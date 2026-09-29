import { afterEach, describe, expect, it } from 'vitest';
import { clearProgress, loadProgress, saveProgress, storageKey } from '../src/progress.js';
import { correctAnswer, isCorrect, neededToPass, normalizeOutput, scoreQuiz } from '../src/scoring.js';
import { must, quizData } from './fixtures.ts';

const [mcq, multi, predict] = quizData.questions;
const q = { mcq: must(mcq), multi: must(multi), predict: must(predict) };

describe('isCorrect', () => {
  it('checks a single choice', () => {
    expect(isCorrect(q.mcq, 'a')).toBe(true);
    expect(isCorrect(q.mcq, 'b')).toBe(false);
  });

  it('wants exactly the right set of choices, in any order', () => {
    expect(isCorrect(q.multi, ['c', 'a'])).toBe(true);
    expect(isCorrect(q.multi, ['a'])).toBe(false);
    expect(isCorrect(q.multi, ['a', 'b', 'c'])).toBe(false);
  });

  it('compares typed output loosely', () => {
    expect(isCorrect(q.predict, '3 1')).toBe(true);
    expect(isCorrect(q.predict, ' 3,1 ')).toBe(true);
    expect(isCorrect(q.predict, '1 3')).toBe(false);
  });
});

describe('normalizeOutput', () => {
  it.each([
    ['[24, 16, 40]', '[24,16,40]'],
    ['[ 24, 16, 40 ]', '[24, 16, 40]'],
    ["{ name: 'Sam' }", '{name:"sam"}'],
    ['inner, outer, document', 'inner outer document'],
    ['True', 'true'],
  ])('treats %j like %j', (a, b) => {
    expect(normalizeOutput(a)).toBe(normalizeOutput(b));
  });

  it('keeps values that differ apart', () => {
    expect(normalizeOutput('1 4 3 2')).not.toBe(normalizeOutput('1 3 4 2'));
    expect(normalizeOutput('[24, 16]')).not.toBe(normalizeOutput('24, 16'));
  });
});

describe('correctAnswer', () => {
  it('spells out the right answer', () => {
    expect(correctAnswer(q.mcq)).toBe('A function plus the variables it was created with');
    expect(correctAnswer(q.multi)).toBe('A function body; A module');
    expect(correctAnswer(q.predict)).toBe('3 1');
  });
});

describe('scoreQuiz', () => {
  it('counts answered and right questions against the pass mark', () => {
    const answers = new Map<string, string | string[]>([
      [q.mcq.id, 'a'],
      [q.multi.id, ['a']],
    ]);
    expect(scoreQuiz(quizData.questions, answers, 0.6)).toEqual({
      answered: 2,
      correct: 1,
      total: 3,
      needed: 2,
      finished: false,
      passed: false,
    });
    answers.set(q.predict.id, '3, 1');
    expect(scoreQuiz(quizData.questions, answers, 0.6)).toMatchObject({ finished: true, correct: 2, passed: true });
  });

  it('rounds the pass mark up to whole questions, without float noise', () => {
    expect(neededToPass(5, 0.8)).toBe(4);
    expect(neededToPass(3, 0.6)).toBe(2);
    expect(neededToPass(10, 0.7)).toBe(7);
    expect(neededToPass(4, 1)).toBe(4);
  });
});

describe('quiz progress', () => {
  const topic = quizData.topic.id;
  afterEach(() => localStorage.clear());

  it('round-trips checked answers', () => {
    const answers = new Map<string, string | string[]>([
      [q.mcq.id, 'b'],
      [q.multi.id, ['a', 'c']],
      [q.predict.id, '3 1'],
    ]);
    saveProgress(topic, answers);
    expect(loadProgress(topic, quizData.questions)).toEqual(answers);
    clearProgress(topic);
    expect(loadProgress(topic, quizData.questions).size).toBe(0);
  });

  it('drops anything it cannot trust', () => {
    localStorage.setItem(storageKey(topic), '{not json');
    expect(loadProgress(topic, quizData.questions).size).toBe(0);

    localStorage.setItem(
      storageKey(topic),
      JSON.stringify({
        answers: {
          [q.mcq.id]: 'z', // not an option
          [q.multi.id]: 'a', // should be a list
          [q.predict.id]: '3 1',
          'scope-and-closures.q99': 'a', // no such question
        },
      }),
    );
    expect([...loadProgress(topic, quizData.questions)]).toEqual([[q.predict.id, '3 1']]);
  });
});
