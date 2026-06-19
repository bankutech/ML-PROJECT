export function injectBadge(img, score, label) {
  // Don't double-badge
  if (img.dataset.truthlensBadged) return;
  img.dataset.truthlensBadged = '1';

  const pct = Math.round(score * 100);
  console.log(`[TruthLens] Badge: ${label.toUpperCase()} ${pct}% → ${img.src.slice(0, 80)}`);

  const color   = label === 'fake'       ? '#E03535'
                : label === 'unverified' ? '#D4840A'
                :                         '#1A9E6E';

  const bgAlpha = label === 'fake'       ? 'rgba(224,53,53,0.92)'
                : label === 'unverified' ? 'rgba(212,132,10,0.92)'
                :                         'rgba(26,158,110,0.92)';

  const icon    = label === 'fake'       ? '⚠'
                : label === 'unverified' ? '?'
                :                         '✔';

  const mainText = label === 'fake'       ? `DEEPFAKE · ${pct}%`
                 : label === 'unverified' ? `UNVERIFIED · ${pct}%`
                 :                         `REAL · ${pct}% AUTHENTIC`;

  // ─── Create badge element ───────────────────────────────────────────────────
  const badge = document.createElement('div');
  badge.setAttribute('data-truthlens', 'true');
  badge.style.cssText = `
    position: absolute;
    top: 8px;
    left: 8px;
    z-index: 2147483647;
    display: flex;
    align-items: center;
    gap: 5px;
    background: ${bgAlpha};
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    letter-spacing: 0.05em;
    padding: 4px 9px 4px 7px;
    border-radius: 6px;
    pointer-events: none;
    user-select: none;
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    border: 1px solid rgba(255,255,255,0.25);
    box-shadow: 0 2px 8px rgba(0,0,0,0.35), 0 0 0 1px ${color}55;
    line-height: 1;
    white-space: nowrap;
    text-shadow: 0 1px 2px rgba(0,0,0,0.3);
  `;
  badge.title = `TruthLens · ${mainText} · Score: ${pct}% · All analysis runs locally in your browser`;

  const iconSpan = document.createElement('span');
  iconSpan.style.cssText = 'font-size:12px;line-height:1;';
  iconSpan.textContent = icon;

  const textSpan = document.createElement('span');
  textSpan.textContent = mainText;

  badge.appendChild(iconSpan);
  badge.appendChild(textSpan);

  // ─── Wrapper logic ──────────────────────────────────────────────────────────
  // Find or create a positioned wrapper so position:absolute works on the badge.
  let wrapper = img.parentElement;
  if (!wrapper) return; // image was detached

  const wrapperTag = wrapper.tagName?.toUpperCase();
  const existingPos = getComputedStyle(wrapper).position;
  const existingDisplay = getComputedStyle(wrapper).display;

  const UNSUITABLE_WRAPPER_TAGS = new Set(['BODY', 'HTML', 'MAIN', 'SECTION', 'ARTICLE', 'DIV']);
  const isUnsuitableParent =
    UNSUITABLE_WRAPPER_TAGS.has(wrapperTag) &&
    (existingDisplay === 'block' || existingDisplay === 'flex' || existingDisplay === 'grid') &&
    wrapper.childElementCount > 3;

  if (existingPos === 'static' && isUnsuitableParent) {
    // Create a tight wrapper around the image
    const newWrapper = document.createElement('div');
    newWrapper.style.cssText = `
      display: inline-block;
      position: relative;
      line-height: 0;
      vertical-align: bottom;
      max-width: 100%;
    `;
    wrapper.insertBefore(newWrapper, img);
    newWrapper.appendChild(img);
    wrapper = newWrapper;
  } else if (existingPos === 'static') {
    wrapper.style.position = 'relative';
  }

  wrapper.appendChild(badge);
}
