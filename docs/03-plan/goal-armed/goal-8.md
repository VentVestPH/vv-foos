# ACTIVE GOAL: Goal 8 — Photograph the product the way a person uses it

The previous audit clipped components and never photographed a page. This one photographs pages, scrolled, with every overlay open, and it is the input Goal 9 reads. **No file under `app/src` changes in this goal**, with two recorded exceptions below.

## The two `app/src` exceptions, 2026-09-08

The freeze was broken twice, deliberately, because the harness could not complete a correct capture with these defects present and Klent's standing instruction is *"do not skip if you encounter errors. fix them if they are simple, think about it, search the web. no skipping if it can actually be fixed."*

1. **QA-023, Critical.** `app/src/hooks/useOverlayDismiss.ts` never reset its `closing` flag after the exit timer fired, so the **second** placeholder overlay of a session opened already marked `data-closing="true"`, could not be dismissed by Escape, the backdrop or the Close button, and left an `opacity: 0` full-screen backdrop that swallowed every click until reload. Four clicks from a fresh sign-in reach it. Without this fix every modal capture after the first would have photographed a stuck, fading overlay rather than the modal.
2. **QA-024, Medium.** `app/src/hooks/useDismissable.ts` registered no `keydown` listener, so the Administration and Help menus ignored Escape, against the W3C ARIA APG Menu and Menubar pattern. The first fix used a `window` listener and was a regression: it dismissed every open overlay at once and broke `date-field.spec.ts` and `select-combobox.spec.ts`. The shipped fix scopes the listener to the menu's own wrapper ref.

Both are logged in `tests/DEFECT_LOG.md` and guarded by `tests/e2e/overlay-dismissal.spec.ts` in the gated suite. **Nothing else under `app/src` changes in this goal**, and the captures in `audit/2026-09-08/` therefore show the fixed behaviour.

**Klent, 2026-09-08, verbatim:** "what kind of discovery even is this? you should've screenshotted each page, scroll down, screenshot again, open modals, per page, per role. not screenshot fucking buttons." And: "do all 4 roles, only in desktop view. don't give me excuses. try all buttons, functions, screenshot modals, open accordions, dropdowns. search the web on how it is properly done. i don't trust your knowledge."

## What was wrong with the last one, stated so it cannot be repeated

`tests/audit/capture.ts` has exactly two paths. `shootElement` calls `page.screenshot({ clip: boundingBox })`, which crops to one element. `shootScreen` calls `page.screenshot({ path })` with **no `fullPage`**, which stops at the fold. The only two specs that name the option say `fullPage: false`. So **none of the 25,231 images was a whole page**, and vertical rhythm, wasted space and misalignment were invisible to the instrument by construction.

## Method, from published sources rather than recall

