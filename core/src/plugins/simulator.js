/**
 * Simulator: fake car data so the whole system can be built and tested on the
 * laptop before any car hardware is connected. Each real driver added later
 * (K-Bus, diagnostics cable, ESP32) takes over some of these topics, and the
 * simulator is then switched off in config.json.
 *
 * Topics it writes:
 *   vehicle.ignition      "off" | "acc" | "run"
 *   vehicle.speed         km/h
 *   vehicle.rpm
 *   vehicle.coolant       °C
 *   vehicle.fuel          % of tank
 *   vehicle.outsideTemp   °C
 *   vehicle.reverse       true while reverse gear is engaged
 *   vehicle.doors         { fl, fr, rl, rr, trunk }  true = open
 *   vehicle.locked        true | false
 *   vehicle.lights        { parking, low, high, fogFront, fogRear }
 *   parking.distances     { rearLeft, rearMidLeft, rearMidRight, rearRight }  cm, null = nothing seen
 *   ambient.state         { on, color "#rrggbb", brightness 0-100 }
 *   diag.codes            [{ module, code, text, status }]
 *   diag.scanning         true while a scan runs
 *   sim.scenario          "drive" | "park" | "idle"
 *
 * Commands it handles:
 *   sim.scenario  "drive" | "park" | "idle"
 *   sim.door      { door: "fl", open: true }
 *   body.lock     { locked: true }
 *   ambient.set   { on?, color?, brightness? }
 *   diag.scan
 *   diag.clear    { module? }   (no module = clear all)
 */

const SCENARIOS = ['drive', 'park', 'idle'];
const DOORS = ['fl', 'fr', 'rl', 'rr', 'trunk'];

// Clearly marked as simulated; real codes come from the car once the
// diagnostics cable is connected.
const SAMPLE_CODES = [
  { module: 'DME (engine)', code: 'P0171', text: 'System too lean, bank 1', status: 'stored' },
  { module: 'DME (engine)', code: 'P0174', text: 'System too lean, bank 2', status: 'stored' },
  { module: 'LCM (lights)', code: 'SIM-01', text: 'Rear left brake light bulb (simulated)', status: 'active' },
];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round = (v, digits = 0) => { const f = 10 ** digits; return Math.round(v * f) / f; };

export default function simulator(hub, options = {}) {
  const tickMs = options.tickMs ?? 100;
  let scenario = SCENARIOS.includes(options.scenario) ? options.scenario : 'drive';
  let t = 0;
  let coolant = 20;
  let fuel = 72;
  let parkDistance = 160;
  let codes = SAMPLE_CODES.map((c) => ({ ...c }));
  const doors = Object.fromEntries(DOORS.map((d) => [d, false]));
  let ambient = { on: true, color: '#ff7a1a', brightness: 60 };
  let scanTimer = null;

  hub.set('vehicle.ignition', 'run');
  hub.set('vehicle.outsideTemp', 18);
  hub.set('vehicle.locked', false);
  hub.set('vehicle.lights', { parking: true, low: true, high: false, fogFront: false, fogRear: false });
  hub.set('vehicle.doors', { ...doors });
  hub.set('ambient.state', { ...ambient });
  hub.set('diag.codes', codes);
  hub.set('diag.scanning', false);
  hub.set('sim.scenario', scenario);

  function tick() {
    t += tickMs / 1000;
    let speed = 0;
    let rpm = 0;

    if (scenario === 'drive') {
      speed = 55 + 35 * Math.sin(t / 12) + 4 * Math.sin(t * 1.3);
      // Rough E46 5-speed: shift up every ~35 km/h.
      const gearRatio = [0, 120, 70, 48, 37, 30][clamp(Math.ceil(speed / 35), 1, 5)];
      rpm = clamp(800 + speed * gearRatio * 0.6, 800, 6500);
      fuel = Math.max(0, fuel - 0.0004);
    } else if (scenario === 'park') {
      speed = 3;
      rpm = 950;
      parkDistance -= 0.6;
      if (parkDistance < 15) parkDistance = 160;
    } else {
      rpm = 780 + 15 * Math.sin(t * 2);
    }

    coolant = Math.min(90, coolant + 0.08);

    hub.set('vehicle.speed', round(Math.max(0, speed)));
    hub.set('vehicle.rpm', Math.round(rpm / 10) * 10);
    hub.set('vehicle.coolant', round(coolant));
    hub.set('vehicle.fuel', round(fuel, 1));

    const reverse = scenario === 'park';
    hub.set('vehicle.reverse', reverse);
    if (reverse) {
      const d = parkDistance;
      hub.set('parking.distances', {
        rearLeft: round(d + 25),
        rearMidLeft: round(d + 5),
        rearMidRight: round(d),
        rearRight: d + 40 > 150 ? null : round(d + 40),
      });
    } else {
      hub.set('parking.distances', { rearLeft: null, rearMidLeft: null, rearMidRight: null, rearRight: null });
    }
  }

  const unregister = [
    hub.onCommand('sim.scenario', (value) => {
      if (!SCENARIOS.includes(value)) throw new Error(`Scenario must be one of: ${SCENARIOS.join(', ')}`);
      scenario = value;
      parkDistance = 160;
      hub.set('sim.scenario', scenario);
      return scenario;
    }),

    hub.onCommand('sim.door', ({ door, open } = {}) => {
      if (!DOORS.includes(door)) throw new Error(`Door must be one of: ${DOORS.join(', ')}`);
      doors[door] = Boolean(open);
      hub.set('vehicle.doors', { ...doors });
    }),

    hub.onCommand('body.lock', ({ locked } = {}) => {
      hub.set('vehicle.locked', Boolean(locked));
      return Boolean(locked);
    }),

    hub.onCommand('ambient.set', (value = {}) => {
      const next = { ...ambient };
      if (value.on !== undefined) next.on = Boolean(value.on);
      if (value.color !== undefined) {
        if (!/^#[0-9a-f]{6}$/i.test(value.color)) throw new Error('Color must look like #ff7a1a');
        next.color = value.color.toLowerCase();
      }
      if (value.brightness !== undefined) next.brightness = clamp(Math.round(Number(value.brightness)), 0, 100);
      ambient = next;
      hub.set('ambient.state', { ...ambient });
      return ambient;
    }),

    hub.onCommand('diag.scan', () => {
      if (scanTimer) return 'already scanning';
      hub.set('diag.scanning', true);
      return new Promise((resolve) => {
        scanTimer = setTimeout(() => {
          scanTimer = null;
          hub.set('diag.codes', codes.map((c) => ({ ...c })));
          hub.set('diag.scanning', false);
          resolve(codes.length);
        }, options.scanMs ?? 1500);
      });
    }),

    hub.onCommand('diag.clear', ({ module } = {}) => {
      // Active faults come straight back after clearing, like in a real car.
      codes = codes.filter((c) => (module && c.module !== module) || c.status === 'active');
      hub.set('diag.codes', codes.map((c) => ({ ...c })));
      return codes.length;
    }),
  ];

  tick();
  const timer = setInterval(tick, tickMs);

  return {
    stop() {
      clearInterval(timer);
      clearTimeout(scanTimer);
      unregister.forEach((fn) => fn());
    },
  };
}
