import { getContext, setContext } from 'svelte';
import type { FeedbackTone } from './feedback';

const key = Symbol('admin-notices');

/** One in-memory result, owned by the mounted Admin layout across navigation. */
class AdminNotices {
  current = $state<{
    id: number;
    message: string;
    tone: FeedbackTone;
    details: string;
  } | null>(null);
  private sequence = 0;
  show(message: string, tone: FeedbackTone = 'success', details = '') {
    this.current = { id: ++this.sequence, message, tone, details };
  }
  dismiss(id = this.current?.id) {
    if (this.current?.id === id) this.current = null;
  }
}

export function provideNotices() {
  return setContext(key, new AdminNotices());
}
export function useNotices() {
  return getContext<AdminNotices>(key);
}
