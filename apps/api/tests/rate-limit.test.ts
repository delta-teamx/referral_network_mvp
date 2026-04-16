import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { rateLimit } from '../src/middleware/rateLimit.js';

function makeReq(ip = '1.1.1.1'): Request {
  return {
    ip,
    headers: {},
    socket: { remoteAddress: ip },
  } as unknown as Request;
}

function makeRes(): Response {
  const headers: Record<string, string> = {};
  return {
    setHeader: (k: string, v: string) => {
      headers[k] = v;
    },
    getHeader: (k: string) => headers[k],
    _headers: headers,
  } as unknown as Response & { _headers: Record<string, string> };
}

describe('rateLimit middleware', () => {
  it('allows up to `max` requests in the window', () => {
    const mw = rateLimit({ windowMs: 1_000, max: 3, key: 'test-allow' });
    const next = vi.fn<NextFunction>();
    for (let i = 0; i < 3; i++) mw(makeReq(), makeRes(), next);
    expect(next).toHaveBeenCalledTimes(3);
    for (const call of next.mock.calls) expect(call[0]).toBeUndefined();
  });

  it('blocks the (max+1)th request with a 429 AppError', () => {
    const mw = rateLimit({ windowMs: 1_000, max: 2, key: 'test-block' });
    const next = vi.fn<NextFunction>();
    mw(makeReq('2.2.2.2'), makeRes(), next);
    mw(makeReq('2.2.2.2'), makeRes(), next);
    mw(makeReq('2.2.2.2'), makeRes(), next);

    const thirdCall = next.mock.calls[2]?.[0] as { statusCode?: number } | undefined;
    expect(thirdCall).toBeDefined();
    expect(thirdCall?.statusCode).toBe(429);
  });

  it('isolates buckets by IP', () => {
    const mw = rateLimit({ windowMs: 1_000, max: 1, key: 'test-isolate' });
    const next = vi.fn<NextFunction>();

    mw(makeReq('3.3.3.3'), makeRes(), next);
    mw(makeReq('4.4.4.4'), makeRes(), next);

    // Both first-for-their-IP, both should pass without an error arg.
    expect(next.mock.calls[0]?.[0]).toBeUndefined();
    expect(next.mock.calls[1]?.[0]).toBeUndefined();
  });

  it('honours the skip predicate', () => {
    const mw = rateLimit({
      windowMs: 1_000,
      max: 1,
      key: 'test-skip',
      skip: () => true,
    });
    const next = vi.fn<NextFunction>();
    for (let i = 0; i < 5; i++) mw(makeReq(), makeRes(), next);
    expect(next).toHaveBeenCalledTimes(5);
    for (const call of next.mock.calls) expect(call[0]).toBeUndefined();
  });

  it('sets X-RateLimit-Remaining header', () => {
    const mw = rateLimit({ windowMs: 1_000, max: 5, key: 'test-header' });
    const next = vi.fn<NextFunction>();
    const res = makeRes() as ReturnType<typeof makeRes> & { _headers: Record<string, string> };
    mw(makeReq('5.5.5.5'), res, next);
    expect(res._headers['X-RateLimit-Limit']).toBe('5');
    expect(res._headers['X-RateLimit-Remaining']).toBe('4');
  });
});
