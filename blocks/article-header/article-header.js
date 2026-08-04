// Article Header — eyebrow (with optional link), title, description, date, read time.
// Cell order matches the model: eyebrow, eyebrowLink, title, description,
// articleDate, hideReadTime.
//
// Eyebrow Title and Eyebrow Link are authored: the label is the eyebrow text and
// the link is an aem-content reference to the parent "category" page. The link
// is rendered exactly as authored — no rewriting — so the author-selected path
// (and its MSM-rewritten locale after rollout) is preserved verbatim.

const WORDS_PER_MINUTE = 200;

function cellText(row) {
  return row ? row.textContent.trim() : '';
}

function estimateReadTime() {
  const body = document.querySelector('main');
  const words = body ? body.textContent.trim().split(/\s+/).length : 0;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

// Render the article date as MM-DD-YYYY, handling both the new date-time picker
// values (ISO, e.g. 2026-07-20 or 2026-07-20T00:00:00.000Z) and the legacy
// migrated plain-text dates (already MM-DD-YYYY). Uses UTC parts to avoid a
// timezone off-by-one. Returns '' for blank/unparseable input.
function formatArticleDate(raw) {
  const s = (raw || '').trim();
  if (!s) return '';
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(s)) return s; // legacy MM-DD-YYYY, keep as-is
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/); // ISO date or datetime
  if (iso) { const [, y, m, d] = iso; return `${m}-${d}-${y}`; }
  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) return '';
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${mm}-${dd}-${dt.getUTCFullYear()}`;
}

export default function decorate(block) {
  const rows = [...block.children];
  const [eyebrowRow, eyebrowLinkRow, titleRow, descRow, dateRow, hideReadRow] = rows;

  // Eyebrow Link + Title: authored. Link is the author-selected aem-content
  // path, used exactly as-is (no rewrite).
  const eyebrowHref = eyebrowLinkRow?.querySelector('a')?.getAttribute('href')
    || cellText(eyebrowLinkRow);
  const eyebrowText = cellText(eyebrowRow);

  const titleEl = titleRow?.querySelector('h1, h2, h3') || titleRow;
  const descEl = descRow?.querySelector('p') || descRow;
  const dateText = formatArticleDate(cellText(dateRow));
  const hideReadTime = /^(true|yes|on)$/i.test(cellText(hideReadRow));

  const header = document.createElement('div');
  header.className = 'article-header-content';

  if (eyebrowText) {
    const eyebrow = document.createElement('p');
    eyebrow.className = 'article-header-eyebrow';
    if (eyebrowHref) {
      const a = document.createElement('a');
      a.href = eyebrowHref;
      a.textContent = eyebrowText;
      eyebrow.append(a);
    } else {
      eyebrow.textContent = eyebrowText;
    }
    header.append(eyebrow);
  }

  if (titleEl && titleEl.textContent.trim()) {
    const h1 = document.createElement('h1');
    h1.className = 'article-header-title';
    h1.textContent = titleEl.textContent.trim();
    header.append(h1);
  }

  const byline = document.createElement('p');
  byline.className = 'article-header-byline';
  if (dateText) {
    const dateSpan = document.createElement('span');
    dateSpan.className = 'article-header-date';
    dateSpan.textContent = dateText;
    byline.append(dateSpan);
  }
  if (!hideReadTime) {
    const readSpan = document.createElement('span');
    readSpan.className = 'article-header-readtime';
    readSpan.textContent = `${estimateReadTime()} MIN READ`;
    byline.append(readSpan);
  }
  if (byline.childElementCount) header.append(byline);

  if (descEl && descEl.textContent.trim()) {
    const desc = document.createElement('p');
    desc.className = 'article-header-description';
    desc.textContent = descEl.textContent.trim();
    header.append(desc);
  }

  block.replaceChildren(header);
}
