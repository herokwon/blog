import { tick } from 'svelte';
import { afterEach, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ProcessingIndicator from './ProcessingIndicator.svelte';

afterEach(() => vi.useRealTimers());

it('delays visual feedback and cancels a short operation without a stale indicator', async () => {
  vi.useFakeTimers();
  const view = await render(ProcessingIndicator, {
    active: true,
    message: '저장 중…',
  });
  await vi.advanceTimersByTimeAsync(179);
  await tick();
  expect(view.container.querySelector('[role="status"]')).toBeNull();
  await view.rerender({ active: false });
  await vi.advanceTimersByTimeAsync(1000);
  await tick();
  expect(view.container.querySelector('[role="status"]')).toBeNull();
});

it('removes feedback immediately on completion and starts a fresh delay on retry', async () => {
  vi.useFakeTimers();
  const view = await render(ProcessingIndicator, {
    active: true,
    message: '저장 중…',
  });
  await vi.advanceTimersByTimeAsync(180);
  await tick();
  expect(view.container.querySelector('[role="status"]')?.textContent).toBe(
    '저장 중…',
  );
  await view.rerender({ active: false });
  expect(view.container.querySelector('[role="status"]')).toBeNull();
  await view.rerender({ active: true });
  expect(view.container.querySelector('[role="status"]')).toBeNull();
  await vi.advanceTimersByTimeAsync(180);
  await tick();
  expect(view.container.querySelector('[role="status"]')).not.toBeNull();
});
