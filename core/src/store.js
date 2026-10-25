import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

/**
 * Small settings files that survive updates (radio presets, sound settings, ...).
 * Stored outside the code folder: ~/.local/share/e46-headunit/<name>.json
 */
export function dataDir() {
  return process.env.E46_DATA_DIR ?? path.join(homedir(), '.local', 'share', 'e46-headunit');
}

export async function openStore(name, defaults = {}) {
  const dir = dataDir();
  const file = path.join(dir, `${name}.json`);
  let data = { ...defaults };
  try {
    data = { ...defaults, ...JSON.parse(await readFile(file, 'utf8')) };
  } catch {
    // First start or unreadable file: use defaults.
  }

  let writing = Promise.resolve();
  const save = () => {
    // Write to a temp file and rename, so a power cut never leaves half a file.
    writing = writing.then(async () => {
      await mkdir(dir, { recursive: true });
      const tmp = `${file}.tmp`;
      await writeFile(tmp, JSON.stringify(data, null, 2));
      await rename(tmp, file);
    }).catch((err) => console.error(`[store] could not save ${name}:`, err));
    return writing;
  };

  return {
    get: (key) => data[key],
    all: () => ({ ...data }),
    set: (key, value) => {
      data[key] = value;
      return save();
    },
  };
}
