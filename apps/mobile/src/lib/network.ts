/** Bound network waits without retrying authentication or mutations. */
export function createBoundedFetch(
  transport: typeof fetch = fetch,
  timeoutMs = 15000
): typeof fetch {
  return async (input, init) => {
    const controller = new AbortController();
    const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    const abort = () => controller.abort();
    if (signal?.aborted) controller.abort();
    else signal?.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(abort, timeoutMs);
    try {
      return await transport(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
    }
  };
}
