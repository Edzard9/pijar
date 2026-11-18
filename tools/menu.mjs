import {copyFile, readdir, readFile, stat, writeFile} from 'node:fs/promises';
import {execFile, spawn} from 'node:child_process';
import {createInterface} from 'node:readline/promises';
import {stdin, stdout} from 'node:process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'src');
const skip = new Set(['Root.tsx', 'Root.tsx.bak', 'index.ts', 'index.tsx']);

async function scan() {
  const entries = await readdir(src, {withFileTypes: true});
  const files = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.tsx')) continue;
    if (skip.has(entry.name) || entry.name.endsWith('.bak') || entry.name.includes('.generated.')) continue;
    const info = await stat(path.join(src, entry.name));
    files.push({name: entry.name, mtimeMs: info.mtimeMs});
  }
  files.sort((a, b) => b.mtimeMs - a.mtimeMs);
  const compositions = [];

  for (const {name: file, mtimeMs} of files) {
    const id = path.basename(file, '.tsx');
    const source = await readFile(path.join(src, file), 'utf8');
    const exported = new Set(
      [...source.matchAll(/\bexport\s+(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g)].map((m) => m[1])
    );
    if (!exported.has(id)) {
      console.log(`Peringatan: ${file} dilewati, tidak mengekspor ${id}.`);
      continue;
    }
    compositions.push({id, file: `./${id}`, exported, source, mtimeMs});
  }

  return compositions;
}

function declaration(source, name) {
  const match = source.match(new RegExp(`^\\s*export\\s+const\\s+${name}\\s*=\\s*([^\\n]+)`, 'm'));
  if (!match) return null;
  const comment = match[1].match(/\/\/\s*(\d+)/)?.[1];
  return {expression: match[1].split('//')[0].trim().replace(/;$/, ''), comment};
}

function displayValue(source, names, fallback) {
  for (const name of names) {
    const found = declaration(source, name);
    if (!found) continue;
    if (/^-?\d+$/.test(found.expression)) return found.expression;
    if (found.comment) return found.comment;
    return found.expression.replace(/\s+/g, ' ');
  }
  return fallback;
}

const FIELDS = [
  ['durationInFrames', ['TOTAL_FRAMES', 'DURATION_FRAMES'], 'TF_', '90'],
  ['fps', ['FPS'], 'FPS_', '30'],
  ['width', ['WIDTH', 'W'], 'W_', '1080'],
  ['height', ['HEIGHT', 'H'], 'H_', '1920'],
];

function rootSource(compositions) {
  const imports = ['import React from "react";', 'import {Composition} from "remotion";'];
  const blocks = compositions.map(({id, file, exported}) => {
    const names = [];
    const args = {};
    for (const [prop, candidates, prefix, fallback] of FIELDS) {
      const name = candidates.find((candidate) => exported.has(candidate));
      if (name) {
        const alias = `${prefix}${id}`;
        names.push(`${name} as ${alias}`);
        args[prop] = alias;
      } else {
        args[prop] = fallback;
      }
    }
    imports.push(`import {${[id, ...names].join(', ')}} from "${file}";`);
    return `      <Composition id="${id}" component={${id}} durationInFrames={${args.durationInFrames}} fps={${args.fps}} width={${args.width}} height={${args.height}} />`;
  });
  return [
    '// GENERATED oleh tools/menu.mjs - jangan edit manual. Jalankan: npm run menu',
    ...imports,
    '',
    'export const Root: React.FC = () => (',
    '  <>',
    ...blocks,
    '  </>',
    ');',
    '',
  ].join('\n');
}

