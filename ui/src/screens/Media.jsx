import { useEffect, useMemo, useState } from 'react';
import { useResizable } from '../resize.jsx';
import { HUB_HTTP, useTopic } from '../hub.js';
import { Icon } from '../icons.jsx';
import { cycleRepeat, formatTime, next, playTracks, previous, seek, setShuffle, toggle, usePlayer } from '../player.js';
import { Artwork, Keyboard, Tabs } from '../widgets.jsx';
import { songHue } from './home/common.jsx';

const SOURCE_ICON = { local: 'folder', usb: 'usb' };
const art = (track) => (track ? `${HUB_HTTP}/media/art/${track.id}` : null);

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

function TrackList({ tracks, current, onPlay, empty = 'No songs here' }) {
  if (!tracks.length) return <div className="empty-state">{empty}</div>;
  return (
    <div className="list">
      {tracks.map((t, i) => (
        <button key={`${t.id}-${i}`} className={`list-row track-row ${current?.id === t.id ? 'active' : ''}`} onClick={() => onPlay(tracks, i)}>
          <Artwork src={art(t)} icon="media" className="thumb" />
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
            <small>{items.length} song{items.length === 1 ? '' : 's'}</small>
          </span>
          <Icon name="next" size={16} />
        </button>
      ))}
    </div>
  );
}

/** Albums as a grid of covers. */
function AlbumGrid({ groups, onOpen }) {
  if (!groups.length) return <div className="empty-state">Nothing here</div>;
  return (
    <div className="album-grid">
      {groups.map(([name, items]) => (
        <button key={name} className="album" onClick={() => onOpen(name)}>
          <Artwork src={art(items[0])} icon="media" className="cover" />
          <strong>{name}</strong>
          <small>{items[0].artist ?? `${items.length} song${items.length === 1 ? '' : 's'}`}</small>
        </button>
      ))}
    </div>
  );
}

