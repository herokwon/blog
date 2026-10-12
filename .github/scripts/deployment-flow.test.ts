import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflow = readFileSync(
  new URL('../workflows/deployment.yml', import.meta.url),
  'utf8',
);
function candidate() {
  return (
    workflow.split('  prepare-candidate:')[1]?.split('  deploy-worker:')[0] ??
    ''
  );
}

test('candidate_build_runs_once and preview_migration_failure_blocks_both_uploads', () => {
  const flow = candidate();
  assert.equal((flow.match(/run: pnpm build/g) ?? []).length, 1);
  assert.ok(flow.indexOf('pnpm db:migrate:preview') > 0);
  assert.ok(
    flow.indexOf('pnpm db:migrate:preview') < flow.indexOf('versions upload'),
  );
  assert.doesNotMatch(flow, /continue-on-error/);
  assert.equal((flow.match(/versions upload/g) ?? []).length, 2);
});
test('preview_deploys_uploaded_id and production_candidate_remains_undeployed', () => {
  const flow = candidate();
  assert.match(
    flow,
    /versions deploy \$\{\{ steps\.preview-version\.outputs\.version-id \}\}@100% --env preview -y/,
  );
  assert.match(
    flow,
    /triggers deploy --config wrangler.trigger.json --env preview/,
  );
  assert.doesNotMatch(flow, /versions deploy[^\n]*production-version/);
  assert.match(flow, /preview-upload.ndjson/);
  assert.match(flow, /production-upload.ndjson/);
});
test('promotion_selects_production_only and hotfix_does_not_touch_preview', () => {
  const production =
    workflow.split('  deploy-worker:')[1]?.split('  report-deployment:')[0] ??
    '';
  assert.match(production, /strategy != 'upload'/);
  assert.doesNotMatch(production, /--env preview/);
  assert.match(workflow, /group: \$\{\{ github.workflow \}\}-workers/);
  assert.match(candidate(), /refs\/heads\/\$RELEASE_REF/);
});
test('preview_trigger_failure_blocks_success and confirmed partial outcomes remain reportable', () => {
  assert.match(candidate(), /preview-triggers-result:/);
  assert.match(
    workflow,
    /needs\.prepare-candidate\.outputs\.preview-triggers-result/,
  );
  assert.match(
    workflow,
    /needs\.prepare-candidate\.outputs\.production-version-id/,
  );
  assert.match(candidate(), /if: always\(\)/);
});
