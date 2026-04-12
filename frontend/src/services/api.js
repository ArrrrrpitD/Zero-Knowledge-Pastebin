/**
 * ApiService - All REST API calls and WebSocket management.
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Creates a new paste on the server.
 * @param {object} payload
 * @returns {Promise<{id: string}>}
 */
export async function createPaste(payload) {
  const response = await fetch(`${BASE_URL}/api/pastes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(err.detail || 'Failed to create paste');
  }
  return response.json();
}

/**
 * Retrieves a paste from the server by ID.
 * @param {string} id
 * @returns {Promise<object>}
 */
export async function getPaste(id) {
  const response = await fetch(`${BASE_URL}/api/pastes/${id}`);
  if (response.status === 404) throw new Error('PASTE_NOT_FOUND');
  if (response.status === 410) throw new Error('PASTE_BURNED');
  if (!response.ok) throw new Error('Failed to retrieve paste');
  return response.json();
}

/**
 * Creates and manages a WebSocket connection for paste presence.
 * @param {string} pasteId
 * @param {object} callbacks - { onPresenceUpdate, onPasteBurned, onError }
 * @returns {{ disconnect: Function }}
 */
export function connectPresence(pasteId, { onPresenceUpdate, onPasteBurned, onError } = {}) {
  const wsBaseUrl = BASE_URL.replace(/^http/, 'ws');
  const ws = new WebSocket(`${wsBaseUrl}/ws/presence/${pasteId}`);

  ws.onopen = () => {
    console.log(`[WS] Connected to presence channel for paste: ${pasteId}`);
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'presence_update' && onPresenceUpdate) {
        onPresenceUpdate(msg.count);
      }
      if (msg.type === 'paste_burned' && onPasteBurned) {
        onPasteBurned();
      }
    } catch (e) {
      console.error('[WS] Failed to parse message', event.data);
    }
  };

  ws.onerror = (event) => {
    console.error('[WS] Error', event);
    if (onError) onError(event);
  };

  ws.onclose = () => {
    console.log('[WS] Disconnected from presence channel');
  };

  return {
    disconnect: () => ws.close(),
  };
}
