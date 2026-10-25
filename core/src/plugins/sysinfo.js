/**
 * Live resource use, for the performance display (Settings → Display).
 *
 * Topic:
 *   system.stats {
 *     cpu        % of all cores in use (whole computer)
 *     cpuTemp    °C, or null
 *     memUsedMB, memTotalMB
 *     app        { cpu %, memMB, processes }   this system only (screen app + core)
 *     gpu        { curMHz, maxMHz, busy % } - what the graphics driver reports, or null
 *   }
 */
import { readFile, readdir } from 'node:fs/promises';
import { cpus } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(here, '..', '..', '..');
const CLK_TCK = 100; // Linux kernel ticks per second for process times

const read = (file) => readFile(file, 'utf8').catch(() => null);
const num = async (file) => {
  const text = await read(file);
  const n = text === null ? NaN : Number(text.trim());
  return Number.isFinite(n) ? n : null;
};

/** "cpu  4705 356 584 3699 23 23 0 0 0 0" -> { busy, total } */
export function parseCpuLine(line) {
  const v = line.trim().split(/\s+/).slice(1).map(Number);
  const idle = v[3] + (v[4] || 0);
  const total = v.slice(0, 8).reduce((a, b) => a + b, 0);
  return { busy: total - idle, total };
}

export function parseMeminfo(text) {
  const get = (key) => Number(new RegExp(`^${key}:\\s+(\\d+)`, 'm').exec(text)?.[1] ?? 0);
  const total = get('MemTotal');
  return { totalMB: Math.round(total / 1024), usedMB: Math.round((total - get('MemAvailable')) / 1024) };
}

/** utime + stime from /proc/<pid>/stat (the name may contain spaces, so split after ")"). */
export function parseProcTicks(stat) {
  const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
  return Number(fields[11]) + Number(fields[12]);
}

async function findCpuTemp() {
  // Intel: coretemp, AMD: k10temp - first sensor is the whole processor.
  try {
    for (const dir of await readdir('/sys/class/hwmon')) {
      const name = (await read(`/sys/class/hwmon/${dir}/name`))?.trim();
      if (name === 'coretemp' || name === 'k10temp' || name === 'zenpower') return `/sys/class/hwmon/${dir}/temp1_input`;
    }
  } catch {
    // No sensors exposed.
  }
  return null;
}

async function findGpu() {
  try {
    for (const card of await readdir('/sys/class/drm')) {
      if (!/^card\d+$/.test(card)) continue;
      const base = `/sys/class/drm/${card}`;
      // Intel (i915 driver)
      if ((await num(`${base}/gt_cur_freq_mhz`)) !== null) return { cur: `${base}/gt_cur_freq_mhz`, max: `${base}/gt_RP0_freq_mhz` };
      // Intel (newer xe driver)
      const xe = `${base}/device/tile0/gt0/freq0`;
      if ((await num(`${xe}/act_freq`)) !== null) return { cur: `${xe}/act_freq`, max: `${xe}/rp0_freq` };
      // AMD
      if ((await num(`${base}/device/gpu_busy_percent`)) !== null) return { busy: `${base}/device/gpu_busy_percent` };
    }
  } catch {
    // No graphics information.
  }
  return null;
}

async function ourProcesses() {
  const pids = [];
  for (const entry of await readdir('/proc')) {
    if (!/^\d+$/.test(entry)) continue;
    const cmd = await read(`/proc/${entry}/cmdline`);
    if (cmd && (Number(entry) === process.pid || cmd.includes(REPO))) pids.push(entry);
  }
  return pids;
}

async function pssMB(pid) {
  const text = await read(`/proc/${pid}/smaps_rollup`);
  const kb = Number(/^Pss:\s+(\d+)/m.exec(text ?? '')?.[1] ?? 0);
  return kb / 1024;
}

export default async function sysinfo(hub, options = {}) {
  const intervalMs = options.intervalMs ?? 1000;
  const cores = cpus().length || 1;
  const tempFile = await findCpuTemp();
  const gpu = await findGpu();
  let lastCpu = null;
  let lastTicks = new Map();
  let lastAt = Date.now();

  async function sample() {
    const now = Date.now();
    const seconds = (now - lastAt) / 1000;
    lastAt = now;

    const statText = (await read('/proc/stat')) ?? 'cpu 0 0 0 0';
    const cpuNow = parseCpuLine(statText.split('\n')[0]);
    const cpu = lastCpu && cpuNow.total > lastCpu.total ? ((cpuNow.busy - lastCpu.busy) / (cpuNow.total - lastCpu.total)) * 100 : 0;
    lastCpu = cpuNow;

    const mem = parseMeminfo((await read('/proc/meminfo')) ?? '');

    const pids = await ourProcesses();
    const ticks = new Map();
    let appTicks = 0;
    let appMem = 0;
    for (const pid of pids) {
      const stat = await read(`/proc/${pid}/stat`);
      if (!stat) continue;
      const t = parseProcTicks(stat);
      ticks.set(pid, t);
      if (lastTicks.has(pid)) appTicks += t - lastTicks.get(pid);
      appMem += await pssMB(pid);
    }
    lastTicks = ticks;

    let gpuInfo = null;
    if (gpu?.cur) gpuInfo = { curMHz: await num(gpu.cur), maxMHz: await num(gpu.max), busy: null };
    else if (gpu?.busy) gpuInfo = { curMHz: null, maxMHz: null, busy: await num(gpu.busy) };

    const temp = tempFile ? await num(tempFile) : null;
    hub.set('system.stats', {
      cpu: Math.round(cpu),
      cpuTemp: temp === null ? null : Math.round(temp / 1000),
      memUsedMB: mem.usedMB,
      memTotalMB: mem.totalMB,
      app: {
        cpu: Math.round((appTicks / CLK_TCK / seconds / cores) * 100),
        memMB: Math.round(appMem),
        processes: pids.length,
      },
      gpu: gpuInfo,
    });
  }

  await sample();
  const timer = setInterval(() => sample().catch(() => {}), intervalMs);
  return {
    stop() {
      clearInterval(timer);
    },
  };
}
