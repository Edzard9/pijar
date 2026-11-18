import {copyFile, readdir, readFile, writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline/promises';
import {stdin, stdout} from 'node:process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'src');
const skip = new Set(['Root.tsx', 'Root.tsx.bak', 'index.ts', 'index.tsx']);

async function scan() {
  const entries = await readdir(src, {withFileTypes: true});
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.tsx'))
    .map((entry) => entry.name)
    .filter((name) => !skip.has(name) && !name.endsWith('.bak') && !name.includes('.generated.'))
    .sort();
  const compositions = [];

  for (const file of files) {
    const id = path.basename(file, '.tsx');
    const source = await readFile(path.join(src, file), 'utf8');
    const exported = new Set(
      [...source.matchAll(/\bexport\s+(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g)].map((m) => m[1])
    );
    if (!exported.has(id)) {
      console.log(`Peringatan: ${file} dilewati, tidak mengekspor ${id}.`);
      continue;
    }
    compositions.push({id, file: `./${id}`, exported, source});
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

function spawnStep(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', args, {cwd: root, shell: true, stdio: 'inherit'});
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 1));
  });
}

const compositions = await scan();
await writeRoot(compositions);
if (process.argv.includes('--gen')) process.exit(0);

compositions.forEach((composition, index) => {
  const duration = displayValue(composition.source, ['TOTAL_FRAMES', 'DURATION_FRAMES'], '90');
  const fps = displayValue(composition.source, ['FPS'], '30');
  const width = displayValue(composition.source, ['WIDTH', 'W'], '1080');
  const height = displayValue(composition.source, ['HEIGHT', 'H'], '1920');
  console.log(`  ${index + 1}. ${composition.id} - ${duration} frame, ${fps} fps, ${width}x${height}, ${outputName(composition)}`);
});

const prompt = createInterface({input: stdin, output: stdout});
const choice = (await prompt.question('Pilih nomor (kosong/q untuk keluar): ')).trim();
prompt.close();
if (!choice || choice.toLowerCase() === 'q') process.exit(0);
const selected = Number(choice);
if (!Number.isInteger(selected) || selected < 1 || selected > compositions.length) {
  console.log('Pilihan tidak valid.');
  process.exit(1);
}

console.log('Memeriksa tipe...');
const typecheck = await spawnStep(['tsc', '--noEmit']);
if (typecheck !== 0) {
  console.log('Pemeriksaan tipe gagal, render dibatalkan.');
  process.exit(typecheck);
}

const composition = compositions[selected - 1];
console.log(`Merender ${composition.id}...`);
process.exit(await spawnStep(['remotion', 'render', composition.id, `out\\${outputName(composition)}`]));
