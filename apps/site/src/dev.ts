// `pnpm dev`: builds the site, serves it on http://localhost:4321 and rebuilds when content, CSS or a widget changes.
// Node's --watch restarts this script when a TypeScript template changes.
import { watch } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DATA_DIR, loadContent } from '@lp/content';
import type { Content } from '@lp/contracts';
import { buildSite, DIST_DIR, STYLES_DIR, WIDGETS_DIR } from './build.ts';
import { createSiteServer } from './server.ts';

const port = Number(process.env.PORT ?? 4321);

function rebuild(): Content | undefined {
  try {
    const content = loadContent();
    const { pages } = buildSite({ content });
    console.log(`Built ${pages.length} pages`);
    return content;
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    return undefined;
  }
}

const content = rebuild();
const [first, ...rest] = content?.tracks.map((t) => t.id) ?? [];
if (!first) {
  console.error('Fix the problems above, then run `pnpm dev` again.');
  process.exit(1);
}

createSiteServer({
  root: DIST_DIR,
  trackIds: [first, ...rest],
  onSignup: (s) =>
    console.log(`Sign-up received (${s.track}, ${s.level}, ${s.hoursPerWeek} h a week); the stub stores nothing`),
}).listen(port, () => console.log(`Site running at http://localhost:${port} (Ctrl+C to stop)`));

let timer: ReturnType<typeof setTimeout> | undefined;
const watched = [DATA_DIR, STYLES_DIR, fileURLToPath(import.meta.resolve('@lp/design-tokens/tokens.css')), WIDGETS_DIR];
for (const path of watched) {
  watch(path, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(rebuild, 100);
  });
}
