import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { importKey, decryptText, decrypt, arrayBufferToBase64 } from '../services/crypto';
import { getPaste, connectPresence } from '../services/api';
import { Link } from 'react-router-dom';

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function GhostViewer({ count }) {
  return (
    <div className="ghost-viewer" title="People currently viewing this paste">
      <span className="ghost-icon">👁</span>
      <span className="ghost-count">{count}</span>
      <span className="ghost-label">{count === 1 ? 'viewer' : 'viewers'} now</span>
    </div>
  );
}

export default function ViewPastePage() {
  const { id } = useParams();
  const [state, setState] = useState('loading'); // loading | decrypting | done | burned | not_found | error | no_key
  const [pasteData, setPasteData] = useState(null);
  const [decryptedText, setDecryptedText] = useState('');
  const [decryptedFile, setDecryptedFile] = useState(null); // { name, mimeType, url, size }
  const [viewerCount, setViewerCount] = useState(1);
  const presenceRef = useRef(null);
  // Guard against double-fetch on remount (e.g. React fast-refresh)
  const hasFetched = useRef(false);

  useEffect(() => {
    // Only run once per mount — critical for burn-after-read correctness
    if (hasFetched.current) return;
    hasFetched.current = true;

    const keyString = window.location.hash.replace('#key=', '');

    if (!keyString) {
      setState('no_key');
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        // Connect to presence WebSocket first
        presenceRef.current = connectPresence(id, {
          onPresenceUpdate: (count) => !cancelled && setViewerCount(count),
          // Only show "burned" screen if we haven't already decrypted the content.
          // If we're the one who triggered the burn, we already have the content
          // and the paste_burned event is our own echo — don't redirect ourselves.
          onPasteBurned: () => {
            if (!cancelled) {
              setState((prev) => {
                // If we're already showing content (done state), ignore the burn event
                if (prev === 'done') return prev;
                return 'burned';
              });
            }
          },
        });

        // Fetch encrypted payload
        let paste;
        try {
          paste = await getPaste(id);
        } catch (e) {
          if (e.message === 'PASTE_NOT_FOUND') { setState('not_found'); return; }
          if (e.message === 'PASTE_BURNED') { setState('burned'); return; }
          throw e;
        }

        if (cancelled) return;
        setState('decrypting');
        setPasteData(paste);

        // Import the key from the fragment
        const key = await importKey(keyString);

        if (paste.type === 'text') {
          const plainText = await decryptText(key, paste.iv, paste.ciphertext);
          if (!cancelled) {
            setDecryptedText(plainText);
            setState('done');
          }
        } else if (paste.type === 'file') {
          // Decrypt each chunk and concatenate
          const buffers = await Promise.all(
            paste.chunks.map((chunk) => decrypt(key, chunk.iv, chunk.ciphertext))
          );
          const totalLength = buffers.reduce((s, b) => s + b.byteLength, 0);
          const combined = new Uint8Array(totalLength);
          let offset = 0;
          for (const buf of buffers) {
            combined.set(new Uint8Array(buf), offset);
            offset += buf.byteLength;
          }
          const blob = new Blob([combined], { type: paste.mime_type });
          const objectUrl = URL.createObjectURL(blob);
          if (!cancelled) {
            setDecryptedFile({
              name: paste.file_name,
              mimeType: paste.mime_type,
              url: objectUrl,
              size: paste.total_size,
            });
            setState('done');
          }
        }
      } catch (e) {
        console.error('Decryption failed:', e);
        if (!cancelled) setState('error');
      }
    };

    load();
    return () => {
      cancelled = true;
      presenceRef.current?.disconnect();
    };
  }, [id]);

  // Cleanup object URLs
  useEffect(() => {
    return () => {
      if (decryptedFile?.url) URL.revokeObjectURL(decryptedFile.url);
    };
  }, [decryptedFile]);

  // ---- Render States ----

  if (state === 'no_key') {
    return (
      <main className="state-page">
        <div className="state-card glass-card">
          <span className="state-icon">🔑</span>
          <h1 className="state-title">Missing decryption key</h1>
          <p className="state-desc">
            The URL is missing the <code>#key=…</code> fragment. The key is never sent to the server —
            you need the full original link to decrypt this paste.
          </p>
          <Link to="/" className="btn-home">← Create a new paste</Link>
        </div>
      </main>
    );
  }

  if (state === 'not_found') {
    return (
      <main className="state-page">
        <div className="state-card glass-card">
          <span className="state-icon">🌀</span>
          <h1 className="state-title">Paste not found</h1>
          <p className="state-desc">
            This paste doesn't exist or has already expired. It may have been burned or its
            TTL ran out.
          </p>
          <Link to="/" className="btn-home">← Create a new paste</Link>
        </div>
      </main>
    );
  }

  if (state === 'burned') {
    return (
      <main className="state-page">
        <div className="state-card glass-card">
          <span className="state-icon">🔥</span>
          <h1 className="state-title">This paste self-destructed</h1>
          <p className="state-desc">
            This paste was set to burn after the first read. It has been permanently
            and irreversibly deleted from the server. Nothing remains.
          </p>
          <Link to="/" className="btn-home">← Create a new paste</Link>
        </div>
      </main>
    );
  }

  if (state === 'loading' || state === 'decrypting') {
    return (
      <main className="view-page">
        <div className="container">
          <div className="glass-card">
            <div className="decrypting-overlay">
              <div className="decrypting-spinner" />
              <span className="decrypting-text">
                {state === 'loading' ? 'Fetching encrypted payload…' : 'Decrypting in browser…'}
              </span>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (state === 'error') {
    return (
      <main className="state-page">
        <div className="state-card glass-card">
          <span className="state-icon">⚠️</span>
          <h1 className="state-title">Decryption failed</h1>
          <p className="state-desc">
            The key in the URL doesn't match this paste, or the data is corrupted.
            Make sure you're using the complete, unmodified link.
          </p>
          <Link to="/" className="btn-home">← Create a new paste</Link>
        </div>
      </main>
    );
  }

  // state === 'done'
  return (
    <main className="view-page">
      <div className="container">
        <div className="view-page-header">
          <div className="view-page-meta">
            <h1>Decrypted Paste</h1>
            <p>id: {id} · decrypted entirely in your browser</p>
          </div>
          <GhostViewer count={viewerCount} />
        </div>

        {/* Metadata chips */}
        <div className="metadata-bar">
          <span className="meta-chip">🔒 AES-256-GCM</span>
          {pasteData?.burn_after_read && (
            <span className="meta-chip meta-chip-burn">🔥 Burned after read</span>
          )}
          {pasteData?.expires_at && (
            <span className="meta-chip">
              ⏱ Expires {new Date(pasteData.expires_at * 1000).toLocaleString()}
            </span>
          )}
          {decryptedFile && (
            <span className="meta-chip">
              📁 {decryptedFile.mimeType}
            </span>
          )}
        </div>

        <div className="glass-card content-viewer">
          {decryptedText && (
            <pre className="content-code">{decryptedText}</pre>
          )}
          {decryptedFile && (
            <div className="file-download">
              <span style={{ fontSize: 48 }}>📄</span>
              <div className="file-download-info">
                <div className="file-download-name">{decryptedFile.name}</div>
                <div className="file-download-meta">
                  {decryptedFile.mimeType} · {formatFileSize(decryptedFile.size)}
                </div>
              </div>
              <a
                id="download-file-btn"
                href={decryptedFile.url}
                download={decryptedFile.name}
                className="btn-download"
              >
                ⬇ Download
              </a>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
