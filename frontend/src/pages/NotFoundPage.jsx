import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <main className="state-page">
      <div className="state-card glass-card">
        <span className="state-icon">🌌</span>
        <h1 className="state-title">404 — Nothing here</h1>
        <p className="state-desc">
          This page doesn't exist. If you were looking for a paste,
          you may need the complete link with the <code>#key=</code> fragment.
        </p>
        <Link to="/" className="btn-home">← Go home</Link>
      </div>
    </main>
  );
}
