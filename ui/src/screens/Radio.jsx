import { useEffect, useState } from 'react';
import { command, useTopic } from '../hub.js';
import { Icon } from '../icons.jsx';
import { playStation, toggle, usePlayer } from '../player.js';
import { Artwork, Keyboard, Tabs } from '../widgets.jsx';

function StationList({ stations, current, onPlay }) {
  return (
    <div className="list">
      {stations.map((s) => (
        <button key={s.id} className={`list-row ${current?.id === s.id ? 'active' : ''}`} onClick={() => onPlay(s)}>
          <Artwork src={s.favicon} icon="radio" className="small" />
          <span className="list-main">
            <strong>{s.name}</strong>
            <small>{[s.tags, s.bitrate ? `${s.bitrate} kbps` : null].filter(Boolean).join(' · ')}</small>
          </span>
          {current?.id === s.id && <Icon name="sound" size={18} />}
        </button>
      ))}
    </div>
  );
}

function useStations(load, deps) {
  const [state, setState] = useState({ loading: false, error: null, stations: [] });
  useEffect(() => {
    if (!load) return;
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    load()
      .then((stations) => alive && setState({ loading: false, error: null, stations }))
      .catch((err) => alive && setState({ loading: false, error: err.message, stations: [] }));
    return () => {
      alive = false;
    };
  }, deps);
  return state;
}

function Loading({ state, empty }) {
  if (state.loading) return <div className="empty-state">Loading stations…</div>;
  if (state.error) return <div className="empty-state error">{state.error}</div>;
  if (!state.stations.length) return <div className="empty-state">{empty}</div>;
  return null;
}

const COUNTRIES = [
  ['', 'All'],
  ['ES', 'Spain'],
  ['GE', 'Georgia'],
  ['GB', 'UK'],
  ['US', 'USA'],
  ['DE', 'Germany'],
  ['FR', 'France'],
  ['IT', 'Italy'],
  ['RU', 'Russia'],
  ['TR', 'Turkey'],
];
const GENRES = ['pop', 'rock', 'dance', 'electronic', 'hip hop', 'jazz', 'classical', 'chill', '80s', '90s', 'news', 'talk'];

/**
 * Station finder: type a name and/or pick a country and a style of music.
 * Results come in while you type.
 */
function StationSearch({ current, onPlay }) {
  const [query, setQuery] = useState('');
  const [country, setCountry] = useState('ES');
  const [genre, setGenre] = useState('');
  const [typing, setTyping] = useState(false);
  const [filters, setFilters] = useState({ query: '', country: 'ES', genre: '' });

  // Wait until typing pauses before asking the station directory.
  useEffect(() => {
    const timer = setTimeout(() => setFilters({ query: query.trim(), country, genre }), 450);
    return () => clearTimeout(timer);
  }, [query, country, genre]);

  const any = filters.query || filters.genre || filters.country;
  const results = useStations(
    any ? () => command('radio.search', { query: filters.query, country: filters.country, tag: filters.genre, limit: 60 }) : null,
    [filters.query, filters.country, filters.genre],
  );

  return (
    <div className="station-search">
      <div className="search-row">
        <button className={`search-field ${typing ? 'focus' : ''}`} onClick={() => setTyping(true)}>
          <Icon name="search" size={18} />
          <span>{query || <em>Station name</em>}</span>
        </button>
        {(query || genre || country) && (
          <button
            className="btn small"
            onClick={() => {
              setQuery('');
              setGenre('');
              setCountry('');
            }}
          >
            Clear
          </button>
        )}
      </div>
      {typing ? (
        <Keyboard value={query} onChange={setQuery} onDone={() => setTyping(false)} doneLabel="Done" />
      ) : (
        <>
          <div className="chips scroll">
            <Icon name="navigate" size={16} />
            {COUNTRIES.map(([code, name]) => (
              <button key={code || 'all'} className={`chip ${country === code ? 'on' : ''}`} onClick={() => setCountry(code)}>
                {name}
              </button>
            ))}
          </div>
          <div className="chips scroll">
            <Icon name="media" size={16} />
            {GENRES.map((g) => (
              <button key={g} className={`chip ${genre === g ? 'on' : ''}`} onClick={() => setGenre(genre === g ? '' : g)}>
                {g}
              </button>
            ))}
          </div>
          {any ? (
            <>
              <Loading state={results} empty="No stations found. Try fewer filters." />
              {!results.loading && <StationList stations={results.stations} current={current} onPlay={onPlay} />}
            </>
          ) : (
            <div className="empty-state">Type a name, or pick a country or a style of music.</div>
          )}
        </>
      )}
    </div>
  );
}

