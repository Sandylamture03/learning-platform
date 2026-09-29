import type { Content } from '@lp/contracts';
import { html } from '../html.ts';
import { layout, type Page, SITE_NAME } from '../layout.ts';
import { linkFrom, ROUTES } from '../routes.ts';
import { countWord, trackCard } from './parts.ts';

export function homePage(content: Content): Page {
  const path = ROUTES.home;
  const link = linkFrom(path);
  const weeks = content.tracks.map((t) => t.pace.weeks);
  const [first, second] = content.tracks;

  const main = html`<div class="container">
  <section class="hero" aria-labelledby="hero-title">
    <p class="eyebrow">HTML5 · CSS3 · JavaScript · TypeScript · React · Node.js</p>
    <h1 id="hero-title">Learn the 20% that real jobs use</h1>
    <p class="hero__lead">${countWord(content.tracks.length)} tracks cut down to the skills you will use every week at work. Each week pairs a short list of topics with a build, and a clear line for when you are done.</p>
    <div class="hero__actions">
      <a class="button" href="${link(ROUTES.tracks)}">Browse the tracks</a>
      <a class="button button--secondary" href="${link(ROUTES.signup)}">Sign up for early access</a>
    </div>
  </section>

  <section class="section" aria-labelledby="how-title">
    <h2 id="how-title">How each week works</h2>
    <ol class="steps" role="list">
      <li><h3>Learn the 20%</h3><p>A handful of topics that do most of the work, marked P0 when interviews ask about them too.</p></li>
      <li><h3>Build with it</h3><p>Every week ends in a build: a résumé page, a landing page, a dashboard, an API.</p></li>
      <li><h3>Check you are done</h3><p>A short "done when" list tells you when to move on, and a "not now" list tells you what to skip.</p></li>
    </ol>
  </section>

  <section class="section" aria-labelledby="tracks-title">
    <div class="section__head">
      <h2 id="tracks-title">The tracks</h2>
      <p><a href="${link(ROUTES.tracks)}">See every track in detail</a></p>
    </div>
    <ul class="card-grid" role="list">
${content.tracks.map((t) => trackCard(t, link, 3))}    </ul>
  </section>

  <section class="section" aria-labelledby="faq-title">
    <h2 id="faq-title">Questions</h2>
    <div class="faq">
      <details>
        <summary>What does 80/20 mean here?</summary>
        <p>Roughly 20% of each technology covers 80% of day-to-day work. Each track teaches that 20% in depth and leaves the rest until a task needs it. Every track lists what to skip for now.</p>
      </details>
      <details>
        <summary>Which track should I start with?</summary>
        <p>Start with ${first?.title ?? 'the first track'}, then ${second?.title ?? 'the second'}. TypeScript runs alongside React and Node.js, and both of those build on JavaScript.</p>
      </details>
      <details>
        <summary>How long does a track take?</summary>
        <p>Between ${Math.min(...weeks)} and ${Math.max(...weeks)} weeks. Most tracks plan for 10–12 hours a week, and each track page shows its own pace.</p>
      </details>
      <details>
        <summary>What do I need to install?</summary>
        <p>A code editor and a modern browser are enough for HTML and CSS. From the JavaScript track on, you also need Node.js.</p>
      </details>
      <details>
        <summary>Why sign up now?</summary>
        <p>The track outlines, the resource finder and the first quizzes are open to everyone. Accounts, written lessons and progress that follows you between devices come with the learning app; sign up to hear when your track is ready.</p>
      </details>
    </div>
  </section>
</div>`;

  return {
    path,
    html: layout({
      link,
      title: SITE_NAME,
      description:
        'Learn the 20% of HTML5, CSS3, JavaScript, TypeScript, React and Node.js that real jobs use, one week and one build at a time.',
      main,
    }),
  };
}
