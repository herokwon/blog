import { appendFileSync, existsSync, readFileSync } from 'node:fs';

const lines = ['## Test results', ''];
if (existsSync('coverage/coverage-summary.json')) {
  const metrics = ['lines', 'statements', 'functions', 'branches'] as const;
  const {
    total,
  }: { total: Record<(typeof metrics)[number], { pct: number }> } = JSON.parse(
    readFileSync('coverage/coverage-summary.json', 'utf8'),
  );
  for (const key of metrics)
    lines.push(`- ${key}: ${total[key].pct}% (informational)`);
} else lines.push('- Coverage report unavailable; inspect the test step.');
if (existsSync('test-results/e2e-results.json')) {
  const {
    stats,
  }: {
    stats: Record<'expected' | 'unexpected' | 'flaky' | 'skipped', number>;
  } = JSON.parse(readFileSync('test-results/e2e-results.json', 'utf8'));
  lines.push(
    `- E2E: ${stats.expected} passed, ${stats.unexpected} failed, ${stats.flaky} flaky, ${stats.skipped} skipped`,
  );
} else lines.push('- E2E report unavailable; tests may not have started.');
if (process.env.GITHUB_STEP_SUMMARY)
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');
else console.log(lines.join('\n'));
