// @ts-check
// <lp-quiz src="data/quizzes/event-loop.json">: one topic's questions, scored in the browser, with the learner's
// checked answers kept in localStorage.
//
// The element's children are the no-JavaScript fallback: the page puts the questions and their answers inside it,
// the shadow root covers them once this script runs, and a slot shows them again if the quiz can't load.
/** @import { QuizData, QuizQuestion } from '@lp/contracts' */
/** @import { PlatformContext, UiModule } from '@lp/platform-kit' */
/** @import { Answer } from './scoring.js' */
import { h } from './dom.js';
import { clearProgress, loadProgress, saveProgress } from './progress.js';
import { correctAnswer, isAnswered, isCorrect, neededToPass, scoreQuiz } from './scoring.js';

export const TAG = 'lp-quiz';

const STYLES = new URL('./widgets.css', import.meta.url).href;

export class Quiz extends HTMLElement {
  /**
   * Set by mount() in the shell, so a passed quiz can report topic.completed.v1. The static site has none.
   * @type {PlatformContext | undefined}
   */
  ctx;
  /** @type {QuizData | undefined} */
  #data;
  /** The learner's checked answers, by question id. @type {Map<string, Answer>} */
  #answers = new Map();
  /** Aborted on disconnect: removes every listener and cancels the fetch. @type {AbortController | undefined} */
  #connection;

  #intro = h('p', { class: 'intro' });
  #status = h('p', { class: 'status', role: 'status' }, 'Loading the quiz…');
  #list = h('ol', { class: 'questions', role: 'list' });
  #summary = h('div', { class: 'summary', hidden: true });
  #fallback = h('div', { class: 'fallback', hidden: true }, h('slot'));

  constructor() {
    super();
    this.attachShadow({ mode: 'open' }).append(
      h('link', { rel: 'stylesheet', href: STYLES }),
      this.#intro,
      this.#status,
      this.#list,
      this.#summary,
      this.#fallback,
    );
  }

  connectedCallback() {
    this.#connection = new AbortController();
    const { signal } = this.#connection;
    const root = /** @type {ShadowRoot} */ (this.shadowRoot);

    // Event delegation: one listener on the shadow root serves every question's form and the restart button,
    // including the ones render() creates later.
    root.addEventListener(
      'submit',
      (event) => {
        event.preventDefault();
        if (event.target instanceof HTMLFormElement) this.#check(event.target);
      },
      { signal },
    );
    root.addEventListener(
      'click',
      (event) => {
        if (event.target instanceof Element && event.target.closest('[data-action="restart"]')) this.#restart();
      },
      { signal },
    );
    if (!this.#data) void this.#start(signal);
  }

  disconnectedCallback() {
    this.#connection?.abort();
  }

  /** @param {AbortSignal} signal This connection's signal: a load it aborted is not an error. */
  async #start(signal) {
    this.setAttribute('aria-busy', 'true');
    try {
      const src = this.getAttribute('src');
      if (!src) throw new Error(`<${TAG}> needs a src attribute`);
      const response = await fetch(src, { signal });
      if (!response.ok) throw new Error(`Loading ${src} failed with HTTP ${response.status}`);
      /** @type {QuizData} */
      const data = await response.json();
      this.#data = data;
      this.#answers = loadProgress(data.topic.id, data.questions);
      this.#render();
    } catch {
      if (signal.aborted) return;
      this.#status.textContent =
        this.children.length > 0
          ? 'The quiz could not load, so here are the questions with their answers.'
          : 'The quiz could not load. Reload the page to try again.';
      this.#fallback.hidden = false;
    }
    this.removeAttribute('aria-busy');
  }

