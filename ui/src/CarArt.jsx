import { useId } from 'react';
import { usePref } from './prefs.js';

/**
 * The car: a BMW E46 saloon (pre-2001 front), drawn from scratch so the
 * paint colour can follow Settings → Display → Car colour.
 *
 * Your own picture instead: put it in ui/public (for example car.png, a
 * transparent PNG works best) and set CUSTOM_PICTURE to its name.
 */
const CUSTOM_PICTURE = null; // e.g. 'car.png'

// Approximations of factory E46 colours (a screen can't show paint exactly).
export const PAINTS = [
  ['titan', 'Titan Silver', '#b4b9bf'],
  ['alpine', 'Alpine White', '#eceeed'],
  ['black', 'Black Sapphire', '#1d1f24'],
  ['steel', 'Steel Grey', '#5f666e'],
  ['imola', 'Imola Red', '#b5121b'],
  ['topaz', 'Topaz Blue', '#1d3a78'],
  ['estoril', 'Estoril Blue', '#1f4fa8'],
  ['laguna', 'Laguna Seca Blue', '#5aa6d9'],
  ['orient', 'Orient Blue', '#18284a'],
  ['green', 'Racing Green', '#1d3b2c'],
];

export function usePaint() {
  const [paint, setPaint] = usePref('car.paint', 'titan');
  const entry = PAINTS.find(([id]) => id === paint) ?? PAINTS[0];
  return [entry, setPaint];
}

// The paint mixed with white (positive) or black (negative), for light and shade.
const tone = (amount) => (amount >= 0 ? `color-mix(in srgb, var(--paint) ${100 - amount}%, #fff)` : `color-mix(in srgb, var(--paint) ${100 + amount}%, #000)`);

const LINE = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };

/** The left half of the car (as you look at it). The right half is a mirror copy. */
function Half({ id }) {
  return (
    <g>
      {/* Tyre under the body */}
      <rect x="78" y="236" width="42" height="40" rx="8" fill="#0b0c0e" />
      {/* Mirror */}
      <path d="M116 112c-16-6-36-6-46 0-6 4-6 12 2 15 12 4 30 3 44-3Z" fill={`url(#${id}-body)`} />
      <path d="M74 117c10-4 26-4 38-1" style={{ stroke: tone(45) }} strokeWidth="2" opacity="0.6" {...LINE} />
      {/* Body: shoulder, fender, bumper corner */}
      <path d="M114 122 86 160c-8 8-12 18-14 30l-4 42c-1 14 6 24 20 26h152V122Z" fill={`url(#${id}-body)`} />
      {/* Light on the shoulder, shade along the bottom */}
      <path d="M114 122 86 160c-6 6-10 13-12 21 10-16 24-34 46-54Z" style={{ fill: tone(55) }} opacity="0.45" />
      <path d="M69 222c1 18 6 30 19 34h152v-12H110c-22 0-34-8-41-22Z" style={{ fill: tone(-45) }} opacity="0.55" />
      {/* Hood: lighter panel with a crease running down to the kidneys */}
      <path d="M118 124c-6 12-14 26-24 40 50-6 96-6 146-6v-34Z" style={{ fill: tone(26) }} opacity="0.5" />
      <path d="M146 126c-6 12-10 26-12 40" style={{ stroke: tone(-35) }} strokeWidth="2" opacity="0.7" {...LINE} />
      <path d="M198 126c2 12 6 24 12 36" style={{ stroke: tone(-25) }} strokeWidth="2" opacity="0.5" {...LINE} />
      {/* Headlight unit: top edge slopes down towards the kidneys */}
      <path d="M86 176c2-8 8-12 16-12l96 8c6 1 9 5 8 11l-2 10c-1 5-5 8-11 8H97c-8 0-13-5-12-12Z" fill="#121418" />
      <path d="M90 170c3-4 7-6 12-6l96 8" stroke="#fff" strokeOpacity="0.35" strokeWidth="1.5" {...LINE} />
      <path d="M90 176h10c3 0 4 2 4 4v10c0 3-2 5-5 5h-5c-4 0-6-3-5-7Z" fill="#e8e2d2" opacity="0.85" />
      <circle cx="126" cy="183" r="15" fill="#2b3036" />
      <circle cx="126" cy="183" r="11.5" fill="#d9e0e8" />
      <circle cx="126" cy="183" r="5" fill="#fff" />
      <circle cx="126" cy="183" r="14" fill="none" style={{ stroke: 'var(--angel, #fff)' }} strokeOpacity="0.55" strokeWidth="1.5" />
      <circle cx="166" cy="185" r="13" fill="#2b3036" />
      <circle cx="166" cy="185" r="9.5" fill="#d9e0e8" />
      <circle cx="166" cy="185" r="4.5" fill="#fff" />
      <circle cx="166" cy="185" r="12" fill="none" style={{ stroke: 'var(--angel, #fff)' }} strokeOpacity="0.55" strokeWidth="1.5" />
      {/* Bumper: crease line with a highlight under it */}
      <path d="M78 206c40-2 100-3 162-3" style={{ stroke: tone(-30) }} strokeWidth="2" {...LINE} />
      <path d="M80 210c40-2 100-3 160-3v8c-60 0-118 1-158 3Z" style={{ fill: tone(40) }} opacity="0.45" />
      {/* Side air intake with a round fog light */}
      <path d="M90 230c0-6 4-10 10-10h46c5 0 8 4 7 9l-2 10c-1 5-5 9-10 9h-41c-6 0-10-5-10-11Z" fill="#0e1013" />
      <circle cx="116" cy="234" r="9.5" fill="#2d3238" />
      <circle cx="116" cy="234" r="6.5" fill="#cfd6de" />
      {/* Bumper lip */}
      <path d="M84 254h156v8H96c-7 0-12-3-12-8Z" fill="#0c0d0f" />
    </g>
  );
}

