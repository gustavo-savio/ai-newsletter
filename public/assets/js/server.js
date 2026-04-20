import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const ROOT       = resolve(__dirname, "../../..");

dotenv.config({ path: resolve(ROOT, ".env") });

// ─── Validation ───────────────────────────────────────────────────────────────

const GNEWS_API_KEY      = process.env.GNEWS_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const PORT               = parseInt(process.env.PORT ?? "3000", 10);

if (!GNEWS_API_KEY) {
  console.error("[server] ERROR: GNEWS_API_KEY is not set.");
  process.exit(1);
}

if (!OPENROUTER_API_KEY) {
  console.warn("[server] WARN: OPENROUTER_API_KEY not set — using keyword fallback classifier.");
}

// ─── App ──────────────────────────────────────────────────────────────────────

const app = express();

// ─── Security Headers ─────────────────────────────────────────────────────────

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options",  "nosniff");
  res.setHeader("X-Frame-Options",          "DENY");
  res.setHeader("X-XSS-Protection",         "1; mode=block");
  res.setHeader("Referrer-Policy",          "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy",       "geolocation=(), camera=(), microphone=()");
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
      "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com",
      "img-src 'self' data: https:",
      "connect-src 'self'",
    ].join("; ")
  );
  next();
});

// ─── Static Files ─────────────────────────────────────────────────────────────

app.use(express.static(ROOT, { maxAge: "1h" }));

// ─── Cache ────────────────────────────────────────────────────────────────────
// 30 min = 48 ciclos/dia × 2 requests = 96 requests → dentro do free tier (100/dia)

const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2h = 24 requests/day, well within free tier
let cachedArticles = null;
let cacheExpiresAt = 0;

// ─── Keyword Fallback Classifier ──────────────────────────────────────────────

const KEYWORD_RULES = [
  {
    tag: "ai",
    keywords: [
      "artificial intelligence", "machine learning", "llm", "large language model",
      "gpt", "openai", "anthropic", "deep learning", "neural network", "chatbot",
      "gemini", "copilot", "generative ai", "stable diffusion", "mistral",
      "claude", "midjourney", "dall-e", "transformer", "foundation model",
    ],
  },
  {
    tag: "games",
    keywords: [
      "game", "gaming", "gamer", "xbox", "playstation", "nintendo", "steam",
      "esport", "esports", "fortnite", "minecraft", "call of duty", "fifa",
      "console", "indie game", "video game", "rpg", "fps", "mmorpg",
      "activision", "ea games", "ubisoft", "riot games", "epic games",
      "blizzard", "bethesda", "rockstar", "valve",
    ],
  },
  {
    tag: "security",
    keywords: [
      "hack", "breach", "vulnerability", "cybersecurity", "ransomware",
      "malware", "exploit", "zero-day", "phishing", "data leak", "data breach",
      "cyberattack", "spyware", "ddos", "botnet", "encryption",
    ],
  },
  {
    tag: "hardware",
    keywords: [
      "chip", "processor", "cpu", "gpu", "nvidia", "amd", "intel",
      "apple silicon", "semiconductor", "quantum", "electric vehicle",
      "battery", "drone", "robot", "device", "display", "wearable", "headset",
    ],
  },
  {
    tag: "startup",
    keywords: [
      "startup", "funding", "venture capital", "series a", "series b", "series c",
      "ipo", "valuation", "unicorn", "seed round", "raised", "y combinator",
    ],
  },
  {
    tag: "business",
    keywords: [
      "acquisition", "merger", "revenue", "earnings", "profit", "layoff",
      "ceo", "stock", "market cap", "quarterly", "fiscal", "shares",
      "workforce", "partnership", "antitrust", "regulation",
    ],
  },
  {
    tag: "software",
    keywords: [
      "open source", "github", "programming", "developer", "framework",
      "library", "sdk", "typescript", "python", "javascript", "linux",
      "android", "ios", "update", "release", "launch", "version", "app store",
    ],
  },
];

const classifyByKeywords = (article) => {
  const text = [
    article.title ?? "",
    article.description ?? "",
    article.source?.name ?? "",
  ].join(" ").toLowerCase();

  for (const rule of KEYWORD_RULES) {
    if (rule.keywords.some((kw) => text.includes(kw))) return rule.tag;
  }
  return "tech";
};

// ─── AI Classifier via OpenRouter ─────────────────────────────────────────────

const VALID_TAGS = new Set([
  "ai", "games", "security", "hardware", "startup", "business", "software", "tech",
]);

