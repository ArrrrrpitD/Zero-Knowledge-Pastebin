import { Link } from 'react-router-dom';

export default function Navbar() {
  return (
    <nav className="navbar">
      <div className="container navbar-inner">
        <Link to="/" className="logo">
          <div className="logo-icon">🔒</div>
          <div>
            <div className="logo-text">ZeroPaste</div>
            <div className="logo-tagline">// end-to-end encrypted</div>
          </div>
        </Link>
        <div className="navbar-badge">
          <span className="badge-dot" />
          server-blind
        </div>
      </div>
    </nav>
  );
}
