document.addEventListener('DOMContentLoaded', async () => {
  const $scanned   = document.getElementById('images-scanned');
  const $fakes     = document.getElementById('deepfakes-detected');
  const $credPct   = document.getElementById('cred-pct');
  const $credBar   = document.getElementById('cred-bar');
  const $pill      = document.getElementById('status-pill');
  const $toggle    = document.getElementById('toggle-extension');

  // ── Load live stats from background ───────────────────────────────────────
  async function refreshStats() {
    try {
      const stats = await chrome.runtime.sendMessage({ type: 'GET_STATS' });
      if (!stats) return;

      const { imagesScanned = 0, deepfakesDetected = 0 } = stats;
      $scanned.textContent = imagesScanned;
      $fakes.textContent   = deepfakesDetected;

      if (imagesScanned > 0) {
        const fakeRatio  = deepfakesDetected / imagesScanned;
        const credScore  = Math.round((1 - fakeRatio) * 100);
        const barColor   = credScore >= 75 ? '#10b981'
                         : credScore >= 50 ? '#f59e0b'
                         :                   '#ef4444';

        $credPct.textContent  = `${credScore}% credible`;
        $credPct.style.color  = barColor;
        $credBar.style.width  = `${credScore}%`;
        $credBar.style.background = barColor;
      } else {
        $credPct.textContent = 'No images scanned yet';
        $credPct.style.color = '#9ca3af';
      }
    } catch (e) {
      $credPct.textContent = 'Extension reloading…';
    }
  }

  await refreshStats();
  // Refresh every 2s while popup is open
  const interval = setInterval(refreshStats, 2000);
  window.addEventListener('unload', () => clearInterval(interval));

  // ── Toggle ────────────────────────────────────────────────────────────────
  const stored = await chrome.storage.local.get('enabled');
  const isEnabled = stored.enabled !== false; // default true
  $toggle.checked = isEnabled;
  updatePill(isEnabled);

  $toggle.addEventListener('change', async (e) => {
    const val = e.target.checked;
    await chrome.storage.local.set({ enabled: val });
    updatePill(val);
  });

  function updatePill(enabled) {
    $pill.textContent = enabled ? '● ACTIVE' : '○ PAUSED';
    $pill.className   = enabled ? 'pill-active' : 'pill-inactive';
  }
});