/** Where the music comes from: a dropdown instead of a row of buttons. */
function SourcePicker({ sources, sourceId, onPick, onNavigate }) {
  const [open, setOpen] = useState(false);
  const source = sources.find((s) => s.id === sourceId);
  const pick = (id) => {
    setOpen(false);
    onPick(id);
  };
  return (
    <div className="source-picker">
      <button className={`source-button ${open ? 'open' : ''}`} onClick={() => setOpen(!open)}>
        <Icon name={SOURCE_ICON[source?.type] ?? 'folder'} size={18} />
        <span>
          <small>Source</small>
          <strong>{source?.name ?? 'No music found'}</strong>
        </span>
        <Icon name="chevron" size={16} className="chevron" />
      </button>
      {open && (
        <>
          <div className="menu-backdrop" onClick={() => setOpen(false)} />
          <div className="source-menu">
            {sources.map((s) => (
              <button key={s.id} className={s.id === sourceId ? 'active' : ''} onClick={() => pick(s.id)}>
                <Icon name={SOURCE_ICON[s.type] ?? 'folder'} size={20} />
                <span>
                  <strong>{s.name}</strong>
                  <small>{s.scanning ? 'Reading…' : `${s.tracks} songs`}</small>
                </span>
                {s.id === sourceId && <Icon name="check" size={18} />}
              </button>
            ))}
            <button
              onClick={() => {
                setOpen(false);
                onNavigate?.('fulllink');
              }}
            >
              <Icon name="link" size={20} />
              <span>
                <strong>Phone (Full Link)</strong>
                <small>Music apps through CarPlay / Android Auto</small>
              </span>
            </button>
            <button disabled>
              <Icon name="bluetooth" size={20} />
              <span>
                <strong>Bluetooth audio</strong>
                <small>Coming later</small>
              </span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function Media({ onNavigate }) {
  const rs = useResizable('media', { minLeft: 250, minRight: 400 });
  const player = usePlayer();
  const sources = useTopic('media.sources', []);
  const carplayMedia = useTopic('carplay.media');
  const [sourceId, setSourceId] = useState('local');
  const [view, setView] = useState('songs');
  const [group, setGroup] = useState(null);
  const [filter, setFilter] = useState('');
  const [typing, setTyping] = useState(false);

  // When a USB stick is plugged in, switch to it; when removed, go back.
  useEffect(() => {
    if (!sources.some((s) => s.id === sourceId)) setSourceId(sources[0]?.id ?? 'local');
  }, [sources]);

  const source = sources.find((s) => s.id === sourceId);
  const version = `${source?.tracks}:${source?.scanning}`;
  const tracks = useLibrary(sourceId, version);
  const sorted = useMemo(() => [...tracks].sort(sortTracks), [tracks]);
  const found = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return sorted;
    return sorted.filter((t) => [t.title, t.artist, t.album, t.folder].some((x) => x?.toLowerCase().includes(f)));
  }, [sorted, filter]);

  const groupBy = (key, fallback) => {
    const map = new Map();
    for (const t of found) {
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
  const upNext = player.kind === 'media' ? player.queue.slice(player.index + 1) : [];

  const shuffleAll = () => {
    if (!found.length) return;
    setShuffle(true);
    playTracks(found, Math.floor(Math.random() * found.length));
  };

  return (
    <div className={`split media-screen ${rs.className}`} ref={rs.ref} style={rs.style}>
      <section className="panel now-playing media-now" style={{ '--song-hue': songHue(t?.title ?? '') }}>
        <div className="media-cover">
          <Artwork src={art(t)} icon="media" className="large" key={t?.id ?? 'none'} />
        </div>
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
          <small>-{formatTime(Math.max(0, player.duration - player.position))}</small>
        </div>
        <div className="controls">
          <button className={`icon-btn ${player.shuffle ? 'on' : ''}`} onClick={() => setShuffle(!player.shuffle)} aria-label="Shuffle">
            <Icon name="shuffle" />
          </button>
          <button className="icon-btn" onClick={previous} disabled={!t} aria-label="Previous">
            <Icon name="prev" />
          </button>
          <button className="icon-btn big primary" onClick={() => (t ? toggle() : found.length && playTracks(found, 0))} disabled={!t && !found.length} aria-label={playing ? 'Pause' : 'Play'}>
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
        <div className="media-toolbar">
          <SourcePicker
            sources={sources}
            sourceId={sourceId}
            onNavigate={onNavigate}
            onPick={(id) => {
              setSourceId(id);
              setGroup(null);
            }}
          />
          <button className={`search-field compact ${filter ? 'filled' : ''}`} onClick={() => setTyping(!typing)}>
            <Icon name="search" size={16} />
            <span>{filter || <em>Search songs</em>}</span>
            {filter && (
              <small
                onClick={(e) => {
                  e.stopPropagation();
                  setFilter('');
                }}
              >
                <Icon name="close" size={14} />
              </small>
            )}
          </button>
          <button className="btn small" onClick={shuffleAll} disabled={!found.length}>
            <Icon name="shuffle" size={16} /> Shuffle all
          </button>
        </div>

        {typing ? (
          <Keyboard value={filter} onChange={setFilter} onDone={() => setTyping(false)} doneLabel="Done" />
        ) : (
          <>
            <Tabs
              value={view}
              onChange={(v) => {
                setView(v);
                setGroup(null);
              }}
              tabs={[
                ['songs', `Songs (${found.length})`, 'list'],
                ['albums', 'Albums', 'media'],
                ['artists', 'Artists', 'contacts'],
                ['folders', 'Folders', 'folder'],
                ['queue', 'Up next', 'history'],
              ]}
            />
            {view === 'songs' && <TrackList tracks={found} current={t} onPlay={playTracks} empty={filter ? `No songs match "${filter}"` : 'No songs here'} />}
            {view === 'queue' && (
              <TrackList
                tracks={upNext}
                current={null}
                onPlay={(_, i) => playTracks(player.queue, player.index + 1 + i)}
                empty={t ? 'This was the last song in the list' : 'Play something to see what comes next'}
              />
            )}
            {view === 'albums' && !group && <AlbumGrid groups={groups} onOpen={setGroup} />}
            {(view === 'artists' || view === 'folders') && !group && <GroupList groups={groups} onOpen={setGroup} icon={view === 'folders' ? 'folder' : 'contacts'} />}
            {view !== 'songs' && view !== 'queue' && group && (
              <>
                <div className="group-head">
                  <button className="back-row" onClick={() => setGroup(null)}>
                    <Icon name="back" size={18} /> {group}
                  </button>
                  <button className="btn small primary" onClick={() => playTracks(groupTracks, 0)} disabled={!groupTracks.length}>
                    <Icon name="play" size={14} filled /> Play all
                  </button>
                </div>
                <TrackList tracks={groupTracks} current={t} onPlay={playTracks} />
              </>
            )}
            {!sources.length && <div className="empty-state">No music found. Put songs in the Music folder or plug in a USB stick.</div>}
          </>
        )}
      </section>
      {rs.handle}
    </div>
  );
}
