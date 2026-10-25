/**
 * Music library: the laptop's Music folder plus every USB stick that is plugged in.
 *
 * Topics:
 *   media.sources   [{ id, name, type: "local"|"usb", tracks, scanning }]
 *
 * Commands:
 *   media.rescan    scan all sources again
 *
 * HTTP (for the screen app):
 *   /media/library?source=<id>   track list as JSON
 *   /media/file/<trackId>        the audio file (supports seeking)
 *   /media/art/<trackId>         embedded album art, if any
 *
 * Only files found by the scan can be fetched - never arbitrary paths.
 */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { homedir, userInfo } from 'node:os';
import path from 'node:path';

const AUDIO = {
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.flac': 'audio/flac',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.wav': 'audio/wav',
  '.webm': 'audio/webm',
};
const MAX_FILES = 20_000;
const MAX_DEPTH = 8;

const idFor = (text) => createHash('sha1').update(text).digest('hex').slice(0, 16);

async function findAudio(dir, depth = 0, out = []) {
  if (depth > MAX_DEPTH || out.length >= MAX_FILES) return out;
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await findAudio(full, depth + 1, out);
    else if (entry.isFile() && AUDIO[path.extname(entry.name).toLowerCase()]) out.push(full);
    if (out.length >= MAX_FILES) break;
  }
  return out;
}

/** Folders where Ubuntu mounts USB sticks. */
async function usbMounts(roots) {
  const found = [];
  for (const root of roots) {
    try {
      for (const entry of await readdir(root, { withFileTypes: true })) {
        if (entry.isDirectory()) found.push(path.join(root, entry.name));
      }
    } catch {
      // Root does not exist on this system.
    }
  }
  return found.sort();
}

