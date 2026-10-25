import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Hub } from '../src/hub.js';
import updater from '../src/plugins/updater.js';

const ID = ['-c', 'user.name=Test', '-c', 'user.email=test@example.com'];
const git = (cwd, ...args) => execFileSync('git', [...ID, ...args], { cwd, encoding: 'utf8' }).trim();

/** A fake "GitHub" (bare repo), a laptop clone and a developer clone. */
function setup() {
  const root = mkdtempSync(path.join(tmpdir(), 'e46-updater-'));
  const origin = path.join(root, 'origin.git');
  const laptop = path.join(root, 'laptop');
  const dev = path.join(root, 'dev');
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', origin]);
  execFileSync('git', ['clone', '-q', origin, dev]);
  writeFileSync(path.join(dev, 'README.md'), 'v1\n');
  git(dev, 'add', '.');
  git(dev, 'commit', '-qm', 'First version');
  git(dev, 'push', '-q', 'origin', 'HEAD:main');
  execFileSync('git', ['clone', '-q', origin, laptop]);

  const publish = (file, content, message) => {
    writeFileSync(path.join(dev, file), content);
    git(dev, 'add', '.');
    git(dev, 'commit', '-qm', message);
    git(dev, 'push', '-q', 'origin', 'HEAD:main');
  };
  return { root, laptop, publish, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

function start(repoDir) {
  const hub = new Hub();
  const plugin = updater(hub, { repoDir, autoCheckMinutes: 0, noRestart: true });
  return { hub, plugin };
}

test('updater: reports up to date, then finds and installs a new version', async () => {
  const env = setup();
  const { hub, plugin } = start(env.laptop);
  try {
    let result = await hub.command('system.update.check');
    assert.equal(result.status, 'up-to-date');

    env.publish('README.md', 'v2\n', 'Better README');
    result = await hub.command('system.update.check');
    assert.equal(result.status, 'available');
    assert.equal(result.behind, 1);
    assert.equal(result.commits[0].message, 'Better README');

    result = await hub.command('system.update.apply');
    assert.equal(result.status, 'done');
    assert.equal(git(env.laptop, 'log', '-1', '--format=%s'), 'Better README');
    assert.equal(hub.get('system.version').message, 'Better README');
  } finally {
    plugin.stop();
    env.cleanup();
  }
});

test('updater: refuses to overwrite files changed on the laptop', async () => {
  const env = setup();
  const { hub, plugin } = start(env.laptop);
  try {
    env.publish('README.md', 'v2\n', 'Remote change');
    writeFileSync(path.join(env.laptop, 'README.md'), 'my own edit\n');
    await assert.rejects(hub.command('system.update.apply'), /changed on this laptop: README\.md/);
    assert.equal(hub.get('system.update').status, 'error');
  } finally {
    plugin.stop();
    env.cleanup();
  }
});

test('updater: explains a missing connection', async () => {
  const env = setup();
  git(env.laptop, 'remote', 'set-url', 'origin', 'https://nonexistent.invalid/repo.git');
  const { hub, plugin } = start(env.laptop);
  try {
    const result = await hub.command('system.update.check');
    assert.equal(result.status, 'error');
    assert.ok(result.message.length > 0);
  } finally {
    plugin.stop();
    env.cleanup();
  }
});
