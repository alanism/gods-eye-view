#!/usr/bin/env node
/**
 * Regression for Authoring/Display rail feedback in narrow desktop windows.
 * Requires a dev server: node scripts/qa-panel-layout-stability.mjs
 * Optional QA_BASE_URL and QA_SCREENSHOT_DIR (evidence stays outside the repo).
 * Tests CSS viewport widths, including the effective width of a zoomed window.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    ...(process.platform === 'darwin'
      ? ['--use-angle=metal', '--enable-gpu']
      : ['--use-gl=angle', '--use-angle=swiftshader']),
  ],
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const baseUrl = process.env.QA_BASE_URL || 'http://localhost:4173';
const output = process.env.QA_SCREENSHOT_DIR;
const cases = [
  { width: 786, height: 856, layout: 'aperture' },
  { width: 786, height: 856, layout: 'survey' },
  { width: 786, height: 856, layout: 'signal' },
  { width: 721, height: 856, layout: 'aperture' },
  { width: 944, height: 1028, layout: 'aperture' },
  { width: 960, height: 856, layout: 'tactical' },
  { width: 1280, height: 900, layout: 'minimal' },
];

try {
  await page.setViewport({ width: cases[0].width, height: cases[0].height });
  await page.goto(`${baseUrl}/?welcome=0`, { waitUntil: 'domcontentloaded' });
  assert.equal(await page.title(), "God's Eye View");
  await page.waitForFunction(
    () =>
      window.__godsEyeView?.sceneDirector &&
      document.querySelector('#loading-screen.hidden'),
    { timeout: 60000 },
  );
  // This gate measures DOM layout, not map performance. Pausing the 3D render
  // loop avoids GPU/software-renderer load changing the sampling cadence.
  await page.evaluate(() => {
    window.__godsEyeView.viewer.useDefaultRenderLoop = false;
  });
  await page.click('[data-rail-item="pp-toggles"]');
  await page.select('#hud-layout-select', 'aperture');
  await page.click('[data-rail-item="scene-panel"]');

  for (const { width, height, layout } of cases) {
    await page.setViewport({ width, height });
    await page.select('#hud-layout-select', layout);
    // Let one-off disclosure/resize transitions finish before testing idle.
    await delay(1800);
    // A busy software renderer may defer a one-off CSS transition beyond a
    // wall-clock delay. Wait for committed targets before observing idle; a
    // feedback loop either cannot settle here or fails the samples below.
    await page.waitForFunction(
      (expectedLayout) => {
        const left = document.getElementById('left-panel-stack');
        const right = document.getElementById('right-context-rail');
        const authoring = document.getElementById('scene-panel');
        const display = document.getElementById('pp-toggles');
        const close = (actual, expected) =>
          Number.isFinite(expected) && Math.abs(actual - expected) <= 1;
        return (
          document.getElementById('intel-hud').dataset.variant ===
            expectedLayout &&
          left.dataset.expandedCount === '1' &&
          close(
            left.getBoundingClientRect().top,
            (Number(left.dataset.safeTopPct) * innerHeight) / 100,
          ) &&
          close(
            right.getBoundingClientRect().top,
            Number(right.dataset.safeTop),
          ) &&
          close(
            authoring.getBoundingClientRect().height,
            parseFloat(
              authoring.style.getPropertyValue('--left-panel-allocated-height'),
            ),
          ) &&
          close(
            display.getBoundingClientRect().height,
            parseFloat(
              display.style.getPropertyValue('--right-panel-allocated-height'),
            ),
          )
        );
      },
      { timeout: 15000 },
      layout,
    );
    const samples = (
      await page.evaluate(async () => {
        const rows = [];
        for (let i = 0; i < 40; i++) {
          await new Promise((resolve) => setTimeout(resolve, 80));
          const rect = (id) => {
            const element = document.getElementById(id);
            const r = element.getBoundingClientRect();
            return {
              top: r.top,
              left: r.left,
              right: r.right,
              height: r.height,
              width: r.width,
              collapsed: element.classList.contains('collapsed'),
            };
          };
          rows.push({
            authoring: rect('scene-panel'),
            display: rect('pp-toggles'),
          });
        }
        return rows;
      })
    ).slice(-25); // Ignore initial resize frames; sustained feedback still fails.
    for (const panel of ['authoring', 'display']) {
      assert.ok(
        samples.every((s) => !s[panel].collapsed && s[panel].height >= 96),
        `${layout} ${width}: ${panel} stays usable and open`,
      );
      for (const metric of ['top', 'height']) {
        const values = samples.map((s) => s[panel][metric]);
        assert.ok(
          Math.max(...values) - Math.min(...values) <= 1,
          `${layout} ${width}: ${panel} ${metric} must settle; got ${values.join(', ')}`,
        );
      }
    }
    assert.ok(
      samples.every((s) => s.display.left - s.authoring.right >= 15),
      `${layout} ${width}: panels must not overlap`,
    );
    assert.ok(
      samples.every(
        (s) => s.authoring.left >= 0 && s.display.right <= width + 1,
      ),
      `${layout} ${width}: panels stay inside the viewport`,
    );
    const clippedButtons = await page.$$eval(
      '#scene-panel .scene-controls button',
      (buttons) =>
        buttons
          .filter(
            (button) =>
              button.getBoundingClientRect().width > 0 &&
              button.scrollWidth > button.clientWidth + 1,
          )
          .map((button) => button.textContent.trim()),
    );
    assert.deepEqual(
      clippedButtons,
      [],
      `${layout} ${width}: action labels fit their buttons`,
    );
    console.log(
      `[PASS] ${layout} ${width}x${height}: both panels remain separated and stable across 25 samples`,
    );
    if (output) {
      await fs.mkdir(output, { recursive: true });
      await page.screenshot({
        path: path.join(output, `panels-${layout}-${width}.png`),
      });
    }
  }
  // The desktop sizing rule must leave phone sheets to their existing owner.
  await page.setViewport({ width: 390, height: 844 });
  await page.waitForSelector('body.mobile-shell');
  await page.click('#mobile-tab-bar [data-mobile-sheet="more"]');
  await page.waitForSelector('#hud-layout-select', { visible: true });
  await page.select('#hud-layout-select', 'signal');
  assert.equal(
    await page.$eval('#intel-hud', (el) => el.dataset.variant),
    'signal',
  );
  console.log('[PASS] phone More sheet still exposes the HUD layout control');
  if (output)
    await page.screenshot({ path: path.join(output, 'panels-phone.png') });
  assert.deepEqual(errors, [], 'no uncaught browser errors');
  console.log('[PASS] page identity, rendered controls and console health');
} finally {
  await browser.close();
}
