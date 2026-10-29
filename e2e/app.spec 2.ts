import { expect, test, type Page } from '@playwright/test';

const uniq = () => `e2e${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

async function open(page: Page, path = '/', user = uniq()) {
  await page.goto(`/?syncUser=${user}#${path}`);
  await expect(page.locator('main')).not.toContainText('Loading…');
  return user;
}

async function answer(page: Page, ...opts: string[]) {
  for (const o of opts) await page.locator(`main [data-opt="${o}"]`).click();
  await page.getByTestId('check').click();
}

test('single-choice question gives instant feedback @phone', async ({ page }) => {
  await open(page, '/q/PE-07'); // 'python'[-3]
  await answer(page, 'd');
  const fb = page.getByTestId('feedback');
  await expect(fb).toContainText('Correct');
  await expect(fb).toContainText('verified by running the code');
  await page.getByTestId('next').click(); // "Try again"
  await answer(page, 'c');
  await expect(page.getByTestId('feedback')).toContainText('Wrong');
  await expect(page.getByTestId('feedback')).toContainText('review queue');
});

test('multi-select needs every correct option', async ({ page }) => {
  await open(page, '/q/PE-08'); // open('data.txt') and open('data.txt', 'r')
  await answer(page, 'b');
  await expect(page.getByTestId('feedback')).toContainText('Wrong');
  await page.getByTestId('next').click();
  await answer(page, 'b', 'c');
  await expect(page.getByTestId('feedback')).toContainText('Correct');
});

test('keyboard shortcuts: 1-4 select, Enter validates, N next', async ({ page }) => {
  await open(page, '/learn/S1/strings');
  await page.getByTestId('start-topic').click();
  await page.keyboard.press('1');
  await expect(page.locator('main .opt.selected')).toHaveCount(1);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('feedback')).toBeVisible();
  await page.keyboard.press('n');
  await expect(page.getByTestId('feedback')).toHaveCount(0);
});

test('practice session ends with a summary and retry button', async ({ page }) => {
  await open(page, '/practice');
  await page.getByRole('button', { name: '5 questions' }).click();
  await page.getByTestId('start-practice').click();
  for (let i = 0; i < 5; i++) {
    await page.locator('main [data-opt="a"]').click();
    await page.getByTestId('check').click();
    await page.getByTestId('next').click();
  }
  await expect(page.getByTestId('session-summary')).toContainText('/5 correct');
});

test('mock exam: answer, resume after reload, finish and review', async ({ page }) => {
  await open(page, '/mock');
  await page.getByTestId('start-mock-reference').click();
  await expect(page.getByTestId('mock-runner')).toBeVisible();
  await expect(page.getByTestId('timer')).toContainText(/59min|60min/);
  // Q1: tuple[2:] -> (c)
  await page.locator('main [data-opt="c"]').click();
  await page.getByTestId('mock-answer').click();
  // Q2: I don't know
  await page.getByTestId('mock-idk').click();
  await expect(page.getByTestId('open-sidebar')).toContainText('2/40');
  // no feedback during the exam
  await expect(page.getByTestId('feedback')).toHaveCount(0);
  await page.waitForTimeout(2500);
  await page.reload();
  await expect(page.getByTestId('open-sidebar')).toContainText('2/40');
  page.on('dialog', (d) => d.accept());
  await page.getByTestId('end-exam').click();
  await expect(page.getByTestId('mock-results')).toBeVisible();
  await expect(page.locator('h1')).toContainText('1 / 40');
  await expect(page.getByTestId('retry-mistakes')).toContainText('39');
});

test('mock exam auto-submits when the timer reaches zero', async ({ page }) => {
  await page.clock.install();
  await open(page, '/settings');
  const minutes = page.getByLabel('Mock duration (min)');
  await minutes.fill('1');
  await minutes.blur();
  await page.goto(page.url().replace(/#.*/, '#/mock'));
  await page.getByTestId('start-mock-last_year').click();
  await expect(page.getByTestId('timer')).toContainText('1min 00s');
  await page.clock.runFor(30_000);
  await expect(page.getByTestId('timer')).toContainText('0min 30s');
  await page.clock.runFor(32_000);
  await expect(page.getByTestId('mock-results')).toBeVisible();
  await expect(page.locator('h1')).toContainText('0 / 40');
});

test('works offline once installed (service worker)', async ({ page, context }) => {
  await open(page, '/');
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return !!reg.active;
  });
  // make sure the SW controls the page and has precached everything
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('continue')).toBeVisible();
  await expect(page.getByTestId('offline-banner')).toBeVisible();
  await expect(page.getByTestId('sync-status')).toHaveAttribute('data-status', 'offline');
  await page.goto(page.url().replace(/#.*/, '#/q/PE-14'));
  await answer(page, 'c');
  await expect(page.getByTestId('feedback')).toContainText('Correct');
  await expect(page.getByTestId('sync-status')).toContainText('1 pending');
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.getByTestId('sync-status')).toHaveAttribute('data-status', 'synced', { timeout: 15_000 });
});

test('two devices converge through sync', async ({ browser }) => {
  const user = uniq();
  const a = await browser.newContext();
  const b = await browser.newContext();
  const pa = await a.newPage();
  const pb = await b.newPage();
  await open(pa, '/q/PE-07', user);
  await answer(pa, 'd'); // correct
  await pa.goto(pa.url().replace(/#.*/, '#/q/PE-14'));
  await answer(pa, 'a'); // wrong -> review queue
  await expect(pa.getByTestId('sync-status')).toHaveAttribute('data-status', 'synced', { timeout: 15_000 });

  await open(pb, '/', user);
  await expect(pb.getByTestId('kpi-answers')).toHaveText('2', { timeout: 15_000 });
  await expect(pb.getByTestId('due')).toContainText('1 due today');
  // B answers offline, then comes back
  await b.setOffline(true);
  await pb.goto(pb.url().replace(/#.*/, '#/q/PE-24'));
  await answer(pb, 'a');
  await b.setOffline(false);
  await pb.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(pb.getByTestId('sync-status')).toHaveAttribute('data-status', 'synced', { timeout: 15_000 });

  await pa.goto(pa.url().replace(/#.*/, '#/settings'));
  await pa.getByTestId('sync-now').click();
  await pa.goto(pa.url().replace(/#.*/, '#/'));
  await expect(pa.getByTestId('kpi-answers')).toHaveText('3', { timeout: 15_000 });
  // identical event sets on both devices
  const ids = async (p: Page) =>
    p.evaluate(() => (window as unknown as { __pyquiz: { store: { all(): { id: string }[] } } }).__pyquiz.store.all().map((e) => e.id).sort().join(','));
  expect(await ids(pa)).toBe(await ids(pb));
  await a.close();
  await b.close();
});
