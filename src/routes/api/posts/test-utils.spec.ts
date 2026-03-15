import { describe, expect, it } from 'vitest';

import {
  createMockD1,
  createMockPost,
  createMockRequestEvent,
} from './test-utils';

describe('[Functions] test-utils', () => {
  it('createMockPost returns a post object with default values', () => {
    const post = createMockPost();

    expect(post).toHaveProperty('id');
    expect(post).toHaveProperty('title');
    expect(post).toHaveProperty('content');
    expect(post).toHaveProperty('createdAt');
    expect(post).toHaveProperty('updatedAt');
  });

  it('createMockD1 returns a mock D1 and spies are callable', async () => {
    const { db, spies } = createMockD1();

    expect(typeof db).toBe('object');

    spies.prepare('SELECT 1');
    spies.bind('x', 1);
    await spies.all();
    spies.run();

    expect(spies.prepare).toHaveBeenCalled();
    expect(spies.bind).toHaveBeenCalled();
    expect(spies.all).toHaveBeenCalled();
    expect(spies.run).toHaveBeenCalled();
  });

  it('createMockRequestEvent attaches platform env, ctx, caches', () => {
    const { db } = createMockD1();

    const event = createMockRequestEvent({
      url: '/posts',
      params: { id: '123' },
      db,
    });

    expect(event.platform?.env.BLOG_DB).toBe(db);
  });
});
