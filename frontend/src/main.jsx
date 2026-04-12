import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Note: StrictMode is intentionally removed because it double-invokes effects in dev,
// which would consume burn-after-read pastes before the user sees them.
createRoot(document.getElementById('root')).render(<App />)
