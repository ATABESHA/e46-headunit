/**
 * Apple CarPlay and Android Auto through a Carlinkit USB adapter
 * (uses the open-source node-carplay driver).
 *
 * The core talks to the adapter over USB, plays the phone's sound through the
 * laptop (PipeWire), and streams the phone's screen to the screen app.
 *
 * Topics:
 *   carplay.state   { status, phone, wifi, message }
 *                   status: "no-adapter" | "starting" | "waiting-phone" | "connected" | "error"
 *                   phone:  "CarPlay" | "Android Auto" | null
 *   carplay.media   { title, artist, album, app, duration, position, playing, coverVersion } | null
 *   carplay.hostUI  counter - goes up when the user taps the "car" button inside CarPlay
 *
 * Commands:
 *   carplay.key { key }   home, play, pause, next, prev, back, siri ...
 *   carplay.restart
 *
 * Streams:
 *   ws://127.0.0.1:8765/carplay   binary: H.264 video. text (from screen): {"t":"touch", x, y, action}
 *   http://127.0.0.1:8765/carplay/cover   album cover of the song playing on the phone
 */
import { spawn } from 'node:child_process';

const PHONE_TYPES = { 3: 'CarPlay', 5: 'Android Auto', 1: 'Android mirror', 4: 'iPhone mirror', 6: 'HiCar' };
const RETRY_MS = 3000;
const PLAYER_IDLE_MS = 15_000;
const TOUCH = { down: 14, move: 15, up: 16 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Plays raw 16-bit PCM through PipeWire (pw-cat), or ALSA (aplay) if pw-cat is missing. */
class PcmPlayer {
  constructor(rate, channels) {
    this.rate = rate;
    this.channels = channels;
    this.lastWrite = Date.now();
    this.proc = this.spawn('pw-cat', ['--playback', '--format', 's16', '--rate', String(rate), '--channels', String(channels), '-'], () => {
      this.proc = this.spawn('aplay', ['-q', '-t', 'raw', '-f', 'S16_LE', '-r', String(rate), '-c', String(channels)], () => {
        console.error('[carplay] no audio player found (install pipewire-bin or alsa-utils)');
        this.proc = null;
      });
    });
  }

  spawn(cmd, args, onMissing) {
    const proc = spawn(cmd, args, { stdio: ['pipe', 'ignore', 'ignore'] });
    proc.on('error', (err) => {
      if (err.code === 'ENOENT') onMissing();
    });
    proc.stdin.on('error', () => {}); // Player closed: ignore broken pipe.
    return proc;
  }

  write(int16) {
    this.lastWrite = Date.now();
    if (this.proc?.stdin.writable) this.proc.stdin.write(Buffer.from(int16.buffer, int16.byteOffset, int16.byteLength));
  }

  close() {
    this.proc?.stdin.end();
    this.proc?.kill();
    this.proc = null;
  }
}

export default async function carplay(hub, options = {}) {
  let lib;
  let usb;
  try {
    lib = await import('node-carplay/node');
    ({ webusb: usb } = await import('usb'));
  } catch (err) {
    hub.set('carplay.state', { status: 'error', phone: null, wifi: false, message: `CarPlay driver missing: ${err.message}` });
    return {};
  }

  const { DongleDriver, DEFAULT_CONFIG, Plugged, Unplugged, VideoData, AudioData, MediaData, Command, SendCommand, SendTouch, SendAudio, AudioCommand, CommandMapping, decodeTypeMap, NodeMicrophone } = lib;

  const config = {
    ...DEFAULT_CONFIG,
    width: options.width ?? 1008,
    height: options.height ?? 480,
    fps: options.fps ?? 30,
    dpi: options.dpi ?? 160,
    boxName: options.boxName ?? 'E46',
    wifiType: options.wifiType ?? '5ghz',
    nightMode: options.nightMode ?? true,
  };

  let driver = null;
  let device = null;
  let stopped = false;
  let frameTimer = null;
  let pairTimer = null;
  let mic = null;
  let lastVideoConfig = null;
  let cover = null;
  let coverVersion = 0;
  let hostUI = 0;
  const players = new Map();
  const viewers = new Set();

  const setState = (patch) => {
    const prev = hub.get('carplay.state') ?? { status: 'starting', phone: null, wifi: false, message: null };
    hub.set('carplay.state', { ...prev, ...patch });
  };
  setState({ status: 'starting', message: null });
  hub.set('carplay.media', null);
  hub.set('carplay.hostUI', hostUI);

  const send = (msg) => driver?.send(msg);

  // ---- Audio ----

  function playAudio(message) {
    if (message.command != null) {
      const c = message.command;
      if (c === AudioCommand.AudioPhonecallStart || c === AudioCommand.AudioSiriStart) startMic();
      if (c === AudioCommand.AudioPhonecallStop || c === AudioCommand.AudioSiriStop) stopMic();
      return;
    }
    if (!message.data) return;
    const format = decodeTypeMap[message.decodeType];
    if (!format) return;
    const key = `${message.audioType}:${format.frequency}:${format.channel}`;
    let player = players.get(key);
    if (!player) {
      player = new PcmPlayer(format.frequency, format.channel);
      players.set(key, player);
    }
    player.write(message.data);
  }

  const idleTimer = setInterval(() => {
    for (const [key, player] of players) {
      if (Date.now() - player.lastWrite > PLAYER_IDLE_MS) {
        player.close();
        players.delete(key);
      }
    }
  }, 5000);

  function startMic() {
    try {
      mic ??= new NodeMicrophone();
      mic.removeAllListeners('data');
      mic.on('data', (data) => send(new SendAudio(data)));
      mic.start();
    } catch (err) {
      console.error('[carplay] microphone:', err.message);
    }
  }

  function stopMic() {
    try {
      mic?.stop();
    } catch {
      // Already stopped.
    }
  }

  // ---- Video to the screen app ----

  function onVideo(message) {
    const size = `${message.width}x${message.height}`;
    if (size !== lastVideoConfig) {
      lastVideoConfig = size;
      for (const ws of viewers) ws.send(JSON.stringify({ t: 'size', width: message.width, height: message.height }));
    }
    for (const ws of viewers) {
      // Skip frames for a viewer that can't keep up instead of building a delay.
      if (ws.readyState === ws.OPEN && ws.bufferedAmount < 2_000_000) ws.send(message.data);
    }
  }

  const unsocket = hub.socket('/carplay', (ws) => {
    viewers.add(ws);
    if (lastVideoConfig) {
      const [width, height] = lastVideoConfig.split('x').map(Number);
      ws.send(JSON.stringify({ t: 'size', width, height }));
    }
    send(new SendCommand('frame')); // ask the phone for a full picture
    ws.on('message', (raw, isBinary) => {
      if (isBinary) return;
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.t === 'touch' && TOUCH[msg.action] !== undefined) {
          send(new SendTouch(Number(msg.x), Number(msg.y), TOUCH[msg.action]));
        } else if (msg.t === 'frame') {
          send(new SendCommand('frame'));
        }
      } catch {
        // Ignore malformed messages.
      }
    });
    ws.on('close', () => viewers.delete(ws));
  });

  const unroute = hub.route('/carplay/cover', (req, res) => {
    if (!cover) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-cache' });
    res.end(cover);
  });

  // ---- Messages from the adapter ----

  function onMessage(message) {
    if (message instanceof Plugged) {
      clearTimeout(pairTimer);
      const phone = PHONE_TYPES[message.phoneType] ?? 'Phone';
      setState({ status: 'connected', phone, wifi: Boolean(message.wifi), message: null });
      hub.notify('success', `${phone} connected${message.wifi ? ' (wireless)' : ''}`);
      clearInterval(frameTimer);
      // CarPlay needs a regular "send a full picture" request.
      if (message.phoneType === 3) frameTimer = setInterval(() => send(new SendCommand('frame')), 5000);
    } else if (message instanceof Unplugged) {
      clearInterval(frameTimer);
      setState({ status: 'waiting-phone', phone: null, wifi: false });
      hub.set('carplay.media', null);
      hub.notify('info', 'Phone disconnected from CarPlay');
    } else if (message instanceof VideoData) {
      onVideo(message);
    } else if (message instanceof AudioData) {
      playAudio(message);
    } else if (message instanceof MediaData) {
      const payload = message.payload;
      if (payload?.base64Image) {
        cover = Buffer.from(payload.base64Image, 'base64');
        coverVersion += 1;
        hub.set('carplay.media', { ...(hub.get('carplay.media') ?? {}), coverVersion });
      } else if (payload?.media) {
        const m = payload.media;
        hub.set('carplay.media', {
          ...(hub.get('carplay.media') ?? {}),
          title: m.MediaSongName ?? null,
          artist: m.MediaArtistName ?? null,
          album: m.MediaAlbumName ?? null,
          app: m.MediaAPPName ?? null,
          duration: m.MediaSongDuration ? Math.round(m.MediaSongDuration / 1000) : null,
          position: m.MediaSongPlayTime ? Math.round(m.MediaSongPlayTime / 1000) : null,
          playing: m.MediaPlayStatus === undefined ? true : m.MediaPlayStatus === 1,
        });
      }
    } else if (message instanceof Command) {
      if (message.value === 3) {
        // requestHostUI: the "car" button inside CarPlay was tapped.
        hub.set('carplay.hostUI', ++hostUI);
      }
    }
  }

  // ---- Adapter connection ----

  async function findAdapter() {
    try {
      return await usb.requestDevice({ filters: DongleDriver.knownDevices });
    } catch {
      return null; // requestDevice throws when nothing matches
    }
  }

  async function connect() {
    while (!stopped) {
      try {
        let found = await findAdapter();
        if (!found) {
          setState({ status: 'no-adapter', phone: null, message: null });
          await sleep(RETRY_MS);
          continue;
        }
        setState({ status: 'starting', message: null });

        // The adapter must be reset once; it disappears for a few seconds afterwards.
        await found.open();
        await found.reset();
        await found.close().catch(() => {});
        await sleep(RETRY_MS);
        found = await findAdapter();
        if (!found) continue;

        await found.open();
        device = found;
        driver = new DongleDriver();
        driver.on('message', onMessage);
        driver.on('failure', () => {
          setState({ status: 'error', message: 'Lost connection to the adapter. Reconnecting…' });
          restart();
        });
        await driver.initialise(device);
        await driver.start(config);
        setState({ status: 'waiting-phone', message: null });
        hub.notify('info', 'CarPlay adapter ready. Connect your phone.');
        // If no phone connects by itself, ask the adapter to start pairing.
        pairTimer = setTimeout(() => send(new SendCommand('wifiPair')), 15_000);
        return;
      } catch (err) {
        const denied = /LIBUSB_ERROR_ACCESS|Access denied/i.test(err.message);
        setState({
          status: 'error',
          message: denied
            ? 'No permission to use the adapter. Run: bash scripts/install.sh, then unplug and replug the adapter.'
            : `Adapter error: ${err.message}`,
        });
        await close();
        await sleep(RETRY_MS);
      }
    }
  }

  async function close() {
    clearInterval(frameTimer);
    clearTimeout(pairTimer);
    stopMic();
    try {
      await driver?.close();
    } catch {
      // Already closed.
    }
    driver = null;
    device = null;
  }

  let restarting = false;
  async function restart() {
    if (restarting) return;
    restarting = true;
    await close();
    await sleep(1000);
    restarting = false;
    connect();
  }

  // USB unplug of the adapter.
  const onDisconnect = (event) => {
    if (device && event.device === device) {
      hub.notify('warning', 'CarPlay adapter unplugged');
      restart();
    }
  };
  usb.addEventListener?.('disconnect', onDisconnect);

  const unregister = [
    hub.onCommand('carplay.key', ({ key } = {}) => {
      if (!driver) throw new Error('CarPlay adapter not connected');
      if (typeof key !== 'string' || CommandMapping[key] === undefined) throw new Error(`Unknown key "${key}"`);
      send(new SendCommand(key));
    }),
    hub.onCommand('carplay.restart', () => restart()),
  ];

  connect();

  return {
    async stop() {
      stopped = true;
      clearInterval(idleTimer);
      usb.removeEventListener?.('disconnect', onDisconnect);
      unsocket();
      unroute();
      unregister.forEach((fn) => fn());
      for (const player of players.values()) player.close();
      await close();
    },
  };
}