const classifyWithAI = async (articles) => {
  const items = articles.map((a, i) => ({
    id: i,
    title: a.title ?? "",
    description: (a.description ?? "").slice(0, 150),
  }));

  const prompt = `You are a tech news classifier. Classify each article into exactly one category.

Categories:
- ai: artificial intelligence, machine learning, LLMs, chatbots, generative AI
- games: video games, gaming, consoles, esports, game studios
- security: cybersecurity, hacking, data breaches, vulnerabilities, malware
- hardware: chips, CPUs, GPUs, devices, semiconductors, robotics, EVs, gadgets
- startup: startup funding rounds, venture capital, IPOs, unicorns
- business: acquisitions, mergers, earnings, layoffs, CEO news, market moves
- software: apps, open source, programming, frameworks, OS updates, developer tools
- tech: anything else technology-related that doesn't fit the above

Articles:
${JSON.stringify(items, null, 2)}

Respond with ONLY a valid JSON array, no explanation, no markdown:
[{"id":0,"tag":"ai"},{"id":1,"tag":"games"},...]`;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type":  "application/json",
      "HTTP-Referer":  "https://ai-newsletter.app",
      "X-Title":       "AI Newsletter Classifier",
    },
    body: JSON.stringify({
      model: "google/gemma-4-31b-it:free",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 300,
      temperature: 0,
    }),
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) throw new Error(`OpenRouter ${response.status}`);

  const data  = await response.json();
  const raw   = data.choices?.[0]?.message?.content ?? "";

  console.log("[classifier] model response:", raw.slice(0, 400));

  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error(`No JSON array in response. Raw: ${raw.slice(0, 300)}`);

  const parsed = JSON.parse(match[0]);

  const tagMap = {};
  for (const item of parsed) {
    tagMap[item.id] = VALID_TAGS.has(item.tag) ? item.tag : "tech";
  }
  return tagMap;
};

const classifyArticles = async (articles) => {
  if (!OPENROUTER_API_KEY) {
    return articles.map((a) => ({ ...a, _tag: classifyByKeywords(a) }));
  }
  try {
    const tagMap = await classifyWithAI(articles);
    return articles.map((a, i) => ({ ...a, _tag: tagMap[i] ?? classifyByKeywords(a) }));
  } catch (err) {
    console.warn("[classifier] AI failed, using keyword fallback:", err.message);
    return articles.map((a) => ({ ...a, _tag: classifyByKeywords(a) }));
  }
};

// ─── GNews Normalizer ─────────────────────────────────────────────────────────

const normalizeArticle = (article) => ({
  ...article,
  urlToImage: article.image ?? null,
  source: { name: article.source?.name ?? "", id: null },
});

// ─── News Proxy ───────────────────────────────────────────────────────────────

const ALLOWED_LANGUAGES = new Set(["en", "pt", "es", "de", "fr", "ar", "zh"]);
const ALLOWED_COUNTRIES = new Set(["us", "gb", "br", "de", "fr", "au", "ca", "in"]);

app.get("/api/news", async (req, res) => {
  // ── Serve cache se ainda válido ──────────────────────────────────────────
  if (cachedArticles && Date.now() < cacheExpiresAt) {
    console.log("[cache] HIT — serving cached articles");
    return res.json({ status: "ok", articles: cachedArticles, cached: true });
  }

  console.log("[cache] MISS — fetching fresh articles from GNews");

  const lang = ALLOWED_LANGUAGES.has(req.query.language)
    ? req.query.language
    : "en";

  const country = ALLOWED_COUNTRIES.has(req.query.country)
    ? req.query.country
    : "us";

  const buildGNewsUrl = (category) => {
    const u = new URL("https://gnews.io/api/v4/top-headlines");
    u.searchParams.set("category", category);
    u.searchParams.set("lang",     lang);
    u.searchParams.set("country",  country);
    u.searchParams.set("max",      "10");
    u.searchParams.set("apikey",   GNEWS_API_KEY);
    return u.toString();
  };

  try {
    const [res1, res2] = await Promise.all([
      fetch(buildGNewsUrl("technology"), { headers: { "User-Agent": "ai-newsletter/2.0" }, signal: AbortSignal.timeout(8_000) }),
      fetch(buildGNewsUrl("business"),   { headers: { "User-Agent": "ai-newsletter/2.0" }, signal: AbortSignal.timeout(8_000) }),
    ]);

    if (!res1.ok || !res2.ok) {
      const is429 = res1.status === 429 || res2.status === 429;
      console.error(`[api/news] GNews error: ${res1.status} / ${res2.status}`);

      // Serve stale cache rather than erroring out
      if (cachedArticles) {
        console.warn("[cache] Serving stale cache due to upstream error");
        return res.json({ status: "ok", articles: cachedArticles, stale: true });
      }

      const message = is429
        ? "News quota exceeded. Try again later."
        : "Upstream API error.";
      return res.status(502).json({ status: "error", message });
    }

    const [data1, data2] = await Promise.all([res1.json(), res2.json()]);

    // Mescla e deduplica por título
    const seen = new Set();
    const raw  = [...(data1.articles ?? []), ...(data2.articles ?? [])].filter((a) => {
      if (!a.title || a.title === "[Removed]") return false;
      if (seen.has(a.title)) return false;
      seen.add(a.title);
      return true;
    });

    const normalized = raw.map(normalizeArticle);
    const classified = await classifyArticles(normalized);

    // ── Atualiza cache ───────────────────────────────────────────────────
    cachedArticles = classified;
    cacheExpiresAt = Date.now() + CACHE_TTL_MS;
    console.log(`[cache] Updated — next refresh at ${new Date(cacheExpiresAt).toLocaleTimeString()}`);

    res.setHeader("Cache-Control", "public, max-age=120");
    return res.json({ status: "ok", totalArticles: classified.length, articles: classified });

  } catch (err) {
    if (err.name === "TimeoutError") {
      console.error("[api/news] Request timed out");
      return res.status(504).json({ status: "error", message: "Request timed out." });
    }
    console.error("[api/news] Unexpected error:", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
});

// ─── 404 ──────────────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({ status: "error", message: "Not found." });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[server] Running → http://localhost:${PORT}`);
});