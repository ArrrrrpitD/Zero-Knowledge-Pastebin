import { useState } from 'react';

const EXPIRY_OPTIONS = [
  { value: 'never', label: 'Never expires' },
  { value: '5m', label: '5 minutes' },
  { value: '1h', label: '1 hour' },
  { value: '24h', label: '24 hours' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
];

export default function OptionsPanel({ options, onChange }) {
  const set = (key, value) => onChange({ ...options, [key]: value });

  return (
    <div className="options-panel glass-card">
      <div className="options-title">🛡️ &nbsp;Security Options</div>
      <div className="options-grid">
        {/* Expiry */}
        <div className="option-item">
          <label className="option-label">
            <span className="option-icon">⏱</span> Expiry
          </label>
          <select
            className="styled-select"
            value={options.expiry}
            onChange={(e) => set('expiry', e.target.value)}
          >
            {EXPIRY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Burn after read */}
        <div className="option-item">
          <label className="option-label">
            <span className="option-icon">🔥</span> Destruction
          </label>
          <div
            className={`toggle-row ${options.burnAfterRead ? 'active' : ''}`}
            onClick={() => set('burnAfterRead', !options.burnAfterRead)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && set('burnAfterRead', !options.burnAfterRead)}
          >
            <div className="toggle-info">
              <div className="toggle-info-title">Burn after read</div>
              <div className="toggle-info-sub">Destruct on first view</div>
            </div>
            <div className={`toggle-switch ${options.burnAfterRead ? 'on' : ''}`}>
              <div className="toggle-knob" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
