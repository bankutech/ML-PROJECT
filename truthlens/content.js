import { injectBadge } from './src/badge.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function extractHeadline() {
  return (
    document.querySelector('h1')?.textContent?.trim() ||
    document.querySelector('meta[property="og:title"]')?.content?.trim() ||
    document.querySelector('meta[name="twitter:title"]')?.content?.trim() ||
    document.title?.trim()
  );
}

function isAnalysable(img) {
  // Skip data-URI, SVGs, tiny icons, already-badged images
  if (!img.src || img.src.startsWith('data:') || img.src.startsWith('blob:')) return false;
  if (img.src.toLowerCase().includes('.svg')) return false;
  if (img.dataset.truthlensId) return false;
  // Require the image to be at least 200×200 (filter out icons/thumbnails)
  const rect = img.getBoundingClientRect();
  const width  = rect.width  || img.naturalWidth  || img.width;
  const height = rect.height || img.naturalHeight || img.height;
  return width >= 200 && height >= 200;
}

// ─── State ────────────────────────────────────────────────────────────────────
const analyzed = new Set();   // img.src strings already processed or in-queue
let running = 0;
const MAX_CONCURRENT = 2;
const queue = [];

let pageMisinfoScore = null;

// ─── Headline analysis ────────────────────────────────────────────────────────
function init() {
  const headline = extractHeadline();
  if (headline) {
    chrome.runtime.sendMessage({ type: 'ANALYZE_HEADLINE', headline })
      .then(result => {
        if (result) {
          pageMisinfoScore = result.score;
          console.log(`[TruthLens] Headline: "${headline}" — misinfo score: ${(pageMisinfoScore * 100).toFixed(1)}%`);
        }
      })
      .catch(() => { /* extension may not be fully ready yet */ });
  }
  document.querySelectorAll('img').forEach(scheduleImage);
}

// ─── Image scheduling ─────────────────────────────────────────────────────────
function scheduleImage(img) {
  if (analyzed.has(img.src) || !isAnalysable(img)) return;
  analyzed.add(img.src);
  // Mark element so MutationObserver skips it if cloned
  img.dataset.truthlensId = img.src;
  queue.push(img);
  drainQueue();
}

async function drainQueue() {
  if (running >= MAX_CONCURRENT || queue.length === 0) return;
  running++;
  const img = queue.shift();

  // Skip if the image was removed from DOM before we got to it
  if (!img.isConnected) {
    running--;
    drainQueue();
    return;
  }

  try {
    // Grab surrounding context (alt text + nearby text) to catch obvious AI captions
    const altText = (img.alt || img.title || '').substring(0, 200);
    const parentText = (img.parentElement?.textContent || '').substring(0, 500);
    const contextStr = `${altText} ${parentText}`.toLowerCase();

    const response = await chrome.runtime.sendMessage({
      type: 'ANALYZE',
      src: img.src,
      hostname: window.location.hostname,
      context: contextStr,
    });

    if (response && img.isConnected) {
      let { score, label } = response;

      // Blend headline misinfo score on top if available
      if (pageMisinfoScore !== null) {
        score = 0.70 * score + 0.30 * pageMisinfoScore;
      }

      // ── Calibrated thresholds ────────────────────────────────────────────────
      // Philosophy: NEVER falsely label AI as real. Be skeptical by default.
      //   > 0.45  → FAKE        (strong evidence of AI generation)
      //   > 0.12  → UNVERIFIED  (anything in the middle = suspicious)
      //   ≤ 0.12  → REAL        (only label real if very strong evidence)
      const finalLabel = score > 0.45 ? 'fake'
                       : score > 0.12 ? 'unverified'
                       : 'real';

      injectBadge(img, score, finalLabel);
    }
  } catch (e) {
    // Usually "Extension context invalidated" — safe to ignore
    if (!e.message?.includes('Extension context')) {
      console.warn('[TruthLens]', e.message);
    }
  } finally {
    running--;
    drainQueue();
  }
}

// ─── MutationObserver for dynamic content ────────────────────────────────────
new MutationObserver(mutations => {
  for (const m of mutations) {
    for (const node of m.addedNodes) {
      if (node.nodeType !== 1) continue; // skip text nodes
      if (node.tagName === 'IMG') {
        scheduleImage(node);
      } else if (node.querySelectorAll) {
        node.querySelectorAll('img').forEach(scheduleImage);
      }
    }
  }
}).observe(document.body || document.documentElement, { childList: true, subtree: true });

// ─── Kick off ─────────────────────────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
