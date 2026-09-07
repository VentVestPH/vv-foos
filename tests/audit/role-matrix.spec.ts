import { test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from '../e2e/helpers';
import { ROUTES, VIEWPORTS, resolveIds, resolvePath } from './routes';
import { CORPUS, settle } from './capture';

type Role = keyof typeof PERSONA_EMAILS;

const ROLE = (process.env.FOOS_AUDIT_ROLE ?? 'admin') as Role;

interface ControlRow {
  kind: string;
  name: string;
  nativelyDisabled: boolean;
  ariaDisabled: boolean;
  variant: string;
}

interface MatrixRow {
  route: string;
  path: string;
  role: Role;
  viewport: string;
  requestedUrl: string;
  finalPath: string;
  redirected: boolean;
  notFound: boolean;
  heading: string;
  navTabs: string[];
  controlCount: number;
  respondingCount: number;
  ariaDisabledCount: number;
  nativelyDisabledCount: number;
  tableRows: number;
  emptyStateText: string;
  errorText: string[];
  consoleErrors: string[];
  pageErrors: string[];
  shot: string;
  controls: ControlRow[];
}

async function describeScreen(page: Page) {
  return page.evaluate(() => {
    const vis = (el: Element) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && cs.display !== 'none';
    };
    const accName = (e: HTMLElement): string => {
      const byIds = e.getAttribute('aria-labelledby');
      if (byIds !== null) {
        const t = byIds
          .split(/\s+/)
          .map((id) => document.getElementById(id))
          .filter((n): n is HTMLElement => n !== null)
          .map((n) => (n.innerText || '').trim())
          .join(' ')
          .trim();
        if (t !== '') return t;
      }
      const label = e.getAttribute('aria-label');
      if (label !== null && label.trim() !== '') return label.trim();
      const input = e as HTMLInputElement;
      if (input.labels !== undefined && input.labels !== null && input.labels.length > 0) {
        const t = (input.labels[0].innerText || '').trim();
        if (t !== '') return t;
      }
      const own = (e.innerText || '').trim().split('\n')[0];
      if (own !== undefined && own !== '') return own;
      const title = e.getAttribute('title');
      if (title !== null && title.trim() !== '') return title.trim();
      return '';
    };

    const controls = Array.from(
      document.querySelectorAll(
        'button, a[href], select, textarea, input, summary, [role="tab"], [role="checkbox"], .record-section-header',
      ),
    )
      .filter(vis)
      .map((el) => {
        const e = el as HTMLElement;
        const tag = e.tagName.toLowerCase();
        const type = tag === 'input' ? (e as HTMLInputElement).type || 'text' : '';
        const cls = e.className?.toString() ?? '';
        return {
          kind:
            tag === 'input'
              ? `input-${type}`
              : tag === 'a'
                ? 'link'
                : e.getAttribute('role') === 'tab'
                  ? 'tab'
                  : cls.includes('record-section-header')
                    ? 'section-header'
                    : tag,
          name: accName(e).slice(0, 60),
          nativelyDisabled: e.hasAttribute('disabled'),
          ariaDisabled: e.getAttribute('aria-disabled') === 'true',
          variant:
            cls
              .split(/\s+/)
              .filter((c) => /^(btn|fo|link|record|input|field)/.test(c))
              .slice(0, 3)
              .join(' ') || '',
        };
      });

    const navTabs = Array.from(document.querySelectorAll('nav[aria-label="Primary"] button'))
      .filter(vis)
      .map((n) => ((n as HTMLElement).innerText || (n.getAttribute('title') ?? '')).trim())
      .filter((t) => t !== '');

    const emptyCell = document.querySelector('td.table-empty');
    const heads = Array.from(document.querySelectorAll('h1'));

    return {
      heading: heads.length > 0 ? (heads[0] as HTMLElement).innerText.trim().slice(0, 80) : '',
      navTabs,
      controls,
      tableRows: document.querySelectorAll('tbody tr:not(:has(td[colspan]))').length,
      emptyStateText: emptyCell !== null ? (emptyCell as HTMLElement).innerText.trim().slice(0, 80) : '',
      errorText: Array.from(
        document.querySelectorAll('.rq-error, .form-error, .settings-error, .field-error-text, [role="alert"]'),
      )
        .map((n) => (n as HTMLElement).innerText.trim().slice(0, 120))
        .filter((t) => t !== ''),
      notFound: /page not found/i.test(document.body.innerText),
    };
  });
}

test(`role matrix: what ${ROLE} sees on every route`, async ({ page }) => {
  test.setTimeout(0);

  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200));
  });
  page.on('pageerror', (e) => pageErrors.push(e.message.slice(0, 200)));

  const ids = await resolveIds();
  await signIn(page, PERSONA_EMAILS[ROLE]);

  const rows: MatrixRow[] = [];
  const dir = join(CORPUS, 'role-matrix', ROLE);
  mkdirSync(dir, { recursive: true });

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    for (const route of ROUTES) {
      const path = resolvePath(route, ids);
      if (path === null) continue;

      consoleErrors.length = 0;
      pageErrors.length = 0;

      await gotoAsSignedIn(page, path);
      await settle(page, 900);
      try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
      } catch {
        void 0;
      }
      await settle(page, 500);

      const seen = await describeScreen(page);
      const finalPath = new URL(page.url()).pathname + new URL(page.url()).search;
      const shot = `role-matrix/${ROLE}/${route.id}.${viewport.name}.png`;
      await page.screenshot({ path: join(CORPUS, shot), fullPage: false });

      rows.push({
        route: route.id,
        path,
        role: ROLE,
        viewport: viewport.name,
        requestedUrl: path,
        finalPath,
        redirected: finalPath.split('?')[0] !== path.split('?')[0],
        notFound: seen.notFound,
        heading: seen.heading,
        navTabs: seen.navTabs,
        controlCount: seen.controls.length,
        respondingCount: seen.controls.filter((c) => !c.nativelyDisabled).length,
        ariaDisabledCount: seen.controls.filter((c) => c.ariaDisabled).length,
        nativelyDisabledCount: seen.controls.filter((c) => c.nativelyDisabled).length,
        tableRows: seen.tableRows,
        emptyStateText: seen.emptyStateText,
        errorText: seen.errorText,
        consoleErrors: [...consoleErrors],
        pageErrors: [...pageErrors],
        shot,
        controls: seen.controls,
      });

      writeFileSync(join(CORPUS, `role-matrix.${ROLE}.json`), JSON.stringify(rows, null, 2));
    }
  }

  console.log(`MATRIX role=${ROLE} rows=${rows.length}`);
  for (const r of rows.filter((x) => x.viewport === 'desktop')) {
    console.log(
      `MATRIX ${r.role} ${r.route}: controls=${r.controlCount} responding=${r.respondingCount} ariaDisabled=${r.ariaDisabledCount} rows=${r.tableRows} navTabs=${r.navTabs.length}${r.redirected ? ` REDIRECTED->${r.finalPath}` : ''}${r.notFound ? ' NOT-FOUND' : ''}${r.errorText.length > 0 ? ` ERR:${r.errorText[0].slice(0, 40)}` : ''}${r.pageErrors.length > 0 ? ` PAGEERR:${r.pageErrors[0].slice(0, 40)}` : ''}`,
    );
  }
});
