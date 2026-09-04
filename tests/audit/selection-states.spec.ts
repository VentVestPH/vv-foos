import { test, type Page } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from '../e2e/helpers';
import { VIEWPORTS } from './routes';
import {
  blockedWrites,
  flush,
  guardWrites,
  markExistingOverlays,
  newOverlaySelector,
  note,
  settle,
  shootElement,
  shootScreen,
  shots,
} from './capture';

const SCREEN = 'recruit-candidates-selection';

async function rowBoxes(page: Page) {
  return page.locator('tbody input[type="checkbox"]');
}

async function headerBox(page: Page) {
  return page.locator('thead input[type="checkbox"]').first();
}

async function describeHeader(page: Page): Promise<{ checked: boolean; indeterminate: boolean }> {
  const header = await headerBox(page);
  return header.evaluate((node) => ({
    checked: (node as HTMLInputElement).checked,
    indeterminate: (node as HTMLInputElement).indeterminate,
  }));
}

test('selection states: partial, full, and the bulk bar they reveal', async ({ page }) => {
  test.setTimeout(0);
  await signIn(page, PERSONA_EMAILS.admin);

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await guardWrites(page, SCREEN);
    await gotoAsSignedIn(page, '/recruit/candidates');
    await settle(page, 1200);

    const rows = await rowBoxes(page);
    const rowCount = await rows.count();
    if (rowCount < 3) {
      note(`${SCREEN} ${viewport.name}: only ${rowCount} selectable rows, so partial selection could not be shown`);
      continue;
    }

    await shootScreen(page, SCREEN, viewport.name, 'selection-none');
    const barBefore = page.locator('.fo-list-action-bar').first();
    if ((await barBefore.count()) > 0) {
      await shootElement(page, barBefore, SCREEN, viewport.name, 'bulk-bar', 'bulk-bar', 'selection-none', 'bulk actions');
      const states = await barBefore.evaluate((node) => {
        const bs = Array.from(node.querySelectorAll('button'));
        return {
          total: bs.length,
          nativelyDisabled: bs.filter((b) => (b as HTMLButtonElement).disabled).length,
          ariaDisabled: bs.filter((b) => b.getAttribute('aria-disabled') === 'true').length,
        };
      });
      note(
        `${SCREEN} ${viewport.name}: with nothing selected the action bar is already present with ${states.total} buttons, ${states.nativelyDisabled} natively disabled and ${states.ariaDisabled} aria-disabled`,
      );
    }
    const header = await headerBox(page);
    await shootElement(page, header, SCREEN, viewport.name, 'select-all', 'input-checkbox', 'selection-none', 'select all rows');

    let picked = 0;
    for (let i = 0; i < Math.min(rowCount, 8) && picked < 3; i += 1) {
      const box = rows.nth(i);
      try {
        await box.scrollIntoViewIfNeeded({ timeout: 2000 });
        await box.click({ timeout: 2500, force: true });
        await page.waitForTimeout(140);
        if (await box.isChecked()) picked += 1;
      } catch (e) {
        note(`${SCREEN} ${viewport.name}: row checkbox ${i} would not tick: ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`);
      }
    }
    await settle(page, 350);
    if (picked === 0) {
      note(`${SCREEN} ${viewport.name}: no row checkbox could be ticked, so the partial-selection captures were skipped`);
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      flush();
      continue;
    }
    if (picked !== 3) {
      note(`${SCREEN} ${viewport.name}: ticked ${picked} rows rather than 3; the captures below reflect ${picked}`);
    }

    const partial = await describeHeader(page);
    await shootScreen(
      page,
      SCREEN,
      viewport.name,
      'selection-partial',
      `${picked} of ${rowCount} rows selected; the header checkbox reports checked=${partial.checked} indeterminate=${partial.indeterminate}`,
    );
    await shootElement(
      page,
      header,
      SCREEN,
      viewport.name,
      'select-all',
      'input-checkbox',
      'selection-partial',
      'select all rows',
      `${picked} of ${rowCount} selected, checked=${partial.checked} indeterminate=${partial.indeterminate}`,
    );
    if (!partial.indeterminate) {
      note(
        `${SCREEN} ${viewport.name}: with ${picked} of ${rowCount} rows selected the header checkbox has indeterminate=false and checked=${partial.checked}, so a partial selection is drawn as ${partial.checked ? 'fully checked' : 'empty'}`,
      );
    }
    await page.keyboard.press('Escape');
    await settle(page, 400);
    try {
      await header.scrollIntoViewIfNeeded({ timeout: 2000 });
      await header.click({ timeout: 2500, force: true });
      await settle(page, 400);
    } catch (e) {
      note(`${SCREEN} ${viewport.name}: the header checkbox would not click after the bulk sweep: ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`);
    }
    const afterAll = await describeHeader(page);
    const selectedAfter = await page.locator('tbody input[type="checkbox"]:checked').count();
    await shootScreen(
      page,
      SCREEN,
      viewport.name,
      'selection-after-clicking-partial-header',
      `clicking the header while ${picked} of ${rowCount} were selected left ${selectedAfter} rows selected; header checked=${afterAll.checked}`,
    );
    if (selectedAfter > picked) {
      note(
        `${SCREEN} ${viewport.name}: clicking the header checkbox while ${picked} rows were selected widened the selection to ${selectedAfter} rows rather than clearing it`,
      );
    }


    for (let i = 0; i < Math.min(rowCount, 8) && (await page.locator('tbody input[type="checkbox"]:checked').count()) < picked; i += 1) {
      await rows.nth(i).click({ timeout: 2500, force: true }).catch(() => undefined);
      await page.waitForTimeout(120);
    }
    await settle(page, 300);

    const bulkBar = page.locator('.fo-list-action-bar').first();
    if ((await bulkBar.count()) > 0) {
      await shootElement(page, bulkBar, SCREEN, viewport.name, 'bulk-bar', 'bulk-bar', 'selection-partial', 'bulk actions');
    }

    const bulkButtons = page.locator('.fo-list-action-bar button');
    const bulkCount = await bulkButtons.count();
    for (let i = 0; i < bulkCount; i += 1) {
      const button = bulkButtons.nth(i);
      const label = ((await button.innerText()).trim().split('\n')[0] || `bulk-${i}`).slice(0, 40);
      await shootElement(page, button, SCREEN, viewport.name, 'bulk-action', 'button', 'default', label);
      await button.hover({ timeout: 1500, force: true }).catch(() => undefined);
      await page.waitForTimeout(110);
      await shootElement(page, button, SCREEN, viewport.name, 'bulk-action', 'button', 'hover', label);
      await page.mouse.move(0, 0);

      await markExistingOverlays(page);
      await button.click({ timeout: 2500, force: true }).catch(() => undefined);
      await settle(page, 500);
      const fresh = page.locator(newOverlaySelector());
      const freshCount = await fresh.count();
      if (freshCount === 0) {
        note(`${SCREEN} ${viewport.name}: bulk action "${label}" opened no overlay`);
        continue;
      }
      await shootScreen(page, SCREEN, viewport.name, `bulk-opened-${label}`);
      await shootElement(page, fresh.first(), SCREEN, viewport.name, 'overlay', 'overlay', 'open', label);

      const inner = fresh.first().locator('input, select, textarea, button');
      const innerCount = await inner.count();
      for (let k = 0; k < innerCount; k += 1) {
        const control = inner.nth(k);
        const meta = await control.evaluate((node) => {
          const e = node as HTMLInputElement;
          const tag = e.tagName.toLowerCase();
          return {
            kind: tag === 'input' ? `input-${e.type || 'text'}` : tag,
            name: (
              e.getAttribute('aria-label') ??
              (e.labels && e.labels.length > 0 ? (e.labels[0].innerText || '').trim() : '') ??
              ''
            ).slice(0, 40),
          };
        });
        const name = meta.name || `${meta.kind}-${k}`;
        await shootElement(page, control, SCREEN, viewport.name, 'inside-bulk-overlay', meta.kind, 'inner-default', name);
        if (meta.kind === 'input-radio') {
          await control.click({ timeout: 1500, force: true }).catch(() => undefined);
          await page.waitForTimeout(130);
          await shootElement(page, control, SCREEN, viewport.name, 'inside-bulk-overlay', meta.kind, 'inner-checked', name);
        }
      }
      await page.keyboard.press('Escape');
      await settle(page, 300);
    }

    await page.unrouteAll({ behavior: 'ignoreErrors' });
    flush();
  }

  flush();
  console.log(`SELECTION shots=${shots.length} blockedWrites=${new Set(blockedWrites).size}`);
});