- **`fullPage: true` is the whole point.** Playwright captures the entire scrollable page and overrides the viewport height ([Checkly](https://www.checklyhq.com/docs/learn/playwright/taking-screenshots/), [BrowserStack](https://www.browserstack.com/guide/playwright-screenshot)).
- **Also capture per fold**, because a 6,000px full-page PNG hides what a user actually sees at once. Scroll by one viewport height and shoot each fold.
- **Overlay states need their own shots**, and shooting the overlay's own element is more stable than the page for a floating layer ([Checkly](https://www.checklyhq.com/docs/learn/playwright/taking-screenshots/)). Capture both: the full page with the overlay open, and the overlay clipped.
- **Custom dropdowns need a real click**, not `selectOption`, which only works on a native `<select>` ([TestMu](https://www.testmuai.com/learning-hub/handling-alerts-and-dropdowns-in-playwright/)). This codebase has **zero** native selects left, so every one is the custom combobox.
- **Wait for a settled condition before shooting**, never a flat timeout: spinners hidden, images loaded, layout stable ([houseful](https://www.houseful.blog/posts/2023/fix-flaky-playwright-visual-regression-tests/)). Reuse `settleLayout()` from `tests/e2e/phone.spec.ts`; a flat wait is what caused four false failures on 2026-09-07.
- **Enumerate states, do not guess them** ([testRigor](https://testrigor.com/blog/what-is-screenshot-testing/), [Percy](https://percio.io/blog/visual-screenshot-testing), [Chromatic](https://www.chromatic.com/blog/how-to-automate-ui-testing-from-scratch/)). Query the DOM for every interactive element, act on each, and record what was found so coverage is a number rather than a claim.

## Scope, fixed and not negotiable

- **All four roles**: admin, recruiter, sourcer, bd. Every route, every role, even where the view is identical, because "identical" is a finding that has to be proven.
- **Desktop only.** 1440 x 900. No phone captures in this goal.
- **31 routes** from `tests/audit/routes.ts`, with record ids resolved from real rows. **Corrected 2026-09-08:** this read 32; `grep -c '{ id:' tests/audit/routes.ts` returns **31**, which is also the figure every workstream V and W document uses. Six of the 31 resolve a record id through `needs:`, and those ids are now chosen with an explicit `.order(...)` so the same record is photographed on every run, which Goal 11's diff against `audit/2026-09-09/` depends on.

### Plus everything the 31 routes never covered

**Klent, 2026-09-08:** "add everytything that is an issue for the website. this is the time for you to dig deep. include the login page, the transition when the website is loading, etc."

`grep -c login tests/audit/routes.ts` returns **0**. The login page has never been in audit scope, which is why nobody has looked at the first screen anyone sees. These are in scope now and each needs its own captures:

1. **`/login`, signed out.** Resting state, the email field focused, a bad password submitted, the error shown, the Google button hovered and focused, and the form mid-submit with the button in its loading state.
2. **The unauthenticated redirect.** Hit a deep link such as `/recruit/candidates/<id>` while signed out and photograph what the user actually sees on the way to `/login`.
3. **The app-loading transition.** `App.tsx:35` renders `<Suspense fallback={<div className="full-center text-secondary">Loading...</div>}>` — **an unstyled string with three dots and no layout**. Capture it by throttling the network so the lazy chunk is slow, and capture it for **each** lazily-loaded module, since every one of the five gets that same bare fallback.
4. **The route-to-route transition.** Navigate between modules and capture the intermediate frames: does the shell persist, does the page flash, is there a skeleton or nothing at all.
5. **The `RequireAuth` loading gate.** `Loading…` while the staff row resolves, which W24 made more visible by design. Photograph it.
6. **First paint on a cold load.** Reload with a cold cache and capture the first frames, so unstyled-flash and layout-shift are visible rather than inferred.
7. **The 404 and the not-provisioned card.** Both are real screens a user can reach and neither has ever been photographed at full page.
8. **The `TaleoPlaceholder` overlay**, which 18 files route through, in its rendered state.

Throttle with Playwright's CDP session or a `page.route` delay to hold a transient state long enough to shoot it. **A transient state that is hard to capture is not an excuse to skip it**: hold it open, photograph it, and say how it was held.

## What to capture per route, per role

### The scroll cadence, which is the point of this goal

**Klent, 2026-09-08, verbatim:** "remember, screenshot, scrolldown, screenshot, scrolldown, screenshot... i want to see all pages in all of their heights. no exceptions."

**This is the primary method, not a supplement.** For every page, in every state, at every role:

```
shoot  ->  scroll one viewport height  ->  shoot  ->  scroll  ->  shoot  ->  ...
until the bottom is reached and the scroll position stops changing
```

- **Every fold gets its own image**, named `02-fold-1.png`, `03-fold-2.png`, and so on in order, so paging through the folder is paging down the page.
- **The sequence runs to the actual bottom**, detected by the scroll position ceasing to change, never by a guessed page count. A page 9 folds tall gets 9 images.
- **No exceptions, and that is literal.** Not "the long ones", not "the interesting ones". Every route, every role, every overlay state that scrolls. If a page is exactly one viewport tall, that is one fold image plus the full-page shot, and the JSON records that the page was one viewport tall so the absence of `fold-2` is provably a short page rather than a skipped capture.
- **A scrolled overlay scrolls too.** If a modal, drawer or listbox has its own scroll container, the cadence runs inside it as well and the images say so: `modal-add-candidate-fold-2.png`.
- `fullPage: true` is captured **in addition**, as `01-full.png`, because the single tall image is what makes vertical rhythm and dead space comparable across pages. It does not replace the cadence, and the cadence does not replace it.

1. **`01-full.png`** — `fullPage: true`, after `settleLayout`.
2. **`02-fold-N.png`** — the cadence above, one image per viewport-height scroll position, running to the true bottom.
3. **Every accordion opened.** `.record-section-header` is the toggle. Open **each one individually** and shoot, then all open together and shoot. Klent's density complaint lives here.
4. **Every dropdown and combobox opened.** `[role="combobox"]`, clicked to open, listbox visible, full page plus the listbox clipped.
5. **Every tab selected.** `[role="tab"]`, each one, full page after selection.
6. **Every modal, dialog, drawer and side panel opened.** Click each trigger, shoot the page with it open plus the overlay clipped, then close it and continue.
7. **Every button pressed that is safe to press.** Enumerate `button, a[href], [role="button"]` and act on each. **Destructive actions are excluded by an explicit allowlist of labels, not by guesswork**: anything matching `/delete|remove|purge|erase|merge|archive|deactivate|send|invite/i` is recorded as "not pressed, destructive" rather than clicked. Everything else is pressed, and whatever appears is photographed.
8. **Empty, loading and error states** where a route can be driven into them: a search that returns nothing, a form submitted blank, a filter that matches zero rows.

## What to write alongside the images

`audit/2026-09-08/measurements/<role>/<route>.json`, one file per route per role, holding for every element acted on: its accessible name, its selector, what happened when acted on (a dialog opened, a listbox opened, nothing changed, the route changed), and the resulting image filename. **An element that did nothing is the most valuable row in the file**, because that is a dead control.

Plus per route: page height, viewport count, the count of interactive elements found and acted on, and the vertical gap between consecutive sections.

## The bar

- **Coverage is reported as a fraction, not an adjective.** "Acted on 41 of 41 interactive elements on `/recruit/candidates` as admin, 3 excluded as destructive" — never "captured the candidate list".
- Every image is named so its content is obvious without opening it.
- The harness is a **new spec** under `tests/audit/`, not an edit to `capture.ts`, and it runs on `playwright.audit.config.ts` so the gate never runs it.
- Fixtures are run-unique and every teardown checks its error. Nothing is left in the database: `select count(*) from client_errors` returns 0 afterwards.
- **No commit.** Klent reviews the folder before anything is committed.

## Standing rules for this goal and Goal 9

**Klent, 2026-09-08:** "do not skip and move on if you encounter an error. fix it to proceed. you may use the internet, spawn multiple agents, i don't care. what i want is the best results and quality of the findings, so that we can resolve all of these findings in a separate goal."

- **An error stops the goal until it is fixed.** Not worked around, not noted for later, not retried and hoped past. Read the code, form a hypothesis, test it, fix the cause. This applies to a failing capture as much as to a failing test: a route that will not photograph is a finding about the route, and it gets diagnosed.
- **Use the internet freely.** Any published guidance, spec or reference that settles a question is worth fetching rather than recalling, and it gets cited with the date it was read.
- **Parallel agents are allowed and encouraged**, one per role or one per review lens, never nested. Each gets a narrow brief, a word limit and a report format, because the report is all that returns.
- **Quality of findings is the deliverable**, not the count of images. The next goal has to be able to fix things from this output alone.

**ON FINISHING: `bash scripts/arm-goal.sh 9`, and do not commit.**
