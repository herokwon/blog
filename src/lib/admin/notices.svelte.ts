import { getContext, setContext } from 'svelte';

const key = Symbol('admin-notices');

/** One in-memory confirmed result, owned by the mounted Admin layout. */
class AdminNotices {
  current = $state<{ id: number; message: string } | null>(null);
  private sequence = 0;
  show(message: string) {
    this.current = { id: ++this.sequence, message };
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
