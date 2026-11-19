#!/usr/bin/env node
'use strict';
/**
 * Antigravity Custom Theme — patcher CLI.
 *
 * Appends a self-contained block to `dist/main.js` (IPC handlers) and
 * `dist/preload.js` (style injection + Settings > Appearance card) inside the
 * Electron ASAR archive, so the feature survives restarts without a debug port
 * and without any external daemon.
 *
 *   node lib/patcher.cjs --check      report current state
 *   node lib/patcher.cjs --build      produce a candidate archive, do not touch the app
 *   node lib/patcher.cjs --install    build, verify, then swap it in
 *   node lib/patcher.cjs --uninstall  restore the pristine archive
 *
 * Options:  --asar <path>   override the app.asar location
 *           --no-kill      do not terminate a running Antigravity
 *           --quiet        only print errors
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const asar = require('./asar.cjs');

const BEGIN = '// ===== AGY_BG_BEGIN =====';
// Matches the older patcher byte for byte (four trailing '='), so blocks written
// by either tool are recognised and replaced instead of stacking up.
const END = '// ===== AGY_BG_END ====';
const TARGETS = ['dist/main.js', 'dist/preload.js'];

const ROOT = path.resolve(__dirname, '..');
const INJECT_MAIN = path.join(ROOT, 'inject', 'inject-main.js');
const INJECT_PRELOAD = path.join(ROOT, 'inject', 'inject-preload.js');

const CONFIG_DIR = path.join(os.homedir(), '.gemini', 'config', 'agy-bg');

function arg(flag) {
  const at = process.argv.indexOf(flag);
  return at >= 0 ? process.argv[at + 1] : null;
}
const QUIET = process.argv.includes('--quiet');
function say(...parts) {
  if (!QUIET) console.log(...parts);
}

/**
 * Every place Antigravity is known to install to, per platform.
 *
 * macOS ships as a bundle, so the archive sits under Contents/Resources.
 * Linux builds land in /opt or /usr/share, and an AppImage mounts under
 * /tmp/.mount_* — the glob there is resolved by listing the parent instead of
 * relying on a shell, so this works with no child process at all.
 */
function candidateAsarPaths() {
  const out = [];
  if (process.platform === 'win32') {
    if (process.env.LOCALAPPDATA) {
      out.push(path.join(process.env.LOCALAPPDATA, 'Programs', 'antigravity', 'resources', 'app.asar'));
    }
    out.push('C:/Program Files/Antigravity/resources/app.asar');
    out.push('C:/Program Files/antigravity/resources/app.asar');
  } else if (process.platform === 'darwin') {
    out.push('/Applications/Antigravity.app/Contents/Resources/app.asar');
    out.push(path.join(os.homedir(), 'Applications', 'Antigravity.app', 'Contents', 'Resources', 'app.asar'));
  } else {
    out.push('/opt/Antigravity/resources/app.asar');
    out.push('/opt/antigravity/resources/app.asar');
    out.push('/usr/share/antigravity/resources/app.asar');
    out.push('/usr/local/share/antigravity/resources/app.asar');
    out.push('/snap/antigravity/current/resources/app.asar');
    try {
      for (const entry of fs.readdirSync('/tmp')) {
        if (!entry.startsWith('.mount_')) continue;
        out.push(path.join('/tmp', entry, 'resources', 'app.asar'));
      }
    } catch (e) {
      // No /tmp access; the fixed paths above are enough.
    }
  }
  if (process.env.ANTIGRAVITY_ASAR) out.unshift(process.env.ANTIGRAVITY_ASAR);
  return out;
}

function defaultAsarPath() {
  for (const candidate of candidateAsarPaths()) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(
    'Cannot locate app.asar on this platform. Pass --asar <path to resources/app.asar>,\n' +
    'or set ANTIGRAVITY_ASAR. Looked in:\n  ' + candidateAsarPaths().join('\n  ')
  );
}

const ASAR = path.resolve(arg('--asar') || defaultAsarPath());
const RES = path.dirname(ASAR);
const BACKUP = path.join(RES, 'app.asar.custom-theme.bak');
const STAGED = path.join(RES, 'app.asar.custom-theme.staged');

