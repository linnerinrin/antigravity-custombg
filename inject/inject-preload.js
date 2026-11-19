'use strict';
// Auto-extracted from the legacy patcher; injected into dist/preload.js.
(function () {
  try {
    if (window.top !== window) return;
    if (globalThis.__AGY_BG_PRELOAD__) return;
    globalThis.__AGY_BG_PRELOAD__ = true;

    const ipcRenderer = require('electron').ipcRenderer;
    if (!ipcRenderer) return;

    const SID = '__agy_bg_style__';
    const SEC = '__agy_bg_section__';

    function inject(css) {
      const host = document.head || document.documentElement;
      if (!host) return;
      let st = document.getElementById(SID);
      if (!css) {
        if (st) st.remove();
        return;
      }
      if (!st) {
        st = document.createElement('style');
        st.id = SID;
        host.appendChild(st);
      }
      if (st.textContent !== css) st.textContent = css;
    }

    function refresh() {
      try {
        ipcRenderer.invoke('agy-bg:get-css').then(inject).catch(function () {});
      } catch (e) {}
    }

    // ---- Card injected into the Appearance screen ----
    const ROW = 'py-2 px-3 w-full bg-transparent flex justify-between gap-4 items-center';
    const BTN = [
      'type="button" style="cursor:pointer;padding:4px 10px;border-radius:6px;',
      'border:1px solid var(--border);background:var(--secondary);',
      'color:var(--secondary-foreground);font-size:12px;line-height:18px;white-space:nowrap"'
    ].join('');

    function buildSection() {
      const sec = document.createElement('div');
      sec.id = SEC;
      sec.className = 'space-y-2';
      sec.innerHTML = [
        '<div class="flex flex-col gap-1">',
        '  <div class="flex items-center justify-between">',
        '    <div class="flex items-center gap-1.5"><h3 class="m-0 font-medium">Custom Theme</h3></div>',
        '    <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">',
        '      <input type="checkbox" id="__agy_bg_on" style="cursor:pointer;margin:0">',
        '      <span style="color:var(--muted-foreground)">Enabled</span>',
        '    </label>',
        '  </div>',
        '</div>',
        '<div>',
        '  <div class="agy-card bg-transparent rounded-xl border border-border overflow-hidden divide-y divide-border">',
        '    <div class="' + ROW + '">',
        '      <div class="flex-1 flex flex-col gap-0.5">',
        '        <div class="flex items-center gap-1.5"><span>Wallpaper</span></div>',
        '        <div style="font-size:11px;color:var(--muted-foreground)" id="__agy_bg_hint">未设置</div>',
        '      </div>',
        '      <div class="shrink-0" style="display:flex;align-items:center;gap:8px">',
        '        <img id="__agy_bg_thumb" alt="" style="display:none;width:64px;height:36px;object-fit:cover;border-radius:4px;border:1px solid var(--border)">',
        '        <button id="__agy_bg_pick" ' + BTN + '>Choose…</button>',
        '      </div>',
        '    </div>',
        '    <div class="' + ROW + '">',
        '      <div class="flex-1 flex flex-col gap-0.5">',
        '        <div class="flex items-center gap-1.5"><span>Wallpaper transparency</span></div>',
        '        <div style="font-size:11px;color:var(--muted-foreground)">越大壁纸越透</div>',
        '      </div>',
        '      <div class="shrink-0" style="display:flex;align-items:center;gap:8px;width:190px">',
        '        <input id="__agy_bg_dim" type="range" min="0" max="100" step="1" style="flex:1;cursor:pointer;accent-color:var(--foreground)">',
        '        <span id="__agy_bg_dimv" style="font-size:11px;width:34px;text-align:right;color:var(--muted-foreground)">0%</span>',
        '      </div>',
        '    </div>',
        '    <div class="' + ROW + '">',
        '      <div class="flex-1 flex flex-col gap-0.5">',
        '        <div class="flex items-center gap-1.5"><span>Sidebar transparency</span></div>',
        '        <div style="font-size:11px;color:var(--muted-foreground)">越大侧边栏越透</div>',
        '      </div>',
        '      <div class="shrink-0" style="display:flex;align-items:center;gap:8px;width:190px">',
        '        <input id="__agy_bg_sbt" type="range" min="0" max="100" step="1" style="flex:1;cursor:pointer;accent-color:var(--foreground)">',
        '        <span id="__agy_bg_sbtv" style="font-size:11px;width:34px;text-align:right;color:var(--muted-foreground)">0%</span>',
        '      </div>',
        '    </div>',
        '    <div class="' + ROW + '">',
        '      <div class="flex-1 flex flex-col gap-0.5">',
        '        <div class="flex items-center gap-1.5"><span>Custom font</span></div>',
        '        <div style="font-size:11px;color:var(--muted-foreground)" id="__agy_bg_fonthint">未设置，用自带字体</div>',
        '      </div>',
        '      <div class="shrink-0" style="display:flex;align-items:center;gap:8px">',
        '        <button id="__agy_bg_fontclr" ' + BTN + ' title="恢复自带字体">Reset</button>',
        '        <button id="__agy_bg_font" ' + BTN + '>Choose font…</button>',
        '      </div>',
        '    </div>',
        '    <div class="' + ROW + '">',
        '      <div class="flex-1 flex flex-col gap-0.5">',
        '        <div class="flex items-center gap-1.5"><span>Apply to code font</span></div>',
        '        <div style="font-size:11px;color:var(--muted-foreground)">编辑器与代码块也换成该字体</div>',
        '      </div>',
        '      <div class="shrink-0" style="display:flex;align-items:center">',
        '        <input type="checkbox" id="__agy_bg_fontcode" style="cursor:pointer;margin:0">',
        '      </div>',
        '    </div>',
        '  </div>',
        '</div>'
      ].join('');
      return sec;
    }

    function syncUI(sec, st) {
      const on = sec.querySelector('#__agy_bg_on');
      const dim = sec.querySelector('#__agy_bg_dim');
      const dimv = sec.querySelector('#__agy_bg_dimv');
      const sbt = sec.querySelector('#__agy_bg_sbt');
      const sbtv = sec.querySelector('#__agy_bg_sbtv');
      const thumb = sec.querySelector('#__agy_bg_thumb');
      const hint = sec.querySelector('#__agy_bg_hint');
      if (!on || !dim) return;
      on.checked = st.enabled !== false;
      // Both sliders read "larger = more transparent"; cfg.dimming means "larger = more opaque", so invert.
      const d = typeof st.dimming === 'number' ? (100 - st.dimming) : 97;
      dim.value = String(d);
      if (dimv) dimv.textContent = d + '%';
      const s = typeof st.sidebarTrans === 'number' ? st.sidebarTrans : 0;
      if (sbt) sbt.value = String(s);
      if (sbtv) sbtv.textContent = s + '%';
      const fh = sec.querySelector('#__agy_bg_fonthint');
      const fc = sec.querySelector('#__agy_bg_fontcode');
      if (fh) fh.textContent = st.fontName ? st.fontName : '未设置，用自带字体';
      if (fc) fc.checked = st.fontApplyCode === true;
      if (st.preview) {
        thumb.src = st.preview;
        thumb.style.display = 'block';
        if (hint) hint.textContent = st.cfg && st.cfg.image ? st.cfg.image : '已设置';
      } else {
        thumb.style.display = 'none';
        if (hint) hint.textContent = st.hasImage ? '图片缺失' : '未设置，点击 Choose… 选一张';
      }
    }

    function bind(sec) {
      if (sec.dataset.bound === '1') return;
      sec.dataset.bound = '1';

      const on = sec.querySelector('#__agy_bg_on');
      const dim = sec.querySelector('#__agy_bg_dim');
      const dimv = sec.querySelector('#__agy_bg_dimv');
      const sbt = sec.querySelector('#__agy_bg_sbt');
      const sbtv = sec.querySelector('#__agy_bg_sbtv');
      const pick = sec.querySelector('#__agy_bg_pick');
      const thumb = sec.querySelector('#__agy_bg_thumb');
      const hint = sec.querySelector('#__agy_bg_hint');
      const fbtn = sec.querySelector('#__agy_bg_font');
      const fclr = sec.querySelector('#__agy_bg_fontclr');
      const fh = sec.querySelector('#__agy_bg_fonthint');
      const fcode = sec.querySelector('#__agy_bg_fontcode');

      if (fbtn) {
        fbtn.addEventListener('click', function () {
          fbtn.disabled = true;
          fbtn.textContent = '…';
          ipcRenderer.invoke('agy-bg:pick-font').then(function (r) {
            fbtn.disabled = false;
            fbtn.textContent = 'Choose font…';
            if (r && r.ok) {
              inject(r.css);
              if (fh) fh.textContent = r.fontName || r.fontFile || '已设置';
            }
          }).catch(function () {
            fbtn.disabled = false;
            fbtn.textContent = 'Choose font…';
          });
        });
      }
      if (fclr) {
        fclr.addEventListener('click', function () {
          ipcRenderer.invoke('agy-bg:set-option', { fontFile: null }).then(function (r) {
            if (r && r.ok) {
              inject(r.css || '');
              if (fh) fh.textContent = '未设置，用自带字体';
            }
          }).catch(function () {});
        });
      }
      if (fcode) {
        fcode.addEventListener('change', function () {
          ipcRenderer.invoke('agy-bg:set-option', { fontApplyCode: fcode.checked }).then(function (r) {
            if (r && r.ok) inject(r.css || '');
          }).catch(function () {});
        });
      }

      on.addEventListener('change', function () {
        ipcRenderer.invoke('agy-bg:set-option', { enabled: on.checked })
          .then(function (r) { if (r && r.ok) inject(r.css); })
          .catch(function () {});
      });

      let inflight = false;
      let pending = null;
      let lastSent = null;

      let dimLast = null, dimFlying = false, dimQueue = null;
      let sbtLast = null, sbtFlying = false, sbtQueue = null;

      function paint(r) {
        if (!r || !r.ok) return;
        inject(r.css);
        const cb = sec.querySelector('#__agy_bg_on');
        if (cb) cb.checked = true;
      }

      // Live while dragging: input calls IPC directly; one request in flight, the
      // newest value overwrites the queue and is flushed as soon as the reply lands.
      function pushKey(key, val) {
        const n = Number(val);
        if (key === '__dim') {
          // Slider value = transparency (larger = clearer); config value = opacity. Invert.
          const cfgVal = 100 - n;
          if (dimLast === cfgVal) return;
          if (dimFlying) { dimQueue = cfgVal; return; }
          dimLast = cfgVal; dimFlying = true;
          ipcRenderer.invoke('agy-bg:set-option', { dimming: cfgVal, enabled: true })
            .then(function (r) {
              dimFlying = false; paint(r);
              if (dimQueue !== null) { const q = dimQueue; dimQueue = null; pushKey('__dim', 100 - q); }
            }).catch(function () {
              dimFlying = false;
              if (dimQueue !== null) { const q = dimQueue; dimQueue = null; pushKey('__dim', 100 - q); }
            });
        } else {
          if (sbtLast === n) return;
          if (sbtFlying) { sbtQueue = n; return; }
          sbtLast = n; sbtFlying = true;
          ipcRenderer.invoke('agy-bg:set-option', { sidebarTrans: n, enabled: true })
            .then(function (r) {
              sbtFlying = false; paint(r);
              if (sbtQueue !== null) { const q = sbtQueue; sbtQueue = null; pushKey('__sbt', q); }
            }).catch(function () {
              sbtFlying = false;
              if (sbtQueue !== null) { const q = sbtQueue; sbtQueue = null; pushKey('__sbt', q); }
            });
        }
      }

      dim.addEventListener('input', function () {
        if (dimv) dimv.textContent = dim.value + '%';
        pushKey('__dim', dim.value);
      });
      dim.addEventListener('change', function () {
        if (dimv) dimv.textContent = dim.value + '%';
        pushKey('__dim', dim.value);
      });

      if (sbt) {
        sbt.addEventListener('input', function () {
          if (sbtv) sbtv.textContent = sbt.value + '%';
          pushKey('__sbt', sbt.value);
        });
        sbt.addEventListener('change', function () {
          if (sbtv) sbtv.textContent = sbt.value + '%';
          pushKey('__sbt', sbt.value);
        });
      }

      pick.addEventListener('click', function () {
        pick.disabled = true;
        pick.textContent = '…';
        ipcRenderer.invoke('agy-bg:pick-image').then(function (r) {
          pick.disabled = false;
          pick.textContent = 'Choose…';
          if (r && r.ok) {
            inject(r.css);
            if (r.preview && thumb) {
              thumb.src = r.preview;
              thumb.style.display = 'block';
            }
            if (hint && r.image) hint.textContent = r.image;
            const cb = sec.querySelector('#__agy_bg_on');
            if (cb) cb.checked = true;
          }
        }).catch(function () {
          pick.disabled = false;
          pick.textContent = 'Choose…';
        });
      });
    }

    let injectScheduled = false;
    function findContainer() {
      const h2 = Array.prototype.find.call(
        document.querySelectorAll('h2'),
        function (e) { return (e.textContent || '').trim() === 'Appearance'; }
      );
      if (!h2) return null;
      let root = h2;
      for (let i = 0; i < 6 && root.parentElement; i++) {
        root = root.parentElement;
        if (typeof root.className === 'string' && root.className.indexOf('p-6') >= 0) break;
      }
      for (const c of root.children) {
        if (typeof c.className === 'string' && c.className.indexOf('gap-8') >= 0) return c;
      }
      return null;
    }

    function tryInjectUI() {
      if (injectScheduled) return;
      injectScheduled = true;
      setTimeout(function () {
        injectScheduled = false;
        try {
          const container = findContainer();
          if (!container) return;
          let sec = document.getElementById(SEC);
          if (!sec) {
            sec = buildSection();
            bind(sec);
            ipcRenderer.invoke('agy-bg:get-config').then(function (st) {
              if (st && st.ok) syncUI(sec, st);
            }).catch(function () {});
          }
          // Always append last: the native Theme block is rebuilt on Light/Dark switch and
          // reorders the list, so last-child is the only stable slot.
          if (container.lastElementChild !== sec) container.appendChild(sec);
        } catch (e) {}
      }, 180);
    }

    function boot() {
      refresh();
      const mo = new MutationObserver(function () { tryInjectUI(); });
      try {
        mo.observe(document.documentElement, { childList: true, subtree: true });
      } catch (e) {}
      tryInjectUI();
      window.addEventListener('load', refresh);
      setTimeout(refresh, 1000);
      setInterval(tryInjectUI, 1500);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
  } catch (err) {
    try { console.error('[agy-bg] preload error:', err); } catch (e) {}
  }
})();
