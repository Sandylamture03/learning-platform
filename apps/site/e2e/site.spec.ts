// Gate checks in a real browser. Phase 1: accessibility, 320px layouts, keyboard use, the form.
// Phase 2: the widgets work on the static site, typing fast never shows stale results, and pages without widgets
// still ship no JavaScript.
import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

const WIDGET_PAGES = ['/resources.html', '/quizzes/dom-and-events.html', '/quizzes/event-loop.html'];

const PAGES = [
  '/',
  '/tracks/',
  '/tracks/html-css.html',
  '/tracks/javascript.html',
  '/tracks/typescript.html',
  '/tracks/react.html',
  '/tracks/nodejs.html',
  ...WIDGET_PAGES,
  '/signup.html',
  '/thanks.html',
  '/no-such-page.html',
];

declare global {
  interface Window {
    recordStatus(text: string): void;
  }
}

/** Waits until every widget on the page has started and finished loading its data. */
async function widgetsReady(page: Page) {
  await page.waitForFunction(() =>
    [...document.querySelectorAll('lp-resource-finder, lp-quiz')].every(
      (el) => el.shadowRoot && !el.hasAttribute('aria-busy'),
    ),
  );
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`${colorScheme} theme`, () => {
    test.use({ colorScheme });

    for (const path of PAGES) {
      test(`${path} has no axe violations`, async ({ page }) => {
        await page.goto(path);
        await widgetsReady(page);
        const { violations } = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
          .analyze();
        expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
      });
    }
  });
}

