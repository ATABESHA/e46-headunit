/**
 * Software updates from GitHub, started from Settings in the screen app.
 *
 * Topics:
 *   system.version   { commit, date, message }               what is installed now
 *   system.update    { status, behind, commits, message,      update state (see STATUS)
 *                      checkedAt, needsTerminal, restartApp }
 *
 * Commands:
 *   system.update.check   ask GitHub whether there is something new
 *   system.update.apply   download and install it
 *
 * The update only fast-forwards: if files were changed on the laptop itself,
 * it stops and says which ones, so nothing local is ever overwritten.
 */
import { execFile, spawn } from 'node:child_process';
import { stat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO = path.resolve(here, '..', '..', '..');

const STATUS = {
  IDLE: 'idle',
  CHECKING: 'checking',
  UP_TO_DATE: 'up-to-date',
  AVAILABLE: 'available',
  UPDATING: 'updating',
  DONE: 'done',
  ERROR: 'error',
};

const SEP = '\x1f';

function run(cmd, args, { cwd, timeoutMs = 60_000 } = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      cmd,
      args,
      {
        cwd,
        timeout: timeoutMs,
        maxBuffer: 10 * 1024 * 1024,
        // Never wait for a password prompt; fail with a clear error instead.
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_ASKPASS: 'true' },
      },
      (err, stdout, stderr) => {
        if (err) {
          const detail = (stderr || stdout || err.message).trim().split('\n').slice(-4).join('\n');
          reject(new Error(`${cmd} ${args[0]} failed: ${detail}`));
        } else {
          resolve(stdout.trim());
        }
      },
    );
  });
}

/** Turns git errors into something a person can act on. */
function explain(err) {
  const msg = err.message;
  if (/could not read Username|Authentication failed|terminal prompts disabled|403|401/i.test(msg)) {
    return 'GitHub login needed. In Terminal run: gh auth login';
  }
  if (/Could not resolve host|unable to access|Network is unreachable|timed out/i.test(msg)) {
    return 'No internet connection. Connect to Wi-Fi and try again.';
  }
  return msg;
}

