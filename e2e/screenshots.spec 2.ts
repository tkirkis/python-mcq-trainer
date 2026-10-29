// Captures the documentation screenshots: SHOTS=1 npx playwright test e2e/screenshots.spec.ts
import { expect, test, type Page } from '@playwright/test';

test.skip(!process.env.SHOTS, 'set SHOTS=1 to (re)generate docs/screenshots');

async function seed(page: Page) {
  await page.evaluate(async () => {
    const bank = await (await fetch('data/bank.json')).json();
    const acc: Record<string, number> = { S1: 0.82, S2: 0.7, S3: 0.55, S4: 0.42, S5: 0.66, S6: 0.5, S7: 0.6, S8: 0.72 };
    let seed = 7;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const now = Date.now();
    const evs: unknown[] = [];
    const qs = bank.questions as { id: string; chapter: string; correct: string[] }[];
    for (let i = 0; i < 260; i++) {
      const q = qs[Math.floor(r() * qs.length)];
      const ok = r() < acc[q.chapter];
      const ts = now - Math.floor(r() * 12) * 86_400_000 - Math.floor(r() * 3_600_000);
      evs.push({ id: `seed-${i}`, ts, dev: 'dseed', t: 'ans', q: q.id, ch: ok ? q.correct : ['a'], ok, ms: 20_000 + Math.floor(r() * 70_000), mode: 'practice', conf: 1 + Math.floor(r() * 3) });
    }
    [24, 27.5, 31].forEach((score, k) => {
      const items = qs.slice(k * 40, k * 40 + 40).map((q, j) => ({ q: q.id, ch: [], ok: j < score, pts: j < score ? 1 : 0 }));
      evs.push({ id: `seedm-${k}`, ts: now - (9 - 4 * k) * 86_400_000, dev: 'dseed', t: 'mock', mid: `seedm${k}`, variant: k === 2 ? 'full' : 'last_year', score, max: 40, ms: (50 - k * 4) * 60_000, limit: 3_600_000, started: 0, items, scoring: { correct: 1, wrong: 0, idk: 0, multi: 'all' } });
    });
    await (window as unknown as { __pyquiz: { store: { importEvents(e: unknown[]): Promise<number> } } }).__pyquiz.store.importEvents(evs);
  });
}

test('capture screenshots @phone', async ({ page }, info) => {
  const dir = `docs/screenshots/${info.project.name}`;
  const shot = async (name: string) => {
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${dir}/${name}.png`, fullPage: false });
  };
  await page.goto(`/?syncUser=shots${info.project.name}${Date.now()}#/`);
  await expect(page.getByTestId('continue')).toBeVisible();
  await seed(page);
  await page.reload();
  await expect(page.getByTestId('kpi-answers')).not.toHaveText('0');
  await shot('1-home');

  await page.goto(page.url().replace(/#.*/, '#/q/PE-21'));
  await page.locator('main [data-opt="c"]').click();
  await shot('2-question');
  await page.getByTestId('check').click();
  await page.getByTestId('feedback').scrollIntoViewIfNeeded();
  await shot('3-feedback');

  await page.goto(page.url().replace(/#.*/, '#/mock'));
  await page.getByTestId('start-mock-full').click();
  await page.locator('main [data-opt="b"]').first().click();
  await shot('4-mock-exam');
  page.on('dialog', (d) => d.accept());
  for (let i = 0; i < 6; i++) {
    await page.locator('main [data-opt="a"]').first().click();
    await page.getByTestId('mock-answer').click();
  }
  await page.getByTestId('end-exam').click();
  await expect(page.getByTestId('mock-results')).toBeVisible();
  await shot('5-mock-results');

  await page.goto(page.url().replace(/#.*/, '#/dashboard'));
  await expect(page.getByTestId('dashboard')).toBeVisible();
  await shot('6-dashboard');
  await page.getByTestId('estimate').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${dir}/7-dashboard-full.png`, fullPage: true });

  await page.goto(page.url().replace(/#.*/, '#/learn/S4/scopes'));
  await expect(page.getByTestId('lesson')).toBeVisible();
  await shot('8-lesson');
});
