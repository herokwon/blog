import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { COOKIE_NAME, EXPIRES_IN_SECONDS } from '$lib/constants';
import { verifyPassword } from '$lib/server';
import {
  createMockD1,
  createMockRequestEvent,
  createMockUser,
} from '$lib/test-utils';

import { actions } from './+page.server';

vi.mock('$lib/server', () => ({
  verifyPassword: vi.fn(),
}));

describe('[Page Server] /login', () => {
  let mockD1: ReturnType<typeof createMockD1>;
  let mockAdminUser: ReturnType<typeof createMockUser>;
  let mockEvent: ReturnType<typeof createMockRequestEvent>;

  beforeEach(() => {
    mockD1 = createMockD1();
    mockAdminUser = createMockUser({
      role: 'admin',
    });
    mockEvent = createMockRequestEvent({
      method: 'POST',
      body: new URLSearchParams({
        username: mockAdminUser.username,
        password: mockAdminUser.password_hash,
      }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      db: mockD1.db,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 500 when database is not available', async () => {
    mockEvent = createMockRequestEvent({
      method: 'POST',
      body: new URLSearchParams({
        username: mockAdminUser.username,
        password: mockAdminUser.password_hash,
      }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const result = await actions.default(mockEvent.event);

    expect(result).toMatchObject({
      status: 500,
      data: { message: 'Database connection not available' },
    });
  });

  it('returns 401 when user is not found', async () => {
    mockD1.spies.first.mockResolvedValue(null);

    const result = await actions.default(mockEvent.event);

    expect(result).toMatchObject({
      status: 401,
      data: { message: 'Invalid username or password' },
    });
  });

  it('returns 401 when password is incorrect', async () => {
    vi.mocked(verifyPassword).mockResolvedValue(false);
    mockEvent = createMockRequestEvent({
      method: 'POST',
      body: new URLSearchParams({
        username: mockAdminUser.username,
        password: 'wrong_password',
      }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      db: mockD1.db,
    });

    const result = await actions.default(mockEvent.event);

    expect(result).toMatchObject({
      status: 401,
      data: { message: 'Invalid username or password' },
    });
  });

  it('returns 500 when session insertion fails', async () => {
    vi.mocked(verifyPassword).mockResolvedValue(true);
    mockD1.spies.first.mockResolvedValue(mockAdminUser);
    mockD1.spies.run.mockRejectedValue(new Error('DB error'));

    const result = await actions.default(mockEvent.event);

    expect(result).toMatchObject({
      status: 500,
      data: { message: 'Failed to create session' },
    });
  });

  it('sets session cookie and redirects to /admin on success', async () => {
    vi.mocked(verifyPassword).mockResolvedValue(true);
    mockD1.spies.first.mockResolvedValue(mockAdminUser);
    mockD1.spies.run.mockResolvedValue({ success: true });

    await expect(actions.default(mockEvent.event)).rejects.toMatchObject({
      status: 303,
      location: '/admin',
    });

    expect(mockEvent.spies.cookies.set).toHaveBeenCalledWith(
      COOKIE_NAME,
      expect.any(String),
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: EXPIRES_IN_SECONDS,
      }),
    );
  });
});
