/**
 * Internet radio, using the free radio-browser.info station directory.
 * (FM/DAB need a radio receiver: an RTL-SDR USB stick can be added later.)
 *
 * Topics:
 *   radio.presets   [{ id, name, url, favicon, country, tags, codec, bitrate }]  up to 36
 *   radio.last      the station that played last (to resume after start-up)
 *
 * Commands:
 *   radio.search    { query?, country?, tag?, limit? }  -> stations
 *   radio.top       { country? }                        -> most popular stations
 *   radio.savePreset   station
 *   radio.removePreset { id }
 *   radio.setLast      station
 *
 * HTTP:
 *   /radio/stream?url=<stream>   passes the station through the core, so the
 *                                screen app's sound settings (bass, treble…) work on it
 */
import { Readable } from 'node:stream';
import { openStore } from '../store.js';

const MAX_PRESETS = 36;
const SERVERS = ['https://all.api.radio-browser.info', 'https://de1.api.radio-browser.info', 'https://fi1.api.radio-browser.info'];

const toStation = (s) => ({
  id: s.stationuuid,
  name: (s.name || 'Unknown station').trim(),
  url: s.url_resolved || s.url,
  favicon: s.favicon || null,
  country: s.countrycode || null,
  tags: s.tags ? s.tags.split(',').slice(0, 3).join(', ') : '',
  codec: s.codec || null,
  bitrate: s.bitrate || null,
});

function cleanStation(s) {
  if (!s || typeof s.url !== 'string' || !/^https?:\/\//.test(s.url)) throw new Error('Station needs a web address');
  return {
    id: String(s.id ?? s.url),
    name: String(s.name ?? 'Station').slice(0, 80),
    url: s.url,
    favicon: s.favicon ?? null,
    country: s.country ?? null,
    tags: s.tags ?? '',
    codec: s.codec ?? null,
    bitrate: s.bitrate ?? null,
  };
}

export default async function radio(hub, options = {}) {
  const store = await openStore('radio', { presets: [], last: null });
  const fetchJson = options.fetch ?? (async (url) => {
    const res = await fetch(url, { headers: { 'User-Agent': 'e46-headunit/0.2' }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  });
  const defaultCountry = options.country ?? 'ES';

  hub.set('radio.presets', store.get('presets'));
  hub.set('radio.last', store.get('last'));

  async function query(pathAndQuery) {
    let lastError;
    for (const server of SERVERS) {
      try {
        const list = await fetchJson(`${server}${pathAndQuery}`);
        return list.filter((s) => s.url_resolved || s.url).map(toStation);
      } catch (err) {
        lastError = err;
      }
    }
    throw new Error(`Radio directory not reachable (${lastError?.message ?? 'no connection'}). Check the internet connection.`);
  }

  const unroute = hub.route('/radio/stream', async (req, res, url) => {
    const target = url.searchParams.get('url') ?? '';
    if (!/^https?:\/\//.test(target)) {
      res.writeHead(400);
      res.end();
      return;
    }
    const abort = new AbortController();
    req.on('close', () => abort.abort());
    let upstream;
    try {
      upstream = await fetch(target, { headers: { 'User-Agent': 'e46-headunit/0.2', 'Icy-MetaData': '0' }, signal: abort.signal });
    } catch {
      upstream = null;
    }
    if (!upstream?.ok || !upstream.body) {
      res.writeHead(502);
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': upstream.headers.get('content-type') ?? 'audio/mpeg', 'Cache-Control': 'no-cache' });
    Readable.fromWeb(upstream.body)
      .on('error', () => res.end())
      .pipe(res);
  });

  const unregister = [
    unroute,
    hub.onCommand('radio.search', ({ query: text = '', country = '', tag = '', limit = 40 } = {}) => {
      const params = new URLSearchParams({
        name: text,
        countrycode: country,
        tag,
        order: 'clickcount',
        reverse: 'true',
        hidebroken: 'true',
        limit: String(Math.min(100, Number(limit) || 40)),
      });
      return query(`/json/stations/search?${params}`);
    }),

    hub.onCommand('radio.top', ({ country = defaultCountry } = {}) => {
      const params = new URLSearchParams({ countrycode: country, order: 'clickcount', reverse: 'true', hidebroken: 'true', limit: '40' });
      return query(`/json/stations/search?${params}`);
    }),

    hub.onCommand('radio.savePreset', async (station) => {
      const clean = cleanStation(station);
      const presets = store.get('presets').filter((p) => p.id !== clean.id);
      if (presets.length >= MAX_PRESETS) throw new Error(`All ${MAX_PRESETS} favourites are used. Remove one first.`);
      presets.push(clean);
      await store.set('presets', presets);
      hub.set('radio.presets', presets);
      return presets.length;
    }),

    hub.onCommand('radio.removePreset', async ({ id } = {}) => {
      const presets = store.get('presets').filter((p) => p.id !== id);
      await store.set('presets', presets);
      hub.set('radio.presets', presets);
      return presets.length;
    }),

    hub.onCommand('radio.setLast', async (station) => {
      const clean = station ? cleanStation(station) : null;
      await store.set('last', clean);
      hub.set('radio.last', clean);
    }),
  ];

  return {
    stop() {
      unregister.forEach((fn) => fn());
    },
  };
}
