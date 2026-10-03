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
    migration_result: input.migrationResult || 'skipped',
    pr_url: input.prUrl,
    run_url: input.runUrl,
  };
  const commits: [string, string][] =
    input.mergeSha === input.sourceSha
      ? [['Target merge SHA / source SHA / version tag', input.mergeSha]]
      : [
          ['Target merge SHA', input.mergeSha],
          ['Source SHA / version tag', input.sourceSha],
        ];
  const rows: [string, string][] = [
    ['Status', outcome],
    ['Environment', input.environment],
    ['Strategy', input.strategy],
    ['Package version', input.packageVersion || 'Unavailable'],
    ...commits,
    ['Candidate selection', payload.candidate_selection_result],
    ['D1 migration', payload.migration_result],
    ['Version upload', payload.upload_result],
    ['Worker deployment', payload.worker_deployment_result],
    ['Triggers', payload.triggers_result],
  ];
  if (versionId) {
    const stages = [
      'selected',
      ...(uploadedId ? ['uploaded'] : []),
      ...(deployedId ? ['deployed'] : []),
    ];
    rows.push([`Worker Version ID (${stages.join(', ')})`, versionId]);
  }
  if (!deployedId && production)
    rows.push([
      'Production deployment',
      'Not confirmed; inspect production state before recovery or retry.',
    ]);
  if (input.url) rows.push(['URL', input.url]);
  rows.push(
    ['PR', `[Originating PR](${input.prUrl})`],
    ['Details', `[GitHub Actions](${input.runUrl})`],
  );
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
