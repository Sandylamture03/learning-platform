// Serves the already-built dist/ folder, e.g. for the end-to-end tests: `node src/serve.ts --port 4322`.
import { parseArgs } from 'node:util';
import { loadContent } from '@lp/content';
import { DIST_DIR } from './build.ts';
import { createSiteServer } from './server.ts';

const { values } = parseArgs({ options: { port: { type: 'string', default: '4322' } } });
const ids = loadContent().tracks.map((t) => t.id);
const [first, ...rest] = ids;
if (!first) throw new Error('No tracks in the content');

createSiteServer({ root: DIST_DIR, trackIds: [first, ...rest] }).listen(Number(values.port), () => {
  console.log(`Serving dist/ at http://localhost:${values.port}`);
});