export default function updater(hub, options = {}) {
  const repo = options.repoDir ? path.resolve(options.repoDir) : DEFAULT_REPO;
  const exec = options.run ?? run;
  const git = (...args) => exec('git', args, { cwd: repo });
  const autoCheckMs = options.autoCheckMinutes === 0 ? 0 : (options.autoCheckMinutes ?? 360) * 60_000;
  let busy = false;
  let state = { status: STATUS.IDLE, behind: 0, commits: [], message: null, checkedAt: null };

  const setState = (patch) => {
    state = { ...state, ...patch };
    hub.set('system.update', state);
  };

  async function readVersion() {
    try {
      const [commit, date, message] = (await git('log', '-1', `--format=%h${SEP}%cI${SEP}%s`)).split(SEP);
      hub.set('system.version', { commit, date, message });
    } catch (err) {
      hub.set('system.version', { commit: null, date: null, message: explain(err) });
    }
  }

  async function localChanges() {
    // Tracked files that differ from the last downloaded version (staged or not).
    const out = await git('diff', '--name-only', 'HEAD');
    return out ? out.split('\n') : [];
  }

  async function check() {
    if (busy) return state;
    busy = true;
    setState({ status: STATUS.CHECKING, message: null });
    try {
      await git('fetch', '--quiet', 'origin');
      const behind = Number(await git('rev-list', '--count', 'HEAD..@{u}'));
      const ahead = Number(await git('rev-list', '--count', '@{u}..HEAD'));
      const log = behind ? await git('log', `--format=%h${SEP}%s${SEP}%cI`, 'HEAD..@{u}') : '';
      const commits = log
        ? log.split('\n').map((line) => {
            const [hash, message, date] = line.split(SEP);
            return { hash, message, date };
          })
        : [];
      let message = null;
      if (ahead && behind) {
        message = `This laptop has ${ahead} change(s) that are not on GitHub. Upload or remove them before updating.`;
      }
      setState({
        status: behind ? STATUS.AVAILABLE : STATUS.UP_TO_DATE,
        behind,
        commits,
        message,
        checkedAt: new Date().toISOString(),
        needsTerminal: null,
        restartApp: false,
      });
    } catch (err) {
      setState({ status: STATUS.ERROR, message: explain(err), checkedAt: new Date().toISOString() });
    } finally {
      busy = false;
    }
    return state;
  }

  async function sandboxOk() {
    try {
      const electronPath = (await readFile(path.join(repo, 'node_modules', 'electron', 'path.txt'), 'utf8')).trim();
      const helper = path.join(repo, 'node_modules', 'electron', 'dist', path.dirname(electronPath), 'chrome-sandbox');
      const info = await stat(helper);
      return info.uid === 0 && (info.mode & 0o4000) !== 0;
    } catch {
      return true; // Electron not installed here (e.g. tests): nothing to check.
    }
  }

  async function apply() {
    if (busy) throw new Error('An update or check is already running');
    busy = true;
    try {
      const changed = await localChanges();
      if (changed.length) {
        throw new Error(`Files were changed on this laptop: ${changed.join(', ')}. Upload them to GitHub or undo them first.`);
      }

      setState({ status: STATUS.UPDATING, message: 'Downloading…' });
      const before = await git('rev-parse', 'HEAD');
      await git('pull', '--ff-only', '--quiet');
      const after = await git('rev-parse', 'HEAD');
      const files = before === after ? [] : (await git('diff', '--name-only', before, after)).split('\n').filter(Boolean);

      const depsChanged = files.some((f) => /(^|\/)package(-lock)?\.json$/.test(f));
      const uiChanged = files.some((f) => f.startsWith('ui/'));
      const coreChanged = files.some((f) => f.startsWith('core/'));

      if (depsChanged) {
        setState({ message: 'Installing new components…' });
        // "install" (not "ci") leaves unchanged packages alone, so Electron keeps its settings.
        await exec('npm', ['install', '--no-audit', '--no-fund'], { cwd: repo, timeoutMs: 15 * 60_000 });
      }
      if (uiChanged || depsChanged) {
        setState({ message: 'Building the screen app…' });
        await exec('npm', ['run', 'build'], { cwd: repo, timeoutMs: 5 * 60_000 });
      }

      // Only a reinstall of components can undo the Electron permission step.
      let needsTerminal = depsChanged && !(await sandboxOk()) ? 'cd ~/e46-headunit && bash scripts/update.sh' : null;
      // New system settings (permissions, packages) can only be applied with the password.
      if (files.includes('scripts/install.sh')) needsTerminal = 'cd ~/e46-headunit && bash scripts/install.sh';
      await readVersion();
      setState({
        status: STATUS.DONE,
        behind: 0,
        commits: [],
        message: files.length ? `Updated ${files.length} file(s).` : 'Already up to date.',
        needsTerminal,
        restartApp: files.some((f) => f.startsWith('ui/electron/')),
      });

      // Restart the core so new core code runs. systemd starts it again.
      if ((coreChanged || depsChanged) && process.env.INVOCATION_ID && !options.noRestart) {
        setTimeout(() => {
          spawn('systemctl', ['--user', 'restart', 'e46-core.service'], { detached: true, stdio: 'ignore' }).unref();
        }, 1500);
      }
      return state;
    } catch (err) {
      setState({ status: STATUS.ERROR, message: explain(err) });
      throw new Error(explain(err));
    } finally {
      busy = false;
    }
  }

  const unregister = [
    hub.onCommand('system.update.check', () => check()),
    hub.onCommand('system.update.apply', () => apply()),
  ];

  hub.set('system.update', state);
  readVersion();

  // Check by itself shortly after start-up and then every few hours.
  const timers = [];
  if (autoCheckMs) {
    timers.push(setTimeout(check, options.firstCheckMs ?? 30_000));
    timers.push(setInterval(check, autoCheckMs));
  }

  return {
    stop() {
      timers.forEach((t) => clearTimeout(t));
      unregister.forEach((fn) => fn());
    },
  };
}
