import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type ReportInput = {
  strategy: string;
  environment: string;
  packageVersion: string;
  mergeSha: string;
  sourceSha: string;
  versionId: string;
  workerResult: string;
  uploadResult: string;
  deployResult: string;
  triggersResult: string;
  selectionResult: string;
  tagValidationResult?: string;
  migrationResult: string;
  url: string;
  prUrl: string;
  runUrl: string;
};

export function createDeploymentReport(input: ReportInput) {
  const production = input.environment === 'production';
  const versionId = input.versionId || null;
  const uploadedId = input.uploadResult === 'success' ? versionId : null;
  const deployedId =
    production && input.deployResult === 'success' ? versionId : null;
  const success =
    input.workerResult === 'success' &&
    (production
      ? Boolean(deployedId) && input.triggersResult === 'success'
      : Boolean(uploadedId));
  const partial = !success && Boolean(deployedId);
  const outcome = success
    ? '✅ Success'
    : partial
      ? '⚠️ Partial success'
      : '❌ Failed';
  const payload = {
    strategy: input.strategy,
    package_version: input.packageVersion || null,
    target_merge_sha: input.mergeSha,
    source_sha: input.sourceSha,
    worker_version_tag: input.sourceSha,
    selected_worker_version_id: versionId,
    uploaded_worker_version_id: uploadedId,
    deployed_worker_version_id: deployedId,
    worker_job_result: input.workerResult,
    upload_result: input.uploadResult || 'skipped',
    worker_deployment_result: input.deployResult || 'skipped',
    triggers_result: input.triggersResult || 'skipped',
    candidate_selection_result: input.selectionResult || 'skipped',
    release_tag_validation_result: input.tagValidationResult || 'skipped',
    migration_result: input.migrationResult || 'skipped',
    pr_url: input.prUrl,
    run_url: input.runUrl,
  };
  const commits: [string, string][] =
    input.mergeSha === input.sourceSha
      ? [['Source SHA / version tag', input.sourceSha]]
      : [
          ['Target merge SHA', input.mergeSha],
          ['Source SHA / version tag', input.sourceSha],
        ];
  const rows: [string, string][] = [
    [
      'Result',
      `${outcome} · ${input.strategy === 'promote' ? 'Production promotion' : input.strategy === 'hotfix' ? 'Hotfix · production' : 'Candidate upload · preview'}`,
    ],
    ['Package version', input.packageVersion || 'Unavailable'],
    ...commits,
  ];
  if (versionId) {
    rows.push([
      deployedId
        ? 'Deployed Worker Version ID'
        : uploadedId
          ? 'Uploaded Worker Version ID'
          : 'Selected Worker Version ID (deployment unconfirmed)',
      versionId,
    ]);
  }
  if (!success) {
    const stopped = (label: string, result: string) =>
      result === 'failure'
        ? `${label} failed`
        : result === 'cancelled'
          ? `${label} cancelled`
          : null;
    const failure =
      (input.strategy === 'promote'
        ? (stopped('Release tag validation', input.tagValidationResult ?? '') ??
          stopped('Exact candidate selection', input.selectionResult) ??
          stopped('D1 migration', input.migrationResult))
        : null) ??
      stopped('Worker deployment', input.deployResult) ??
      (input.deployResult === 'success' && !versionId
        ? 'Worker Version ID unavailable; deployment identity cannot be confirmed'
        : null) ??
      (deployedId ? stopped('Triggers update', input.triggersResult) : null) ??
      (input.workerResult === 'cancelled' && !input.deployResult
        ? 'Worker job cancelled; inspect Actions'
        : null) ??
      (deployedId
        ? 'Subsequent Worker job step failed or was cancelled; inspect Actions'
        : 'Preparation or upload failed, was blocked, or was cancelled; inspect Actions');
    rows.push(['Failure summary', failure]);
    if (production) {
      const state = deployedId
        ? 'Worker deployment confirmed'
        : ['failure', 'cancelled', 'success'].includes(input.deployResult) ||
            (input.workerResult === 'cancelled' && !input.deployResult)
          ? 'Worker deployment not confirmed; inspect actual production state'
          : 'Worker deployment not attempted';
      rows.push([
        'Production state',
        `D1 step: ${payload.migration_result}; ${state}${stopped('D1 migration', input.migrationResult) ? '; partial D1 changes may remain' : ''}${input.migrationResult === 'success' ? '; D1 step success does not imply schema changes' : ''}.`,
      ]);
    }
  }
  if (input.url)
    rows.push([production ? 'Production URL' : 'Version URL', input.url]);
  rows.push(['Details', `[GitHub Actions](${input.runUrl})`]);
  const cell = (value: string) =>
    value.replaceAll('|', '\\|').replaceAll(/\r?\n/g, ' ');
  return {
    deployment: {
      ref: input.mergeSha,
      environment: input.environment,
      auto_merge: false,
      required_contexts: [],
      production_environment: production,
      transient_environment: !production,
      payload,
    },
    status: {
      state: success ? 'success' : 'failure',
      environment: input.environment,
      log_url: input.runUrl,
      description: partial
        ? 'Worker deployed; subsequent steps failed.'
        : success
          ? 'Workflow completed successfully.'
          : 'Workflow failed or was blocked; inspect run details.',
      ...(input.url ? { environment_url: input.url } : {}),
    },
    comment: `### ⚡ Cloudflare Workers deployment\n\n| Field | Result |\n| :--- | :--- |\n${rows.map(([label, value]) => `| ${label} | ${cell(value)} |`).join('\n')}\n`,
  };
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  const value = (key: string) => process.env[key] ?? '';
  const report = createDeploymentReport({
    strategy: value('STRATEGY'),
    environment: value('ENVIRONMENT'),
    packageVersion: value('PACKAGE_VERSION'),
    mergeSha: value('COMMIT_SHA'),
    sourceSha: value('SOURCE_SHA'),
    versionId: value('VERSION_ID'),
    workerResult: value('WORKER_RESULT'),
    uploadResult: value('UPLOAD_RESULT'),
    deployResult: value('DEPLOY_RESULT'),
    triggersResult: value('TRIGGERS_RESULT'),
    selectionResult: value('SELECTION_RESULT'),
    tagValidationResult: value('TAG_VALIDATION_RESULT'),
    migrationResult: value('MIGRATION_RESULT'),
    url: value('WORKER_URL'),
    prUrl: value('PR_URL'),
    runUrl: value('RUN_URL'),
  });
  const directory = process.argv[2];
  for (const [file, content] of [
    ['deployment.json', JSON.stringify(report.deployment)],
    ['deployment-status.json', JSON.stringify(report.status)],
    ['deployment-comment.md', report.comment],
  ])
    writeFileSync(resolve(directory, file), content);
}
