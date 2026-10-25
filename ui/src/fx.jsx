import { useEffect, useRef, useState } from 'react';
import { useTopic } from './hub.js';
import { usePref } from './prefs.js';

/**
 * Graphics quality (Settings → Display → Graphics):
 *   low    flat design, lightest (for the car on small hardware)
 *   high   animated background, shadows, screen transitions
 *   premium  the Ultra look made the way real car clusters do it: cheap tricks
 *          (low-resolution background, no live blur, glows as extra shapes,
 *          only moving/fading layers) - smooth on modest hardware
 *   ultra  STRESS TEST: everything at maximum - full-resolution animated
 *          background, live blur behind every panel, glowing needles,
 *          animated light effects. Use with the performance display.
 */
export const FX_LEVELS = [
  ['low', 'Low'],
  ['high', 'High'],
  ['premium', 'Premium'],
  ['ultra', 'Ultra (stress test)'],
];

export function useFx() {
  const [fx, setFx] = usePref('fx.level', 'low');
  const level = FX_LEVELS.some(([id]) => id === fx) ? fx : 'low';
  useEffect(() => {
    document.documentElement.dataset.fx = level;
  }, [level]);
  return [level, setFx];
}

// ---------- Animated background (WebGL, runs on the graphics chip) ----------

const VERTEX = `attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

// Flowing light: layered noise, bent by more noise ("domain warping").
// The number of layers (octaves) decides how hard the graphics chip works.
const FRAGMENT = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uColor;
uniform float uSpeed;
uniform int uOctaves;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 10; i++) {
    if (i >= uOctaves) break;
    v += a * noise(p);
    p = p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = uv * vec2(uRes.x / uRes.y, 1.0) * 2.2;
  float t = uTime * (0.04 + uSpeed * 0.5);
  vec2 warp = vec2(fbm(p + vec2(t, -t * 0.7)), fbm(p + vec2(-t * 0.6, t) + 5.2));
  float n = fbm(p + 2.2 * warp + vec2(t * 0.8, 0.0));
  float glow = smoothstep(0.3, 0.95, n);
  // Light streaks that move faster as the car drives faster.
  float streak = smoothstep(0.985, 1.0, noise(vec2(uv.x * 3.0 - uTime * (0.2 + uSpeed * 4.0), uv.y * 60.0)));
  vec3 col = vec3(0.012, 0.014, 0.02);
  col += uColor * glow * 0.75;
  col += uColor * streak * 0.5 * (0.3 + uSpeed);
  col += uColor * pow(1.0 - abs(uv.y - 0.5) * 2.0, 8.0) * 0.08;
  col *= 1.0 - 0.55 * length((uv - 0.5) * vec2(1.1, 1.6));
  gl_FragColor = vec4(col, 1.0);
}`;

function accentRgb() {
  const value = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  const hex = /^#([0-9a-f]{6})$/i.exec(value)?.[1];
  if (!hex) return [0.9, 0.5, 0.2];
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
}

// Per level: render resolution (× screen pixels), noise layers, frames per second.
const SETTINGS = {
  high: { scale: 0.34, octaves: 4, fps: 30 },
  // The background is soft anyway: a third of the pixels looks the same.
  premium: { scale: 0.34, octaves: 5, fps: 30 },
  ultra: { scale: 1.5, octaves: 9, fps: 60 },
};

