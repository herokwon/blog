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
  await vi.advanceTimersByTimeAsync(199);
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
  await vi.advanceTimersByTimeAsync(200);
  await tick();
  expect(view.container.querySelector('[role="status"]')?.textContent).toBe(
    '저장 중…',
  );
  await view.rerender({ active: false });
  expect(view.container.querySelector('[role="status"]')).toBeNull();
  await view.rerender({ active: true });
  expect(view.container.querySelector('[role="status"]')).toBeNull();
  await vi.advanceTimersByTimeAsync(200);
  await tick();
  expect(view.container.querySelector('[role="status"]')).not.toBeNull();
});

it('keeps one delay across progress-message changes in a continuous operation', async () => {
  vi.useFakeTimers();
  const view = await render(ProcessingIndicator, {
    active: true,
    message: '저장 중…',
    scope: 'region',
  });
  await vi.advanceTimersByTimeAsync(150);
  await view.rerender({ message: '최신 상태 불러오는 중…' });
  await vi.advanceTimersByTimeAsync(50);
  await tick();
  expect(view.container.querySelector('[role="status"]')?.textContent).toBe(
    '최신 상태 불러오는 중…',
  );
  await view.rerender({ message: '발행 중…' });
  expect(view.container.querySelector('[role="status"]')?.textContent).toBe(
    '발행 중…',
  );
  await view.rerender({ active: false });
  expect(view.container.querySelector('[data-processing]')).toBeNull();
});

it('does not let a cancelled delay reveal the indicator early during a retry', async () => {
  vi.useFakeTimers();
  const view = await render(ProcessingIndicator, {
    active: true,
    message: '저장 중…',
  });
  await vi.advanceTimersByTimeAsync(150);
  await view.rerender({ active: false });
  await view.rerender({ active: true });
  await vi.advanceTimersByTimeAsync(199);
  await tick();
  expect(view.container.querySelector('[role="status"]')).toBeNull();
  await vi.advanceTimersByTimeAsync(1);
  await tick();
  expect(view.container.querySelector('[role="status"]')?.textContent).toBe(
    '저장 중…',
  );
});

it('cancels the pending indicator when its owner is disposed', async () => {
  vi.useFakeTimers();
  const view = await render(ProcessingIndicator, {
    active: true,
    message: '저장 중…',
  });
  await vi.advanceTimersByTimeAsync(100);
  await view.unmount();
  await vi.advanceTimersByTimeAsync(1000);
  await tick();
  expect(view.container.querySelector('[data-processing]')).toBeNull();
});
