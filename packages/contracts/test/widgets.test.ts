import { describe, expect, it } from 'vitest';
import { isQuizQuestion, Question } from '../src/index.ts';

const base = {
  id: 'closures.q01',
  topic: 'closures',
  difficulty: 1,
  priority: 'P0',
  usage: ['quiz'],
  tags: [],
  prompt: 'What is a closure?',
};

const mcq = Question.parse({
  ...base,
  type: 'mcq',
  options: [
    { id: 'a', text: 'A function with its scope' },
    { id: 'b', text: 'A block' },
  ],
  answer: 'a',
  explanation: 'Functions remember where they were written.',
});

const deepDive = Question.parse({
  ...base,
  type: 'deep_dive',
  timeLimitSec: 120,
  followUps: [],
  modelAnswer: 'A function plus its lexical environment.',
  rubric: [
    { id: 'scope', point: 'Mentions scope', weight: 1 },
    { id: 'example', point: 'Gives an example', weight: 1 },
  ],
});

describe('isQuizQuestion', () => {
  it('takes questions a quiz can score by itself, when they are meant for quizzes', () => {
    expect(isQuizQuestion(mcq)).toBe(true);
    expect(isQuizQuestion({ ...mcq, usage: ['interview'] })).toBe(false);
  });

  it('leaves out questions that need a person or a code runner to mark', () => {
    expect(isQuizQuestion(deepDive)).toBe(false);
  });
});
