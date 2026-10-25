/**
 * Telephone - SIMULATED for now. Shows how calls, contacts and history will
 * work. Real calls already work through CarPlay / Android Auto; a Bluetooth
 * hands-free driver can replace this plugin later using the same topics.
 *
 * Topics:
 *   phone.state     { connection: "connected"|"disconnected", device, battery, signal, simulated }
 *   phone.contacts  [{ id, name, numbers: [{ label, number }] }]
 *   phone.history   [{ id, name, number, direction: "in"|"out"|"missed", at }]
 *   phone.call      { state: "incoming"|"outgoing"|"active"|"ended"|"failed", name, number, startedAt, muted } | null
 *
 * Commands:
 *   phone.dial { number }   phone.answer   phone.reject   phone.hangup
 *   phone.mute { muted }    phone.connect  phone.disconnect
 *   sim.incomingCall        (for testing)
 */

const CONTACTS = [
  ['Ana García', '+34 600 100 201', 'Mobile'],
  ['Carlos Martín', '+34 600 100 202', 'Mobile'],
  ['Garage - BMW service', '+34 930 100 203', 'Work'],
  ['Home', '+34 930 100 204', 'Home'],
  ['Laura Sánchez', '+34 600 100 205', 'Mobile'],
  ['Mamá', '+34 600 100 206', 'Mobile'],
  ['Pablo Ruiz', '+34 600 100 207', 'Mobile'],
  ['Roadside assistance', '+34 900 100 208', 'Work'],
].map(([name, number, label], i) => ({ id: `c${i + 1}`, name, numbers: [{ label, number }] }));

const normalize = (n) => String(n).replace(/[^\d+]/g, '');

export default function phone(hub, options = {}) {
  const connectMs = options.connectMs ?? 2500;
  const endedMs = options.endedMs ?? 2000;
  let history = [
    { id: 'h3', name: 'Carlos Martín', number: '+34 600 100 202', direction: 'missed', at: Date.now() - 3600_000 },
    { id: 'h2', name: 'Home', number: '+34 930 100 204', direction: 'out', at: Date.now() - 86_400_000 },
    { id: 'h1', name: 'Ana García', number: '+34 600 100 201', direction: 'in', at: Date.now() - 2 * 86_400_000 },
  ];
  let call = null;
  let timer = null;
  let historyId = 10;

  const state = { connection: 'connected', device: 'Phone (simulated)', battery: 80, signal: 4, simulated: true };
  hub.set('phone.state', { ...state });
  hub.set('phone.contacts', CONTACTS);
  hub.set('phone.history', history);
  hub.set('phone.call', null);

  const nameFor = (number) => {
    const n = normalize(number);
    return CONTACTS.find((c) => c.numbers.some((x) => normalize(x.number) === n))?.name ?? null;
  };

  const setCall = (next) => {
    call = next;
    hub.set('phone.call', call ? { ...call } : null);
  };

  const addHistory = (direction) => {
    history = [{ id: `h${++historyId}`, name: call.name, number: call.number, direction, at: Date.now() }, ...history].slice(0, 50);
    hub.set('phone.history', history);
  };

  const finish = (finalState = 'ended') => {
    clearTimeout(timer);
    setCall({ ...call, state: finalState });
    timer = setTimeout(() => setCall(null), endedMs);
  };

  const requireConnected = () => {
    if (state.connection !== 'connected') throw new Error('No phone connected');
  };

  const unregister = [
    hub.onCommand('phone.dial', ({ number } = {}) => {
      requireConnected();
      if (call && call.state !== 'ended') throw new Error('A call is already in progress');
      if (!number || normalize(number).replace('+', '').length < 3) throw new Error('Enter a phone number first');
      clearTimeout(timer);
      setCall({ state: 'outgoing', name: nameFor(number), number, startedAt: null, muted: false });
      addHistory('out');
      timer = setTimeout(() => setCall({ ...call, state: 'active', startedAt: Date.now() }), connectMs);
      return call;
    }),

    hub.onCommand('phone.answer', () => {
      if (call?.state !== 'incoming') throw new Error('No incoming call');
      setCall({ ...call, state: 'active', startedAt: Date.now() });
      addHistory('in');
    }),

    hub.onCommand('phone.reject', () => {
      if (call?.state !== 'incoming') throw new Error('No incoming call');
      addHistory('missed');
      finish('ended');
    }),

    hub.onCommand('phone.hangup', () => {
      if (!call || call.state === 'ended') return;
      if (call.state === 'incoming') addHistory('missed');
      finish('ended');
    }),

    hub.onCommand('phone.mute', ({ muted } = {}) => {
      if (call?.state !== 'active') throw new Error('No active call');
      setCall({ ...call, muted: Boolean(muted) });
    }),

    hub.onCommand('phone.connect', () => {
      state.connection = 'connected';
      hub.set('phone.state', { ...state });
      hub.notify('success', `${state.device} connected`);
    }),

    hub.onCommand('phone.disconnect', () => {
      if (call) finish('ended');
      state.connection = 'disconnected';
      hub.set('phone.state', { ...state });
      hub.notify('info', 'Phone disconnected');
    }),

    hub.onCommand('sim.incomingCall', ({ contactId } = {}) => {
      requireConnected();
      if (call && call.state !== 'ended') throw new Error('A call is already in progress');
      const contact = CONTACTS.find((c) => c.id === contactId) ?? CONTACTS[Math.floor(Math.random() * CONTACTS.length)];
      clearTimeout(timer);
      setCall({ state: 'incoming', name: contact.name, number: contact.numbers[0].number, startedAt: null, muted: false });
    }),
  ];

  return {
    stop() {
      clearTimeout(timer);
      unregister.forEach((fn) => fn());
    },
  };
}
