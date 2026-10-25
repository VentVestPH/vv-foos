# Why CI fails, and how to write a test that does not

**Status:** Final · **Date:** 2026-09-11 · **Owner:** engineering

Read this before adding or changing a browser test. It exists because on 2026-09-11 the `integration` job failed on five consecutive pushes over about six hours, and **not one failure was a database problem, a Supabase problem, or a defect in the thing the failing test was asserting**. Every one came from a test measuring something that differs between a developer machine and a CI runner.

## 1. CI's Supabase is the same Supabase

There is no hosted Supabase in CI. `.github/workflows/ci.yml` runs `supabase start`: the same Docker containers, the same `supabase/migrations/*.sql` applied in the same order, the same `supabase/seed.sql`, the same RLS. `scripts/check-migrations.mjs` runs there and reports no drift. The live project (`hilieyehhecrlccdveta`) is never contacted.

If a browser test fails in CI, the database is not the reason. Across eleven distinct failures on 2026-09-11 there was not one Postgres error, RLS denial or container failure.

## 2. The two things that *are* different

### Data

| | Developer machine | CI |
|---|---|---|
| candidates | 73,024 | 8 |
| requisitions | 690 | 3 |
| applications | 86,163 | a handful |
| intake items | 1 | **0** |
| companies | 195 | 5 |

CI's database is migrations plus `seed.sql`, nothing else. The developer database carries the migrated Zoho copy.

This inverts any assertion written against volume. Real examples:

```
Expected: 20                        Received: 8
Expected: "Next candidate by name"  Received: "Next candidate"
Error: /recruit/requisitions offers no suggestions — element(s) not found
```

The second is the instructive one: on a small database the test's own fixture lands on **page one of the list**, so a URL the test believed it was "arriving cold" at is a history entry React Router restores router state from.

### Machine speed

`ubuntu-latest` on a private repo is **2 vCPU**; a developer machine here is 10 cores. `requestAnimationFrame` fires every 16ms locally and catches eight frames of a 140ms fade. On CI the whole fade can complete **between two samples**.

```
Expected: > 2     Received: 0     the fade has to be visible over several frames
Expected: true    Received: false the rail must outlive the click so it can animate out
Expected: > 0     Received: 0     a dropdown menu animates in, animates out
- "background": "rgba(240, 246, 251, 0.96)"
+ "background": "rgb(240, 246, 251)"
```

The last is the subtlest: a poll waiting for a colour to *stop changing* saw the same mid-fade value on two throttled frames and called it settled.

## 3. The rule

**Assert the contract, never the moment.** A test may read something the product guarantees — a declared CSS property, a recorded event, a value derived from the page itself. It may not read something that exists for an instant.

### Motion

```ts
// no
const frames = [];  // …sample rAF… 
expect(frames.filter((f) => f.o > 0.02 && f.o < 0.98).length).toBeGreaterThan(2);

// yes
const s = await el.evaluate((n) => getComputedStyle(n));
expect(s.transitionProperty).toContain('opacity');
expect(s.transitionDuration.split(', ')[0]).not.toBe('0s');
expect(s.transitionDelay.split(', ')[0]).not.toBe('0s');   // a staggered fade
expect(s.animationIterationCount).toBe('infinite');        // a continuous cue
```

### Proving something animated out

Record it before the click; read the record after the element is gone. `watchExit()` and `exitSeen()` in `tests/e2e/interaction-motion.spec.ts` are the implementation.

```ts
await watchExit(page, '.the-overlay');       // MutationObserver on data-closing
await trigger.click();
await expect(overlay).toHaveCount(0);
expect((await exitSeen(page)).closing).toBe(true);
```

History is machine-independent. `!!document.querySelector(...)` one round trip after the click is not.

### A colour mid-transition

Poll for the **token**, never for "it changed":

```ts
const target = await page.evaluate(() => {
  const probe = document.createElement('div');
  probe.style.backgroundColor = 'var(--fo-option-hover)';
  document.body.appendChild(probe);
  const value = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return value;
});
await expect.poll(() => el.evaluate((n) => getComputedStyle(n).backgroundColor)).toBe(target);
```

### Data

