import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';

import {
  auditDecision,
  type AuditException,
  type AuditReport,
} from './policy.ts';

mkdirSync('test-results', { recursive: true });
const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const result = spawnSync(command, ['audit', '--json'], {
  encoding: 'utf8',
  shell: process.platform === 'win32',
});
writeFileSync('test-results/audit.json', result.stdout ?? '');
try {
  if (result.error || (result.status !== 0 && result.status !== 1))
    throw new Error('Audit command did not complete');
  const report: AuditReport = JSON.parse(result.stdout);
  const exceptions: AuditException[] = JSON.parse(
    readFileSync(
      process.env.AUDIT_EXCEPTIONS_FILE ?? '.github/audit-exceptions.json',
      'utf8',
    ),
  );
  const blocked = auditDecision(report, exceptions);
  const lines = [
    '## Dependency audit',
    '',
    `Blocking advisories: ${blocked.length}`,
    '',
    ...Object.values(report.advisories ?? {}).map(
      item =>
        `- ${item.severity}: ${item.module_name} (${item.github_advisory_id ?? item.id})`,
    ),
    ...exceptions.map(
      item =>
        `- Exception ${item.ghsa}, review by ${item.reviewBy}: ${item.reason}`,
    ),
  ];
  const summary = lines.join('\n') + '\n';
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  if (blocked.length) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
