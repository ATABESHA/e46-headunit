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
  lowBeam: (
    <>
      <path d="M17 7c6 0 11 4 11 9s-5 9-11 9V7Z" />
      <path d="M3 10l10 2M3 15l10 2M3 20l10 2M3 25l10 2" className="stroke" />
    </>
  ),
  parkingLights: (
    <>
      <path d="M11 10c-3 1-4 3.5-4 6s1 5 4 6V10ZM21 10c3 1 4 3.5 4 6s-1 5-4 6V10Z" />
      <path d="M2 12h3M2 16h3M2 20h3M27 12h3M27 16h3M27 20h3" className="stroke" />
    </>
  ),
  cruise: (
    <>
      <path d="M6 22a10 10 0 1 1 20 0" className="stroke" />
      <path d="M16 22l6-7" className="stroke thick" />
      <path d="M4 26h24" className="stroke" />
    </>
  ),
  parkBrake: (
    <>
      <circle cx="16" cy="16" r="8.5" className="stroke" />
      <path d="M6 7a13 13 0 0 0 0 18M26 7a13 13 0 0 1 0 18" className="stroke" />
      <text x="16" y="20.5" className="lamp-text big">P</text>
    </>
  ),
  dsc: (
    <>
      <path d="M8 6h16l2 5v5H6v-5l2-5Z" className="stroke" />
      <path d="M8 16v3M24 16v3" className="stroke" />
      <path d="M6 24c3-3 5 3 8 0M18 24c3-3 5 3 8 0" className="stroke" />
    </>
  ),
  tirePressure: (
    <>
      <path d="M9 26c-3-2.5-5-6-5-10s2-7.5 5-10M23 26c3-2.5 5-6 5-10s-2-7.5-5-10M9 26h14" className="stroke" />
      <path d="M8 29h3M14.5 29h3M21 29h3" className="stroke" />
      <path d="M16 9v8M16 20.5v1" className="stroke thick" />
    </>
  ),
  coolantTemp: (
    <>
      <path d="M16 4v14M16 9h5M16 13h5" className="stroke thick" />
      <circle cx="16" cy="20" r="3" />
      <path d="M4 25c2.5-2 5 2 7.5 0s5 2 7.5 0 5 2 7.5 0" className="stroke" />
    </>
  ),
  lowFuel: (
    <>
      <path d="M6 27V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v20H6Zm2-15h8V8H8v4Z" />
      <path d="M18 13h3v9a2 2 0 0 0 4 0V11l-3-4M4 27h16" className="stroke" />
    </>
  ),
  doorOpen: (
    <>
      <path d="M11 4h10l2 6v14l-2 4H11l-2-4V10l2-6Z" className="stroke" />
      <path d="M23 13l6 3M9 13l-6 3" className="stroke thick" />
    </>
  ),
  service: (
    <>
      <path d="M20 5a6 6 0 0 0-5.6 8.2L5 22.6 9.4 27l9.4-9.4A6 6 0 0 0 27 12l-3.5 3.5-4-1-1-4L22 7a6 6 0 0 0-2-2Z" className="stroke" />
    </>
  ),
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
  lowBeam: 'green',
  parkingLights: 'green',
  cruise: 'green',
  parkBrake: 'red',
  dsc: 'amber',
  tirePressure: 'amber',
  coolantTemp: 'red',
  lowFuel: 'amber',
  doorOpen: 'red',
  service: 'amber',
};

export function Lamp({ name, on }) {
  return (
    <svg viewBox="0 0 32 32" className={`lamp ${COLOR[name]} ${on ? 'on' : ''}`} aria-label={name}>
      {SYMBOLS[name]}
    </svg>
  );
}

/** Same lists as the simulator (core/src/plugins/simulator.js). */
export const WARNINGS = [
  'checkEngine', 'oil', 'battery', 'brake', 'parkBrake', 'abs', 'dsc', 'airbag',
  'seatbelt', 'tirePressure', 'coolantTemp', 'lowFuel', 'doorOpen', 'service',
];
export const INDICATORS = ['parkingLights', 'lowBeam', 'highBeam', 'fogFront', 'fogRear', 'cruise'];

/** Names for the light test buttons in Settings → Simulator. */
export const LAMP_NAMES = {
  turnLeft: 'Left signal',
  turnRight: 'Right signal',
  parkingLights: 'Parking lights',
  lowBeam: 'Low beam',
  highBeam: 'High beam',
  fogFront: 'Front fog',
  fogRear: 'Rear fog',
  cruise: 'Cruise control',
  checkEngine: 'Check engine',
  oil: 'Oil pressure',
  battery: 'Battery',
  brake: 'Brake system',
  parkBrake: 'Parking brake',
  abs: 'ABS',
  dsc: 'DSC / traction',
  airbag: 'Airbag',
  seatbelt: 'Seat belt',
  tirePressure: 'Tyre pressure',
  coolantTemp: 'Coolant hot',
  lowFuel: 'Low fuel',
  doorOpen: 'Door open',
  service: 'Service due',
};
