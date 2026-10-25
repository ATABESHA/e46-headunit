import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { Hub } from './hub.js';
import { startServer } from './server.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const coreDir = path.resolve(here, '..');

/** config.local.json (not in git) overrides config.json, so the car can have its own settings. */
async function loadConfig() {
  const file = process.env.E46_CONFIG
    ?? [path.join(coreDir, 'config.local.json'), path.join(coreDir, 'config.json')].find(existsSync);
  const config = JSON.parse(await readFile(file, 'utf8'));
  console.info(`[core] config: ${file}`);
  return config;
}

/**
 * A plugin is a module whose default export is `(hub, options) => { stop() } | void`.
 * Built-in plugins live in src/plugins/<name>.js. A plugin can also be any file:
 * set "path": "/home/car/my-plugin.js" in its config entry.
 */
async function loadPlugin(name, options) {
  const file = options.path
    ? path.resolve(coreDir, options.path)
    : path.join(here, 'plugins', `${name}.js`);
  const mod = await import(pathToFileURL(file).href);
  return mod.default;
}

async function main() {
  const config = await loadConfig();
  const hub = new Hub();
  const running = [];

  for (const [name, options] of Object.entries(config.plugins ?? {})) {
    if (!options.enabled) continue;
    try {
      const plugin = await loadPlugin(name, options);
      running.push({ name, instance: (await plugin(hub, options)) ?? {} });
      console.info(`[core] plugin started: ${name}`);
    } catch (err) {
      // One broken plugin must not take the whole system down.
      console.error(`[core] plugin "${name}" failed to start:`, err);
    }
  }

  const server = await startServer(hub, { host: config.host, port: config.port });

  const shutdown = async () => {
    console.info('[core] shutting down');
    for (const { name, instance } of running) {
      try {
        await instance.stop?.();
      } catch (err) {
        console.error(`[core] plugin "${name}" failed to stop:`, err);
      }
    }
    await server.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[core] fatal:', err);
  process.exit(1);
});
