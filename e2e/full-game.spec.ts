import { expect, test } from '@playwright/test';
import { AI_MODELS } from '@/lib/game/types';

const LOBBY_PATH = '/play';

test('plays a 5-player mock game to game over', async ({ page }) => {
  await page.goto(LOBBY_PATH);
  await page.getByTestId('lobby-player-count-5').click();
  await page.getByTestId('lobby-start').click();
  await expect(page).toHaveURL(/\/game$/);

  await page.getByTestId('role-reveal-continue').click();

  let reachedGameOver = false;
  let capturedVoteReveal = false;

  for (let iteration = 0; iteration < 200; iteration += 1) {
    await page.waitForTimeout(250);

    const gameOver = page.getByTestId('game-over');
    if (await gameOver.isVisible()) {
      reachedGameOver = true;
      break;
    }

    const seatError = page.getByTestId('seat-error');
    if (await seatError.first().isVisible()) {
      throw new Error(`Mock AI seat error: ${await seatError.allInnerTexts()}`);
    }

    if (!capturedVoteReveal) {
      const phaseText = await page.getByTestId('phase-panel').innerText();
      if (/投票(?:结果[^\n]*)?(?:通过|否决)/.test(phaseText)) {
        await page.screenshot({ path: 'docs/screenshot.png', fullPage: true });
        capturedVoteReveal = true;
      }
    }

    const discussionSkip = page.getByTestId('discussion-skip');
    if (await discussionSkip.isVisible()) {
      await discussionSkip.click();
      continue;
    }

    const discussionEnd = page.getByTestId('discussion-end');
    if (await discussionEnd.isVisible()) {
      await discussionEnd.click();
      continue;
    }

    const teamConfirm = page.getByTestId('team-confirm');
    if (await teamConfirm.isVisible()) {
      const playerChoices = page.getByTestId(/^team-pick-\d+$/);
      for (let index = 0; index < await playerChoices.count(); index += 1) {
        if (await teamConfirm.isEnabled()) break;
        await playerChoices.nth(index).click();
      }
      await expect(teamConfirm).toBeEnabled();
      await teamConfirm.click();
      continue;
    }

    const voteApprove = page.getByTestId('vote-approve');
    if (await voteApprove.isVisible()) {
      await voteApprove.click();
      continue;
    }

    const questSuccess = page.getByTestId('quest-success');
    if (await questSuccess.isVisible()) {
      await questSuccess.click();
      continue;
    }

    const assassinationTargets = page.getByTestId(/^assassinate-\d+$/);
    if (await assassinationTargets.first().isVisible()) {
      await assassinationTargets.first().click();
      await page.getByTestId('assassinate-confirm').click();
    }
  }

  expect(reachedGameOver, 'game should finish within 200 loop iterations').toBe(true);
  expect(capturedVoteReveal, 'the first vote reveal screenshot should be captured').toBe(true);

  const gameOver = page.getByTestId('game-over');
  await expect(gameOver).toBeVisible();
  await expect(gameOver).toContainText(/你赢了|你输了/);

  const finishedQuests = await page
    .getByTestId('quest-tracker')
    .locator('[data-quest-result]:not([data-quest-result="pending"])')
    .count();
  expect(finishedQuests).toBeGreaterThanOrEqual(3);

  const voteMatrix = page.getByTestId('vote-matrix');
  await expect(voteMatrix).toBeVisible();
  expect(
    await voteMatrix.locator('[data-testid="vote-cell"] svg').count(),
    'vote matrix should show at least one approval or rejection icon',
  ).toBeGreaterThan(0);

  const transcript = page.getByTestId('transcript');
  await expect(transcript).toBeVisible();
  expect(await transcript.locator('details').count()).toBeGreaterThanOrEqual(3);
});

test('lobby renders', async ({ page }) => {
  await page.goto(LOBBY_PATH);

  await expect(page.getByTestId('lobby-start')).toBeVisible();
  const advancedSettings = page.getByTestId('advanced-settings');
  await advancedSettings.locator('summary').click();
  await page.getByTestId('quick-mode').check();
  await page.getByTestId('seat-select-0').selectOption(AI_MODELS[1].id);
  await page.getByTestId('seats-same').click();

  const seatSelects = page.getByTestId(/^seat-select-\d+$/);
  await expect(seatSelects).toHaveCount(4);
  for (let index = 0; index < await seatSelects.count(); index += 1) {
    await expect(seatSelects.nth(index)).toHaveValue(AI_MODELS[1].id);
  }

  await page.getByTestId('lobby-start').click();
  await expect(page).toHaveURL(/\/game$/);
  await page.getByTestId('settings-open').click();
  await expect(page.getByRole('dialog')).toContainText('讨论轮数：1');
});

test('landing page links to the lobby', async ({ page }) => {
  await page.goto('/');

  const playLink = page.getByTestId('landing-play');
  await expect(playLink).toBeVisible();
  await playLink.click();

  await expect(page).toHaveURL(/\/play$/);
  await expect(page.getByTestId('lobby-start')).toBeVisible();
});

test('game screen has no horizontal overflow at 360px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto(LOBBY_PATH);
  await page.getByTestId('lobby-player-count-5').click();
  await page.getByTestId('lobby-start').click();
  await expect(page).toHaveURL(/\/game$/);

  const dimensions = await page.evaluate(() => ({
    contentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));

  expect(dimensions.contentWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
});