function readInject(file) {
  const text = fs.readFileSync(file, 'utf8');
  // Drop the two-line header the extractor adds; the wrapper supplies its own.
  return text.replace(/^'use strict';\s*/, '').replace(/^\/\/[^\n]*\n/, '').trim();
}

function wrap(injectText) {
  return BEGIN + '\n' + injectText + '\n' + END;
}

/** Remove every previously injected block (idempotent, in case of duplicates). */
function stripBlocks(text) {
  let out = text;
  for (let guard = 0; guard < 8; guard += 1) {
    const start = out.indexOf(BEGIN);
    if (start < 0) break;
    const stop = out.indexOf(END, start);
    if (stop < 0) throw new Error('Found a start marker without its end marker; archive is inconsistent.');
    out = out.slice(0, start) + out.slice(stop + END.length);
  }
  return out.replace(/\s+$/, '') + '\n';
}

function relaunchHint() {
  if (process.platform === 'win32') {
    const exe = path.join(installRoot(), 'Antigravity.exe');
    return fs.existsSync(exe) ? exe : null;
  }
  if (process.platform === 'darwin') {
    const app = path.resolve(installRoot(), '..', '..');
    return fs.existsSync(app) ? app : null;
  }
  const bin = path.join(installRoot(), 'antigravity');
  return fs.existsSync(bin) ? bin : null;
}

function hasAntigravityRunning() {
  const { execSync } = require('child_process');
  try {
    if (process.platform === 'win32') {
      const out = execSync('tasklist /FI "IMAGENAME eq Antigravity.exe" /NH', { encoding: 'utf8' });
      return /Antigravity\.exe/i.test(out);
    }
    // pgrep is present on macOS and most Linux distributions; -f matches the
    // full command line, so the bundle path counts too.
    const out = execSync('pgrep -f -i Antigravity', { encoding: 'utf8' });
    return out.trim().length > 0;
  } catch (e) {
    return false;
  }
}

function waitForUnlock() {
  const deadline = Date.now() + 25000;
  while (Date.now() < deadline) {
    try {
      const fd = fs.openSync(ASAR, 'r+');
      fs.closeSync(fd);
      return;
    } catch (e) {
      // Still held; sleep without shelling out so this works everywhere.
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 400);
    }
  }
  throw new Error('app.asar is still locked; close Antigravity and retry.');
}

function stopAntigravity() {
  const { execSync } = require('child_process');
  try {
    if (process.platform === 'win32') {
      execSync('taskkill /F /IM Antigravity.exe /T', { stdio: 'ignore' });
    } else {
      // SIGTERM first so the app can flush state, then make sure it is gone.
      try { execSync('pkill -f -i Antigravity', { stdio: 'ignore' }); } catch (e) { /* not running */ }
      for (let i = 0; i < 10 && hasAntigravityRunning(); i += 1) {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300);
      }
      if (hasAntigravityRunning()) {
        try { execSync('pkill -9 -f -i Antigravity', { stdio: 'ignore' }); } catch (e) { /* gone */ }
      }
    }
  } catch (e) {
    // Not running is fine.
  }
  waitForUnlock();
}

/** Where the app binary lives, for relaunch hints and the shell wrappers. */
function installRoot() {
  return path.resolve(RES, '..');
}

function inspect() {
  const archive = asar.open(ASAR);
  const main = asar.readText(archive, 'dist/main.js');
  const preload = asar.readText(archive, 'dist/preload.js');
  const nekoMain = main.includes('GEMINI_NEKO_HUD_BEGIN');
  const nekoPre = preload.includes('GEMINI_NEKO_HUD_BEGIN');
  return {
    asar: ASAR,
    bytes: fs.statSync(ASAR).size,
    customThemeInMain: main.includes(BEGIN),
    customThemeInPreload: preload.includes(BEGIN),
    nekoHudInMain: nekoMain,
    nekoHudInPreload: nekoPre,
    backup: fs.existsSync(BACKUP) ? fs.statSync(BACKUP).size : null,
    configDir: CONFIG_DIR
  };
}

