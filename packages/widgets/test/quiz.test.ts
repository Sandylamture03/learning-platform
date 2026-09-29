import type { QuizData } from '@lp/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { storageKey } from '../src/progress.js';
import quiz, { TAG } from '../src/quiz.js';
import { fakeContext, fakeFetch, must, quizData, settle } from './fixtures.ts';

const KEY = storageKey(quizData.topic.id);

async function addQuiz(data: unknown = quizData, host: HTMLElement = document.body) {
  fakeFetch(data);
  const el = document.createElement(TAG);
  el.setAttribute('src', '/data/quizzes/scope-and-closures.json');
  host.append(el);
  await settle();
  return parts(el);
}

function parts(el: Element) {
  const root = must(el.shadowRoot, 'a shadow root');
  const form = (n: number) => must(root.querySelectorAll('form')[n], `question ${n + 1}`);
  return {
    el,
    root,
    form,
    intro: () => root.querySelector('.intro')?.textContent,
    status: () => root.querySelector('[role="status"]')?.textContent,
    feedback: (n: number) => must(form(n).querySelector<HTMLElement>('.feedback')),
    summary: () => must(root.querySelector<HTMLElement>('.summary')),
    /** Ticks the options with these ids (or types the text) in question n, then presses Check answer. */
    answer(n: number, choice: string | string[]) {
      const f = form(n);
      const text = f.querySelector<HTMLInputElement>('input[type="text"]');
      if (text) text.value = String(choice);
      for (const input of f.querySelectorAll<HTMLInputElement>('input[type="radio"], input[type="checkbox"]')) {
        input.checked = ([] as string[]).concat(choice).includes(input.value);
      }
      f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    },
  };
}

afterEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('<lp-quiz>', () => {
  it('renders each question as a form with labelled answers', async () => {
    const q = await addQuiz();
    expect(q.intro()).toBe(
      '3 questions. Get 2 right to pass. Your answers are saved in this browser, so you can come back later.',
    );
    expect(q.status()).toBe('Answered 0 of 3, 0 right.');
    expect(q.root.querySelectorAll('form')).toHaveLength(3);
    expect(q.form(0).querySelector('legend')?.textContent).toBe('Question 1 of 3 What is a closure?');
    expect(q.form(0).querySelectorAll('input[type="radio"]')).toHaveLength(2);
    expect(q.form(1).querySelectorAll('input[type="checkbox"]')).toHaveLength(3);
    expect(q.form(2).querySelector('pre code')?.textContent).toBe('console.log(a(), b());');

    for (const input of q.root.querySelectorAll('input')) {
      expect(q.root.querySelector(`label[for="${input.id}"]`), input.id).not.toBeNull();
    }
    expect(q.el.hasAttribute('aria-busy')).toBe(false);
  });

  it('marks a right answer, then locks the question and moves focus to the verdict', async () => {
    const q = await addQuiz();
    q.answer(0, 'a');

    const feedback = q.feedback(0);
    expect(feedback.hidden).toBe(false);
    expect(feedback.querySelector('.verdict')?.textContent).toBe('Correct.');
    expect(feedback.textContent).toContain('A function remembers the scope it was written in.');
    expect(q.form(0).querySelector('fieldset')?.disabled).toBe(true);
    expect(q.form(0).querySelector('button')).toBeNull();
    expect(q.root.activeElement).toBe(feedback);
    expect(q.status()).toBe('Answered 1 of 3, 1 right.');
  });

  it('explains a wrong answer and says which options were right, in words', async () => {
    const q = await addQuiz();
    q.answer(1, ['a', 'b']);

    const feedback = q.feedback(1);
    expect(feedback.querySelector('.verdict')?.textContent).toBe('Not quite.');
    expect(feedback.textContent).toContain('The answer: A function body; A module');
    const marks = [...q.form(1).querySelectorAll('.choice')].map((c) => c.querySelector('.mark')?.textContent ?? '');
    expect(marks).toEqual(['Correct answer', 'Your answer', 'Correct answer']);
    expect(q.status()).toBe('Answered 1 of 3, 0 right.');
  });

  it('accepts typed output written with different spacing', async () => {
    const q = await addQuiz();
    q.answer(2, '3,1');
    expect(q.feedback(2).querySelector('.verdict')?.textContent).toBe('Correct.');
  });

  it('repeats a wrong typed answer back, next to the right one', async () => {
    const q = await addQuiz();
    q.answer(2, '1 3');
    expect(q.feedback(2).textContent).toContain('You wrote 1 3.');
    expect(q.feedback(2).textContent).toContain('The answer: 3 1');
  });

  it('asks for an answer before checking one', async () => {
    const q = await addQuiz();
    q.answer(0, []);
    expect(q.status()).toBe('Choose an answer, then check it.');
    expect(q.feedback(0).hidden).toBe(true);
    q.answer(2, '   ');
    expect(q.status()).toBe('Type an answer, then check it.');
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('saves checked answers and picks up where the learner left off', async () => {
    const first = await addQuiz();
    first.answer(0, 'a');
    first.answer(2, '1 3');
    expect(JSON.parse(localStorage.getItem(KEY) ?? '{}')).toEqual({
      answers: { 'scope-and-closures.q01': 'a', 'scope-and-closures.q03': '1 3' },
    });
    first.el.remove();

    const again = await addQuiz();
    expect(again.status()).toBe('Answered 2 of 3, 1 right.');
    expect(again.form(0).querySelector<HTMLInputElement>('input[value="a"]')?.checked).toBe(true);
    expect(again.form(0).querySelector('fieldset')?.disabled).toBe(true);
    expect(again.form(2).querySelector<HTMLInputElement>('input')?.value).toBe('1 3');
    expect(again.form(1).querySelector('fieldset')?.disabled).toBe(false);
  });

  it('starts fresh when the saved progress is unreadable', async () => {
    localStorage.setItem(KEY, '{broken');
    const q = await addQuiz();
    expect(q.status()).toBe('Answered 0 of 3, 0 right.');
  });

  it('shows the score at the end and can start again', async () => {
    const q = await addQuiz();
    expect(q.summary().hidden).toBe(true);
    q.answer(0, 'a');
    q.answer(1, ['a']);
    q.answer(2, '3 1');

    expect(q.summary().hidden).toBe(false);
    expect(q.summary().textContent).toContain('You got 2 of 3 right (67%).');
    expect(q.summary().textContent).toContain('That is a pass: you needed 2.');
    expect(q.status()).toBe('Finished: 2 of 3 right. You passed.');

    must(q.summary().querySelector('button')).click();
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(q.summary().hidden).toBe(true);
    expect(q.status()).toBe('Answers cleared. Answered 0 of 3, 0 right.');
    expect(q.form(0).querySelector('fieldset')?.disabled).toBe(false);
    expect(q.root.activeElement).toBe(q.form(0).querySelector('input'));
  });

  it('says when the learner has not passed yet', async () => {
    const q = await addQuiz();
    q.answer(0, 'b');
    q.answer(1, ['a']);
    q.answer(2, '3 1');
    expect(q.summary().textContent).toContain('You need 2 to pass.');
    expect(q.status()).toBe('Finished: 1 of 3 right. Not a pass yet.');
  });

  it('shows questions and options as text, never as markup', async () => {
    const [first] = quizData.questions;
    const tricky: QuizData = {
      ...quizData,
      questions: [{ ...must(first), prompt: '<b>bold</b> <img src=x onerror=alert(1)>' }],
    };
    const q = await addQuiz(tricky);
    expect(q.root.querySelector('b, img')).toBeNull();
    expect(q.form(0).querySelector('legend')?.textContent).toContain('<b>bold</b>');
  });

  it("shows the page's own questions when the quiz can't load", async () => {
    fakeFetch({}, { status: 500 });
    const el = document.createElement(TAG);
    el.setAttribute('src', '/data/quizzes/missing.json');
    el.append(document.createElement('ol'));
    document.body.append(el);
    await settle();
    const q = parts(el);
    expect(q.status()).toBe('The quiz could not load, so here are the questions with their answers.');
    expect(must(q.root.querySelector<HTMLElement>('.fallback')).hidden).toBe(false);
  });
});

describe('the quiz module', () => {
  it('tells the shell when a learner passes', async () => {
    fakeFetch(quizData);
    const ctx = fakeContext();
    const completed = vi.fn();
    ctx.events.on('topic.completed.v1', completed);
    const host = document.createElement('div');
    host.dataset.src = '/api/quizzes/scope-and-closures';
    document.body.append(host);

    await quiz.mount(host, ctx);
    await settle();
    const q = parts(must(host.querySelector(TAG)));
    q.answer(0, 'a');
    q.answer(1, ['a', 'c']);
    expect(completed).not.toHaveBeenCalled(); // not finished yet
    q.answer(2, '3 1');
    expect(completed).toHaveBeenCalledExactlyOnceWith({
      trackId: 'javascript',
      topicId: 'scope-and-closures',
      score: 1,
    });
  });

  it('stays quiet when a learner finishes without passing', async () => {
    fakeFetch(quizData);
    const ctx = fakeContext();
    const completed = vi.fn();
    ctx.events.on('topic.completed.v1', completed);
    const host = document.createElement('div');
    document.body.append(host);
    host.dataset.src = '/q.json';
    await quiz.mount(host, ctx);
    await settle();
    const q = parts(must(host.querySelector(TAG)));
    q.answer(0, 'b');
    q.answer(1, ['b']);
    q.answer(2, 'nothing');
    expect(q.status()).toBe('Finished: 0 of 3 right. Not a pass yet.');
    expect(completed).not.toHaveBeenCalled();
  });

  it('unmounts cleanly: the element goes, and its listeners with it', async () => {
    fakeFetch(quizData);
    const host = document.createElement('div');
    host.dataset.src = '/q.json';
    document.body.append(host);
    await quiz.mount(host, fakeContext());
    await settle();
    const q = parts(must(host.querySelector(TAG)));

    await quiz.unmount(host);
    expect(host.childElementCount).toBe(0);
    q.answer(0, 'a'); // a submit inside the detached quiz reaches no listener
    expect(q.feedback(0).hidden).toBe(true);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('cancels its fetch when it leaves the page before the quiz arrives', async () => {
    const network = fakeFetch(quizData, { hold: true });
    const host = document.createElement('div');
    host.dataset.src = '/q.json';
    document.body.append(host);
    await quiz.mount(host, fakeContext());
    await quiz.unmount(host);
    expect(network.requests[0]?.signal?.aborted).toBe(true);
  });
});
