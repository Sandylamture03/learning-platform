import { type Content, SIGNUP_LIMITS, STARTING_LEVELS } from '@lp/contracts';
import { html } from '../html.ts';
import { layout, type Page } from '../layout.ts';
import { linkFrom, ROUTES, WAITLIST_ENDPOINT } from '../routes.ts';

/**
 * Native validation only: required, type, min/max and maxlength do the checking, and CSS
 * shows each field's message once :user-invalid matches (after the learner has interacted).
 * The same limits are checked again on the server (waitlistSignup in @lp/contracts).
 */
export function signupPage(content: Content): Page {
  const path = ROUTES.signup;
  const link = linkFrom(path);

  const main = html`<div class="container">
  <header class="page-head">
    <h1>Sign up for early access</h1>
    <p class="page-head__lead">The track outlines and the first lessons and quizzes are open to everyone. Accounts, saved progress and the rest of the lessons come with the learning app. Tell us where you want to start and we will email you when your track is ready.</p>
  </header>

  <form class="form" method="post" action="${WAITLIST_ENDPOINT}">
    <p class="form__note">All fields are required.</p>

    <div class="field">
      <label for="name">Name</label>
      <input id="name" name="name" type="text" autocomplete="name" required maxlength="${SIGNUP_LIMITS.nameMax}">
      <p class="field__error" id="name-error">Enter your name.</p>
    </div>

    <div class="field">
      <label for="email">Email</label>
      <p class="field__hint" id="email-hint">We only use it to tell you when your track opens.</p>
      <input id="email" name="email" type="email" autocomplete="email" required maxlength="${SIGNUP_LIMITS.emailMax}" aria-describedby="email-hint">
      <p class="field__error" id="email-error">Enter an email address like name@example.com.</p>
    </div>

    <div class="field">
      <label for="track">First track</label>
      <select id="track" name="track" required>
        <option value="">Choose a track</option>
${content.tracks.map((t) => html`        <option value="${t.id}">${t.title}</option>\n`)}      </select>
      <p class="field__error" id="track-error">Choose a track.</p>
    </div>

    <fieldset class="field">
      <legend>Where are you starting from?</legend>
${Object.entries(STARTING_LEVELS).map(
  ([value, label]) => html`      <div class="choice">
        <input id="level-${value}" name="level" type="radio" value="${value}" required>
        <label for="level-${value}">${label}</label>
      </div>
`,
)}      <p class="field__error" id="level-error">Choose where you are starting from.</p>
    </fieldset>

    <div class="field">
      <label for="hours">Hours a week you can study</label>
      <p class="field__hint" id="hours-hint">Most tracks plan for 10–12 hours a week.</p>
      <input id="hours" name="hoursPerWeek" type="number" inputmode="numeric" required min="${SIGNUP_LIMITS.hoursMin}" max="${SIGNUP_LIMITS.hoursMax}" step="1" aria-describedby="hours-hint">
      <p class="field__error" id="hours-error">Enter a whole number of hours from ${SIGNUP_LIMITS.hoursMin} to ${SIGNUP_LIMITS.hoursMax}.</p>
    </div>

    <div class="field">
      <div class="choice">
        <input id="updates" name="updates" type="checkbox" value="yes" required>
        <label for="updates">Email me when my track opens</label>
      </div>
      <p class="field__error" id="updates-error">Tick the box so we can email you.</p>
    </div>

    <button class="button" type="submit">Sign up</button>
  </form>
</div>`;

  return {
    path,
    html: layout({
      link,
      title: 'Sign up',
      description: 'Sign up for early access to the Learning Platform app: lessons, quizzes and saved progress.',
      current: 'signup',
      main,
    }),
  };
}
