import { useEffect, useRef, useState } from 'react';
import { HUB_HTTP, command, useTopic } from '../hub.js';
import { Icon } from '../icons.jsx';

const WS_URL = HUB_HTTP.replace(/^http/, 'ws') + '/carplay';

/** Splits an H.264 stream ("Annex B") into NAL units. */
function nalUnits(bytes) {
  const units = [];
  let start = -1;
  for (let i = 0; i + 3 <= bytes.length; i++) {
    const three = bytes[i] === 0 && bytes[i + 1] === 0 && bytes[i + 2] === 1;
    if (three) {
      if (start >= 0) units.push(bytes.subarray(start, i > 0 && bytes[i - 1] === 0 ? i - 1 : i));
      start = i + 3;
      i += 2;
    }
  }
  if (start >= 0 && start < bytes.length) units.push(bytes.subarray(start));
  return units;
}

const hex = (n) => n.toString(16).padStart(2, '0');

/** Shows the phone's screen and sends touches back to it. */
function PhoneScreen() {
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const [videoSize, setVideoSize] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (typeof VideoDecoder === 'undefined') {
      setError('This screen app cannot decode video (WebCodecs missing).');
      return undefined;
    }
    const canvas = canvasRef.current;
    const ctx2d = canvas.getContext('2d');
    let decoder = null;
    let codec = null;
    let waitingForKey = true;
    let lastFrameRequest = 0;
    let closed = false;
    let ws = null;
    let retry = null;

    const requestFrame = () => {
      if (Date.now() - lastFrameRequest < 1000) return;
      lastFrameRequest = Date.now();
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: 'frame' }));
    };

    const makeDecoder = () => {
      decoder?.state !== 'closed' && decoder?.close();
      decoder = new VideoDecoder({
        output: (frame) => {
          if (canvas.width !== frame.displayWidth || canvas.height !== frame.displayHeight) {
            canvas.width = frame.displayWidth;
            canvas.height = frame.displayHeight;
          }
          ctx2d.drawImage(frame, 0, 0);
          frame.close();
        },
        error: (err) => {
          console.warn('CarPlay video error, restarting decoder:', err);
          codec = null;
          waitingForKey = true;
          requestFrame();
        },
      });
    };

    const onVideo = (buffer) => {
      const bytes = new Uint8Array(buffer);
      const units = nalUnits(bytes);
      let isKey = false;
      for (const unit of units) {
        const type = unit[0] & 0x1f;
        if (type === 7 && unit.length > 3) {
          const next = `avc1.${hex(unit[1])}${hex(unit[2])}${hex(unit[3])}`;
          if (next !== codec || !decoder || decoder.state !== 'configured') {
            makeDecoder();
            decoder.configure({ codec: next, optimizeForLatency: true });
            codec = next;
          }
          isKey = true;
        }
        if (type === 5) isKey = true;
      }
      if (!decoder || decoder.state !== 'configured') {
        requestFrame();
        return;
      }
      if (waitingForKey && !isKey) {
        requestFrame();
        return;
      }
      waitingForKey = false;
      try {
        decoder.decode(new EncodedVideoChunk({ type: isKey ? 'key' : 'delta', timestamp: performance.now() * 1000, data: bytes }));
      } catch {
        waitingForKey = true;
        requestFrame();
      }
    };

    const connect = () => {
      ws = new WebSocket(WS_URL);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;
      ws.onmessage = (e) => {
        if (typeof e.data === 'string') {
          const msg = JSON.parse(e.data);
          if (msg.t === 'size') setVideoSize({ width: msg.width, height: msg.height });
        } else {
          onVideo(e.data);
        }
      };
      ws.onclose = () => {
        if (!closed) retry = setTimeout(connect, 1000);
      };
    };
    connect();

    return () => {
      closed = true;
      clearTimeout(retry);
      ws?.close();
      if (decoder && decoder.state !== 'closed') decoder.close();
    };
  }, []);

  // Touch: convert the finger position to 0..1 inside the picture.
  const pending = useRef(null);
  const sendTouch = (e, action) => {
    const canvas = canvasRef.current;
    const ws = wsRef.current;
    if (!canvas || ws?.readyState !== WebSocket.OPEN || !canvas.width) return;
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / canvas.width, rect.height / canvas.height);
    const w = canvas.width * scale;
    const h = canvas.height * scale;
    const x = (e.clientX - rect.left - (rect.width - w) / 2) / w;
    const y = (e.clientY - rect.top - (rect.height - h) / 2) / h;
    if (action !== 'up' && (x < 0 || x > 1 || y < 0 || y > 1)) return;
    const msg = JSON.stringify({ t: 'touch', action, x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) });
    if (action === 'move') {
      // At most one move per screen refresh.
      const first = pending.current === null;
      pending.current = msg;
      if (first) {
        requestAnimationFrame(() => {
          ws.send(pending.current);
          pending.current = null;
        });
      }
    } else {
      ws.send(msg);
    }
  };

  return (
    <div className="phone-screen">
      <canvas
        ref={canvasRef}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          sendTouch(e, 'down');
        }}
        onPointerMove={(e) => e.buttons && sendTouch(e, 'move')}
        onPointerUp={(e) => sendTouch(e, 'up')}
        onPointerCancel={(e) => sendTouch(e, 'up')}
      />
      {!videoSize && !error && <div className="phone-screen-wait">Waiting for the phone's screen…</div>}
      {error && <div className="phone-screen-wait">{error}</div>}
    </div>
  );
}

const STATUS_TEXT = {
  starting: ['Starting the adapter…', 'This takes a few seconds.'],
  'no-adapter': ['No adapter connected', 'Plug the Carlinkit adapter into a USB port of the laptop.'],
  'waiting-phone': ['Connect your phone', 'iPhone: connect with a cable, or Settings → General → CarPlay → choose the adapter. Android: Android Auto app with cable, or wireless pairing.'],
  error: ['Adapter problem', null],
};

export default function FullLink() {
  const state = useTopic('carplay.state');
  const status = state?.status ?? 'starting';

  if (status === 'connected') return <PhoneScreen />;

  const [title, help] = STATUS_TEXT[status] ?? STATUS_TEXT.starting;
  return (
    <div className="fulllink">
      <div className={`fulllink-icon ${status}`}>
        <Icon name="link" size={44} />
      </div>
      <h1>{title}</h1>
      <p className="muted">{state?.message ?? help}</p>
      <div className="fulllink-badges">
        <span className="badge">Apple CarPlay</span>
        <span className="badge">Android Auto</span>
        <span className="badge">Wired &amp; wireless</span>
      </div>
      {(status === 'error' || status === 'waiting-phone') && (
        <button className="btn" onClick={() => command('carplay.restart').catch(() => {})}>
          Restart adapter
        </button>
      )}
    </div>
  );
}
