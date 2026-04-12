import { useState, useRef } from 'react';
import { generateKey, exportKey, encryptText, encryptFile } from '../services/crypto';
import { createPaste } from '../services/api';
import OptionsPanel from '../components/OptionsPanel';
import ShareModal from '../components/ShareModal';

const EXPIRY_SECONDS = {
  never: null,
  '5m': 300,
  '1h': 3600,
  '24h': 86400,
  '7d': 604800,
  '30d': 2592000,
};

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function HomePage() {
  const [tab, setTab] = useState('text'); // 'text' | 'file'
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [options, setOptions] = useState({ expiry: 'never', burnAfterRead: false });
  const [loading, setLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFile = (f) => {
    if (!f) return;
    if (f.size > 10 * 1024 * 1024 * 10) { // 100MB hard cap (10x 10MB chunks)
      setError('File exceeds the maximum allowed size.');
      return;
    }
    setFile(f);
    setError(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleSubmit = async () => {
    setError(null);
    if (tab === 'text' && !text.trim()) {
      setError('Please enter some content to encrypt.');
      return;
    }
    if (tab === 'file' && !file) {
      setError('Please select a file to encrypt.');
      return;
    }

    setLoading(true);
    try {
      const key = await generateKey();
      const keyString = await exportKey(key);

      let payload;

      if (tab === 'text') {
        const { iv, ciphertext } = await encryptText(key, text);
        payload = {
          type: 'text',
          iv,
          ciphertext,
          expiry_seconds: EXPIRY_SECONDS[options.expiry],
          burn_after_read: options.burnAfterRead,
        };
      } else {
        const fileData = await encryptFile(key, file);
        payload = {
          type: 'file',
          file_name: fileData.fileName,
          mime_type: fileData.mimeType,
          total_size: fileData.totalSize,
          chunks: fileData.chunks,
          expiry_seconds: EXPIRY_SECONDS[options.expiry],
          burn_after_read: options.burnAfterRead,
        };
      }

      const { id } = await createPaste(payload);
      const shareLink = `${window.location.origin}/paste/${id}#key=${keyString}`;
      setShareUrl(shareLink);
    } catch (e) {
      console.error(e);
      setError(e.message || 'Encryption or upload failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setShareUrl(null);
    setText('');
    setFile(null);
    setOptions({ expiry: 'never', burnAfterRead: false });
    setError(null);
  };

  const canSubmit = tab === 'text' ? text.trim().length > 0 : !!file;

  return (
    <main className="home-page">
      <div className="container">
        <div className="home-header">
          <h1>Paste, but the server<br />literally can't read it.</h1>
          <p>
            End-to-end encrypted using the WebCrypto API. The decryption key
            never touches our servers — it lives only in your URL.
          </p>
          <div className="features-strip">
            <span className="feature-chip">🔒 AES-256-GCM</span>
            <span className="feature-chip">🔑 Zero-knowledge</span>
            <span className="feature-chip">🔥 Burn after read</span>
            <span className="feature-chip">👁 Ghost viewer</span>
            <span className="feature-chip">📁 File upload</span>
          </div>
        </div>

        {/* Editor Card */}
        <div className="glass-card editor-area">
          {/* Toolbar Tabs */}
          <div className="editor-toolbar">
            <button
              id="tab-text-btn"
              className={`tab-btn ${tab === 'text' ? 'active' : ''}`}
              onClick={() => setTab('text')}
            >
              📝 Text / Code
            </button>
            <button
              id="tab-file-btn"
              className={`tab-btn ${tab === 'file' ? 'active' : ''}`}
              onClick={() => setTab('file')}
            >
              📁 File Upload
            </button>
          </div>

          {/* Content Area */}
          {tab === 'text' ? (
            <textarea
              id="paste-editor"
              className="code-editor"
              placeholder="Paste your secret text, code, tokens, or credentials here…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              spellCheck={false}
            />
          ) : (
            <>
              {file ? (
                <div className="file-selected">
                  <span className="file-icon">📄</span>
                  <div className="file-info">
                    <div className="file-info-name">{file.name}</div>
                    <div className="file-info-size">{formatFileSize(file.size)}</div>
                  </div>
                  <button className="file-remove" onClick={() => setFile(null)}>✕</button>
                </div>
              ) : (
                <div
                  className={`drop-zone ${dragging ? 'dragging' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <span className="drop-zone-icon">☁️</span>
                  <h3>Drop a file here</h3>
                  <p>or click to browse · max 100MB · encrypted in chunks</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={(e) => handleFile(e.target.files[0])}
                    style={{ display: 'none' }}
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* Options */}
        <OptionsPanel options={options} onChange={setOptions} />

        {/* Error */}
        {error && (
          <div style={{
            marginTop: 16,
            padding: '12px 16px',
            background: 'rgba(255,69,105,0.1)',
            border: '1px solid rgba(255,69,105,0.3)',
            borderRadius: 8,
            color: 'var(--danger)',
            fontSize: 14,
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Submit Button */}
        <button
          id="encrypt-submit-btn"
          className={`btn-encrypt ${loading ? 'loading' : ''}`}
          onClick={handleSubmit}
          disabled={loading || !canSubmit}
        >
          {loading ? (
            <>
              <span className="spinner" />
              Encrypting in browser…
            </>
          ) : (
            <>🔐 Encrypt &amp; Generate Link</>
          )}
        </button>
      </div>

      {/* Share Modal */}
      {shareUrl && (
        <ShareModal
          url={shareUrl}
          options={options}
          onClose={reset}
        />
      )}
    </main>
  );
}
