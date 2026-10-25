import { EventEmitter } from 'node:events';

/**
 * The hub is the center of the system.
 *
 * - State: named values ("topics") such as `vehicle.speed` or `parking.distances`.
 *   Drivers (plugins) write them, the screen app reads them.
 * - Commands: requests such as `ambient.set` or `diag.clear`.
 *   The screen app sends them, a plugin handles them.
 */
export class Hub extends EventEmitter {
  constructor() {
    super();
    this.state = new Map();
    this.commandHandlers = new Map();
  }

  /** Update a topic. Listeners are only told when the value actually changed. */
  set(topic, value) {
    const prev = this.state.get(topic);
    if (prev !== undefined && JSON.stringify(prev) === JSON.stringify(value)) return;
    this.state.set(topic, value);
    this.emit('state', topic, value);
  }

  get(topic) {
    return this.state.get(topic);
  }

  snapshot() {
    return Object.fromEntries(this.state);
  }

  /** Register a handler for a command. Returns a function that unregisters it. */
  onCommand(topic, handler) {
    if (this.commandHandlers.has(topic)) {
      throw new Error(`Command "${topic}" already has a handler`);
    }
    this.commandHandlers.set(topic, handler);
    return () => this.commandHandlers.delete(topic);
  }

  async command(topic, value) {
    const handler = this.commandHandlers.get(topic);
    if (!handler) throw new Error(`No handler for command "${topic}"`);
    return handler(value);
  }

  commands() {
    return [...this.commandHandlers.keys()].sort();
  }
}