export default async function media(hub, options = {}) {
  const user = userInfo().username;
  const localFolders = options.folders ?? [path.join(homedir(), 'Music')];
  const usbRoots = options.usbRoots ?? [`/media/${user}`, `/run/media/${user}`];
  const pollMs = options.pollMs ?? 4000;
  let mm = null; // music-metadata, loaded on first use

  const sources = new Map(); // id -> { id, name, type, root(s), tracks: Map, scanning }
  const tracks = new Map(); // trackId -> { file, sourceId, ... }

  const publish = () =>
    hub.set(
      'media.sources',
      [...sources.values()].map((s) => ({ id: s.id, name: s.name, type: s.type, tracks: s.tracks.size, scanning: s.scanning })),
    );

  async function readTags(file) {
    try {
      mm ??= await import('music-metadata');
      const { common, format } = await mm.parseFile(file, { duration: false, skipCovers: true });
      return {
        title: common.title || null,
        artist: common.artist || common.albumartist || null,
        album: common.album || null,
        trackNo: common.track?.no ?? null,
        duration: format.duration ? Math.round(format.duration) : null,
      };
    } catch {
      return {}; // Missing or broken tags must not break the library.
    }
  }

  async function scan(source) {
    source.scanning = true;
    publish();
    const files = [];
    for (const root of source.roots) await findAudio(root, 0, files);

    // Remove old tracks of this source, then add the new list.
    for (const id of source.tracks.keys()) tracks.delete(id);
    source.tracks.clear();

    for (const file of files) {
      const id = idFor(`${source.id}:${file}`);
      const rel = path.relative(source.roots.find((r) => file.startsWith(r)) ?? '', file);
      const track = {
        id,
        file,
        sourceId: source.id,
        folder: path.dirname(rel) === '.' ? '' : path.dirname(rel),
        title: path.basename(file, path.extname(file)),
        artist: null,
        album: null,
        trackNo: null,
        duration: null,
      };
      source.tracks.set(id, track);
      tracks.set(id, track);
    }
    publish();

    // Tags take longer; read them after the list is already usable.
    for (const track of source.tracks.values()) {
      if (!sources.has(source.id)) return; // USB stick removed during the scan
      const tags = await readTags(track.file);
      Object.assign(track, Object.fromEntries(Object.entries(tags).filter(([, v]) => v !== null && v !== undefined)));
    }
    source.scanning = false;
    publish();
  }

  async function addSource(id, name, type, roots) {
    const source = { id, name, type, roots, tracks: new Map(), scanning: false };
    sources.set(id, source);
    await scan(source);
  }

  function removeSource(id) {
    const source = sources.get(id);
    if (!source) return;
    for (const trackId of source.tracks.keys()) tracks.delete(trackId);
    sources.delete(id);
    publish();
  }

  let knownMounts = [];
  async function checkUsb() {
    const mounts = await usbMounts(usbRoots);
    const added = mounts.filter((m) => !knownMounts.includes(m));
    const removed = knownMounts.filter((m) => !mounts.includes(m));
    knownMounts = mounts;
    for (const mount of removed) {
      removeSource(idFor(mount));
      hub.notify('info', `USB stick removed: ${path.basename(mount)}`);
    }
    for (const mount of added) {
      hub.notify('success', `USB stick connected: ${path.basename(mount)}`);
      addSource(idFor(mount), path.basename(mount), 'usb', [mount]).catch((err) => console.error('[media]', err));
    }
  }

  // ---- HTTP ----

  const unroute = hub.route('/media/', async (req, res, url) => {
    const parts = url.pathname.split('/').filter(Boolean); // ["media", kind, id?]
    const kind = parts[1];

    if (kind === 'library') {
      const sourceId = url.searchParams.get('source');
      const list = [...tracks.values()]
        .filter((t) => !sourceId || t.sourceId === sourceId)
        .map(({ file, ...rest }) => rest);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(list));
      return;
    }

    const track = tracks.get(parts[2]);
    if (!track) {
      res.writeHead(404);
      res.end();
      return;
    }

    if (kind === 'art') {
      mm ??= await import('music-metadata');
      const { common } = await mm.parseFile(track.file, { duration: false }).catch(() => ({ common: {} }));
      const picture = common.picture?.[0];
      if (!picture) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, { 'Content-Type': picture.format, 'Cache-Control': 'max-age=86400' });
      res.end(Buffer.from(picture.data));
      return;
    }

    if (kind === 'file') {
      const { size } = await stat(track.file);
      const type = AUDIO[path.extname(track.file).toLowerCase()] ?? 'application/octet-stream';
      const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '');
      if (range) {
        let start = range[1] ? Number(range[1]) : 0;
        let end = range[2] ? Number(range[2]) : size - 1;
        if (!range[1] && range[2]) {
          start = Math.max(0, size - Number(range[2])); // "bytes=-500" = last 500 bytes
          end = size - 1;
        }
        if (start >= size || end < start) {
          res.writeHead(416, { 'Content-Range': `bytes */${size}` });
          res.end();
          return;
        }
        end = Math.min(end, size - 1);
        res.writeHead(206, {
          'Content-Type': type,
          'Content-Length': end - start + 1,
          'Content-Range': `bytes ${start}-${end}/${size}`,
          'Accept-Ranges': 'bytes',
        });
        createReadStream(track.file, { start, end }).pipe(res);
      } else {
        res.writeHead(200, { 'Content-Type': type, 'Content-Length': size, 'Accept-Ranges': 'bytes' });
        createReadStream(track.file).pipe(res);
      }
      return;
    }

    res.writeHead(404);
    res.end();
  });

  const unregister = [
    hub.onCommand('media.rescan', async () => {
      await Promise.all([...sources.values()].map(scan));
      return tracks.size;
    }),
  ];

  publish();
  const localReady = addSource('local', 'This laptop', 'local', localFolders.map((f) => path.resolve(f)));
  await checkUsb();
  const timer = setInterval(() => checkUsb().catch(() => {}), pollMs);

  return {
    ready: localReady,
    stop() {
      clearInterval(timer);
      unroute();
      unregister.forEach((fn) => fn());
    },
  };
}
