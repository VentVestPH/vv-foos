import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plan } from '../../scripts/affected.mjs';

test('a module change runs its own areas and the accessibility sweep', () => {
  const result = plan(['app/src/modules/recruit/candidates/CandidateListPage.tsx']);
  assert.deepEqual(result.areas, ['lists', 'records', 'recruit']);
  assert.deepEqual(result.targets, ['e2e/lists', 'e2e/records', 'e2e/recruit', 'e2e/shell/accessibility.spec.ts']);
  assert.equal(result.all, false);
});

test('shared application code runs every browser area', () => {
  for (const file of ['app/src/components/ui/Select.tsx', 'app/src/styles/layers/controls.css', 'app/src/lib/csv.ts']) {
    const result = plan([file]);
    assert.equal(result.all, true, file);
    assert.deepEqual(result.targets, ['e2e'], file);
  }
});

test('documentation, scripts and workflows run no browser tests', () => {
  const result = plan(['docs/INDEX.md', 'CLAUDE.md', 'scripts/gate.sh', '.github/workflows/ci.yml']);
  assert.deepEqual(result.targets, []);
  assert.equal(result.integration, false);
});

test('a migration runs everything and the integration tests', () => {
  const result = plan(['supabase/migrations/20261020000001_x.sql']);
  assert.equal(result.all, true);
  assert.equal(result.integration, true);
});

test('an edge function runs the integration tests only', () => {
  const result = plan(['supabase/functions/careers-apply/index.ts']);
  assert.equal(result.integration, true);
  assert.deepEqual(result.targets, []);
});

test('an e2e spec runs only its own area, with no accessibility sweep', () => {
  const result = plan(['tests/e2e/dashboard/task-board.spec.ts']);
  assert.deepEqual(result.targets, ['e2e/dashboard']);
});

test('shared test code runs everything', () => {
  assert.equal(plan(['tests/support/e2e-helpers.ts']).all, true);
});

test('an unmapped module or page falls back to everything', () => {
  assert.equal(plan(['app/src/modules/newthing/x.tsx']).all, true);
  assert.equal(plan(['app/src/pages/Unknown.tsx']).all, true);
});

test('dashboard pages map to the dashboard area', () => {
  const result = plan(['app/src/pages/MyTaskBoard.tsx']);
  assert.deepEqual(result.areas, ['dashboard']);
});
