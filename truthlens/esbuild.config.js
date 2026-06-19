const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

async function build() {
  const outdir = 'dist';

  // ── Clean dist ─────────────────────────────────────────────────────────────
  if (fs.existsSync(outdir)) {
    fs.rmSync(outdir, { recursive: true, force: true });
  }
  fs.mkdirSync(outdir);

  // ── Static files ───────────────────────────────────────────────────────────
  fs.copyFileSync('manifest.json', path.join(outdir, 'manifest.json'));
  fs.copyFileSync('popup.html',    path.join(outdir, 'popup.html'));
  fs.copyFileSync('popup.js',      path.join(outdir, 'popup.js'));

  // Icons
  fs.mkdirSync(path.join(outdir, 'icons'), { recursive: true });
  if (fs.existsSync('icons/icon48.png')) {
    fs.copyFileSync('icons/icon48.png', path.join(outdir, 'icons/icon48.png'));
  } else {
    console.warn('⚠  icons/icon48.png not found – extension may warn about missing icon.');
  }

  // ── ONNX WASM files ────────────────────────────────────────────────────────
  // Even though we no longer use ONNX for inference, onnxruntime-web is
  // bundled as a dependency and its loader expects to find .wasm files at
  // the extension root.  Copy them just in case.
  const onnxDistPath = path.join(__dirname, 'node_modules', 'onnxruntime-web', 'dist');
  if (fs.existsSync(onnxDistPath)) {
    const wasmFiles = fs.readdirSync(onnxDistPath).filter(f => f.endsWith('.wasm'));
    wasmFiles.forEach(file => {
      fs.copyFileSync(path.join(onnxDistPath, file), path.join(outdir, file));
    });
    console.log(`Copied ${wasmFiles.length} WASM file(s).`);
  }

  // ── Bundle background.js as ESM (Manifest V3 service worker) ──────────────
  await esbuild.build({
    entryPoints: ['background.js'],
    bundle: true,
    outdir,
    format: 'esm',
    target: 'es2022',
    minify: false,
    sourcemap: true,
    define: {
      'process.env.NODE_ENV': '"production"',
    },
  });

  // ── Bundle content.js as IIFE (plain content script, no import.meta) ───────
  await esbuild.build({
    entryPoints: ['content.js'],
    bundle: true,
    outdir,
    format: 'iife',
    target: 'es2022',
    minify: false,
    sourcemap: true,
  });

  console.log('✅  Build completed successfully!');
}

build().catch(e => {
  console.error('❌  Build failed:', e);
  process.exit(1);
});