async function writeRoot(compositions) {
  const file = path.join(src, 'Root.tsx');
  try {
    await readFile(`${file}.bak`);
  } catch {
    try {
      await copyFile(file, `${file}.bak`);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  await writeFile(file, rootSource(compositions));
}

function outputName(composition) {
  const found = declaration(composition.source, 'OUTPUT_NAME');
  const raw = found?.expression ?? `"${composition.id.toLowerCase()}.mp4"`;
  return raw.replace(/^['"]|['"]$/g, '');
}

function formatSeconds(composition) {
  const frames = Number(displayValue(composition.source, ['TOTAL_FRAMES', 'DURATION_FRAMES'], '90'));
  const fps = Number(displayValue(composition.source, ['FPS'], '30'));
  if (!Number.isFinite(frames) || !Number.isFinite(fps) || fps <= 0) return '';
  const seconds = frames / fps;
  const text = Number.isInteger(seconds) ? String(seconds) : seconds.toFixed(1).replace('.', ',');
  return ` (${text} dtk)`;
}

async function renderStatus(composition) {
  try {
    const info = await stat(path.join(root, 'out', outputName(composition)));
    return info.mtimeMs >= composition.mtimeMs ? 'sudah dirender' : 'perlu render ulang';
  } catch {
    return 'belum dirender';
  }
}

function assetRefs(source) {
  const refs = [];
  for (const match of source.matchAll(/\bstaticFile\(\s*([^)]*?)\s*\)/g)) {
    const arg = match[1].trim();
    const literal = arg.match(/^(['"`])([^'"`]+)\1$/);
    if (literal) {
      if (literal[1] === '`' && literal[2].includes('${')) continue;
      refs.push(literal[2]);
      continue;
    }
    if (/^[A-Za-z_$][\w$]*$/.test(arg)) {
      const found = source.match(new RegExp(`\\bconst\\s+${arg}\\s*=\\s*(['"\`])([^'"\`]+)\\1`));
      if (found) refs.push(found[2]);
    }
  }
  return [...new Set(refs)];
}

async function missingAssets(composition) {
  const missing = [];
  for (const ref of assetRefs(composition.source)) {
    try {
      await stat(path.join(root, 'public', ref));
    } catch {
      missing.push(ref);
    }
  }
  return missing;
}

function glRenderer() {
  if (process.platform === 'win32') return {value: 'angle', label: 'GPU (ANGLE/Direct3D) untuk NVIDIA, AMD, dan Intel'};
  if (process.platform === 'darwin') return {value: 'angle', label: 'GPU (ANGLE/Metal) untuk Mac Intel dan Apple Silicon (M series)'};
  return {value: 'egl', label: 'GPU (EGL)'};
}

function detectGpuNames() {
  return new Promise((resolve) => {
    if (process.platform === 'darwin') {
      execFile('sysctl', ['-n', 'machdep.cpu.brand_string'], {timeout: 4000}, (error, stdout) => {
        if (error) return resolve([]);
        const name = stdout.trim();
        resolve(name ? [name] : []);
      });
      return;
    }
    if (process.platform !== 'win32') return resolve([]);
    execFile(
      'powershell',
      ['-NoProfile', '-Command', 'Get-CimInstance Win32_VideoController | ForEach-Object { $_.Name }'],
      {timeout: 4000, windowsHide: true},
      (error, stdout) => {
        if (error) return resolve([]);
        resolve(stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
      }
    );
  });
}

function spawnStep(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', args, {cwd: root, shell: true, stdio: 'inherit'});
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 1));
  });
}

async function renderComposition(composition, gl, gpuNames) {
  console.log(`Merender ${composition.id}...`);
  console.log(`Mode render: ${gl.label}`);
  const renderArgs = ['remotion', 'render', composition.id, `out\\${outputName(composition)}`];
  let usedGpu = true;
  let renderCode = await spawnStep([...renderArgs, `--gl=${gl.value}`]);
  if (renderCode !== 0 && gl.value !== 'swiftshader') {
    console.log('Render dengan GPU gagal, mencoba ulang dengan render software (CPU)...');
    usedGpu = false;
    renderCode = await spawnStep([...renderArgs, '--gl=swiftshader']);
  }
  if (renderCode === 0) {
    const outFile = path.join(root, 'out', outputName(composition));
    const urlPath = outFile.replace(/\\/g, '/');
    const outUrl = urlPath.startsWith('/') ? `file://${urlPath}` : `file:///${urlPath}`;
    console.log(`Render selesai: ${outFile}`);
    console.log(`Klik untuk membuka video: \x1b]8;;${outUrl}\x1b\\\x1b[34;4m${outUrl}\x1b[0m\x1b]8;;\x1b\\`);
    if (usedGpu) {
      console.log(`Dirender dengan GPU: ${gpuNames.length ? gpuNames.join(', ') : gl.label}`);
    } else {
      console.log('Dirender dengan CPU (software), GPU tidak dipakai.');
    }
    return true;
  }
  console.log(`Render gagal (kode ${renderCode}).`);
  return false;
}

if (process.argv.includes('--gen')) {
  const compositions = await scan();
  await writeRoot(compositions);
  process.exit(0);
}

const prompt = createInterface({input: stdin, output: stdout});
const lineQueue = [];
const waiters = [];
let inputClosed = false;
prompt.on('line', (line) => {
  if (waiters.length) waiters.shift()(line);
  else lineQueue.push(line);
});
prompt.on('close', () => {
  inputClosed = true;
  while (waiters.length) waiters.shift()(null);
});
const ask = (text) => {
  stdout.write(text);
  if (lineQueue.length) return Promise.resolve(lineQueue.shift().trim());
  if (inputClosed) return Promise.resolve(null);
  return new Promise((resolve) => waiters.push((value) => resolve(value === null ? null : value.trim())));
};

let selesai = false;
while (!selesai) {
  const compositions = await scan();
  await writeRoot(compositions);
  if (!compositions.length) {
    console.log('Tidak ada komposisi ditemukan di src.');
    break;
  }
  console.log('Komposisi ditemukan, terbaru di atas:');
  for (const [index, composition] of compositions.entries()) {
    const duration = displayValue(composition.source, ['TOTAL_FRAMES', 'DURATION_FRAMES'], '90');
    const fps = displayValue(composition.source, ['FPS'], '30');
    const width = displayValue(composition.source, ['WIDTH', 'W'], '1080');
    const height = displayValue(composition.source, ['HEIGHT', 'H'], '1920');
    const status = await renderStatus(composition);
    console.log(`  ${index + 1}. ${composition.id} - ${duration} frame${formatSeconds(composition)}, ${fps} fps, ${width}x${height}, ${outputName(composition)} [${status}]`);
  }
  console.log('  0. Render SEMUA komposisi berurutan');

  const choice = await ask('Pilih nomor (kosong/q untuk keluar): ');
  if (choice === null || !choice || choice.toLowerCase() === 'q') break;

  if (choice === '0') {
    console.log('Memeriksa tipe...');
    const typecheck = await spawnStep(['tsc', '--noEmit']);
    if (typecheck !== 0) {
      console.log('Pemeriksaan tipe gagal, antrean dibatalkan.');
    } else {
      const gl = glRenderer();
      const gpuNames = await detectGpuNames();
      const detLabel = process.platform === 'darwin' ? 'Chip terdeteksi' : 'GPU terdeteksi';
      if (gpuNames.length) console.log(`${detLabel}: ${gpuNames.join(', ')}`);
      let okCount = 0;
      let failCount = 0;
      let skipCount = 0;
      for (const composition of compositions) {
        const missing = await missingAssets(composition);
        if (missing.length) {
          console.log(`Peringatan: ${composition.id} dilewati, file aset tidak ditemukan di folder public:`);
          for (const name of missing) console.log(`  - ${name}`);
          skipCount++;
          continue;
        }
        const ok = await renderComposition(composition, gl, gpuNames);
        if (ok) okCount++;
        else failCount++;
      }
      console.log(`Antrean selesai: ${okCount} berhasil, ${failCount} gagal, ${skipCount} dilewati.`);
    }
  } else {
    const selected = Number(choice);
    if (!Number.isInteger(selected) || selected < 1 || selected > compositions.length) {
      console.log('Pilihan tidak valid.');
      continue;
    }
    const composition = compositions[selected - 1];

    const missing = await missingAssets(composition);
    let lanjut = true;
    if (missing.length) {
      console.log('Peringatan: file aset berikut tidak ditemukan di folder public:');
      for (const name of missing) console.log(`  - ${name}`);
      console.log('Render kemungkinan gagal di tengah jalan.');
      const tetap = await ask('Tetap render? (y/n): ');
      lanjut = tetap !== null && (tetap.toLowerCase() === 'y' || tetap.toLowerCase() === 'ya');
      if (!lanjut) console.log('Render dibatalkan.');
    }

    if (lanjut) {
      console.log('Memeriksa tipe...');
      const typecheck = await spawnStep(['tsc', '--noEmit']);
      if (typecheck !== 0) {
        console.log('Pemeriksaan tipe gagal, render dibatalkan.');
      } else {
        const gl = glRenderer();
        const gpuNames = await detectGpuNames();
        const detLabel = process.platform === 'darwin' ? 'Chip terdeteksi' : 'GPU terdeteksi';
        if (gpuNames.length) console.log(`${detLabel}: ${gpuNames.join(', ')}`);
        await renderComposition(composition, gl, gpuNames);
      }
    }
  }

  const lagi = await ask('Program selesai? (y/n): ');
  if (lagi === null || lagi.toLowerCase() === 'y' || lagi.toLowerCase() === 'ya') selesai = true;
}
prompt.close();
console.log('Program selesai. Sampai jumpa.');
