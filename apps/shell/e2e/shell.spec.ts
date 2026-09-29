// The learning app in a real browser: accessibility in both themes, 320px layouts, the keyboard, deep links, the
// Phase 2 widgets mounted through ModuleOutlet, and a passed quiz showing up as progress.
import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

const PAGES = [
  '/',
  '/tracks/javascript',
  '/tracks/react',
  '/tracks/javascript/async-code',
  '/tracks/javascript/event-loop',
  '/resources',
  '/no-such-page',
];

/** Waits until the page's data has loaded and every widget on it has mounted and loaded its own. */
async function ready(page: Page) {
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('.loading')).toHaveCount(0);
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
        await ready(page);
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
      await ready(page);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});

for (const path of PAGES) {
  test(`${path} works from the keyboard with a visible focus ring`, async ({ page }) => {
    await page.goto(path);
    await ready(page);

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

test('every page loads straight from its URL, with its own title and no console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  for (const [path, title] of [
    ['/', 'Your learning path — Learning Platform'],
    ['/tracks/javascript', 'JavaScript — Learning Platform'],
    ['/tracks/javascript/async-code', 'JavaScript: Async code — Learning Platform'],
    ['/resources', 'Resources — Learning Platform'],
  ] as const) {
    await page.goto(path);
    await ready(page);
    await expect(page).toHaveTitle(title);
  }
  expect(errors).toEqual([]);
});

test('client-side navigation moves focus to the main content and swaps the mounted quiz', async ({ page }) => {
  await page.goto('/tracks/javascript/async-code');
  await ready(page);
  await expect(page.locator('lp-quiz')).toHaveAttribute('src', '/api/quizzes/async-code');

  await page.getByRole('navigation', { name: 'Lessons' }).getByRole('link', { name: 'The event loop' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('The event loop');
  await ready(page);
  await expect(page.locator('lp-quiz')).toHaveCount(1);
  await expect(page.locator('lp-quiz')).toHaveAttribute('src', '/api/quizzes/event-loop');
  await expect(page.locator('#main')).toBeFocused();

  // Back goes back, without a page load.
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Async code');
});

test('passing a quiz marks the lesson done on the lesson and the learning path', async ({ page }) => {
  await page.goto('/tracks/javascript/event-loop');
  await ready(page);
  const quiz = page.locator('lp-quiz');
  const question = (n: number) => quiz.locator('form').nth(n);
  const check = (n: number) => question(n).getByRole('button', { name: 'Check answer' }).click();

  await question(0).getByLabel('Your answer').fill('1, 4, 3, 2');
  await check(0);
  await question(1).getByLabel('In the microtask queue').check();
  await check(1);
  await question(2).getByLabel('JavaScript runs on one main thread').check();
  await check(2);
  await question(3).getByLabel('Your answer').fill('sync microtask then timeout');
  await check(3);
  await question(4).getByLabel('A setTimeout(callback, 0) callback').check();
  await question(4).getByLabel('A click listener running after the user clicks').check();
  await check(4);

  await expect(quiz.getByRole('status')).toHaveText('Finished: 5 of 5 right. You passed.');
  await expect(page.getByText('Done: you passed the quiz with 100%.')).toBeVisible();

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Learning path' }).click();
  const javascript = page.getByRole('listitem').filter({ has: page.getByRole('link', { name: 'JavaScript' }) });
  await expect(javascript.getByText(/^[1-5] of 5 lessons done$/)).toBeVisible();
});
