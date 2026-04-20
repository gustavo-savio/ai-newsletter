/**
 * AI & Tech Newsletter — Main Entry Point
 * Classification is done server-side via AI. _tag field comes pre-set from the API.
 */

// ─── Config ──────────────────────────────────────────────────────────────────

const CONFIG = {
  API_ENDPOINT: '/api/news',
  REFRESH_INTERVAL_MS: 10 * 60 * 1000,
  READING_SPEED_WPM: 200,
  FALLBACK_ICONS: [
    'fa-microchip', 'fa-code', 'fa-flask', 'fa-bolt',
    'fa-globe', 'fa-satellite', 'fa-dna', 'fa-shield-halved',
  ],
};

// ─── Category Map (tag → display) ────────────────────────────────────────────

const CATEGORIES = {
  ai:       { label: 'AI',       icon: 'fa-microchip',     cssTag: 'ai'       },
  games:    { label: 'Games',    icon: 'fa-gamepad',       cssTag: 'games'    },
  security: { label: 'Security', icon: 'fa-shield-halved', cssTag: 'security' },
  hardware: { label: 'Hardware', icon: 'fa-server',        cssTag: 'hardware' },
  startup:  { label: 'Startup',  icon: 'fa-rocket',        cssTag: 'startup'  },
  business: { label: 'Business', icon: 'fa-chart-line',    cssTag: 'business' },
  software: { label: 'Software', icon: 'fa-code',          cssTag: 'software' },
  tech:     { label: 'Tech',     icon: 'fa-newspaper',     cssTag: 'default'  },
};

const getCategory = (tag) => CATEGORIES[tag] ?? CATEGORIES.tech;

// ─── Time Utilities ───────────────────────────────────────────────────────────

const formatRelativeTime = (isoDate) => {
  if (!isoDate) return '';
  const diff    = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1)  return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)   return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const estimateReadTime = (text = '') => {
  const words   = text.trim().split(/\s+/).length;
  const minutes = Math.max(1, Math.round(words / CONFIG.READING_SPEED_WPM));
  return `${minutes} min read`;
};

// ─── Domain Extraction ────────────────────────────────────────────────────────

const extractDomain = (url) => {
  try { return new URL(url).hostname.replace('www.', ''); }
  catch { return ''; }
};