export default function Radio() {
  const player = usePlayer();
  const presets = useTopic('radio.presets', []);
  const last = useTopic('radio.last');
  const [tab, setTab] = useState(presets.length ? 'favourites' : 'popular');
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState(null);

  const station = player.kind === 'radio' ? player.station : last;
  const isPreset = station && presets.some((p) => p.id === station.id);
  const isPlaying = player.kind === 'radio' && player.playing;

  const popular = useStations(tab === 'popular' ? () => command('radio.top', {}) : null, [tab]);

  const play = (s) => {
    setMessage(null);
    playStation(s);
  };

  const togglePreset = () => {
    if (!station) return;
    const action = isPreset ? command('radio.removePreset', { id: station.id }) : command('radio.savePreset', station);
    action.then(() => setMessage(isPreset ? 'Removed from favourites' : 'Saved to favourites')).catch((err) => setMessage(err.message));
  };

  // Previous / next favourite, like the arrows on a car radio.
  const step = (dir) => {
    if (!presets.length) return;
    const i = presets.findIndex((p) => p.id === station?.id);
    play(presets[(i + dir + presets.length) % presets.length]);
  };

  return (
    <div className="split">
      <section className="panel now-playing">
        <Artwork src={station?.favicon} icon="radio" className="large" />
        <div className="np-text">
          <strong className="np-title">{station?.name ?? 'No station selected'}</strong>
          <span className="np-sub">
            {player.kind === 'radio' && player.loading
              ? 'Connecting…'
              : player.kind === 'radio' && player.error
                ? player.error
                : station
                  ? [station.tags, station.country].filter(Boolean).join(' · ') || 'Internet radio'
                  : 'Choose a station on the right'}
          </span>
        </div>
        <div className="controls">
          <button className="icon-btn" onClick={() => step(-1)} disabled={!presets.length} aria-label="Previous favourite">
            <Icon name="prev" />
          </button>
          <button
            className="icon-btn big primary"
            disabled={!station}
            onClick={() => (player.kind === 'radio' ? toggle() : play(station))}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            <Icon name={isPlaying ? 'pause' : 'play'} filled />
          </button>
          <button className="icon-btn" onClick={() => step(1)} disabled={!presets.length} aria-label="Next favourite">
            <Icon name="next" />
          </button>
          <button className={`icon-btn ${isPreset ? 'on' : ''}`} disabled={!station} onClick={togglePreset} aria-label="Favourite">
            <Icon name="star" filled={isPreset} />
          </button>
        </div>
        {message && <small className="muted center">{message}</small>}
      </section>

      <section className="panel browse">
        <Tabs
          value={tab}
          onChange={(t) => {
            setTab(t);
            setEditing(false);
          }}
          tabs={[
            ['favourites', `Favourites (${presets.length}/36)`, 'star'],
            ['popular', 'Popular', 'radio'],
            ['search', 'Search', 'search'],
          ]}
        >
          {tab === 'favourites' && presets.length > 0 && (
            <button className="btn small" onClick={() => setEditing(!editing)}>
              {editing ? 'Done' : 'Edit'}
            </button>
          )}
        </Tabs>

        {tab === 'favourites' &&
          (presets.length ? (
            <div className="preset-grid">
              {presets.map((p, i) => (
                <button key={p.id} className={`preset ${station?.id === p.id ? 'active' : ''}`} onClick={() => (editing ? null : play(p))}>
                  <span className="preset-no">{i + 1}</span>
                  <Artwork src={p.favicon} icon="radio" className="tiny" />
                  <span className="preset-name">{p.name}</span>
                  {editing && (
                    <span className="preset-remove" onClick={() => command('radio.removePreset', { id: p.id }).catch(() => {})}>
                      <Icon name="close" size={16} />
                    </span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              No favourites yet. Play a station and tap <Icon name="star" size={16} /> to save it.
            </div>
          ))}

        {tab === 'popular' && (
          <>
            <Loading state={popular} empty="No stations found" />
            {!popular.loading && <StationList stations={popular.stations} current={station} onPlay={play} />}
          </>
        )}

        {tab === 'search' && <StationSearch current={station} onPlay={play} />}
      </section>
    </div>
  );
}