function build() {
  const layout = asar.open(ASAR);
  const mainPatch = wrap(readInject(INJECT_MAIN));
  const prePatch = wrap(readInject(INJECT_PRELOAD));

  const replacements = new Map();
  replacements.set('dist/main.js', stripBlocks(asar.readText(layout, 'dist/main.js')) + '\n' + mainPatch + '\n');
  replacements.set('dist/preload.js', stripBlocks(asar.readText(layout, 'dist/preload.js')) + '\n' + prePatch + '\n');

  asar.rebuild(layout, STAGED, replacements);
  asar.verify(ASAR, STAGED, TARGETS, [
    { file: 'dist/main.js', marker: 'agy-bg:pick-font' },
    { file: 'dist/preload.js', marker: 'Custom Theme' },
    { file: 'dist/preload.js', marker: 'Choose font' }
  ]);
  say('candidate: ' + fs.statSync(STAGED).size + ' bytes');
  return STAGED;
}

// Backups written by earlier builds of this patch. Adopted on first install so
// upgrading in place does not trip the "already patched" guard below.
const LEGACY_BACKUPS = ['app.asar.before-bg.bak', 'app.asar.neko.bak'];

function ensureBackup() {
  if (fs.existsSync(BACKUP)) return;
  for (const name of LEGACY_BACKUPS) {
    const legacy = path.join(RES, name);
    if (!fs.existsSync(legacy)) continue;
    const pristine = asar.open(legacy);
    if (asar.readText(pristine, 'dist/main.js').includes(BEGIN)) continue;
    fs.copyFileSync(legacy, BACKUP);
    say('backup  : adopted ' + name + ' -> ' + path.basename(BACKUP) +
      ' (' + fs.statSync(BACKUP).size + ' bytes)');
    return;
  }
  const layout = asar.open(ASAR);
  const main = asar.readText(layout, 'dist/main.js');
  const preload = asar.readText(layout, 'dist/preload.js');
  if (main.includes(BEGIN) || preload.includes(BEGIN)) {
    throw new Error('app.asar already carries the patch but no pristine backup exists. ' +
      'Reinstall Antigravity, or restore a backup you made earlier, then rerun.');
  }
  fs.copyFileSync(ASAR, BACKUP);
  say('backup  : ' + BACKUP + ' (' + fs.statSync(BACKUP).size + ' bytes)');
}

function install() {
  if (!process.argv.includes('--no-kill') && hasAntigravityRunning()) {
    say('stopping Antigravity...');
    stopAntigravity();
  }
  ensureBackup();
  build();
  fs.copyFileSync(STAGED, ASAR);
  fs.unlinkSync(STAGED);
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
  say('installed: ' + fs.statSync(ASAR).size + ' bytes');
  say('config  : ' + CONFIG_DIR);
  const app = relaunchHint();
  say('Restart Antigravity' + (app ? ' (' + app + ')' : '') + ', then open Settings > Appearance.');
}

function uninstall() {
  if (!fs.existsSync(BACKUP)) throw new Error('No backup found at ' + BACKUP);
  if (!process.argv.includes('--no-kill') && hasAntigravityRunning()) {
    say('stopping Antigravity...');
    stopAntigravity();
  }
  fs.copyFileSync(BACKUP, ASAR);
  if (fs.existsSync(STAGED)) fs.unlinkSync(STAGED);
  say('restored: ' + ASAR + ' (' + fs.statSync(ASAR).size + ' bytes)');
  say('Kept your settings in ' + CONFIG_DIR + ' (delete that folder to reset).');
}

const mode = process.argv.find((a) => a.startsWith('--') && !['--no-kill', '--quiet', '--asar'].includes(a)) || '--check';

try {
  if (mode === '--check') {
    console.log(JSON.stringify(inspect(), null, 2));
  } else if (mode === '--build') {
    build();
    say('dry run only; pass --install to write it into the app.');
  } else if (mode === '--install') {
    install();
  } else if (mode === '--uninstall') {
    uninstall();
  } else {
    throw new Error('Unknown mode ' + mode + ' (use --check, --build, --install, --uninstall)');
  }
} catch (err) {
  console.error('ERROR: ' + err.message);
  process.exit(1);
}
