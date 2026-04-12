# 🔐 ZeroPaste

> **A pastebin where the server literally cannot read your data.**

ZeroPaste is a self-hostable, zero-knowledge pastebin. All encryption and decryption happens entirely in your browser using the **WebCrypto API (AES-256-GCM)**. The decryption key never touches the server — it's embedded only in the **URL fragment** (`#key=...`), which browsers never send to servers.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔒 **End-to-end encryption** | AES-256-GCM via the browser's native WebCrypto API |
| 🔑 **Zero-knowledge** | The key lives only in the URL fragment — never sent to the server |
| 🔥 **Burn after read** | Paste is atomically deleted on the first access |
| ⏱ **TTL expiry** | Redis-backed TTLs: 5m, 1h, 24h, 7d, 30d |
| 📁 **Binary file uploads** | Files encrypted in 10MB chunks; reconstructed in-browser |
| 👁 **Ghost Viewer** | Real-time viewer count via WebSocket (server never sees content) |
| 🐳 **Self-hostable** | Full Docker Compose setup with PostgreSQL + Redis |

---

## 🏗️ Architecture

```
Browser (React + WebCrypto)
    │
    ├── POST /api/pastes  ──▶  FastAPI  ──▶  PostgreSQL (encrypted blob only)
    │                                  ──▶  Redis     (TTL tracking)
    │
    └── WS /ws/presence/{id}  ──▶  FastAPI  ──▶  Redis Pub/Sub (viewer count)

URL: https://zeropaste.example.com/paste/{id}#key={base64_aes_key}
                                              ^^^^^^^^^^^^^^^^^^^^^^^^
                                              Never sent to server (fragment)
```

### Paste Creation Flow
1. Browser generates a fresh random 256-bit AES key and 96-bit IV
2. Content/file is encrypted locally using `AES-GCM`
3. Encrypted blob + IV + metadata are POSTed to the server
4. Server stores only ciphertext — it is cryptographically impossible for the server to decrypt it
5. Browser composes the share URL: `https://domain/paste/{id}#key={exportedKey}`

### Paste Viewing Flow
1. Recipient opens the URL; browser extracts the key from the `#fragment`
2. WebSocket connected for Ghost Viewer presence
3. Server fetches and returns the encrypted blob
4. If burn-after-read: server atomically deletes the record and broadcasts `paste_burned` over WebSocket
5. Browser decrypts and renders — nothing decrypted ever leaves the browser

---

## 🚀 Quick Start (Docker)

```bash
# Clone the repo
git clone https://github.com/ArrrrrpitD/Zero-Knowledge-Pastebin.git
cd zeropaste

# Start infrastructure (PostgreSQL + Redis + FastAPI backend)
docker compose up -d

# Install and start the frontend
cd frontend
npm install
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173).

---

## 🛠️ Local Development (without Docker)

### Prerequisites
- Python 3.12+
- Node.js 20+
- PostgreSQL 16
- Redis 7

### Backend
```bash
cd backend

# Create a virtual environment
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy and configure environment
cp ../.env.example .env
# Edit .env if your DB/Redis are on different ports

# Run the server
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## 🌍 Environment Variables

Copy `.env.example` to `backend/.env`:

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://zeropaste:zeropaste@localhost:5432/zeropaste` | PostgreSQL async connection string |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis connection string |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allowed origins |

---

## 🔬 Security Model

- **AES-256-GCM** provides authenticated encryption — any tampering with the ciphertext will cause decryption to fail.
- **The URL fragment (#key=...)** is never sent over HTTP by browsers. It exists only in the client.
- **Burn-after-read** is handled atomically in a single DB transaction — even concurrent requests race to delete the row first.
- **The server never logs or processes the plaintext** — it only stores and retrieves opaque base64 blobs.

> ⚠️ **Note:** ZeroPaste does not protect against a malicious server operator who replaces the frontend code with a key-stealing version. For maximum security, self-host and audit the code.

---

## 📂 Project Structure

```
Zero Knowledge Pastebin/
├── frontend/                 # React + Vite
│   ├── src/
│   │   ├── services/
│   │   │   ├── crypto.js     # WebCrypto API — keygen, encrypt, decrypt
│   │   │   └── api.js        # REST + WebSocket client
│   │   ├── components/
│   │   │   ├── Navbar.jsx
│   │   │   ├── Footer.jsx
│   │   │   ├── OptionsPanel.jsx
│   │   │   └── ShareModal.jsx
│   │   └── pages/
│   │       ├── HomePage.jsx
│   │       ├── ViewPastePage.jsx
│   │       └── NotFoundPage.jsx
│   └── vite.config.js
├── backend/                  # FastAPI (Python)
│   ├── main.py               # App entry point
│   ├── config.py             # Settings / .env
│   ├── database.py           # SQLAlchemy async
│   ├── redis_client.py       # Redis connection
│   ├── models.py             # ORM model
│   ├── schemas.py            # Pydantic schemas
│   └── routers/
│       ├── pastes.py         # POST/GET paste endpoints
│       └── presence.py       # WebSocket ghost viewer
├── docker-compose.yml
└── .env.example
```

---

## 📄 License

MIT
