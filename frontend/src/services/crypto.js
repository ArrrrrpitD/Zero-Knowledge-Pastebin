/**
 * CryptoService - All encryption/decryption using browser's WebCrypto API.
 * The key NEVER leaves the browser. It is embedded only in the URL fragment.
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;

/**
 * Generates a new random AES-GCM 256-bit key.
 * @returns {Promise<CryptoKey>}
 */
export async function generateKey() {
  return crypto.subtle.generateKey(
    { name: ALGORITHM, length: KEY_LENGTH },
    true, // extractable
    ['encrypt', 'decrypt']
  );
}

/**
 * Exports a CryptoKey to a URL-safe Base64 string.
 * @param {CryptoKey} key
 * @returns {Promise<string>}
 */
export async function exportKey(key) {
  const raw = await crypto.subtle.exportKey('raw', key);
  return arrayBufferToBase64Url(raw);
}

/**
 * Imports a URL-safe Base64 string back to a CryptoKey.
 * @param {string} b64urlKey
 * @returns {Promise<CryptoKey>}
 */
export async function importKey(b64urlKey) {
  const raw = base64UrlToArrayBuffer(b64urlKey);
  return crypto.subtle.importKey(
    'raw',
    raw,
    { name: ALGORITHM },
    false,
    ['decrypt']
  );
}

/**
 * Encrypts arbitrary ArrayBuffer data with a given key.
 * Returns an object containing the iv and ciphertext as Base64 strings.
 * @param {CryptoKey} key
 * @param {ArrayBuffer} data
 * @returns {Promise<{iv: string, ciphertext: string}>}
 */
export async function encrypt(key, data) {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM
  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    data
  );
  return {
    iv: arrayBufferToBase64(iv.buffer),
    ciphertext: arrayBufferToBase64(ciphertext),
  };
}

/**
 * Decrypts a Base64-encoded ciphertext with the given key and IV.
 * @param {CryptoKey} key
 * @param {string} ivB64
 * @param {string} ciphertextB64
 * @returns {Promise<ArrayBuffer>}
 */
export async function decrypt(key, ivB64, ciphertextB64) {
  const iv = base64ToArrayBuffer(ivB64);
  const ciphertext = base64ToArrayBuffer(ciphertextB64);
  return crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    ciphertext
  );
}

// --- Chunk Encryption for large files ---

const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Encrypts a File object in chunks.
 * @param {CryptoKey} key
 * @param {File} file
 * @returns {Promise<{chunks: Array<{iv:string, ciphertext:string}>, fileName: string, mimeType: string, totalSize: number}>}
 */
export async function encryptFile(key, file) {
  const chunks = [];
  let offset = 0;

  while (offset < file.size) {
    const slice = file.slice(offset, offset + CHUNK_SIZE);
    const buffer = await slice.arrayBuffer();
    const encrypted = await encrypt(key, buffer);
    chunks.push(encrypted);
    offset += CHUNK_SIZE;
  }

  return {
    chunks,
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    totalSize: file.size,
  };
}

/**
 * Encrypts a plain text string.
 * @param {CryptoKey} key
 * @param {string} text
 * @returns {Promise<{iv: string, ciphertext: string}>}
 */
export async function encryptText(key, text) {
  const encoder = new TextEncoder();
  return encrypt(key, encoder.encode(text).buffer);
}

/**
 * Decrypts and returns a plain text string.
 * @param {CryptoKey} key
 * @param {string} ivB64
 * @param {string} ciphertextB64
 * @returns {Promise<string>}
 */
export async function decryptText(key, ivB64, ciphertextB64) {
  const plainBuffer = await decrypt(key, ivB64, ciphertextB64);
  const decoder = new TextDecoder();
  return decoder.decode(plainBuffer);
}

// --- Utility Functions ---

export function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function arrayBufferToBase64Url(buffer) {
  return arrayBufferToBase64(buffer)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function base64UrlToArrayBuffer(b64url) {
  const b64 = b64url
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(b64url.length + (4 - b64url.length % 4) % 4, '=');
  return base64ToArrayBuffer(b64);
}
