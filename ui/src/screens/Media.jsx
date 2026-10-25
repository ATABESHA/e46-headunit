import { useEffect, useMemo, useState } from 'react';
import { HUB_HTTP, useTopic } from '../hub.js';
import { Icon } from '../icons.jsx';
import { cycleRepeat, formatTime, next, playTracks, previous, seek, setShuffle, toggle, usePlayer } from '../player.js';
import { Artwork, Tabs } from '../widgets.jsx';

const SOURCE_ICON = { local: 'laptop', usb: 'usb' };

function useLibrary(sourceId, version) {
  const [tracks, setTracks] = useState([]);
  useEffect(() => {
    if (!sourceId) return;
    let alive = true;
    fetch(`${HUB_HTTP}/media/library?source=${encodeURIComponent(sourceId)}`)
      .then((r) => r.json())
      .then((list) => alive && setTracks(list))
      .catch(() => alive && setTracks([]));
    return () => {
      alive = false;
    };
  }, [sourceId, version]);
  return tracks;
}

const sortTracks = (a, b) =>
  (a.folder || '').localeCompare(b.folder || '') || (a.trackNo ?? 999) - (b.trackNo ?? 999) || a.title.localeCompare(b.title);

function TrackList({ tracks, current, onPlay }) {
  if (!tracks.length) return <div className="empty-state">No songs here</div>;
  return (
    <div className="list">
      {tracks.map((t, i) => (
        <button key={t.id} className={`list-row ${current?.id === t.id ? 'active' : ''}`} onClick={() => onPlay(tracks, i)}>
          <span className="list-main">
            <strong>{t.title}</strong>
            <small>{[t.artist, t.album].filter(Boolean).join(' · ') || t.folder || 'Unknown artist'}</small>
          </span>
          <small className="muted">{t.duration ? formatTime(t.duration) : ''}</small>
          {current?.id === t.id && <Icon name="sound" size={18} />}
        </button>
      ))}
    </div>
  );
}

function GroupList({ groups, onOpen, icon }) {
  if (!groups.length) return <div className="empty-state">Nothing here</div>;
  return (
    <div className="list">
      {groups.map(([name, items]) => (
        <button key={name} className="list-row" onClick={() => onOpen(name)}>
          <Icon name={icon} size={22} />
          <span className="list-main">
            <strong>{name}</strong>
            <small>{items.length} songs</small>
          </span>
          <Icon name="next" size={16} />
        </button>
      ))}
    </div>
  );
}