  #render() {
    const data = this.#data;
    if (!data) return;
    const total = data.questions.length;
    const needed = neededToPass(total, data.passMark);
    this.#intro.textContent = `${total} questions. Get ${needed} right to pass. Your answers are saved in this browser, so you can come back later.`;
    this.#list.replaceChildren(...data.questions.map((q, i) => this.#question(q, i, total)));
    this.#showScore();
  }

  /**
   * One question as a small form. Answered questions are shown locked, with their feedback.
   * @param {QuizQuestion} question
   * @param {number} index
   * @param {number} total
   */
  #question(question, index, total) {
    const answer = this.#answers.get(question.id);
    const answered = answer !== undefined;
    return h(
      'li',
      {},
      h(
        'form',
        { class: 'question', 'data-question': question.id, novalidate: true },
        h(
          'fieldset',
          { disabled: answered },
          h(
            'legend',
            {},
            h('span', { class: 'question__number' }, `Question ${index + 1} of ${total}`),
            ' ', // keeps the number and the prompt apart in the name a screen reader announces
            question.prompt,
          ),
          question.type === 'predict_output' && h('pre', { class: 'code' }, h('code', {}, question.code)),
          this.#inputs(question, answer),
        ),
        !answered && h('button', { type: 'submit', class: 'button' }, 'Check answer'),
        h('div', { class: 'feedback', tabindex: -1, hidden: !answered }, answered && this.#feedback(question, answer)),
      ),
    );
  }

  /**
   * @param {QuizQuestion} question
   * @param {Answer | undefined} answer
   */
  #inputs(question, answer) {
    if (question.type === 'predict_output') {
      const id = `${question.id}-answer`;
      return h(
        'div',
        { class: 'field' },
        h('label', { for: id }, 'Your answer'),
        h('input', {
          id,
          name: 'answer',
          type: 'text',
          value: typeof answer === 'string' ? answer : undefined,
          autocomplete: 'off',
          autocapitalize: 'off',
          spellcheck: 'false',
        }),
      );
    }
    const type = question.type === 'mcq' ? 'radio' : 'checkbox';
    const picked = answer === undefined ? [] : typeof answer === 'string' ? [answer] : answer;
    const right = question.type === 'mcq' ? [question.answer] : question.answers;
    return h(
      'div',
      { class: 'choices' },
      question.options.map((option) => {
        const id = `${question.id}-${option.id}`;
        const chosen = picked.includes(option.id);
        // Once checked, say which options were right in words, not only in colour.
        const mark =
          answer === undefined
            ? undefined
            : right.includes(option.id)
              ? h('span', { class: 'mark mark--right' }, 'Correct answer')
              : chosen && h('span', { class: 'mark mark--wrong' }, 'Your answer');
        return h(
          'div',
          { class: 'choice' },
          h('input', { id, name: 'answer', type, value: option.id, checked: chosen }),
          h('label', { for: id }, option.text, mark && ' ', mark),
        );
      }),
    );
  }

  /**
   * @param {QuizQuestion} question
   * @param {Answer} answer
   */
  #feedback(question, answer) {
    const right = isCorrect(question, answer);
    return [
      h('p', { class: `verdict verdict--${right ? 'right' : 'wrong'}` }, right ? 'Correct.' : 'Not quite.'),
      !right && question.type === 'predict_output' && h('p', {}, 'You wrote ', h('code', {}, String(answer)), '.'),
      !right && h('p', {}, 'The answer: ', h('strong', {}, correctAnswer(question))),
      h('p', {}, question.explanation),
    ];
  }

  /** @param {HTMLFormElement} form */
  #check(form) {
    const data = this.#data;
    const question = data?.questions.find((q) => q.id === form.dataset.question);
    if (!data || !question || this.#answers.has(question.id)) return;

    const values = new FormData(form).getAll('answer').map(String);
    const answer = question.type === 'multi_select' ? values : (values[0] ?? '').trim();
    if (!isAnswered(answer)) {
      this.#status.textContent =
        question.type === 'predict_output' ? 'Type an answer, then check it.' : 'Choose an answer, then check it.';
      form.querySelector('input')?.focus();
      return;
    }

    this.#answers.set(question.id, answer);
    saveProgress(data.topic.id, this.#answers);
    const index = data.questions.indexOf(question);
    const item = this.#question(question, index, data.questions.length);
    form.closest('li')?.replaceWith(item);
    const score = this.#showScore();
    // Move focus to the verdict: the check button is gone, and the verdict is what to read next.
    /** @type {HTMLElement | null} */ (item.querySelector('.feedback'))?.focus();

    if (score.finished && score.passed) {
      this.ctx?.events.emit('topic.completed.v1', {
        trackId: data.track.id,
        topicId: data.topic.id,
        score: score.correct / score.total,
      });
    }
  }

  #restart() {
    const data = this.#data;
    if (!data) return;
    clearProgress(data.topic.id);
    this.#answers = new Map();
    this.#render();
    this.#status.textContent = `Answers cleared. ${this.#status.textContent}`;
    this.#list.querySelector('input')?.focus();
  }

  /** Updates the running score and, once every question is answered, the summary. */
  #showScore() {
    const data = /** @type {QuizData} */ (this.#data);
    const score = scoreQuiz(data.questions, this.#answers, data.passMark);
    const { answered, correct, total, needed } = score;
    this.#status.textContent = score.finished
      ? `Finished: ${correct} of ${total} right. ${score.passed ? 'You passed.' : 'Not a pass yet.'}`
      : `Answered ${answered} of ${total}, ${correct} right.`;

    this.#summary.hidden = !score.finished;
    this.#summary.replaceChildren(
      ...(score.finished
        ? [
            h(
              'p',
              { class: 'summary__score' },
              `You got ${correct} of ${total} right (${Math.round((correct / total) * 100)}%).`,
            ),
            h(
              'p',
              {},
              score.passed
                ? `That is a pass: you needed ${needed}.`
                : `You need ${needed} to pass. Read the explanations above, then start again.`,
            ),
            h('button', { type: 'button', class: 'button button--secondary', 'data-action': 'restart' }, 'Start again'),
          ]
        : []),
    );
    return score;
  }
}

// A second copy of this file on the page must not throw.
if (!customElements.get(TAG)) customElements.define(TAG, Quiz);

/**
 * The shell's way in (Phase 3). The host element carries the quiz's URL: <div data-src="/data/quizzes/event-loop.json">.
 * @type {UiModule}
 */
const quiz = {
  mount(el, ctx) {
    const node = /** @type {Quiz} */ (document.createElement(TAG));
    node.ctx = ctx; // set before connecting, so a quiz finished straight away can still report it
    if (el.dataset.src) node.setAttribute('src', el.dataset.src);
    el.append(node);
  },
  unmount(el) {
    el.replaceChildren(); // disconnectedCallback removes the listeners and cancels the fetch
  },
};
export default quiz;
