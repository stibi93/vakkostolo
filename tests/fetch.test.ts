import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTimeoutFetch } from '../src/lib/fetch';

function abortableFetch() {
  return vi.fn<typeof fetch>((_input, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
  }));
}

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('időkorlátos fetch', () => {
  it('a megadott idő után TimeoutError-ral megszakítja a kérést', async () => {
    vi.useFakeTimers();
    const request = createTimeoutFetch(10_000, abortableFetch())('https://example.test');
    const outcome = expect(request).rejects.toMatchObject({ name: 'TimeoutError' });
    await vi.advanceTimersByTimeAsync(10_000);
    await outcome;
  });
  it('a hívó saját megszakítását továbbítja', async () => {
    const caller = new AbortController();
    const request = createTimeoutFetch(10_000, abortableFetch())('https://example.test', { signal: caller.signal });
    caller.abort(new Error('caller'));
    await expect(request).rejects.toThrow('caller');
  });
  it('AbortSignal.any nélkül is működik (iOS Safari 17.4 előtt)', async () => {
    vi.spyOn(AbortSignal, 'any').mockImplementation(() => { throw new TypeError('AbortSignal.any is not a function'); });
    const base = vi.fn<typeof fetch>().mockResolvedValue(new Response('ok'));
    const response = await createTimeoutFetch(10_000, base)('https://example.test', { method: 'POST' });
    expect(await response.text()).toBe('ok');
    expect(base.mock.calls[0][1]).toMatchObject({ method: 'POST' });
  });
});
