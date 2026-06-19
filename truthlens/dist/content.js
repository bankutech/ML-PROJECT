(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // src/badge.js
  function injectBadge(img, score, label) {
    if (img.dataset.truthlensBadged) return;
    img.dataset.truthlensBadged = "1";
    const pct = Math.round(score * 100);
    console.log(`[TruthLens] Badge: ${label.toUpperCase()} ${pct}% \u2192 ${img.src.slice(0, 80)}`);
    const color = label === "fake" ? "#E03535" : label === "unverified" ? "#D4840A" : "#1A9E6E";
    const bgAlpha = label === "fake" ? "rgba(224,53,53,0.92)" : label === "unverified" ? "rgba(212,132,10,0.92)" : "rgba(26,158,110,0.92)";
    const icon = label === "fake" ? "\u26A0" : label === "unverified" ? "?" : "\u2714";
    const mainText = label === "fake" ? `DEEPFAKE \xB7 ${pct}%` : label === "unverified" ? `UNVERIFIED \xB7 ${pct}%` : `REAL \xB7 ${pct}% AUTHENTIC`;
    const badge = document.createElement("div");
    badge.setAttribute("data-truthlens", "true");
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
    badge.title = `TruthLens \xB7 ${mainText} \xB7 Score: ${pct}% \xB7 All analysis runs locally in your browser`;
    const iconSpan = document.createElement("span");
    iconSpan.style.cssText = "font-size:12px;line-height:1;";
    iconSpan.textContent = icon;
    const textSpan = document.createElement("span");
    textSpan.textContent = mainText;
    badge.appendChild(iconSpan);
    badge.appendChild(textSpan);
    let wrapper = img.parentElement;
    if (!wrapper) return;
    const wrapperTag = wrapper.tagName?.toUpperCase();
    const existingPos = getComputedStyle(wrapper).position;
    const existingDisplay = getComputedStyle(wrapper).display;
    const UNSUITABLE_WRAPPER_TAGS = /* @__PURE__ */ new Set(["BODY", "HTML", "MAIN", "SECTION", "ARTICLE", "DIV"]);
    const isUnsuitableParent = UNSUITABLE_WRAPPER_TAGS.has(wrapperTag) && (existingDisplay === "block" || existingDisplay === "flex" || existingDisplay === "grid") && wrapper.childElementCount > 3;
    if (existingPos === "static" && isUnsuitableParent) {
      const newWrapper = document.createElement("div");
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
    } else if (existingPos === "static") {
      wrapper.style.position = "relative";
    }
    wrapper.appendChild(badge);
  }
  var init_badge = __esm({
    "src/badge.js"() {
    }
  });

  // content.js
  var require_content = __commonJS({
    "content.js"() {
      init_badge();
      function extractHeadline() {
        return document.querySelector("h1")?.textContent?.trim() || document.querySelector('meta[property="og:title"]')?.content?.trim() || document.querySelector('meta[name="twitter:title"]')?.content?.trim() || document.title?.trim();
      }
      function isAnalysable(img) {
        if (!img.src || img.src.startsWith("data:") || img.src.startsWith("blob:")) return false;
        if (img.src.toLowerCase().includes(".svg")) return false;
        if (img.dataset.truthlensId) return false;
        const rect = img.getBoundingClientRect();
        const width = rect.width || img.naturalWidth || img.width;
        const height = rect.height || img.naturalHeight || img.height;
        return width >= 200 && height >= 200;
      }
      var analyzed = /* @__PURE__ */ new Set();
      var running = 0;
      var MAX_CONCURRENT = 2;
      var queue = [];
      var pageMisinfoScore = null;
      function init() {
        const headline = extractHeadline();
        if (headline) {
          chrome.runtime.sendMessage({ type: "ANALYZE_HEADLINE", headline }).then((result) => {
            if (result) {
              pageMisinfoScore = result.score;
              console.log(`[TruthLens] Headline: "${headline}" \u2014 misinfo score: ${(pageMisinfoScore * 100).toFixed(1)}%`);
            }
          }).catch(() => {
          });
        }
        document.querySelectorAll("img").forEach(scheduleImage);
      }
      function scheduleImage(img) {
        if (analyzed.has(img.src) || !isAnalysable(img)) return;
        analyzed.add(img.src);
        img.dataset.truthlensId = img.src;
        queue.push(img);
        drainQueue();
      }
      async function drainQueue() {
        if (running >= MAX_CONCURRENT || queue.length === 0) return;
        running++;
        const img = queue.shift();
        if (!img.isConnected) {
          running--;
          drainQueue();
          return;
        }
        try {
          const altText = (img.alt || img.title || "").substring(0, 200);
          const parentText = (img.parentElement?.textContent || "").substring(0, 500);
          const contextStr = `${altText} ${parentText}`.toLowerCase();
          const response = await chrome.runtime.sendMessage({
            type: "ANALYZE",
            src: img.src,
            hostname: window.location.hostname,
            context: contextStr
          });
          if (response && img.isConnected) {
            let { score, label } = response;
            if (pageMisinfoScore !== null) {
              score = 0.7 * score + 0.3 * pageMisinfoScore;
            }
            const finalLabel = score > 0.45 ? "fake" : score > 0.12 ? "unverified" : "real";
            injectBadge(img, score, finalLabel);
          }
        } catch (e) {
          if (!e.message?.includes("Extension context")) {
            console.warn("[TruthLens]", e.message);
          }
        } finally {
          running--;
          drainQueue();
        }
      }
      new MutationObserver((mutations) => {
        for (const m of mutations) {
          for (const node of m.addedNodes) {
            if (node.nodeType !== 1) continue;
            if (node.tagName === "IMG") {
              scheduleImage(node);
            } else if (node.querySelectorAll) {
              node.querySelectorAll("img").forEach(scheduleImage);
            }
          }
        }
      }).observe(document.body || document.documentElement, { childList: true, subtree: true });
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
      } else {
        init();
      }
    }
  });
  require_content();
})();
//# sourceMappingURL=content.js.map
