import { getContext, setContext } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';

const key = Symbol('admin-processing');
export class AdminProcessing {
  private owners = new SvelteMap<symbol, boolean>();
  private leavingOwner?: symbol;
  get leaving() {
    return (
      this.leavingOwner !== undefined &&
      this.owners.get(this.leavingOwner) === true
    );
  }
  allowLeave(owner: symbol) {
    if (this.owners.get(owner) === true) this.leavingOwner = owner;
  }
  get busy() {
    return this.owners.size > 0;
  }
  get exclusive() {
    return [...this.owners.values()].some(Boolean);
  }
  update(owner: symbol, busy: boolean, exclusive = false) {
    if (busy) this.owners.set(owner, exclusive);
    else {
      this.owners.delete(owner);
      if (this.leavingOwner === owner) this.leavingOwner = undefined;
    }
  }
}
export function provideProcessing() {
  return setContext(key, new AdminProcessing());
}
export function useProcessing() {
  return getContext<AdminProcessing>(key);
}