const getFaviconUrl = (url) => {
  const domain = extractDomain(url);
  return domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=32` : '';
};

// ─── HTML Helpers ─────────────────────────────────────────────────────────────

const escapeHtml = (str = '') =>
  str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const pickFallbackIcon = (title = '') => {
  const idx = [...title].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return CONFIG.FALLBACK_ICONS[idx % CONFIG.FALLBACK_ICONS.length];
};

const makeFallbackIcon = (title) =>
  `<i class="fa-solid ${pickFallbackIcon(title)}" style="font-size:2.5rem;color:var(--color-text-muted);" aria-hidden="true"></i>`;

const makeTag = (tag) => {
  const cat = getCategory(tag);
  return `<span class="tag tag--${cat.cssTag}" aria-label="Category: ${cat.label}"><i class="fa-solid ${cat.icon}"></i> ${cat.label}</span>`;
};

// ─── Image Builder ────────────────────────────────────────────────────────────

const renderImage = ({ urlToImage, title, cssClass, wrapperClass }) => {
  const fallbackCls  = cssClass.replace('__image', '__image-fallback');
  const fallbackHtml = makeFallbackIcon(title);

  if (urlToImage) {
    return `<div class="${wrapperClass}">
      <img class="${cssClass}" src="${escapeHtml(urlToImage)}" alt="${escapeHtml(title)}"
           loading="lazy" width="600" height="338"
           onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />
      <div class="${fallbackCls}" style="display:none">${fallbackHtml}</div>
    </div>`;
  }
  return `<div class="${wrapperClass}"><div class="${fallbackCls}">${fallbackHtml}</div></div>`;
};

// ─── Card Builders ────────────────────────────────────────────────────────────

const buildNewsCard = (article) => {
  const tag      = article._tag ?? 'tech';
  const domain   = extractDomain(article.url);
  const favicon  = getFaviconUrl(article.url);
  const relTime  = formatRelativeTime(article.publishedAt);

  const faviconHtml = favicon
    ? `<img class="source-badge__favicon" src="${escapeHtml(favicon)}" alt="" width="16" height="16" />`
    : '';

  return `
    <a href="${escapeHtml(article.url)}" target="_blank" rel="noopener noreferrer"
       class="news-card" aria-label="Read: ${escapeHtml(article.title)}">
      ${renderImage({ urlToImage: article.urlToImage, title: article.title ?? '', cssClass: 'news-card__image', wrapperClass: 'news-card__image-wrapper' })}
      <div class="news-card__body">
        <div class="news-card__meta">${makeTag(tag)}</div>
        <h2 class="news-card__title">${escapeHtml(article.title ?? 'Untitled')}</h2>
        ${article.description ? `<p class="news-card__description">${escapeHtml(article.description)}</p>` : ''}
        <div class="news-card__footer">
          <div class="source-badge">
            ${faviconHtml}
            <span class="source-badge__name">${escapeHtml(domain || article.source?.name || 'Unknown')}</span>
          </div>
          <span class="news-card__time">${relTime}</span>
        </div>
      </div>
    </a>`;
};

const buildFeaturedCard = (article) => {
  const tag      = article._tag ?? 'tech';
  const domain   = extractDomain(article.url);
  const favicon  = getFaviconUrl(article.url);
  const relTime  = formatRelativeTime(article.publishedAt);
  const readTime = estimateReadTime(
    (article.title ?? '') + ' ' + (article.description ?? '') + ' ' + (article.content ?? '')
  );

  const faviconHtml = favicon
    ? `<img class="source-badge__favicon" src="${escapeHtml(favicon)}" alt="" width="16" height="16" />`
    : '';

  return `
    <a href="${escapeHtml(article.url)}" target="_blank" rel="noopener noreferrer"
       class="featured-card" aria-label="Featured: ${escapeHtml(article.title)}">
      <span class="featured-card__badge">
        <i class="fa-solid fa-bolt" aria-hidden="true"></i> Featured
      </span>
      ${renderImage({ urlToImage: article.urlToImage, title: article.title ?? '', cssClass: 'featured-card__image', wrapperClass: 'featured-card__image-wrapper' })}
      <div class="featured-card__body">
        <div class="news-card__meta">
          ${makeTag(tag)}
          <span class="live-badge">
            <i class="fa-solid fa-circle" style="font-size:0.45rem" aria-hidden="true"></i> Live
          </span>
        </div>
        <h2 class="featured-card__title">${escapeHtml(article.title ?? 'Untitled')}</h2>
        ${article.description ? `<p class="featured-card__description">${escapeHtml(article.description)}</p>` : ''}
        <div class="source-badge">
          ${faviconHtml}
          <span class="source-badge__name">${escapeHtml(domain || article.source?.name || 'Unknown')}</span>
          <span class="source-badge__name">·</span>
          <span class="source-badge__name">${relTime}</span>
          <span class="source-badge__name">·</span>
          <span class="source-badge__name">${readTime}</span>
        </div>
        <span class="featured-card__cta">
          Read story <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
        </span>
      </div>
    </a>`;
};

// ─── Skeleton Loaders ─────────────────────────────────────────────────────────

const buildFeaturedSkeleton = () => `
  <div class="skeleton-featured" aria-hidden="true">
    <div class="skeleton skeleton-featured__image"></div>
    <div class="skeleton-featured__body">
      <div class="skeleton skeleton-featured__tag"></div>
      <div class="skeleton skeleton-featured__title-1"></div>
      <div class="skeleton skeleton-featured__title-2"></div>
      <div class="skeleton skeleton-featured__desc-1"></div>
      <div class="skeleton skeleton-featured__desc-2"></div>
      <div class="skeleton skeleton-featured__desc-3"></div>
      <div class="skeleton skeleton-featured__cta"></div>
    </div>
  </div>`;

const buildCardSkeleton = () => `
  <div class="skeleton-card" aria-hidden="true">
    <div class="skeleton skeleton-card__image"></div>
    <div class="skeleton-card__body">
      <div class="skeleton skeleton-card__tag"></div>
      <div class="skeleton skeleton-card__title-1"></div>
      <div class="skeleton skeleton-card__title-2"></div>
      <div class="skeleton skeleton-card__desc-1"></div>
      <div class="skeleton skeleton-card__desc-2"></div>
    </div>
  </div>`;

// ─── Data Fetching ────────────────────────────────────────────────────────────

const fetchArticles = async () => {
  const response = await fetch(CONFIG.API_ENDPOINT);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  const data = await response.json();
  if (data.status === 'error') throw new Error(data.message ?? 'API error');
  return (data.articles ?? []).filter(a => a.title && a.title !== '[Removed]');
};

// ─── State ────────────────────────────────────────────────────────────────────

let allArticles  = [];
let activeFilter = 'all';

const getFilteredArticles = () =>
  activeFilter === 'all'
    ? allArticles
    : allArticles.filter(a => (a._tag ?? 'tech') === activeFilter);

// ─── Render ───────────────────────────────────────────────────────────────────

const renderArticles = () => {
  const featured = document.getElementById('featured-article');
  const grid     = document.getElementById('news-grid');
  const count    = document.getElementById('article-count');
  const filtered = getFilteredArticles();

  if (!featured || !grid) return;

  if (filtered.length === 0) {
    featured.innerHTML = '';
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <i class="fa-solid fa-inbox" style="font-size:2rem;color:var(--color-text-muted);margin-bottom:1rem;" aria-hidden="true"></i>
      <p>No articles found for this category.</p>
    </div>`;
    if (count) count.textContent = '0 articles';
    return;
  }

  const [hero, ...rest] = filtered;
  featured.innerHTML = buildFeaturedCard(hero);
  grid.innerHTML     = rest.map(buildNewsCard).join('');
  if (count) count.textContent = `${filtered.length} articles`;
};