function Kidney({ x }) {
  return (
    <g transform={`translate(${x} 0)`}>
      <path d="M2 180c0-9 5-15 13-15h3c8 0 14 6 14 15v14c0 9-6 15-14 15h-3c-8 0-13-6-13-15Z" fill="#0b0c0f" stroke="#dfe4ea" strokeWidth="3.5" />
      {[8, 13, 18, 23, 28].map((sx) => (
        <line key={sx} x1={sx} y1="170" x2={sx} y2="204" stroke="#3a4047" strokeWidth="2" />
      ))}
    </g>
  );
}

export default function CarArt({ className = '', paint }) {
  const id = useId().replace(/:/g, '');
  const [[, , savedColor]] = usePaint();
  if (CUSTOM_PICTURE) return <img className={`car-art ${className}`} src={`./${CUSTOM_PICTURE}`} alt="" />;
  return (
    <svg className={`car-art ${className}`} viewBox="40 24 400 266" style={{ '--paint': paint ?? savedColor }} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-body`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: tone(30) }} />
          <stop offset="0.5" style={{ stopColor: 'var(--paint)' }} />
          <stop offset="1" style={{ stopColor: tone(-35) }} />
        </linearGradient>
        <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#30353d" />
          <stop offset="1" stopColor="#0c0e11" />
        </linearGradient>
        <radialGradient id={`${id}-shadow`}>
          <stop offset="0" stopColor="#000" stopOpacity="0.6" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="240" cy="272" rx="200" ry="18" fill={`url(#${id}-shadow)`} />

      {/* Roof and windscreen */}
      <path d="M168 50c20-8 124-8 144 0l6 8H162Z" fill={`url(#${id}-body)`} />
      <path d="M162 56h156c14 18 30 44 46 68H116c16-24 32-50 46-68Z" fill={`url(#${id}-glass)`} />
      <path d="M176 62c-14 18-26 38-36 58h24c10-20 22-40 36-58Z" fill="#fff" opacity="0.08" />
      <path d="M318 62c-34 10-60 30-78 58h40c14-22 30-40 48-52Z" fill="#fff" opacity="0.04" />

      <Half id={id} />
      <g transform="matrix(-1 0 0 1 480 0)">
        <Half id={id} />
      </g>

      {/* Middle: power dome, kidneys, number plate, lower intake */}
      <path d="M206 126c4 12 8 26 10 38h48c2-12 6-26 10-38Z" style={{ fill: tone(16) }} opacity="0.35" />
      <Kidney x={207} />
      <Kidney x={241} />
      <rect x="198" y="218" width="84" height="15" rx="2" fill="#f2f3ef" />
      <rect x="198" y="218" width="8" height="15" rx="1.5" fill="#1d4fb8" />
      <path d="M164 239h152c4 0 6 3 5 7l-1 5c-1 3-3 5-6 5H166c-3 0-5-2-6-5l-1-5c-1-4 1-7 5-7Z" fill="#0d0f12" />
      <line x1="168" y1="247" x2="312" y2="247" stroke="#2a2f35" strokeWidth="2" />
    </svg>
  );
}

/**
 * The same car seen from above, nose pointing down (towards the driver's
 * view of the screen), for the Design1 home screen. Drawn at 200 x 440.
 */
export function CarTopArt({ className = '', paint }) {
  const id = useId().replace(/:/g, '');
  const [[, , savedColor]] = usePaint();
  return (
    <svg className={`car-art ${className}`} viewBox="0 0 200 440" style={{ '--paint': paint ?? savedColor }} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-side`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" style={{ stopColor: tone(-45) }} />
          <stop offset="0.18" style={{ stopColor: 'var(--paint)' }} />
          <stop offset="0.5" style={{ stopColor: tone(18) }} />
          <stop offset="0.82" style={{ stopColor: 'var(--paint)' }} />
          <stop offset="1" style={{ stopColor: tone(-45) }} />
        </linearGradient>
        <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b0d11" />
          <stop offset="1" stopColor="#262b34" />
        </linearGradient>
        <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Front is at the bottom (y = 440), rear at the top. */}
      {/* Mirrors, at the front corners of the side windows */}
      <path d="M30 300c-12-2-22 2-24 10-1 6 4 9 10 8l18-4Z" style={{ fill: tone(-15) }} />
      <path d="M170 300c12-2 22 2 24 10 1 6-4 9-10 8l-18-4Z" style={{ fill: tone(-15) }} />
      {/* Body: wider over the wheels, rounded nose */}
      <path
        d="M100 4C60 4 34 8 24 24l-6 34c-4 20-4 40-1 58l2 150c-4 24-4 50-1 72l3 50c2 28 26 48 79 48s77-20 79-48l3-50c3-22 3-48-1-72l2-150c3-18 3-38-1-58l-6-34C166 8 140 4 100 4Z"
        fill={`url(#${id}-side)`}
      />
      {/* Taillights (rear, top) */}
      <path d="M24 22c6-9 16-13 32-14l-2 13c-12 1-22 5-28 9Z" fill="#a3121b" />
      <path d="M176 22c-6-9-16-13-32-14l2 13c12 1 22 5 28 9Z" fill="#a3121b" />
      {/* Trunk lid, rear window */}
      <path d="M32 84c44-7 92-7 136 0" style={{ stroke: tone(-30) }} strokeWidth="1.5" fill="none" />
      <path d="M38 92c42-7 82-7 124 0l-10 48c-34-4-70-4-104 0Z" fill={`url(#${id}-glass)`} />
      {/* Roof */}
      <path d="M48 142c34-4 70-4 104 0l2 102c-36-4-72-4-108 0Z" style={{ fill: tone(10) }} />
      <path d="M94 144h12v98H94Z" fill={`url(#${id}-shine)`} opacity="0.55" />
      {/* Side windows */}
      <path d="M38 104 46 142l2 102-8 46-5-6 1-170Z" fill="#111419" />
      <path d="M162 104 154 142l-2 102 8 46 5-6-1-170Z" fill="#111419" />
      {/* Windscreen */}
      <path d="M46 246c36-5 72-5 108 0l12 56c-44-7-88-7-132 0Z" fill={`url(#${id}-glass)`} />
      <path d="M58 254c10-1 22-2 34-2l-6 44c-12 0-26 1-36 2Z" fill="#fff" opacity="0.07" />
      {/* Hood: creases and a highlight down the middle */}
      <path d="M58 306c-4 34-6 70-2 104M142 306c4 34 6 70 2 104" style={{ stroke: tone(-28) }} strokeWidth="1.5" fill="none" />
      <path d="M86 304h28l6 116H80Z" fill={`url(#${id}-shine)`} opacity="0.75" />
      {/* Headlights and kidneys (front, bottom) */}
      <path d="M22 388c2 20 12 34 32 40l4-12c-14-4-24-14-28-28Z" fill="#dfe6ee" />
      <path d="M178 388c-2 20-12 34-32 40l-4-12c14-4 24-14 28-28Z" fill="#dfe6ee" />
      <rect x="80" y="428" width="18" height="8" rx="3" fill="#0d0f12" stroke="#d9dee4" strokeWidth="1.5" />
      <rect x="102" y="428" width="18" height="8" rx="3" fill="#0d0f12" stroke="#d9dee4" strokeWidth="1.5" />
    </svg>
  );
}
