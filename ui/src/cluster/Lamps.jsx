// Cluster indicator and warning lights. Simple symbols drawn in 32x32.
const SYMBOLS = {
  turnLeft: <path d="M3 16 13 7v5h14v8H13v5L3 16Z" />,
  turnRight: <path d="M29 16 19 7v5H5v8h14v5l10-9Z" />,
  highBeam: (
    <>
      <path d="M17 7c6 0 11 4 11 9s-5 9-11 9V7Z" />
      <path d="M3 9h10M3 14h10M3 19h10M3 24h10" className="stroke" />
    </>
  ),
  fogFront: (
    <>
      <path d="M17 8c5 0 9 3.6 9 8s-4 8-9 8V8Z" />
      <path d="M3 11h9l-2 3H3M3 17h9M3 23h9" className="stroke" />
      <path d="M14 5v22" className="stroke wave" />
    </>
  ),
  fogRear: (
    <>
      <path d="M15 8c-5 0-9 3.6-9 8s4 8 9 8V8Z" />
      <path d="M20 11h9M20 16h9M20 21h9" className="stroke" />
      <path d="M18 5v22" className="stroke wave" />
    </>
  ),
  checkEngine: <path d="M6 12h3V9h6V7h-4V5h10v2h-4v2h4l3 3h3v-2h2v12h-2v-2h-3l-3 4H11l-2-3H6v3H4V12h2Z" />,
  oil: (
    <>
      <path d="M3 13h5l3-3h8l9-3-6 10H10l-3-4H5" className="stroke" />
      <path d="M26 20c1.5 2 1.5 3.5 0 4.5-1.5-1-1.5-2.5 0-4.5Z" />
    </>
  ),
  battery: (
    <>
      <rect x="4" y="9" width="24" height="16" rx="2" className="stroke" />
      <path d="M8 9V6h4v3M20 9V6h4v3M8 17h5M19 17h5M21.5 14.5v5" className="stroke" />
    </>
  ),
  brake: (
    <>
      <circle cx="16" cy="16" r="8.5" className="stroke" />
      <path d="M6 7a13 13 0 0 0 0 18M26 7a13 13 0 0 1 0 18" className="stroke" />
      <path d="M16 11v6M16 20v1" className="stroke thick" />
    </>
  ),
  abs: <text x="16" y="21" className="lamp-text">ABS</text>,
  airbag: (
    <>
      <circle cx="11" cy="7" r="3" />
      <path d="M9 12h4l2 8h6v3h-8l-3-5-2 5" className="stroke" />
      <circle cx="23" cy="13" r="5.5" />
    </>
  ),
  seatbelt: (
    <>
      <circle cx="16" cy="6" r="3" />
      <path d="M11 28V14l5-3 5 3v14M11 14l10 10" className="stroke" />
    </>
  ),
};

// Colours follow the usual cluster convention.
const COLOR = {
  turnLeft: 'green',
  turnRight: 'green',
  highBeam: 'blue',
  fogFront: 'green',
  fogRear: 'amber',
  checkEngine: 'amber',
  oil: 'red',
  battery: 'red',
  brake: 'red',
  abs: 'amber',
  airbag: 'red',
  seatbelt: 'red',
};

export function Lamp({ name, on }) {
  return (
    <svg viewBox="0 0 32 32" className={`lamp ${COLOR[name]} ${on ? 'on' : ''}`} aria-label={name}>
      {SYMBOLS[name]}
    </svg>
  );
}

export const WARNINGS = ['checkEngine', 'oil', 'battery', 'brake', 'abs', 'airbag', 'seatbelt'];
export const INDICATORS = ['highBeam', 'fogFront', 'fogRear'];