export default function Media() {
  const player = usePlayer();
  const sources = useTopic('media.sources', []);
  const carplayMedia = useTopic('carplay.media');
  const [sourceId, setSourceId] = useState('local');
  const [view, setView] = useState('songs');
  const [group, setGroup] = useState(null);

  // When a USB stick is plugged in, switch to it; when removed, go back.
  useEffect(() => {
    if (!sources.some((s) => s.id === sourceId)) setSourceId(sources[0]?.id ?? 'local');
  }, [sources]);

  const source = sources.find((s) => s.id === sourceId);
  const version = `${source?.tracks}:${source?.scanning}`;
  const tracks = useLibrary(sourceId, version);
  const sorted = useMemo(() => [...tracks].sort(sortTracks), [tracks]);

  const groupBy = (key, fallback) => {
    const map = new Map();
    for (const t of sorted) {
      const k = t[key] || fallback;
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(t);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  };
  const groups = view === 'folders' ? groupBy('folder', 'Main folder') : view === 'artists' ? groupBy('artist', 'Unknown artist') : view === 'albums' ? groupBy('album', 'Unknown album') : [];
  const groupTracks = group ? groups.find(([name]) => name === group)?.[1] ?? [] : [];

  const t = player.kind === 'media' ? player.track : null;
  const playing = player.kind === 'media' && player.playing;
  const progress = player.duration ? (player.position / player.duration) * 100 : 0;

  return (
    <div className="split">
      <section className="panel now-playing">
        <Artwork src={t ? `${HUB_HTTP}/media/art/${t.id}` : null} icon="media" className="large" key={t?.id ?? 'none'} />
        <div className="np-text">
          <strong className="np-title">{t?.title ?? 'Nothing playing'}</strong>
          <span className="np-sub">{t ? [t.artist, t.album].filter(Boolean).join(' · ') || 'Unknown artist' : player.error ?? 'Choose a song on the right'}</span>
        </div>
        <div
          className="progress"
          onClick={(e) => {
            if (!player.duration) return;
            const rect = e.currentTarget.getBoundingClientRect();
            seek(((e.clientX - rect.left) / rect.width) * player.duration);
          }}
        >
          <i style={{ width: `${progress}%` }} />
        </div>
        <div className="progress-times">
          <small>{formatTime(player.position)}</small>
          <small>{formatTime(player.duration)}</small>
        </div>
        <div className="controls">
          <button className={`icon-btn ${player.shuffle ? 'on' : ''}`} onClick={() => setShuffle(!player.shuffle)} aria-label="Shuffle">
            <Icon name="shuffle" />
          </button>
          <button className="icon-btn" onClick={previous} disabled={!t} aria-label="Previous">
            <Icon name="prev" />
          </button>
          <button className="icon-btn big primary" onClick={() => (t ? toggle() : sorted.length && playTracks(sorted, 0))} disabled={!t && !sorted.length} aria-label={playing ? 'Pause' : 'Play'}>
            <Icon name={playing ? 'pause' : 'play'} filled />
          </button>
          <button className="icon-btn" onClick={() => next()} disabled={!t} aria-label="Next">
            <Icon name="next" />
          </button>
          <button className={`icon-btn ${player.repeat !== 'off' ? 'on' : ''}`} onClick={cycleRepeat} aria-label={`Repeat ${player.repeat}`}>
            <Icon name="repeat" />
            {player.repeat === 'one' && <b className="repeat-one">1</b>}
          </button>
        </div>
        {carplayMedia?.title && (
          <small className="muted center">
            On phone: {carplayMedia.title}
            {carplayMedia.artist ? ` · ${carplayMedia.artist}` : ''}
          </small>
        )}
      </section>

      <section className="panel browse">
        <div className="sources">
          {sources.map((s) => (
            <button
              key={s.id}
              className={`source ${s.id === sourceId ? 'active' : ''}`}
              onClick={() => {
                setSourceId(s.id);
                setGroup(null);
              }}
            >
              <Icon name={SOURCE_ICON[s.type] ?? 'folder'} size={18} />
              {s.name}
              <small>{s.scanning ? 'reading…' : s.tracks}</small>
            </button>
          ))}
          <button className="source disabled" title="Coming later: Bluetooth audio from the phone">
            <Icon name="bluetooth" size={18} />
            Bluetooth
            <small>later</small>
          </button>
        </div>
        <Tabs
          value={view}
          onChange={(v) => {
            setView(v);
            setGroup(null);
          }}
          tabs={[
            ['songs', 'Songs', 'list'],
            ['folders', 'Folders', 'folder'],
            ['artists', 'Artists', 'contacts'],
            ['albums', 'Albums', 'media'],
          ]}
        />
        {view === 'songs' && <TrackList tracks={sorted} current={t} onPlay={playTracks} />}
        {view !== 'songs' && !group && <GroupList groups={groups} onOpen={setGroup} icon={view === 'folders' ? 'folder' : view === 'artists' ? 'contacts' : 'media'} />}
        {view !== 'songs' && group && (
          <>
            <button className="back-row" onClick={() => setGroup(null)}>
              <Icon name="back" size={18} /> {group}
            </button>
            <TrackList tracks={groupTracks} current={t} onPlay={playTracks} />
          </>
        )}
        {!sources.length && <div className="empty-state">No music found. Put songs in the laptop's Music folder or plug in a USB stick.</div>}
      </section>
    </div>
  );
}
