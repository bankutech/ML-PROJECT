import { pipeline, env } from '@xenova/transformers';

// Allow fetching from HuggingFace CDN on first load (cached afterwards)
env.allowLocalModels = false;
env.useBrowserCache = true;

let _classifier = null;
let _loading = false;
let _loadPromise = null;

async function getClassifier() {
  if (_classifier) return _classifier;
  if (_loading) return _loadPromise;

  _loading = true;
  _loadPromise = pipeline(
    'zero-shot-classification',
    'Xenova/distilbert-base-uncased-mnli',
    { revision: 'main' }
  ).then(clf => {
    _classifier = clf;
    _loading = false;
    console.log('[TruthLens] NLP classifier loaded.');
    return clf;
  }).catch(e => {
    _loading = false;
    console.warn('[TruthLens] NLP model load failed – using keyword fallback:', e.message);
    // Keyword-based fallback so the extension is still useful offline
    _classifier = keywordClassifier;
    return _classifier;
  });

  return _loadPromise;
}

// ─── Keyword fallback ─────────────────────────────────────────────────────────
const MISINFO_KEYWORDS = [
  'breaking', 'hoax', 'fake news', 'conspiracy', 'exposed', 'shocking', 'miracle',
  'secret', 'truth about', 'they don\'t want you', 'banned', 'censored',
  'you won\'t believe', 'unbelievable', 'scientists are baffled', 'mainstream media',
  'deep state', 'wake up', 'sheeple', 'false flag', 'crisis actor',
  'mind blowing', 'cover up', 'cover-up', 'explosive', 'bombshell',
];

const CREDIBLE_KEYWORDS = [
  'according to', 'study finds', 'report says', 'official', 'data shows',
  'research', 'published', 'university', 'peer-reviewed', 'government',
  'confirmed', 'verified', 'analysis', 'survey', 'statistics',
];

function keywordClassifier(headline) {
  const lower = headline.toLowerCase();
  let misinfoScore = 0.20; // baseline

  for (const kw of MISINFO_KEYWORDS) {
    if (lower.includes(kw)) misinfoScore = Math.min(0.85, misinfoScore + 0.15);
  }
  for (const kw of CREDIBLE_KEYWORDS) {
    if (lower.includes(kw)) misinfoScore = Math.max(0.05, misinfoScore - 0.08);
  }

  // Caps and exclamation marks = sensationalism
  const capsRatio = (headline.match(/[A-Z]/g) || []).length / headline.length;
  if (capsRatio > 0.4) misinfoScore = Math.min(0.90, misinfoScore + 0.20);
  if ((headline.match(/!/g) || []).length > 1) misinfoScore = Math.min(0.85, misinfoScore + 0.15);

  // Very short headlines are often clickbait
  if (headline.length < 30) misinfoScore = Math.min(0.75, misinfoScore + 0.10);

  return {
    labels: ['this statement is factually accurate and verified', 'this statement is false, misleading, or misinformation'],
    scores: [1 - misinfoScore, misinfoScore],
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────
export async function checkHeadline(headline) {
  if (!headline || headline.trim().length < 5) {
    return { score: 0.15, label: 'unverified' };
  }

  try {
    const clf = await getClassifier();
    const LABELS = [
      'this statement is factually accurate and verified',
      'this statement is false, misleading, or misinformation',
    ];

    let result;
    if (clf === keywordClassifier) {
      result = keywordClassifier(headline);
    } else {
      result = await clf(headline, LABELS);
    }

    const misinfoIdx = result.labels.indexOf(LABELS[1]);
    const misinfoScore = misinfoIdx >= 0 ? result.scores[misinfoIdx] : result.scores[1] ?? 0.15;

    return {
      score: misinfoScore,
      label: misinfoScore > 0.70 ? 'misinformation' : misinfoScore > 0.45 ? 'unverified' : 'credible',
    };
  } catch (e) {
    console.error('[TruthLens] checkHeadline error:', e.message);
    return { score: 0.15, label: 'unverified' };
  }
}
