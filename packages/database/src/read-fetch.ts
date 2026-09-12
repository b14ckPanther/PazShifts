/** Retry only a transient, read-only PostgREST GET once. Never retry Auth or RPC/mutation calls. */
export function createReadFetch(origin: string, transport: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    const method = (
      init?.method || (input instanceof Request ? input.method : 'GET')
    ).toUpperCase();
    const url = new URL(input instanceof Request ? input.url : String(input));
    const signal = init?.signal || (input instanceof Request ? input.signal : undefined);
    const eligible =
      method === 'GET' &&
      url.origin === origin &&
      url.pathname.startsWith('/rest/v1/') &&
      !url.pathname.startsWith('/rest/v1/rpc/');
    for (let attempt = 0; ; attempt++) {
      try {
        const response = await transport(input, init);
        if (
          !eligible ||
          attempt > 0 ||
          signal?.aborted ||
          ![502, 503, 504].includes(response.status)
        )
          return response;
        await response.body?.cancel();
      } catch (error) {
        if (!eligible || attempt > 0 || signal?.aborted || !(error instanceof TypeError))
          throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
      if (signal?.aborted) throw signal.reason || new DOMException('Aborted', 'AbortError');
    }
  };
}
