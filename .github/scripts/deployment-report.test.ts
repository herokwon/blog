import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import {
  createDeploymentReport,
  type ReportInput,
} from './deployment-report.ts';
import { readUploadedVersion } from './worker-output.ts';

const id = '18f97339-c287-4872-9bdd-e2135c07ec12';
const input: ReportInput = {
  strategy: 'promote',
  environment: 'production',
  packageVersion: '0.2.0',
  mergeSha: 'a'.repeat(40),
  sourceSha: 'b'.repeat(40),
  versionId: id,
  workerResult: 'success',
  uploadResult: 'skipped',
  deployResult: 'success',
  triggersResult: 'success',
  selectionResult: 'success',
  migrationResult: 'success',
  url: 'https://blog.example.com',
  prUrl: 'https://github.com/herokwon/blog/pull/8',
  runUrl: 'https://github.com/herokwon/blog/actions/runs/123',
};

test('records the exact deployed candidate separately from the main merge', () => {
  const report = createDeploymentReport(input);
  assert.equal(report.deployment.ref, 'a'.repeat(40));
  assert.equal(report.deployment.payload.source_sha, 'b'.repeat(40));
  assert.equal(report.deployment.payload.deployed_worker_version_id, id);
  assert.equal(report.deployment.payload.uploaded_worker_version_id, null);
  assert.equal(report.deployment.payload.package_version, '0.2.0');
  assert.equal(report.status.state, 'success');
  assert.equal(report.status.log_url, input.runUrl);
  assert.match(report.comment, /^### ⚡ Cloudflare Workers deployment/);
  assert.match(report.comment, /Worker Version ID \(selected, deployed\)/);
});

test('preview success records an uploaded version without claiming production deployment', () => {
  const report = createDeploymentReport({
    ...input,
    strategy: 'upload',
    environment: 'preview',
    sourceSha: input.mergeSha,
    uploadResult: 'success',
    deployResult: 'skipped',
    triggersResult: 'skipped',
  });
  assert.equal(report.deployment.payload.uploaded_worker_version_id, id);
  assert.equal(report.deployment.payload.deployed_worker_version_id, null);
  assert.equal(report.deployment.production_environment, false);
  assert.equal(report.status.state, 'success');
  assert.match(report.comment, /Worker Version ID \(selected, uploaded\)/);
  assert.doesNotMatch(report.comment, /Worker Version ID \([^)]*deployed/);
});

test('hotfix identifies the merged code and both uploaded and deployed version', () => {
  const report = createDeploymentReport({
    ...input,
    strategy: 'hotfix',
    sourceSha: input.mergeSha,
    selectionResult: 'skipped',
    migrationResult: 'skipped',
    uploadResult: 'success',
  });
  assert.equal(report.deployment.payload.source_sha, input.mergeSha);
  assert.equal(report.deployment.payload.uploaded_worker_version_id, id);
  assert.equal(report.deployment.payload.deployed_worker_version_id, id);
  assert.match(
    report.comment,
    /Worker Version ID \(selected, uploaded, deployed\)/,
  );
  assert.equal(report.comment.split(id).length - 1, 1);
  assert.equal(report.comment.split(input.mergeSha).length - 1, 1);
});

test('failed deployment retains the uploaded version without a deployed version claim', () => {
  const report = createDeploymentReport({
    ...input,
    strategy: 'hotfix',
    workerResult: 'failure',
    uploadResult: 'success',
    deployResult: 'failure',
    triggersResult: 'skipped',
  });
  assert.equal(report.status.state, 'failure');
  assert.equal(report.deployment.payload.uploaded_worker_version_id, id);
  assert.equal(report.deployment.payload.deployed_worker_version_id, null);
  assert.match(report.comment, /not confirmed/i);
});

test('trigger failure records successful Worker deployment and overall failure', () => {
  const report = createDeploymentReport({
    ...input,
    workerResult: 'failure',
    triggersResult: 'failure',
  });
  assert.equal(report.status.state, 'failure');
  assert.equal(report.deployment.payload.deployed_worker_version_id, id);
  assert.match(report.comment, /Partial success/);
  assert.match(report.comment, /Triggers \| failure/);
});

test('selection and migration failures preserve target details without deployment claims', () => {
  for (const selectionResult of ['failure', 'success']) {
    const report = createDeploymentReport({
      ...input,
      workerResult: 'skipped',
      selectionResult,
      migrationResult: selectionResult === 'success' ? 'failure' : 'skipped',
      versionId: selectionResult === 'success' ? id : '',
      deployResult: '',
      triggersResult: '',
    });
    assert.equal(report.status.state, 'failure');
    assert.equal(report.deployment.payload.source_sha, input.sourceSha);
    assert.equal(report.deployment.payload.deployed_worker_version_id, null);
    assert.match(report.comment, /not confirmed/i);
  }
});

test('reads upload IDs and preview URLs from structured Wrangler output only', () => {
  const output = [
    { type: 'wrangler-session', version: 1 },
    {
      type: 'version-upload',
      version: 1,
      version_id: id,
      preview_url: 'https://candidate.example.com',
    },
  ]
    .map(entry => JSON.stringify(entry))
    .join('\n');
  assert.deepEqual(readUploadedVersion(output), {
    id,
    url: 'https://candidate.example.com',
  });
});

test('rejects absent, malformed, or ambiguous upload records', () => {
  for (const output of [
    '',
    'Uploaded Version ID: some-id',
    JSON.stringify({ type: 'version-upload', version: 1 }),
    [1, 2]
      .map(() =>
        JSON.stringify({ type: 'version-upload', version: 1, version_id: id }),
      )
      .join('\n'),
  ]) {
    assert.throws(() => readUploadedVersion(output));
  }
});

test('does not claim success when a Version ID is unavailable or deployment is cancelled', () => {
  for (const changes of [
    { versionId: '' },
    {
      workerResult: 'cancelled',
      deployResult: 'cancelled',
      triggersResult: 'skipped',
    },
  ]) {
    const report = createDeploymentReport({ ...input, ...changes });
    assert.equal(report.status.state, 'failure');
    assert.equal(report.deployment.payload.deployed_worker_version_id, null);
    assert.match(report.comment, /not confirmed/i);
  }
});

test('CLI writes upload outputs and partial deployment artifacts for the workflow', () => {
  const directory = mkdtempSync(join(tmpdir(), 'deployment-report-'));
  try {
    const uploadPath = join(directory, 'upload.ndjson');
    const outputPath = join(directory, 'output');
    writeFileSync(outputPath, '');
    writeFileSync(
      uploadPath,
      JSON.stringify({
        type: 'version-upload',
        version: 1,
        version_id: id,
        preview_url: null,
      }) + '\n',
    );
    const uploaded = spawnSync(
      process.execPath,
      [
        fileURLToPath(new URL('./worker-output.ts', import.meta.url)),
        uploadPath,
      ],
      {
        encoding: 'utf8',
        env: { ...process.env, GITHUB_OUTPUT: outputPath },
      },
    );
    assert.ifError(uploaded.error);
    assert.equal(uploaded.status, 0, uploaded.stderr);
    assert.equal(readFileSync(outputPath, 'utf8'), `version-id=${id}\nurl=\n`);
    const reported = spawnSync(
      process.execPath,
      [
        fileURLToPath(new URL('./deployment-report.ts', import.meta.url)),
        directory,
      ],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          STRATEGY: 'hotfix',
          ENVIRONMENT: 'production',
          PACKAGE_VERSION: '0.2.0',
          COMMIT_SHA: 'a'.repeat(40),
          SOURCE_SHA: 'a'.repeat(40),
          VERSION_ID: id,
          WORKER_RESULT: 'failure',
          UPLOAD_RESULT: 'success',
          DEPLOY_RESULT: 'success',
          TRIGGERS_RESULT: 'failure',
          SELECTION_RESULT: 'skipped',
          MIGRATION_RESULT: 'skipped',
          WORKER_URL: input.url,
          PR_URL: input.prUrl,
          RUN_URL: input.runUrl,
        },
      },
    );
    assert.ifError(reported.error);
    assert.equal(reported.status, 0, reported.stderr);
    const deployment = JSON.parse(
      readFileSync(join(directory, 'deployment.json'), 'utf8'),
    );
    const status = JSON.parse(
      readFileSync(join(directory, 'deployment-status.json'), 'utf8'),
    );
    assert.equal(deployment.payload.deployed_worker_version_id, id);
    assert.equal(deployment.payload.pr_url, input.prUrl);
    assert.equal(status.state, 'failure');
    assert.equal(status.log_url, input.runUrl);
    assert.match(
      readFileSync(join(directory, 'deployment-comment.md'), 'utf8'),
      /^### ⚡ Cloudflare Workers deployment/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('PR reporting remains eligible after Deployment recording fails', () => {
  const workflow = readFileSync(
    new URL('../workflows/deployment.yml', import.meta.url),
    'utf8',
  );
  const expression = workflow
    .split('      - name: Comment result')[1]
    ?.match(/^\s+if: (.+)$/m)?.[1];
  assert.ok(expression);
  for (const priorResult of ['success', 'failure']) {
    assert.equal(
      runInNewContext(expression, {
        always: () => true,
        success: () => priorResult === 'success',
        steps: { report: { outcome: 'success' } },
      }),
      true,
    );
  }
  assert.equal(
    runInNewContext(expression, {
      always: () => true,
      steps: { report: { outcome: 'failure' } },
    }),
    false,
  );
});
