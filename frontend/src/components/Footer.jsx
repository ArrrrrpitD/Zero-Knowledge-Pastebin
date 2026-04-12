export default function Footer() {
  return (
    <footer className="footer" style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-color)' }}>
      <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
        <div>
          ZeroPaste — Your data is encrypted before it leaves your browser.
          The server sees only ciphertext. &nbsp;·&nbsp;
          <a href="https://github.com/ArrrrrpitD/Zero-Knowledge-Pastebin" target="_blank" rel="noreferrer">Source Code</a>
        </div>
        <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', opacity: 0.8, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          Crafted with <span style={{ color: '#e25555' }}>♥</span> & cryptography by <a href="https://github.com/ArrrrrpitD" target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>Arpit Dwivedi</a>
        </div>
      </div>
    </footer>
  );
}
