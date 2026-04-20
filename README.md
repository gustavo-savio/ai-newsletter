# AI & Tech Newsletter

A starting point for a tech and AI news aggregator. The idea is simple — a clean feed, auto-updated, easy to replicate using free public APIs.

---

## Stack

| | |
|---|---|
| Frontend | HTML · CSS · Vanilla JS |
| Backend | Node.js · Express |
| News | GNews API |
| Classification | OpenRouter |

---

## Running locally

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env
# Fill in your keys in .env

# 3. Start
npm start         # http://localhost:3000
npm run dev       # with auto-restart
```

---

## Environment variables

```env
GNEWS_API_KEY=your_key
OPENROUTER_API_KEY=your_key
```

- **GNews** → [gnews.io](https://gnews.io) — free, works in production
- **OpenRouter** → [openrouter.ai](https://openrouter.ai/keys) — free, classifies articles by category. Falls back to keyword classification if no key is provided