/** speedFactor 0..1 makes the light streaks faster (vehicle.speed / 200). */
export function FxBackground({ level }) {
  const canvasRef = useRef(null);
  const speedRef = useRef(0);
  speedRef.current = useTopic('vehicle.speed', 0) / 200;

  useEffect(() => {
    const cfg = SETTINGS[level];
    if (!cfg) return undefined;
    const canvas = canvasRef.current;
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });
    if (!gl) return undefined;

    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn('Background effect not supported:', gl.getProgramInfoLog(prog));
      return undefined;
    }
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = (name) => gl.getUniformLocation(prog, name);
    const uRes = u('uRes');
    const uTime = u('uTime');
    const uColor = u('uColor');
    const uSpeed = u('uSpeed');
    gl.uniform1i(u('uOctaves'), cfg.octaves);

    let color = accentRgb();
    const observer = new MutationObserver(() => {
      color = accentRgb();
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    let frame;
    let last = 0;
    const start = performance.now();
    const draw = (now) => {
      frame = requestAnimationFrame(draw);
      if (now - last < 1000 / cfg.fps - 2) return;
      last = now;
      const w = Math.round(canvas.clientWidth * cfg.scale);
      const h = Math.round(canvas.clientHeight * cfg.scale);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      gl.uniform2f(uRes, w, h);
      gl.uniform1f(uTime, (now - start) / 1000);
      gl.uniform3f(uColor, ...color);
      gl.uniform1f(uSpeed, Math.min(1, Math.max(0, speedRef.current)));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, [level]);

  if (!SETTINGS[level]) return null;
  // A new canvas per level: a canvas whose graphics context was closed can't be reused.
  return <canvas key={level} ref={canvasRef} className="fx-background" aria-hidden="true" />;
}

// ---------- Performance display ----------

function useFps() {
  const [fps, setFps] = useState({});
  useEffect(() => {
    let frames = 0;
    let frame;
    let worst = 0;
    let prev = performance.now();
    let windowStart = prev;
    const tick = (now) => {
      frames += 1;
      worst = Math.max(worst, now - prev);
      prev = now;
      if (now - windowStart >= 1000) {
        setFps({ fps: Math.round((frames * 1000) / (now - windowStart)), worst: Math.round(worst) });
        frames = 0;
        worst = 0;
        windowStart = now;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  return fps;
}

export function PerfHud({ label }) {
  const [show] = usePref('fx.hud', false);
  if (!show) return null;
  return <PerfHudPanel label={label} />;
}

function PerfHudPanel({ label }) {
  const { fps = 0, worst = 0 } = useFps();
  const [fx] = useFx();
  const s = useTopic('system.stats');
  const heap = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null;
  const tone = (v, warn, bad) => (v >= bad ? 'bad' : v >= warn ? 'warn' : 'ok');
  return (
    <div className="perf-hud">
      <div className="perf-title">
        {label} · {fx.toUpperCase()}
      </div>
      <div className={`perf-row ${fps < 30 ? 'bad' : fps < 55 ? 'warn' : 'ok'}`}>
        <span>FPS</span>
        <b>{fps}</b>
        <small>slowest frame {worst} ms</small>
      </div>
      {s && (
        <>
          <div className={`perf-row ${tone(s.cpu, 60, 85)}`}>
            <span>CPU</span>
            <b>{s.cpu}%</b>
            <small>{s.cpuTemp !== null ? `${s.cpuTemp}°C` : ''}</small>
          </div>
          <div className={`perf-row ${tone(s.app.cpu, 40, 70)}`}>
            <span>App CPU</span>
            <b>{s.app.cpu}%</b>
            <small>{s.app.processes} processes</small>
          </div>
          <div className={`perf-row ${tone(s.memUsedMB / s.memTotalMB, 0.75, 0.9)}`}>
            <span>RAM</span>
            <b>{(s.memUsedMB / 1024).toFixed(1)} GB</b>
            <small>of {(s.memTotalMB / 1024).toFixed(1)} GB</small>
          </div>
          <div className="perf-row ok">
            <span>App RAM</span>
            <b>{s.app.memMB} MB</b>
            <small>{heap !== null ? `this screen ${heap} MB` : ''}</small>
          </div>
          {s.gpu && (
            <div className={`perf-row ${s.gpu.busy !== null ? tone(s.gpu.busy, 60, 85) : s.gpu.maxMHz ? tone(s.gpu.curMHz / s.gpu.maxMHz, 0.7, 0.95) : 'ok'}`}>
              <span>GPU</span>
              <b>{s.gpu.busy !== null ? `${s.gpu.busy}%` : `${s.gpu.curMHz} MHz`}</b>
              <small>{s.gpu.maxMHz ? `max ${s.gpu.maxMHz} MHz` : ''}</small>
            </div>
          )}
        </>
      )}
    </div>
  );
}