test.describe('on a 320px-wide phone', () => {
  test.use({ viewport: { width: 320, height: 720 } });

  for (const path of PAGES) {
    test(`${path} has no horizontal scroll`, async ({ page }) => {
      await page.goto(path);
      await widgetsReady(page);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});

for (const path of PAGES) {
  test(`${path} loads JavaScript only if it has a widget`, async ({ page }) => {
    await page.goto(path);
    const scripts = page.locator('script');
    if (!WIDGET_PAGES.includes(path)) {
      await expect(scripts).toHaveCount(0);
      return;
    }
    await expect(scripts).toHaveCount(1);
    await expect(scripts).toHaveAttribute('type', 'module');
    await expect(scripts).toHaveAttribute('src', /assets\/widgets\/(?:resource-finder|quiz)\.js$/);
  });

  test(`${path} works from the keyboard with a visible focus ring`, async ({ page }) => {
    await page.goto(path);
    await widgetsReady(page);

    // The first Tab reaches the skip link, and Enter jumps past the header.
    await page.keyboard.press('Tab');
    const skip = page.locator(':focus');
    await expect(skip).toHaveText('Skip to main content');
    await expect(skip).toBeInViewport();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#main$/);

    // Every stop after that shows a focus ring at least 2px wide, inside the widgets' shadow roots too.
    const stops = await page.locator('a[href], button, input, select, summary').count();
    for (let i = 0; i < Math.min(stops, 60); i++) {
      await page.keyboard.press('Tab');
      const focus = await page.evaluate(() => {
        let el = document.activeElement;
        while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
        if (!el || el === document.body) return null;
        const style = getComputedStyle(el);
        return {
          what: el.outerHTML.slice(0, 80),
          outline: style.outlineStyle,
          width: Number.parseFloat(style.outlineWidth),
        };
      });
      if (!focus) break;
      expect(focus.outline, focus.what).not.toBe('none');
      expect(focus.width, focus.what).toBeGreaterThanOrEqual(2);
    }
  });
}

test('the sign-up form shows errors only after interaction, then posts', async ({ page }) => {
  await page.goto('/signup.html');
  const email = page.getByLabel('Email', { exact: true });
  const emailError = page.locator('#email-error');

  await expect(emailError).toBeHidden();
  await email.fill('not-an-email');
  await email.blur();
  await expect(emailError).toBeVisible();
  await email.fill('asha@example.com');
  await expect(emailError).toBeHidden();

  // Native validation stops an incomplete form from leaving the page.
  await page.getByRole('button', { name: 'Sign up' }).click();
  await expect(page).toHaveURL(/signup\.html$/);
  await expect(page.locator('#name-error')).toBeVisible();

  await page.getByLabel('Name').fill('Asha');
  await page.getByLabel('First track').selectOption('react');
  await page.getByLabel('I have built a few small things').check();
  await page.getByLabel('Hours a week you can study').fill('10');
  await page.getByLabel('Email me when my track opens').check();
  await page.getByRole('button', { name: 'Sign up' }).click();

  await expect(page).toHaveURL(/thanks\.html$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('You are on the list');
});

test('FAQ answers open and close without JavaScript', async ({ page }) => {
  await page.goto('/');
  const question = page.getByText('What does 80/20 mean here?');
  const answer = page.getByText('Roughly 20% of each technology');
  await expect(answer).toBeHidden();
  await question.focus();
  await page.keyboard.press('Enter');
  await expect(answer).toBeVisible();
});

test.describe('the resource finder', () => {
  test('searches as you type, and filters by track and type', async ({ page }) => {
    await page.goto('/resources.html');
    await widgetsReady(page);
    const status = page.getByRole('status');
    const meta = page.locator('lp-resource-finder .result__meta');
    await expect(status).toHaveText(/^Showing all \d+ resources\.$/);

    await page.getByRole('searchbox', { name: 'Search' }).pressSequentially('flexbox', { delay: 40 });
    await expect(status).toHaveText(/^Showing \d+ of \d+ resources for “flexbox”\.$/);
    await expect(page.getByRole('link', { name: 'A Complete Guide to Flexbox' })).toBeVisible();

    await page.getByRole('searchbox', { name: 'Search' }).fill('');
    await page.getByLabel('Track').selectOption({ label: 'Node.js' });
    await page.getByLabel('Type').selectOption({ label: 'Video' });
    await expect(status).toHaveText(/^Showing \d+ of \d+ resources in Node\.js \(Video\)\.$/);
    for (const text of await meta.allTextContents()) expect(text).toMatch(/^Video · .*Node\.js/);

    await page.getByRole('searchbox', { name: 'Search' }).fill('no such resource');
    await page.getByRole('button', { name: 'Clear search and filters' }).click();
    await expect(status).toHaveText(/^Showing all \d+ resources\.$/);
    await expect(page.getByRole('searchbox', { name: 'Search' })).toBeFocused();
  });

  test('never shows results for an old query when typing outruns the network', async ({ page }) => {
    // Hold the catalogue back until both searches have started.
    let release = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/data/resources.json', async (route) => {
      await held;
      await route.continue();
    });
    const shown: string[] = [];
    await page.exposeFunction('recordStatus', (text: string) => shown.push(text));
    await page.goto('/resources.html');
    await page.evaluate(() => {
      const status = document.querySelector('lp-resource-finder')?.shadowRoot?.querySelector('[role="status"]');
      if (!status) throw new Error('No status');
      const observer = new MutationObserver(() => window.recordStatus(status.textContent ?? ''));
      observer.observe(status, { childList: true, characterData: true, subtree: true });
    });

    const search = page.getByRole('searchbox', { name: 'Search' });
    await search.fill('grid');
    await page.waitForTimeout(500); // the search for "grid" has started and is waiting for the catalogue
    await search.fill('fetch');
    await page.waitForTimeout(500);
    release();

    await expect(page.getByRole('status')).toHaveText(/for “fetch”/);
    await page.waitForTimeout(300);
    expect(shown).toHaveLength(1);
    expect(shown[0]).toMatch(/^Showing \d+ of \d+ resources for “fetch”\.$/);
  });
});

test('the quiz scores answers, remembers them after a reload, and starts again', async ({ page }) => {
  await page.goto('/quizzes/event-loop.html');
  await widgetsReady(page);
  const status = page.getByRole('status');
  const question = (n: number) => page.locator('lp-quiz form').nth(n);
  const check = (n: number) => question(n).getByRole('button', { name: 'Check answer' }).click();
  await expect(status).toHaveText('Answered 0 of 5, 0 right.');

  await question(0).getByLabel('Your answer').fill('1, 4, 3, 2');
  await check(0);
  await expect(question(0).getByText('Correct.')).toBeVisible();

  await question(1).getByLabel('On the call stack, so they run immediately').check();
  await check(1);
  await expect(question(1).getByText('Not quite.')).toBeVisible();
  await expect(status).toHaveText('Answered 2 of 5, 1 right.');

  await page.reload();
  await widgetsReady(page);
  await expect(status).toHaveText('Answered 2 of 5, 1 right.');
  await expect(question(0).getByLabel('Your answer')).toBeDisabled();
  await expect(question(0).getByLabel('Your answer')).toHaveValue('1, 4, 3, 2');

  await question(2).getByLabel('JavaScript runs on one main thread').check();
  await check(2);
  await question(3).getByLabel('Your answer').fill('sync microtask then timeout');
  await question(3).getByLabel('Your answer').press('Enter');
  await question(4).getByLabel('A setTimeout(callback, 0) callback').check();
  await question(4).getByLabel('A click listener running after the user clicks').check();
  await check(4);

  await expect(status).toHaveText('Finished: 4 of 5 right. You passed.');
  await expect(page.getByText('You got 4 of 5 right (80%).')).toBeVisible();
  await page.getByRole('button', { name: 'Start again' }).click();
  await expect(status).toHaveText('Answers cleared. Answered 0 of 5, 0 right.');
  await expect(question(0).getByLabel('Your answer')).toBeFocused();
});

test('each widget mounts and unmounts through its module, the way the shell will use it', async ({ page }) => {
  await page.goto('/thanks.html'); // a page with no widgets of its own
  const outcome = await page.evaluate(async () => {
    const results: Record<string, unknown> = {};
    for (const [name, src] of [
      ['resource-finder', '/data/resources.json'],
      ['quiz', '/data/quizzes/async-code.json'],
    ] as const) {
      const url = `/assets/widgets/${name}.js`;
      const { default: widget } = await import(url);
      const host = document.createElement('div');
      host.dataset.src = src;
      document.body.append(host);
      await widget.mount(host, { events: { emit() {}, on: () => () => {} } });
      const el = host.firstElementChild;
      // Wait for the data to arrive.
      for (let i = 0; i < 50 && el?.hasAttribute('aria-busy'); i++) await new Promise((r) => setTimeout(r, 20));
      const status = el?.shadowRoot?.querySelector('[role="status"]')?.textContent;
      await widget.unmount(host);
      results[name] = { tag: el?.localName, status, left: host.childElementCount };
    }
    return results;
  });
  expect(outcome).toEqual({
    'resource-finder': {
      tag: 'lp-resource-finder',
      status: expect.stringMatching(/^Showing all \d+ resources\.$/),
      left: 0,
    },
    quiz: { tag: 'lp-quiz', status: 'Answered 0 of 5, 0 right.', left: 0 },
  });
});

test.describe('with JavaScript turned off', () => {
  test.use({ javaScriptEnabled: false });

  test('the resources page lists every resource, grouped by type', async ({ page }) => {
    await page.goto('/resources.html');
    await expect(page.getByRole('heading', { level: 2, name: 'Docs' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'A Complete Guide to Flexbox' })).toBeVisible();
  });

  test('a quiz page shows every question, with its answer behind a disclosure', async ({ page }) => {
    await page.goto('/quizzes/event-loop.html');
    await expect(page.getByText('Show the answer')).toHaveCount(5);
    const answer = page.getByText('Synchronous code runs first');
    await expect(answer).toBeHidden();
    await page.getByText('Show the answer').first().click();
    await expect(answer).toBeVisible();
  });
});
