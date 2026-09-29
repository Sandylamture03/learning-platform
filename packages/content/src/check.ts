// Validates every content file and cross-reference: `pnpm check:content` (or `node src/check.ts <dir>`).
import { resolve } from 'node:path';
import { checkContent, DATA_DIR, formatIssue } from './load.ts';

const dir = process.argv[2] ? resolve(process.argv[2]) : DATA_DIR;
const result = checkContent(dir);

if (result.ok) {
  const { tracks, resources, library, questions } = result.content;
  const count = (pick: (t: (typeof tracks)[number]) => number) => tracks.reduce((sum, t) => sum + pick(t), 0);
  console.log(
    `Content OK: ${tracks.length} tracks, ${count((t) => t.modules.length)} modules, ${count((t) => t.topics.length)} topics, ` +
      `${resources.length} resources, ${library.length} library items, ${questions.length} questions`,
  );
  for (const t of tracks) {
    console.log(
      `  ${t.order}. ${t.title} (${t.id}): ${t.modules.length} modules, ${t.topics.length} topics, ${t.status}`,
    );
  }
} else {
  console.error(`Content has ${result.issues.length} problem(s):`);
  for (const issue of result.issues) console.error(`  ${formatIssue(issue)}`);
  process.exitCode = 1;
}
