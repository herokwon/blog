import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { COOKIE_NAME } from '$lib/constants';
import {
  createMockD1,
  createMockRequestEvent,
  createMockUserSession,
} from '$lib/test-utils';

import { handle } from './hooks.server';

describe('[Hooks] handle', () => {
  let mockD1: ReturnType<typeof createMockD1>;
  let mockEvent: ReturnType<typeof createMockRequestEvent>;
  let resolve: Parameters<typeof handle>[0]['resolve'];

  beforeEach(() => {
    mockD1 = createMockD1();
    mockEvent = createMockRequestEvent({
      db: mockD1.db,
    });
    resolve = vi.fn().mockResolvedValue(new Response());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('session resolution', () => {
    it('sets locals to null and resolves when no session cookie is present', async () => {
      mockEvent.spies.cookies.get.mockReturnValue(null);

      await handle({ event: mockEvent.event, resolve });

      expect(mockEvent.event.locals.user).toBeNull();
      expect(mockEvent.event.locals.session).toBeNull();
      expect(resolve).toHaveBeenCalledWith(mockEvent.event);
    });

    it('sets locals to null and resolves when platform is unavailable', async () => {
      mockEvent = createMockRequestEvent();
      mockEvent.spies.cookies.get.mockReturnValue('session-id');

      await handle({ event: mockEvent.event, resolve });

      expect(mockEvent.spies.cookies.get).toHaveBeenCalledWith(COOKIE_NAME);
      expect(mockEvent.event.locals.user).toBeNull();
      expect(mockEvent.event.locals.session).toBeNull();
      expect(resolve).toHaveBeenCalledWith(mockEvent.event);
    });

    it('deletes cookie and keeps locals null when session is not found in DB', async () => {
      mockEvent.spies.cookies.get.mockReturnValue('no-sid');
      mockD1.spies.first.mockResolvedValueOnce(null);

      await handle({ event: mockEvent.event, resolve });

      expect(mockEvent.event.locals.user).toBeNull();
      expect(mockEvent.event.locals.session).toBeNull();
      expect(mockD1.spies.first).toHaveBeenCalled();
      expect(mockEvent.spies.cookies.delete).toHaveBeenCalledWith(COOKIE_NAME, {
        path: '/',
      });
    });

    it('deletes expired session from DB and clears cookie', async () => {
      const expired = Date.now() - 1000;
      const expiredSession = createMockUserSession({
        expiresAt: expired,
      });

      mockEvent.spies.cookies.get.mockReturnValue(expiredSession.sessionId);
      mockD1.spies.first.mockResolvedValue(expiredSession);
      mockD1.spies.run.mockResolvedValueOnce({ success: true });

      await handle({ event: mockEvent.event, resolve });

      expect(mockEvent.spies.cookies.get).toHaveBeenCalledWith(COOKIE_NAME);
      expect(mockD1.spies.first).toHaveBeenCalledTimes(1);
      expect(mockD1.spies.run).toHaveBeenCalledTimes(1);

      expect(mockEvent.event.locals.user).toBeNull();
      expect(mockEvent.event.locals.session).toBeNull();
      expect(mockEvent.spies.cookies.delete).toHaveBeenCalledWith(COOKIE_NAME, {
        path: '/',
      });
    });

    it('populates locals with user and session data for a valid session', async () => {
      const session = createMockUserSession();

      mockEvent.spies.cookies.get.mockReturnValue(session.sessionId);
      mockD1.spies.first.mockResolvedValueOnce(session);

      await handle({ event: mockEvent.event, resolve });

      expect(mockEvent.spies.cookies.get).toHaveBeenCalledWith(COOKIE_NAME);
      expect(mockD1.spies.first).toHaveBeenCalledTimes(1);

      expect(mockEvent.event.locals.user).toEqual({
        id: session.userId,
        username: session.username,
        role: session.role,
      });
      expect(mockEvent.event.locals.session).toEqual({
        id: session.sessionId,
        expiresAt: session.expiresAt,
      });
    });
  });

  describe('admin route guard', () => {
    beforeEach(() => {
      mockEvent = createMockRequestEvent({
        pathname: '/admin',
        db: mockD1.db,
      });
    });

    it('redirects to /login when unauthenticated user accesses /admin', async () => {
      mockEvent.spies.cookies.get.mockReturnValue(null);

      await expect(
        handle({ event: mockEvent.event, resolve }),
      ).rejects.toMatchObject({
        status: 303,
        location: '/login',
      });

      expect(mockEvent.spies.cookies.get).toHaveBeenCalledWith(COOKIE_NAME);
      expect(resolve).not.toHaveBeenCalled();
    });

    it('redirects to / when non-admin user accesses /admin', async () => {
      const userSession = createMockUserSession();

      mockEvent.spies.cookies.get.mockReturnValue(userSession.sessionId);
      mockD1.spies.first.mockResolvedValueOnce(userSession);

      await expect(
        handle({ event: mockEvent.event, resolve }),
      ).rejects.toMatchObject({
        status: 303,
        location: '/',
      });

      expect(mockEvent.spies.cookies.get).toHaveBeenCalledWith(COOKIE_NAME);
      expect(mockD1.spies.first).toHaveBeenCalled();
      expect(resolve).not.toHaveBeenCalled();
    });

    it('resolves when admin user accesses /admin', async () => {
      const adminSession = createMockUserSession({
        role: 'admin',
      });
      mockEvent.spies.cookies.get.mockReturnValue(adminSession.sessionId);
      mockD1.spies.first.mockResolvedValueOnce(adminSession);

      await handle({ event: mockEvent.event, resolve });

      expect(mockEvent.spies.cookies.get).toHaveBeenCalledWith(COOKIE_NAME);
      expect(mockD1.spies.first).toHaveBeenCalled();

      expect(resolve).toHaveBeenCalledWith(mockEvent.event);
    });

    it('resolves without redirect for non-admin routes', async () => {
      mockEvent = createMockRequestEvent({
        pathname: '/posts',
        db: mockD1.db,
      });

      await handle({ event: mockEvent.event, resolve });
      expect(resolve).toHaveBeenCalledWith(mockEvent.event);
    });
  });
});
