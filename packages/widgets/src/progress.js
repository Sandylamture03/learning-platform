// @ts-check
// Quiz progress in localStorage: the checked answers for each topic, so a reload picks up where the learner left off.
/** @import { QuizQuestion } from '@lp/contracts' */
/** @import { Answer } from './scoring.js' */

/** Bump when the saved shape changes; old progress is then ignored rather than misread. */
const VERSION = 1;

/** @param {string} topicId */
export function storageKey(topicId) {
  return `lp.quiz.v${VERSION}.${topicId}`;
}

/** localStorage, or undefined where the browser blocks it (storage turned off, some private modes, sandboxes). */
function storage() {
  try {
    return globalThis.localStorage ?? undefined;
  } catch {
    // Even reading the localStorage property can throw a SecurityError.
    return undefined;
  }
}

/**
 * Whether a saved value is a possible answer to this question.
 * @param {QuizQuestion} question
 * @param {unknown} value
 * @returns {value is Answer}
 */
function fits(question, value) {
  const isOption = (/** @type {unknown} */ id) =>
    question.type !== 'predict_output' && question.options.some((o) => o.id === id);
  switch (question.type) {
    case 'mcq':
      return isOption(value);
    case 'multi_select':
      return Array.isArray(value) && value.length > 0 && value.every(isOption);
    case 'predict_output':
      return typeof value === 'string' && value.trim() !== '';
    default:
      return false;
  }
}

/**
 * The saved answers to the quiz's current questions. A value that is unreadable, belongs to a question that no longer
 * exists or doesn't fit its question is dropped, so an edited quiz or a hand-edited value can't break the page.
 * @param {string} topicId
 * @param {readonly QuizQuestion[]} questions
 * @returns {Map<string, Answer>}
 */
export function loadProgress(topicId, questions) {
  /** @type {Map<string, Answer>} */
  const answers = new Map();
  /** @type {unknown} */
  let saved;
  try {
    saved = JSON.parse(storage()?.getItem(storageKey(topicId)) ?? 'null');
  } catch {
    return answers;
  }
  if (typeof saved !== 'object' || saved === null || !('answers' in saved)) return answers;
  const stored = saved.answers;
  if (typeof stored !== 'object' || stored === null) return answers;
  for (const question of questions) {
    const value = /** @type {Record<string, unknown>} */ (stored)[question.id];
    if (fits(question, value)) answers.set(question.id, value);
  }
  return answers;
}

/**
 * @param {string} topicId
 * @param {ReadonlyMap<string, Answer>} answers
 */
export function saveProgress(topicId, answers) {
  try {
    storage()?.setItem(storageKey(topicId), JSON.stringify({ answers: Object.fromEntries(answers) }));
  } catch {
    // Full or blocked storage: the quiz still works, it just won't remember.
  }
}

/** @param {string} topicId */
export function clearProgress(topicId) {
  try {
    storage()?.removeItem(storageKey(topicId));
  } catch {
    // Nothing to clear.
  }
}
