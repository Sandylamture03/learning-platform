import type { TopicQuiz } from '@lp/content';
import type { QuizQuestion } from '@lp/contracts';
import { html, type SafeHtml } from '../html.ts';
import { layout, type Page } from '../layout.ts';
import { linkFrom, ROUTES } from '../routes.ts';
import { topicAnchor } from './track.ts';

interface QuizPageInput extends TopicQuiz {
  /** The next quiz in the same track, if there is one. */
  next?: TopicQuiz | undefined;
}

/** The right answer in words, for the no-JavaScript version. */
function answerText(q: QuizQuestion): string {
  if (q.type === 'predict_output') return q.answer;
  const right = q.type === 'mcq' ? [q.answer] : q.answers;
  return q.options
    .filter((o) => right.includes(o.id))
    .map((o) => o.text)
    .join('; ');
}

/** One question as plain HTML: what shows before the quiz script runs, or without JavaScript. */
function staticQuestion(q: QuizQuestion, index: number): SafeHtml {
  return html`<li>
      <p class="quiz-static__prompt">${index + 1}. ${q.prompt}</p>
      ${q.type === 'predict_output' ? html`<pre class="code"><code>${q.code}</code></pre>` : html`<ul>${q.options.map((o) => html`<li>${o.text}</li>`)}</ul>`}
      <details>
        <summary>Show the answer</summary>
        <p><strong>${answerText(q)}</strong></p>
        <p>${q.explanation}</p>
      </details>
    </li>
`;
}

export function quizPage({ track, topic, quiz, next }: QuizPageInput): Page {
  const path = ROUTES.quiz(topic.id);
  const link = linkFrom(path);
  // A written topic's quiz belongs to its lesson; an outline's to its row on the track page.
  const lesson = topic.status !== 'outline' && ROUTES.lesson(topic.id);
  const back = lesson
    ? html`<a class="pager__link" href="${link(lesson)}"><span aria-hidden="true">←</span> Back to the lesson</a>`
    : html`<a class="pager__link" href="${link(`${ROUTES.track(track.id)}#${topicAnchor(topic)}`)}"><span aria-hidden="true">←</span> Back to the ${track.title} track</a>`;

  // The quiz's children are what shows without JavaScript: every question, with its answer behind a disclosure.
  const main = html`<div class="container">
  <nav class="breadcrumb" aria-label="Breadcrumb">
    <ol role="list">
      <li><a href="${link(ROUTES.home)}">Home</a></li>
      <li><a href="${link(ROUTES.tracks)}">Tracks</a></li>
      <li><a href="${link(ROUTES.track(track.id))}">${track.title}</a></li>
      ${lesson && html`<li><a href="${link(lesson)}">${topic.title}</a></li>`}
      <li><a href="${link(path)}" aria-current="page">Quiz: ${topic.title}</a></li>
    </ol>
  </nav>
  <header class="page-head">
    <p class="eyebrow">${track.title} quiz</p>
    <h1>Quiz: ${topic.title}</h1>
    <p class="page-head__lead">${topic.why}</p>
  </header>

  <lp-quiz src="${link(ROUTES.quizData(topic.id))}">
    <ol class="quiz-static" role="list">
    ${quiz.questions.map(staticQuestion)}</ol>
  </lp-quiz>

  <nav class="pager" aria-label="Quizzes">
    ${back}
    ${next && html`<a class="pager__link pager__link--next" href="${link(ROUTES.quiz(next.topic.id))}">Next quiz: ${next.topic.title} <span aria-hidden="true">→</span></a>`}
  </nav>
</div>`;

  return {
    path,
    html: layout({
      link,
      title: `Quiz: ${topic.title}`,
      description: `A ${quiz.questions.length}-question quiz on “${topic.title}” from the ${track.title} track, with explanations.`,
      current: 'tracks',
      scripts: [ROUTES.widget('quiz')],
      main,
    }),
  };
}
