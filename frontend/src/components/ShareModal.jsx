import { useState } from 'react';

export default function ShareModal({ url, options, onClose }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
      const el = document.createElement('textarea');
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal glass-card">
        <div className="modal-header">
          <div className="modal-success-icon">🔐</div>
          <h2>Paste encrypted!</h2>
          <p>Share this link. The decryption key lives only in the <code>#fragment</code> — your server never sees it.</p>
        </div>
        <div className="modal-body">
          <div className="link-box">
            <span className="link-url" title={url}>{url}</span>
            <button
              id="copy-link-btn"
              className={`btn-copy ${copied ? 'copied' : ''}`}
              onClick={copy}
            >
              {copied ? '✓ Copied!' : 'Copy'}
            </button>
          </div>

          <div className="modal-note">
            <span>🛡️</span>
            <span>
              The <code>#key=…</code> fragment is never sent to the server by browsers.
              Only someone with this full URL can decrypt the content.
            </span>
          </div>

          <div className="options-pills">
            {options.burnAfterRead && (
              <span className="pill pill-burn">🔥 Burns after first read</span>
            )}
            {options.expiry !== 'never' && (
              <span className="pill pill-expiry">⏱ Expires in {options.expiry}</span>
            )}
          </div>

          <button className="btn-close-modal" onClick={onClose}>
            Create another paste
          </button>
        </div>
      </div>
    </div>
  );
}
