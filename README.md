# Follower Intel

Authenticate with your X (Twitter) account and analyze all your followers.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                              │
│                  React + Vite + Tailwind                    │
│                     localhost:5173                          │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTP / SSE
┌───────────────────────▼─────────────────────────────────────┐
│                    Express Backend                          │
│                     localhost:3001                          │
│                                                             │
│  /auth/twitter        → OAuth 2.0 PKCE login flow          │
│  /auth/twitter/callback → Exchange code for token          │
│  /auth/me             → Get current session user           │
│  /api/followers/all   → SSE stream all followers           │
│  /api/verified-followers/all → SSE stream verified only    │
└───────────┬───────────────────────────┬─────────────────────┘
            │                           │
┌───────────▼──────────┐   ┌────────────▼────────────────────┐
│   Twitter API v2     │   │         RapidAPI                │
│  (OAuth 2.0 login)   │   │  twitter283.p.rapidapi.com      │
│  developer.twitter   │   │  UserFollowers (paginated)      │
│  .com                │   │  UserVerifiedFollowers          │
└──────────────────────┘   └─────────────────────────────────┘
```

### How the follower fetch works

The RapidAPI returns followers in pages of ~20 using cursor-based pagination.
The backend loops through all pages server-side and streams each batch to the
browser via **Server-Sent Events (SSE)** so cards appear in real-time as data
arrives. A safety cap of 100 pages (~2,000 followers) is set by default.

```
Backend                          Frontend
  │                                 │
  │──── SSE connection open ────────│
  │                                 │
  │  fetch page 1 → parse           │
  │──── event: followers (20) ─────►│ render 20 cards
  │                                 │
  │  fetch page 2 → parse           │
  │──── event: followers (20) ─────►│ render 20 more
  │  ...                            │
  │──── event: done ───────────────►│ show total count
  │                                 │
  │  (then stream verified          │
  │   followers the same way)       │
```

---

## Running locally

### Prerequisites

- Node.js 18+
- A [Twitter Developer App](https://developer.twitter.com) with OAuth 2.0 enabled
- A [RapidAPI](https://rapidapi.com) key subscribed to the `twitter283` API

### 1. Clone and install

```bash
git clone https://github.com/Orqys/synapse.git
cd synapse

# Install backend deps
cd backend && npm install

# Install frontend deps
cd ../frontend && npm install
```

### 2. Configure environment

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:

```env
# Twitter Developer App
# → developer.twitter.com → your app → Keys and Tokens → OAuth 2.0
# App must be inside a Project (developer portal → Create Project)
TWITTER_CLIENT_ID=your_client_id
TWITTER_CLIENT_SECRET=your_client_secret
TWITTER_CALLBACK_URL=http://localhost:3001/auth/twitter/callback

# RapidAPI
# → rapidapi.com → your app → Authorization tab
RAPIDAPI_KEY=your_rapidapi_key

# Session (any random string — generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
SESSION_SECRET=your_random_secret

# URLs
FRONTEND_URL=http://localhost:5173
PORT=3001
```

### 3. Twitter app setup

In the [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard):

1. Create a **Project** and attach your app to it (required for API v2)
2. Go to your app → **User authentication settings** → Set up
   - App type: **Confidential client**
   - Callback URI: `http://localhost:3001/auth/twitter/callback`
   - Website URL: `http://localhost:3001`
3. Go to **Keys and Tokens** → regenerate **OAuth 2.0 Client ID and Secret**

### 4. Start both servers

Open two terminals:

```bash
# Terminal 1 — backend
cd backend && npm run dev

# Terminal 2 — frontend
cd frontend && npm run dev
```

Open **http://localhost:5173**

---

## Project structure

```
synapse/
├── backend/
│   ├── src/
│   │   ├── index.ts          # Express app, session, CORS
│   │   ├── types.ts          # Session type augmentation
│   │   └── routes/
│   │       ├── auth.ts       # Twitter OAuth 2.0 flow
│   │       └── followers.ts  # RapidAPI proxy + SSE streaming
│   ├── .env.example
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── App.tsx            # Router
    │   ├── pages/
    │   │   ├── LoginPage.tsx  # Login with X button
    │   │   └── Dashboard.tsx  # Follower grid + live progress
    │   ├── components/
    │   │   └── FollowerCard.tsx
    │   ├── lib/
    │   │   └── api.ts         # HTTP + SSE client
    │   └── types.ts
    └── package.json
```

## Roadmap

- [ ] Persist followers to MongoDB (fetch once, load instantly)
- [ ] Background job queue for large accounts (100k+ followers)
- [ ] Per-follower tweet fetching
- [ ] Follower scoring (engagement rate, activity, credibility)
- [ ] Delta sync (only fetch new followers since last run)
