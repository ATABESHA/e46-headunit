import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Hub } from '../src/hub.js';
import { startServer } from '../src/server.js';
import media from '../src/plugins/media.js';
import radio from '../src/plugins/radio.js';
import phone from '../src/plugins/phone.js';
import trip from '../src/plugins/trip.js';
import audio from '../src/plugins/audio.js';

const quiet = { info() {}, error() {} };
let dataDir;

before(() => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'e46-data-'));
  process.env.E46_DATA_DIR = dataDir;
});
after(() => rmSync(dataDir, { recursive: true, force: true }));

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test('media: finds music in folders and USB sticks, serves files with seeking', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'e46-media-'));
  const music = path.join(root, 'Music');
  const usbRoot = path.join(root, 'usb');
  mkdirSync(path.join(music, 'Album'), { recursive: true });
  mkdirSync(usbRoot);
  writeFileSync(path.join(music, 'Album', 'song one.mp3'), Buffer.alloc(1000, 1));
  writeFileSync(path.join(music, 'notes.txt'), 'not music');
  writeFileSync(path.join(music, '.hidden.mp3'), 'hidden');

  const hub = new Hub();
  const notices = [];
  hub.on('state', (topic, value) => topic === 'system.notice' && notices.push(value.text));
  const plugin = await media(hub, { folders: [music], usbRoots: [usbRoot], pollMs: 50 });
  const server = await startServer(hub, { port: 0, log: quiet });
  const base = `http://127.0.0.1:${server.port}`;
  try {
    await plugin.ready;
    let library = await (await fetch(`${base}/media/library?source=local`)).json();
    assert.equal(library.length, 1);
    assert.equal(library[0].title, 'song one'); // no tags: file name is the title
    assert.equal(library[0].folder, 'Album');
    assert.equal(library[0].file, undefined, 'file paths are never sent to the screen');

    const part = await fetch(`${base}/media/file/${library[0].id}`, { headers: { Range: 'bytes=100-199' } });
    assert.equal(part.status, 206);
    assert.equal(part.headers.get('content-range'), 'bytes 100-199/1000');
    assert.equal((await part.arrayBuffer()).byteLength, 100);

    assert.equal((await fetch(`${base}/media/file/doesnotexist`)).status, 404);
    assert.equal((await fetch(`${base}/media/file/..%2F..%2Fetc%2Fpasswd`)).status, 404);

    // Plug in a USB stick.
    mkdirSync(path.join(usbRoot, 'MY_USB'));
    writeFileSync(path.join(usbRoot, 'MY_USB', 'track.flac'), Buffer.alloc(10));
    await wait(300);
    const usb = hub.get('media.sources').find((s) => s.type === 'usb');
    assert.equal(usb.name, 'MY_USB');
    assert.equal(usb.tracks, 1);
    assert.ok(notices.some((t) => t.includes('USB stick connected: MY_USB')));

    // Remove it.
    rmSync(path.join(usbRoot, 'MY_USB'), { recursive: true });
    await wait(300);
    assert.equal(hub.get('media.sources').filter((s) => s.type === 'usb').length, 0);
    library = await (await fetch(`${base}/media/library`)).json();
    assert.equal(library.length, 1);
  } finally {
    plugin.stop();
    await server.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test('radio: search results, favourites are saved and limited', async () => {
  const hub = new Hub();
  const fakeFetch = async (url) => {
    assert.match(url, /countrycode=ES/);
    return [
      { stationuuid: 'a', name: 'Radio A', url_resolved: 'https://a.example/stream', countrycode: 'ES', tags: 'pop,hits,spain,extra' },
      { stationuuid: 'b', name: 'No URL', url_resolved: '' },
    ];
  };
  const plugin = await radio(hub, { fetch: fakeFetch, country: 'ES' });
  try {
    const top = await hub.command('radio.top', {});
    assert.equal(top.length, 1);
    assert.equal(top[0].tags, 'pop, hits, spain');

    await hub.command('radio.savePreset', top[0]);
    await hub.command('radio.savePreset', top[0]); // saving twice keeps one
    assert.equal(hub.get('radio.presets').length, 1);
    await assert.rejects(hub.command('radio.savePreset', { name: 'bad', url: 'file:///etc/passwd' }), /web address/);

    await hub.command('radio.removePreset', { id: 'a' });
    assert.equal(hub.get('radio.presets').length, 0);
  } finally {
    plugin.stop();
  }
});

test('phone: outgoing call connects, can be muted and ended', async () => {
  const hub = new Hub();
  const plugin = phone(hub, { connectMs: 20, endedMs: 20 });
  try {
    await assert.rejects(hub.command('phone.dial', { number: '1' }), /Enter a phone number/);
    await hub.command('phone.dial', { number: '+34 600 100 201' });
    assert.equal(hub.get('phone.call').state, 'outgoing');
    assert.equal(hub.get('phone.call').name, 'Ana García');
    await wait(40);
    assert.equal(hub.get('phone.call').state, 'active');
    await hub.command('phone.mute', { muted: true });
    assert.equal(hub.get('phone.call').muted, true);
    await hub.command('phone.hangup');
    assert.equal(hub.get('phone.call').state, 'ended');
    await wait(40);
    assert.equal(hub.get('phone.call'), null);
    assert.equal(hub.get('phone.history')[0].direction, 'out');
  } finally {
    plugin.stop();
  }
});

test('phone: incoming call can be rejected and shows as missed', async () => {
  const hub = new Hub();
  const plugin = phone(hub, { connectMs: 20, endedMs: 20 });
  try {
    await hub.command('sim.incomingCall', { contactId: 'c2' });
    assert.equal(hub.get('phone.call').state, 'incoming');
    await hub.command('phone.reject');
    assert.equal(hub.get('phone.history')[0].direction, 'missed');
    assert.equal(hub.get('phone.history')[0].name, 'Carlos Martín');
  } finally {
    plugin.stop();
  }
});

test('trip: adds up distance while driving', async () => {
  const hub = new Hub();
  hub.set('vehicle.ignition', 'run');
  hub.set('vehicle.speed', 3600); // 1 km per second, to keep the test short
  const plugin = await trip(hub, { tickMs: 100 });
  try {
    await wait(350);
    const t = hub.get('trip.sinceStart');
    assert.ok(t.distanceKm >= 0.2 && t.distanceKm <= 0.4, `distance ${t.distanceKm}`);
    assert.equal(t.maxSpeed, 3600);
    await hub.command('trip.reset', { which: 'sinceStart' });
    assert.equal(hub.get('trip.sinceStart').distanceKm, 0);
    assert.ok(hub.get('trip.longTerm').distanceKm > 0);
  } finally {
    await plugin.stop();
  }
});

test('audio: reads and sets system volume through wpctl', async () => {
  let level = 0.4;
  let muted = false;
  const calls = [];
  const fakeWpctl = async (args) => {
    calls.push(args.join(' '));
    if (args[0] === 'get-volume') return `Volume: ${level.toFixed(2)}${muted ? ' [MUTED]' : ''}`;
    if (args[0] === 'set-volume') level = Number(args[2]);
    if (args[0] === 'set-mute') muted = args[2] === '1';
    return '';
  };
  const hub = new Hub();
  const plugin = await audio(hub, { wpctl: fakeWpctl, pollMs: 10_000 });
  try {
    assert.deepEqual(hub.get('audio.volume'), { level: 40, muted: false, available: true });
    await hub.command('audio.volumeStep', { delta: 5 });
    assert.equal(hub.get('audio.volume').level, 45);
    await hub.command('audio.mute', {});
    assert.equal(hub.get('audio.volume').muted, true);
    await hub.command('audio.setVolume', { level: 150 });
    assert.equal(hub.get('audio.volume').level, 100);
    assert.equal(hub.get('audio.volume').muted, false, 'turning volume up unmutes');

    await hub.command('audio.setSound', { bass: 4, treble: -20 });
    assert.deepEqual(hub.get('audio.sound'), { bass: 4, mid: 0, treble: -10, balance: 0 });
  } finally {
    plugin.stop();
  }
});

test('sysinfo: reads CPU, memory and this system\'s own processes', async () => {
  const { default: sysinfo, parseCpuLine, parseMeminfo, parseProcTicks } = await import('../src/plugins/sysinfo.js');
  assert.deepEqual(parseCpuLine('cpu  100 0 50 800 50 0 0 0 0 0'), { busy: 150, total: 1000 });
  assert.deepEqual(parseMeminfo('MemTotal:       16384000 kB\nMemFree: 1 kB\nMemAvailable:    8192000 kB\n'), { totalMB: 16000, usedMB: 8000 });
  assert.equal(parseProcTicks('123 (my (weird) name) S 1 2 3 4 5 6 7 8 9 10 250 50 0 0'), 300);

  const hub = new Hub();
  const plugin = await sysinfo(hub, { intervalMs: 100 });
  try {
    await wait(250);
    const s = hub.get('system.stats');
    assert.ok(s.memTotalMB > 0 && s.memUsedMB > 0);
    assert.ok(s.cpu >= 0 && s.cpu <= 100);
    assert.ok(s.app.processes >= 1, 'finds at least the core itself');
    assert.ok(s.app.memMB > 0);
  } finally {
    plugin.stop();
  }
});
