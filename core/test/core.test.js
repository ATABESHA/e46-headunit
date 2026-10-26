import { test } from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { Hub } from '../src/hub.js';
import { startServer } from '../src/server.js';
import simulator from '../src/plugins/simulator.js';

const quiet = { info() {} };

test('hub only reports changed values', () => {
  const hub = new Hub();
  const seen = [];
  hub.on('state', (topic, value) => seen.push([topic, value]));
  hub.set('vehicle.speed', 10);
  hub.set('vehicle.speed', 10);
  hub.set('vehicle.speed', 11);
  assert.deepEqual(seen, [['vehicle.speed', 10], ['vehicle.speed', 11]]);
  assert.equal(hub.get('vehicle.speed'), 11);
});

test('hub routes commands and rejects unknown ones', async () => {
  const hub = new Hub();
  hub.onCommand('echo', (v) => v * 2);
  assert.equal(await hub.command('echo', 21), 42);
  await assert.rejects(hub.command('missing'), /No handler/);
  assert.throws(() => hub.onCommand('echo', () => {}), /already has a handler/);
});

function connect(port) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  const inbox = [];
  const waiters = [];
  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    const i = waiters.findIndex((w) => w.match(msg));
    if (i >= 0) waiters.splice(i, 1)[0].resolve(msg);
    else inbox.push(msg);
  });
  const next = (match) => {
    const i = inbox.findIndex(match);
    if (i >= 0) return Promise.resolve(inbox.splice(i, 1)[0]);
    return new Promise((resolve) => waiters.push({ match, resolve }));
  };
  return new Promise((resolve) => ws.on('open', () => resolve({ ws, next })));
}

test('server sends snapshot, runs commands and accepts published values', async () => {
  const hub = new Hub();
  hub.set('vehicle.speed', 50);
  hub.onCommand('double', (v) => v * 2);
  hub.onCommand('fail', () => {
    throw new Error('nope');
  });
  const server = await startServer(hub, { port: 0, log: quiet });
  const { ws, next } = await connect(server.port);

  const snap = await next((m) => m.type === 'snapshot');
  assert.equal(snap.state['vehicle.speed'], 50);
  assert.ok(snap.commands.includes('double'));

  ws.send(JSON.stringify({ type: 'command', id: 1, topic: 'double', value: 4 }));
  assert.deepEqual(await next((m) => m.id === 1), { type: 'result', id: 1, ok: true, value: 8 });

  ws.send(JSON.stringify({ type: 'command', id: 2, topic: 'fail' }));
  const failed = await next((m) => m.id === 2);
  assert.equal(failed.ok, false);
  assert.equal(failed.error, 'nope');

  ws.send(JSON.stringify({ type: 'publish', topic: 'my.sensor', value: 7 }));
  const update = await next((m) => m.type === 'state' && m.topic === 'my.sensor');
  assert.equal(update.value, 7);
  assert.equal(hub.get('my.sensor'), 7);

  ws.close();
  await server.close();
});

test('simulator: park scenario turns on reverse and parking distances', async () => {
  const hub = new Hub();
  const sim = simulator(hub, { tickMs: 10, scanMs: 10 });
  try {
    assert.equal(hub.get('vehicle.reverse'), false);
    await hub.command('sim.scenario', 'park');
    await new Promise((r) => setTimeout(r, 40));
    assert.equal(hub.get('vehicle.reverse'), true);
    assert.equal(typeof hub.get('parking.distances').rearMidRight, 'number');
    await assert.rejects(hub.command('sim.scenario', 'fly'), /Scenario must be/);
  } finally {
    sim.stop();
  }
});

test('simulator: ambient lighting validates input', async () => {
  const hub = new Hub();
  const sim = simulator(hub, { tickMs: 1000 });
  try {
    await hub.command('ambient.set', { color: '#00AAFF', brightness: 150 });
    assert.deepEqual(hub.get('ambient.state'), { on: true, color: '#00aaff', brightness: 100 });
    await assert.rejects(hub.command('ambient.set', { color: 'blue' }), /Color must/);
  } finally {
    sim.stop();
  }
});

test('simulator: clearing codes keeps active faults', async () => {
  const hub = new Hub();
  const sim = simulator(hub, { tickMs: 1000, scanMs: 5 });
  try {
    assert.equal(hub.get('diag.codes').length, 3);
    await hub.command('diag.clear', {});
    const left = hub.get('diag.codes');
    assert.equal(left.length, 1);
    assert.equal(left[0].status, 'active');
    assert.equal(await hub.command('diag.scan'), 1);
    assert.equal(hub.get('diag.scanning'), false);
  } finally {
    sim.stop();
  }
});

test('simulator: cluster lights do a bulb check, then follow forced warnings', async () => {
  const hub = new Hub();
  const sim = simulator(hub, { tickMs: 500 });
  try {
    assert.equal(hub.get('vehicle.lamps').oil, true, 'all warnings on at start');
    await new Promise((r) => setTimeout(r, 2700));
    assert.equal(hub.get('vehicle.lamps').oil, false);
    await hub.command('sim.lamp', { name: 'oil', on: true });
    await new Promise((r) => setTimeout(r, 600));
    assert.equal(hub.get('vehicle.lamps').oil, true);
    assert.match(hub.get('vehicle.gear'), /^[1-5]$/);
    assert.ok(hub.get('vehicle.odometer') >= 187_432);
    await assert.rejects(hub.command('sim.lamp', { name: 'nope', on: true }), /Lamp must be/);

    // Light test: every light on, then back to normal.
    await hub.command('sim.lampsAll', { on: true });
    await new Promise((r) => setTimeout(r, 600));
    const lamps = hub.get('vehicle.lamps');
    for (const name of ['tirePressure', 'dsc', 'parkBrake', 'service', 'checkEngine', 'cruise', 'highBeam']) {
      assert.equal(lamps[name], true, `${name} on`);
    }
    await hub.command('sim.lampsAll', { on: false });
    await new Promise((r) => setTimeout(r, 600));
    assert.equal(hub.get('vehicle.lamps').tirePressure, false);
    assert.deepEqual(Object.values(hub.get('sim.lampsForced')).filter(Boolean), []);
  } finally {
    sim.stop();
  }
});

test('server: serves the built screen app for a web browser', async () => {
  const { mkdtemp, writeFile } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const path = await import('node:path');
  const dir = await mkdtemp(path.join(tmpdir(), 'e46-ui-'));
  await writeFile(path.join(dir, 'index.html'), '<h1>head unit</h1>');
  await writeFile(path.join(dir, 'cluster.html'), '<h1>cluster</h1>');
  const quiet = { info() {}, error() {} };
  const server = await startServer(new Hub(), { port: 0, log: quiet, uiDir: dir });
  const base = `http://127.0.0.1:${server.port}`;
  try {
    const home = await fetch(`${base}/`);
    assert.equal(home.status, 200);
    assert.match(home.headers.get('content-type'), /text\/html/);
    assert.equal(await home.text(), '<h1>head unit</h1>');
    assert.equal(await (await fetch(`${base}/cluster.html`)).text(), '<h1>cluster</h1>');
    assert.equal((await fetch(`${base}/nope.js`)).status, 404);
    assert.equal((await fetch(`${base}/%2e%2e/%2e%2e/etc/passwd`)).status, 404);
  } finally {
    await server.close();
  }
});
