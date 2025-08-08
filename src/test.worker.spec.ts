import {
  createExecutionContext,
  env,
  waitOnExecutionContext,
} from 'cloudflare:test';
import { vi } from 'vitest';

import workers, { type ResponseData } from './test.worker';

describe('Worker 테스트', () => {
  it('기본 응답 테스트입니다.', async () => {
    const request = new Request('https://example.com');
    const ctx = createExecutionContext();

    const response = await workers.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const text = await response.text();

    expect(text).toBe('Hello World!');
  });

  it('404 에러 응답 테스트', async () => {
    const request = new Request('https://example.com/404');
    const ctx = createExecutionContext();

    const response = await workers.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(404);
    const text = await response.text();
    expect(text).toBe('Not found');
  });

  it('환경 변수를 활용한 debug 응답 테스트', async () => {
    const request = new Request('https://example.com/debug');
    const ctx = createExecutionContext();

    const response = await workers.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    if (env.NEXTJS_ENV !== 'production') {
      // 개발 및 테스트 환경 응답
      expect(response.status).toBe(200);
      const data: ResponseData = await response.json();

      expect(data.environment).toBe(env.NEXTJS_ENV);
      expect(data.url).toBe('https://example.com/debug');
      expect(data.method).toBe('GET');
    } else {
      // Production 환경 응답
      expect(response.status).toBe(200);

      const text = await response.text();
      expect(text).toBe('Hello World!');
    }
  });

  it('POST 요청 처리 테스트', async () => {
    const request = new Request('https://example.com/debug', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ test: 'data' }),
    });
    const ctx = createExecutionContext();

    const response = await workers.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    if (env.NEXTJS_ENV !== 'production') {
      expect(response.status).toBe(200);

      const data: ResponseData = await response.json();
      expect(data.method).toBe('POST');
      expect(data.environment).toBe(env.NEXTJS_ENV);
    }
  });

  it('ExecutionContext 백그라운드 작업 테스트', async () => {
    // console.log를 스파이로 감시
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const request = new Request('https://example.com/test-path');
    const ctx = createExecutionContext();

    const response = await workers.fetch(request, env, ctx);

    // ctx.waitUntil()로 등록된 백그라운드 작업 완료 대기
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);

    // 백그라운드에서 로깅이 실행되었는지 확인
    expect(consoleSpy).toHaveBeenCalledWith('Request: GET /test-path');

    consoleSpy.mockRestore();
  });
});
