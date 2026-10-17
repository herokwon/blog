import { describe, expect, it } from 'vitest';
import { AdminProcessing } from './processing.svelte';

describe('Admin processing ownership', () => {
  it('keeps another operation locked when one owner completes or unmounts', () => {
    const state = new AdminProcessing();
    const first = Symbol();
    const second = Symbol();
    state.update(first, true);
    state.update(second, true);
    state.update(first, false);
    expect(state.busy).toBe(true);
    expect(state.exclusive).toBe(false);
    state.update(second, false);
    expect(state.busy).toBe(false);
  });
  it('only locks the whole Admin area for an exclusive operation', () => {
    const state = new AdminProcessing();
    const save = Symbol();
    const logout = Symbol();
    state.update(save, true);
    state.update(logout, true, true);
    expect(state.exclusive).toBe(true);
    state.update(logout, false);
    expect(state.exclusive).toBe(false);
    expect(state.busy).toBe(true);
  });
  it('permits the verified exclusive owner to leave without unlocking controls', () => {
    const state = new AdminProcessing();
    const logout = Symbol();
    state.update(logout, true, true);
    state.allowLeave(Symbol());
    expect(state.leaving).toBe(false);
    state.allowLeave(logout);
    expect(state.leaving).toBe(true);
    expect(state.exclusive).toBe(true);
    state.update(logout, false);
    expect(state.leaving).toBe(false);
    state.update(logout, true, true);
    expect(state.leaving).toBe(false);
  });
});
