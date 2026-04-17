import { afterEach, describe, expect, it, vi } from 'vitest';

const mockRemark = vi.fn((id: string, factory: () => unknown) => [
  { key: { name: id } },
  factory(),
]);

vi.mock('@milkdown/utils', () => ({
  $remark: mockRemark,
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('remarkDirective', () => {
  it('should register shared remark directive with expected plugin', async () => {
    const { sharedRemarkDirective } = await import('./remarkDirective');
    const { default: remarkDirective } = await import('remark-directive');

    expect(Array.isArray(sharedRemarkDirective)).toBe(true);
    expect(sharedRemarkDirective).toHaveLength(2);
    expect(mockRemark).toHaveBeenCalledTimes(1);

    const [ctx, plugin] = sharedRemarkDirective;

    expect(ctx.key.name).toBe('sharedRemarkDirective');
    expect(plugin).toBe(remarkDirective);
  });
});
