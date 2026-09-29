// Import rules for the monorepo: `pnpm check:boundaries`.
//  1. Code reaches another workspace package by its name (@lp/...), never by a relative path.
//  2. Every @lp/* import is declared in the importing package's package.json.
//  3. Nothing imports an app; apps sit at the top of the graph.
//  4. Shared packages stay runtime-neutral: no node: imports in their src/, so the browser can use them.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const NEUTRAL = new Set(['@lp/contracts', '@lp/markdown', '@lp/platform-kit', '@lp/widgets']);
const SOURCE = /\.(?:ts|tsx|js|jsx|mjs)$/;
const IMPORT = /\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)|\bimport\s+['"]([^'"]+)['"]/g;

interface Workspace {
  dir: string;
  name: string;
  declared: Set<string>;
}

const workspaces: Workspace[] = ['apps', 'packages'].flatMap((group) =>
  readdirSync(join(ROOT, group))
    .map((name) => join(group, name))
    .filter((dir) => existsSync(join(ROOT, dir, 'package.json')))
    .map((dir) => {
      const manifest = JSON.parse(readFileSync(join(ROOT, dir, 'package.json'), 'utf8'));
      const declared = new Set(Object.keys({ ...manifest.dependencies, ...manifest.devDependencies }));
      return { dir, name: manifest.name as string, declared };
    }),
);
const byName = new Map(workspaces.map((w) => [w.name, w]));

function* sourceFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* sourceFiles(path);
    else if (SOURCE.test(entry.name)) yield path;
  }
}

const problems: string[] = [];
let files = 0;

for (const ws of workspaces) {
  const home = resolve(ROOT, ws.dir);
  for (const file of sourceFiles(home)) {
    files++;
    const where = relative(ROOT, file).split(sep).join('/');
    const inSrc = relative(home, file).startsWith(`src${sep}`);
    for (const match of readFileSync(file, 'utf8').matchAll(IMPORT)) {
      const spec = match[1] ?? match[2] ?? match[3] ?? '';
      if (spec.startsWith('.')) {
        if (!resolve(dirname(file), spec).startsWith(home + sep)) {
          problems.push(`${where}: "${spec}" reaches outside ${ws.name}; import the package by name instead`);
        }
      } else if (spec.startsWith('@lp/')) {
        const name = spec.split('/').slice(0, 2).join('/');
        const target = byName.get(name);
        if (!target) problems.push(`${where}: "${name}" is not a workspace package`);
        else if (target.dir.startsWith('apps'))
          problems.push(`${where}: imports the app ${name}; apps are never imported`);
        else if (!ws.declared.has(name))
          problems.push(`${where}: imports ${name}, which ${ws.dir}/package.json does not list`);
      } else if (spec.startsWith('node:') && inSrc && NEUTRAL.has(ws.name)) {
        problems.push(`${where}: ${ws.name} must run in the browser too, so it cannot import ${spec}`);
      }
    }
  }
}

if (problems.length > 0) {
  console.error(`Boundary check found ${problems.length} problem(s):`);
  for (const p of problems) console.error(`  ${p}`);
  process.exitCode = 1;
} else {
  console.log(`Boundaries OK: ${files} files in ${workspaces.length} packages`);
}
