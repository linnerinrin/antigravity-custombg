'use strict';
// Auto-extracted from the legacy patcher; injected into dist/main.js.
(function () {
  try {
    const electron = require('electron');
    const ipcMain = electron && electron.ipcMain;
    if (!ipcMain || globalThis.__AGY_BG_MAIN__) return;
    globalThis.__AGY_BG_MAIN__ = true;

    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const dialog = electron.dialog;
    const BrowserWindow = electron.BrowserWindow;
    const nativeImage = electron.nativeImage;
    const shell = electron.shell;

    const DIR = path.join(os.homedir(), '.gemini', 'config', 'agy-bg');
    const CFG = path.join(DIR, 'config.json');
    const MIME = {
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
      '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif'
    };

    function readCfg() {
      try { return JSON.parse(fs.readFileSync(CFG, 'utf8')); } catch (e) { return {}; }
    }
    function writeCfg(c) {
      try {
        fs.mkdirSync(DIR, { recursive: true });
        fs.writeFileSync(CFG, JSON.stringify(c, null, 2), 'utf8');
        return true;
      } catch (e) { return false; }
    }
    function resolveImg(cfg) {
      if (!cfg || !cfg.image) return null;
      if (/^data:|^https?:\/\//i.test(cfg.image)) return null;
      const p = path.isAbsolute(cfg.image) ? cfg.image : path.join(DIR, cfg.image);
      return fs.existsSync(p) ? p : null;
    }
    // Compute alpha only; colors come from per-theme CSS vars.
    function alphaTriple(dim) {
      const base = 0.10 + (dim / 100) * 0.75;
      const clamp = function (x) { return Math.min(0.98, x).toFixed(3); };
      return {
        surface: clamp(base),
        surface2: clamp(base + 0.62),
        sidebar: clamp(base + 0.70),
        composer: clamp(base + 0.78)
      };
    }

    // Sidebar transparency: 0 = fully opaque (0.94), 100 = almost clear (0.04).
    function sidebarAlpha(trans) {
      const t = Math.max(0, Math.min(100, trans));
      const a = 0.94 - (t / 100) * 0.88;
      return Math.min(0.98, Math.max(0.04, a)).toFixed(3);
    }

    // ---- Custom font: inline @font-face via data:base64, cached by mtime ----
    const SANS_FB = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Microsoft YaHei", sans-serif';
    const MONO_FB = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";
    let _fontCache = { key: '', css: '' };

    function fontCss(cfg) {
      const f = cfg && cfg.fontFile;
      if (!f) return '';
      const p = path.isAbsolute(f) ? f : path.join(DIR, f);
      let st = null;
      try { st = fs.statSync(p); } catch (e) { return ''; }
      const ext = (path.extname(p) || '').toLowerCase();
      const applyCode = cfg.fontApplyCode === true;
      const key = p + '|' + st.mtimeMs + '|' + st.size + '|' + (applyCode ? 1 : 0);
      if (_fontCache.key === key) return _fontCache.css;
      let b64;
      try { b64 = fs.readFileSync(p).toString('base64'); } catch (e) { return ''; }
      const fmt = ext === '.woff2' ? 'woff2' : ext === '.woff' ? 'woff' : ext === '.otf' ? 'opentype' : 'truetype';
      const fam = "'AgyCustomFont'";
      const full = fam + ',' + SANS_FB;
      const parts = [
        '@font-face{font-family:' + fam + ';font-style:normal;font-weight:100 900;font-display:swap;' +
          'src:url(data:font/' + fmt + ';base64,' + b64 + ") format('" + fmt + "');}",
        'html{--font-sans:' + full + ' !important;}',
        'body,body[data-agy-font],body[data-agy-font="inter"],body[data-agy-font="google-sans"]{' +
          '--font-sans:' + full + ' !important;font-family:' + full + ' !important;}'
      ];
      if (applyCode) {
        const monoFull = fam + ',' + MONO_FB;
        parts.push('html{--font-mono:' + monoFull + ' !important;--editor-font-family:' + monoFull + ' !important;}');
        parts.push('pre,code,kbd,samp,.font-mono,[class*="font-mono"],[class*="font-mono"] *{font-family:' + monoFull + ' !important;}');
      }
      const css = parts.join('\n');
      _fontCache = { key: key, css: css };
      return css;
    }

    function build() {
      const cfg = readCfg();
      const fontPart = fontCss(cfg);
      if (cfg.enabled === false) return fontPart || null;
      if (!cfg.image) return fontPart || null;

      let uri = null;
      if (/^data:/i.test(cfg.image)) {
        uri = cfg.image;
      } else if (/^https?:\/\//i.test(cfg.image)) {
        uri = cfg.image;
      } else {
        const img = resolveImg(cfg);
        if (!img) return null;
        try {
          const mime = MIME[path.extname(img).toLowerCase()] || 'image/jpeg';
          uri = 'data:' + mime + ';base64,' + fs.readFileSync(img).toString('base64');
        } catch (e) { return null; }
      }

      const v = function (k, d) {
        return cfg[k] !== undefined && cfg[k] !== null ? cfg[k] : d;
      };
      // Only alphas are computed here; color literals are emitted per theme below.
      // Referencing a shared var from :root does not work: it resolves at :root.
      const dim = typeof cfg.dimming === 'number' ? Math.max(0, Math.min(100, cfg.dimming)) : 57;
      const t = alphaTriple(dim);
      const sbTrans = typeof cfg.sidebarTrans === 'number'
        ? Math.max(0, Math.min(100, cfg.sidebarTrans)) : 0;
      const sbA = sidebarAlpha(sbTrans);
      const sbBlur = Math.max(3, Math.round(16 - (sbTrans / 100) * 11));
      const sbSat = Math.round(120 + (sbTrans / 100) * 20);
      const blur = v('blur', 'blur(2px)');
      // Optional veil strength (0-100), theme independent.
      const veil = typeof cfg.veil === 'number' ? Math.max(0, Math.min(100, cfg.veil)) : 8;
      const veilA = (veil / 100 * 0.5).toFixed(3);

      // Both palettes are emitted as literals: a var used inside :root is resolved
      // there, so toggling .dark on body cannot change the computed --background.
      const L = { tint: '249,249,249', tint2: '255,255,255', ink: '0,0,0' };
      const D = { tint: '24,24,27', tint2: '34,34,38', ink: '255,255,255' };

      function paletteVars(p) {
        return [
          '--background:rgba(' + p.tint + ',' + t.surface + ') !important;',
          '--card:rgba(' + p.tint2 + ',' + t.surface2 + ') !important;',
          '--popover:rgba(' + p.tint2 + ',.97) !important;',
          '--muted:rgba(' + p.ink + ',.06) !important;',
          '--secondary:rgba(' + p.ink + ',.10) !important;',
          '--accent:rgba(' + p.ink + ',.08) !important;',
          '--input:rgba(' + p.ink + ',.08) !important;',
          '--border:rgba(' + p.ink + ',.14) !important;',
          '--sidebar:rgba(' + p.tint + ',' + sbA + ') !important;',
          '--sidebar-accent:rgba(' + p.ink + ',.08) !important;',
          '--sidebar-border:rgba(' + p.ink + ',.10) !important;'
        ].join('');
      }

      const css = [
        // ---- Light (default) ----
        ':root,body{' + paletteVars(L) + '}',
        'html,body{background:transparent !important;}',
        'body::before{',
        "content:'';position:fixed;inset:0;z-index:0;pointer-events:none;",
        'background-image:linear-gradient(rgba(' + L.tint + ',' + veilA + '),rgba(' + L.tint + ',' + veilA + ')),',
        'radial-gradient(ellipse 70% 55% at 50% 42%,rgba(' + L.tint2 + ',' + veilA + '),transparent 78%),',
        'url("' + uri + '");',
        'background-size:cover,cover,cover;background-position:center,center,center;',
        'background-repeat:no-repeat,no-repeat,no-repeat;',
        '}',
        '.bg-sidebar:not(.surface-opaque),.bg-sidebar .bg-sidebar:not(.surface-opaque),',
        '[class*="bg-sidebar"]:not(.bg-sidebar-accent):not(.surface-opaque){',
        'background-color:rgba(' + L.tint + ',' + sbA + ') !important;}',
        // Blur only on the real sidebar column. The top titlebar also carries bg-sidebar and
        // is the dropdown menu's parent: a backdrop-filter there double-fuzzes the popup.
        'aside.bg-sidebar,aside [class*="bg-sidebar"]:not(.surface-opaque),',
        '.pb-2.bg-sidebar,.h-full.w-full.flex.flex-col.bg-sidebar{',
        'background-color:rgba(' + L.tint + ',' + sbA + ') !important;',
        'backdrop-filter:blur(' + sbBlur + 'px) saturate(' + sbSat + '%) !important;}',
        // Dropdown menus reuse the bg-sidebar class; keep them solid so items stay readable.
        '.surface-opaque,[role=menu],[role=listbox],[role=dialog],',
        '[data-radix-popper-content-wrapper] > *,',
        '.absolute.top-full{background-color:rgba(' + L.tint2 + ',.97) !important;backdrop-filter:none !important;}',
        '.surface-composer-card{background-color:rgba(' + L.tint2 + ',' + t.composer + ') !important;backdrop-filter:blur(10px);}',
        '.agy-sheet{text-shadow:0 1px 2px rgba(255,255,255,.55);}',

        // ---- Dark: emitted after the light block, with :has() to win the cascade ----
        ':root:has(body.dark),:root:has(body.dark-theme),:root:has(body.theme-dark),',
        'html.dark,body.dark,body.dark-theme,body.theme-dark,body.vscode-dark{',
        paletteVars(D),
        '--agy-ink:255,255,255;',
        '}',
        'body.dark::before,body.dark-theme::before,body.theme-dark::before{',
        'background-image:linear-gradient(rgba(' + D.tint + ',' + veilA + '),rgba(' + D.tint + ',' + veilA + ')),',
        'radial-gradient(ellipse 70% 55% at 50% 42%,rgba(' + D.tint2 + ',' + veilA + '),transparent 78%),',
        'url("' + uri + '");',
        '}',
        'body.dark .bg-sidebar:not(.surface-opaque),',
        'body.dark [class*="bg-sidebar"]:not(.bg-sidebar-accent):not(.surface-opaque),',
        'body.dark aside.bg-sidebar,body.dark-theme aside.bg-sidebar,body.theme-dark aside.bg-sidebar{',
        'background-color:rgba(' + D.tint + ',' + sbA + ') !important;',
        '}',
        'body.dark .pb-2.bg-sidebar,body.dark-theme .pb-2.bg-sidebar,body.theme-dark .pb-2.bg-sidebar,',
        'body.dark .h-full.w-full.flex.flex-col.bg-sidebar,',
        'body.dark-theme .h-full.w-full.flex.flex-col.bg-sidebar,',
        'body.theme-dark .h-full.w-full.flex.flex-col.bg-sidebar{',
        'background-color:rgba(' + D.tint + ',' + sbA + ') !important;',
        'backdrop-filter:blur(' + sbBlur + 'px) saturate(' + sbSat + '%) !important;}',
        'body.dark .surface-opaque,body.dark [role=menu],body.dark [role=listbox],',
        'body.dark-theme .surface-opaque,body.theme-dark .surface-opaque,',
        'body.dark [data-radix-popper-content-wrapper] > *,',
        'body.dark .absolute.top-full,body.dark-theme .absolute.top-full,body.theme-dark .absolute.top-full{',
        'background-color:rgba(' + D.tint2 + ',.97) !important;backdrop-filter:none !important;}',
        'body.dark .surface-composer-card,body.dark-theme .surface-composer-card,body.theme-dark .surface-composer-card{',
        'background-color:rgba(' + D.tint2 + ',' + t.composer + ') !important;}',
        'body.dark .agy-sheet,body.dark-theme .agy-sheet,body.theme-dark .agy-sheet{',
        'text-shadow:0 1px 2px rgba(0,0,0,.45);}',

        // ---- Theme-independent shared rules ----
        '#root,#root>div.relative,#root>div.relative>div,',
        '#root .agy-shell,#root .agy-inset-shell,#root .agy-sheet{background-color:transparent !important;}',
        '#root{position:relative;z-index:1;}',
        '.agy-sheet{backdrop-filter:saturate(115%) ' + blur + ';}',
        '.bg-sidebar-accent,.bg-sidebar-accent-foreground{background-color:transparent !important;}'
      ].join('\n');
      return fontPart ? (css + '\n' + fontPart) : css;
    }

    function preview(cfg) {
      try {
        const img = resolveImg(cfg);
        if (!img) return null;
        const ni = nativeImage.createFromPath(img);
        if (!ni || ni.isEmpty()) return null;
        const sz = ni.getSize();
        const w = Math.min(360, sz.width || 360);
        return ni.resize({ width: w, quality: 'good' }).toDataURL();
      } catch (e) { return null; }
    }

    ipcMain.handle('agy-bg:get-css', function () {
      try { return build(); } catch (e) { return null; }
    });

    ipcMain.handle('agy-bg:get-config', function () {
      try {
        const cfg = readCfg();
        let fontName = null;
        if (cfg.fontFile) {
          fontName = path.basename(cfg.fontFile);
          const p = path.isAbsolute(cfg.fontFile) ? cfg.fontFile : path.join(DIR, cfg.fontFile);
          if (!fs.existsSync(p)) fontName = fontName + ' (缺失)';
        }
        return {
          ok: true,
          cfg: cfg,
          enabled: cfg.enabled !== false,
          hasImage: !!cfg.image,
          dimming: typeof cfg.dimming === 'number' ? cfg.dimming : null,
          sidebarTrans: typeof cfg.sidebarTrans === 'number' ? cfg.sidebarTrans : 0,
          veil: typeof cfg.veil === 'number' ? cfg.veil : 8,
          fontFile: cfg.fontFile || null,
          fontName: fontName,
          fontApplyCode: cfg.fontApplyCode === true,
          preview: preview(cfg),
          dir: DIR
        };
      } catch (e) { return { ok: false, error: String(e) }; }
    });

    ipcMain.handle('agy-bg:pick-font', async function () {
      try {
        const opts = {
          title: '选择字体文件',
          properties: ['openFile'],
          filters: [
            { name: '字体', extensions: ['ttf', 'otf', 'woff', 'woff2', 'ttc'] },
            { name: '所有文件', extensions: ['*'] }
          ]
        };
        let win = null;
        try { win = BrowserWindow.getFocusedWindow(); } catch (e) {}
        if (!win) {
          try {
            const all = BrowserWindow.getAllWindows();
            win = all.find(function (w) {
              try { return /Antigravity/i.test(w.getTitle()); } catch (e) { return false; }
            }) || all[0] || null;
          } catch (e) {}
        }
        const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts);
        if (!r || r.canceled || !r.filePaths || !r.filePaths.length) {
          return { ok: false, canceled: true };
        }
        const src = r.filePaths[0];
        const ext = (path.extname(src) || '.ttf').toLowerCase();
        fs.mkdirSync(DIR, { recursive: true });
        const dest = path.join(DIR, 'font' + ext);
        try {
          const old = readCfg().fontFile;
          if (old) {
            const op = path.isAbsolute(old) ? old : path.join(DIR, old);
            if (op !== dest && fs.existsSync(op)) fs.unlinkSync(op);
          }
        } catch (e) {}
        fs.copyFileSync(src, dest);
        const cfg = readCfg();
        cfg.fontFile = 'font' + ext;
        writeCfg(cfg);
        return { ok: true, css: build(), fontName: path.basename(src), fontFile: cfg.fontFile };
      } catch (e) {
        return { ok: false, error: String((e && e.message) || e) };
      }
    });

    ipcMain.handle('agy-bg:set-option', function (ev, arg) {
      try {
        const cfg = readCfg();
        const patch = arg || {};
        Object.keys(patch).forEach(function (k) { cfg[k] = patch[k]; });
        writeCfg(cfg);
        return { ok: true, css: build() };
      } catch (e) { return { ok: false, error: String(e) }; }
    });

    ipcMain.handle('agy-bg:pick-image', async function () {
      try {
        const opts = {
          title: '选择背景图片',
          properties: ['openFile'],
          filters: [{ name: '图片', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'] }]
        };
        let win = null;
        try { win = BrowserWindow.getFocusedWindow(); } catch (e) {}
        if (!win) {
          try {
            const all = BrowserWindow.getAllWindows();
            win = all.find(function (w) {
              try { return /Antigravity/i.test(w.getTitle()); } catch (e) { return false; }
            }) || all[0] || null;
          } catch (e) {}
        }
        const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts);
        if (!r || r.canceled || !r.filePaths || !r.filePaths.length) {
          return { ok: false, canceled: true };
        }
        const src = r.filePaths[0];
        const ext = (path.extname(src) || '.jpg').toLowerCase();
        fs.mkdirSync(DIR, { recursive: true });
        const dest = path.join(DIR, 'wallpaper' + ext);
        fs.copyFileSync(src, dest);
        const cfg = readCfg();
        cfg.image = 'wallpaper' + ext;
        cfg.enabled = true;
        writeCfg(cfg);
        return { ok: true, css: build(), preview: preview(cfg), image: cfg.image };
      } catch (e) {
        return { ok: false, error: String((e && e.message) || e) };
      }
    });

    ipcMain.handle('agy-bg:open-dir', function () {
      try { shell.openPath(DIR); return true; } catch (e) { return false; }
    });
  } catch (err) {
    try { console.error('[agy-bg] main error:', err); } catch (e) {}
  }
})();
