// @ts-check
// The quiz's scoring: pure functions, so they are easy to test.
/** @import { QuizQuestion } from '@lp/contracts' */

/** An option id (mcq), a list of option ids (multi_select) or typed text (predict_output). */
/** @typedef {string | string[]} Answer */

/**
 * Compares typed output loosely: case, quote style and spacing don't matter, and a comma counts as a space,
 * so "[24,16,40]" matches "[24, 16, 40]" and "3, 1" matches "3 1".
 * @param {string} text
 */
export function normalizeOutput(text) {
  return text
    .trim()
    .toLowerCase()
    .replaceAll("'", '"')
    .replace(/[\s,]+/g, ' ')
    .replace(/\s*([[\]{}():])\s*/g, '$1');
}

/**
 * @param {QuizQuestion} question
 * @param {Answer} answer
 */
export function isCorrect(question, answer) {
  switch (question.type) {
    case 'mcq':
      return answer === question.answer;
    case 'multi_select': {
      const picked = new Set(typeof answer === 'string' ? [answer] : answer);
      return picked.size === question.answers.length && question.answers.every((id) => picked.has(id));
    }
    case 'predict_output':
      return typeof answer === 'string' && normalizeOutput(answer) === normalizeOutput(question.answer);
    default:
      return false;
  }
}

/**
 * The right answer as the learner should read it.
 * @param {QuizQuestion} question
 */
export function correctAnswer(question) {
  switch (question.type) {
    case 'mcq':
      return question.options.find((o) => o.id === question.answer)?.text ?? question.answer;
    case 'multi_select':
      return question.options
        .filter((o) => question.answers.includes(o.id))
        .map((o) => o.text)
        .join('; ');
    case 'predict_output':
      return question.answer;
    default:
      return '';
  }
}

/**
 * Whether the learner has given an answer at all (nothing picked, or only spaces typed, is no answer).
 * @param {Answer} answer
 */
export function isAnswered(answer) {
  return typeof answer === 'string' ? answer.trim() !== '' : answer.length > 0;
}

/**
 * How many questions a learner must get right to pass: 80% of 5 questions is 4.
 * @param {number} total
 * @param {number} passMark From 0 to 1.
 */
export function neededToPass(total, passMark) {
  // Round away float noise first: 0.7 * 10 is 7.000000000000001, which must not become 8.
  return Math.ceil(Math.round(total * passMark * 1e6) / 1e6);
}

/**
 * @param {readonly QuizQuestion[]} questions
 * @param {ReadonlyMap<string, Answer>} answers Checked answers by question id.
 * @param {number} passMark
 */
export function scoreQuiz(questions, answers, passMark) {
  let answered = 0;
  let correct = 0;
  for (const question of questions) {
    const answer = answers.get(question.id);
    if (answer === undefined) continue;
    answered += 1;
    if (isCorrect(question, answer)) correct += 1;
  }
  const total = questions.length;
  const needed = neededToPass(total, passMark);
  return { answered, correct, total, needed, finished: answered === total, passed: correct >= needed };
}