// ─── Loading & Error States ───────────────────────────────────────────────────

const showLoading = () => {
  const featured = document.getElementById('featured-article');
  const grid     = document.getElementById('news-grid');
  if (featured) featured.innerHTML = buildFeaturedSkeleton();
  if (grid)     grid.innerHTML     = Array.from({ length: 9 }, buildCardSkeleton).join('');
};

const showError = (message) => {
  const featured = document.getElementById('featured-article');
  const grid     = document.getElementById('news-grid');
  if (featured) featured.innerHTML = '';
  if (grid) grid.innerHTML = `
    <div class="error-state" style="grid-column:1/-1">
      <i class="fa-solid fa-triangle-exclamation fa-2x" style="color:var(--color-feedback-warning);margin-bottom:1rem;" aria-hidden="true"></i>
      <h2 class="error-state__title">Could not load articles</h2>
      <p class="error-state__message">${escapeHtml(message)}</p>
      <button class="btn btn--ghost" id="retry-btn">
        <i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Try again
      </button>
    </div>`;
};

// ─── Filter Chips ─────────────────────────────────────────────────────────────

const initFilters = () => {
  const filterBar = document.getElementById('filter-bar');
  if (!filterBar) return;

  filterBar.addEventListener('click', (e) => {
    const chip = e.target.closest('.filter-chip');
    if (!chip) return;

    const filter = chip.dataset.filter ?? 'all';
    if (filter === activeFilter) return;

    activeFilter = filter;

    filterBar.querySelectorAll('.filter-chip').forEach(c => {
      c.classList.remove('is-active');
      c.setAttribute('aria-pressed', 'false');
    });
    chip.classList.add('is-active');
    chip.setAttribute('aria-pressed', 'true');

    renderArticles();
  });
};

// ─── Live Clock ───────────────────────────────────────────────────────────────

const startClock = () => {
  const el = document.getElementById('live-time');
  if (!el) return;
  const tick = () => {
    el.textContent = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
    });
  };
  tick();
  setInterval(tick, 30_000);
};

// ─── Auto-refresh ─────────────────────────────────────────────────────────────

const scheduleRefresh = () => {
  setInterval(async () => {
    try {
      allArticles = await fetchArticles();
      renderArticles();
    } catch { /* silent */ }
  }, CONFIG.REFRESH_INTERVAL_MS);
};

// ─── Bootstrap ───────────────────────────────────────────────────────────────

const init = async () => {
  initFilters();
  startClock();
  showLoading();

  document.addEventListener('click', async (e) => {
    if (e.target.closest('#retry-btn')) {
      showLoading();
      try {
        allArticles = await fetchArticles();
        renderArticles();
      } catch (err) {
        showError(err.message);
      }
    }
  });

  try {
    allArticles = await fetchArticles();
    renderArticles();
    scheduleRefresh();
  } catch (err) {
    showError(err.message);
  }
};

document.addEventListener('DOMContentLoaded', init);