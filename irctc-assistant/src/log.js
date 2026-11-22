import { EventEmitter } from 'node:events';

/** Progress bus shared by the CLI (prints) and the web UI (server-sent events). */
export function createBus() {
  const bus = new EventEmitter();
  bus.log = (stage, message, extra = {}) => bus.emit('event', { t: new Date().toISOString(), stage, message, ...extra });
  return bus;
}

export function printEvents(bus, out = console.log) {
  bus.on('event', (e) => out(`[${e.t.slice(11, 19)}] ${e.stage.padEnd(10)} ${e.message}`));
}