- `seed.sql` data is fair game. Every environment has it.
- **Hand-seeded demo rows are not.** `intake-list.spec.ts` was written against 130 intake rows seeded for a stakeholder to review, which were then removed as sample data and which CI never had. Six of fifteen tests failed.
- Take a search term from a row already on screen, or from a fixture the spec created.
- Record a count before the action and compare against that, never a literal.
- **To make a list overflow, shorten the viewport. Do not seed rows.** Seeded rows are visible to every parallel spec: seeding 24 candidates so one test could scroll broke a different test's row count in another worker.

### Shared per-user state

A per-staff row in `integration_settings` is shared: a parallel worker signed in as the same persona writes the same row. Give the assertion room — `record-ui.spec.ts` seeds `{ items: [], limit: 50 }` so a neighbour's record opens cannot evict what it measures.

### Sharding is not a stable partition

`--shard` splits by test count. **Adding a test anywhere moves the boundary**, so every later file gets a different set of concurrent neighbours. A test that depends on being alone in a shared row is a time bomb, not a passing test.

## 4. Configuration

| Setting | Local | CI | Why |
|---|---|---|---|
| `workers` | 4 | **2** | 2 vCPU contends rather than parallelises. Pinned in `ci.yml` so a local default cannot move it |
| `maxFailures` | 1 | **0** | Local stops at the first failure; CI reports every one, because one per push is one round trip per defect |
| `reporter` | `line` | `line` | |

`workers` defaulting to 4 with no CI override took CI from **1 failure to 16** in a single commit — `page.goto` timeouts and `Target page, context or browser has been closed`. A shared config's default is a production value for every environment that does not override it.

## 5. Reproducing CI locally

`bash scripts/ci-parity.sh snapshot | run | restore` pg_dumps the local database, resets it to CI's shape, runs the suite, and restores the migrated copy. **It is destructive between `run` and `restore`.**

That narrows the data half. **Nothing narrows the speed half** short of writing assertions that do not depend on speed, which is what section 3 is for.

Running both shards at CI's settings is the closest honest check:

```sh
cd tests
FOOS_PW_WORKERS=2 FOOS_PW_MAX_FAILURES=0 npx playwright test --shard=1/2
FOOS_PW_WORKERS=2 FOOS_PW_MAX_FAILURES=0 npx playwright test --shard=2/2
```

## 6. What the suite is worth

It is worth keeping on every pull request, and that is a decision on the record rather than an assumption. During the same six hours it found **two real accessibility defects that no amount of looking would have caught**:

- `aria-hidden-focus` on `.fo-page-head-grow` — the collapsed bulk-action bar was `aria-hidden` with its buttons still in the tab order, so a keyboard user could tab into an invisible toolbar.
- `scrollable-region-focusable` on `.kanban` — the sales stage board scrolls horizontally and nothing could put keyboard focus on it, so it could not be scrolled by keyboard at all.

Both were fixed in the product, not in the test.

## 7. The discipline the whole thing rests on

**A UI change and the spec asserting the old UI belong in the same edit.** Not in a follow-up after CI complains. Every red run on 2026-09-11 was either the worker regression or a test still describing a decision that had been reversed minutes earlier.

And when you fix an instance of a pattern, **grep for its siblings before moving on**. One fix was applied to `interaction-motion.spec.ts:308` without checking whether the pattern appeared elsewhere. It appeared at lines 231, 345 and 357 as well, and cost two further CI cycles.

## 8. A guard that was tried and abandoned

A static check for "a `:hover` rule that recolours without a matching transition" was written and reverted. It produced **20+ false positives** because hover and transition are declared against different classes on the same element (`.btn-primary:hover` against `.btn`); resolving which rules apply needs a DOM. Do not rebuild it. Use the shared classes instead — `.fo-icon-btn`, `.fo-gear-btn`, `.link-btn`, `.fo-dialog-close` — which carry both halves already.

## Related

- `tests/qa/DEFECT_LOG.md` — QA-049, QA-055 to QA-061 carry the run ids and verbatim failures
- `CLAUDE.md` — the test-caveat list, fifteen items
- `scripts/ci-parity.sh`
