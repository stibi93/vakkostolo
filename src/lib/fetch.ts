/** Avoids AbortSignal.any, which iOS Safari only supports from 17.4. */
export function createTimeoutFetch(timeoutMs: number, baseFetch: typeof fetch = fetch): typeof fetch {
  return (input, init) => {
    const controller = new AbortController();
    const outer = init?.signal;
    if (outer?.aborted) controller.abort(outer.reason);
    else outer?.addEventListener('abort', () => controller.abort(outer.reason), { once: true });
    // Not cleared on response: the timeout also covers reading the body, like AbortSignal.timeout.
    setTimeout(() => controller.abort(new DOMException('A kérés időtúllépés miatt megszakadt.', 'TimeoutError')),
      timeoutMs);
    return baseFetch(input, { ...init, signal: controller.signal });
  };
}
