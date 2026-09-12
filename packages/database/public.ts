/** Explicit native/browser boundary. Never export server/client factories here. */
export { normalizePhone, passwordCredentials } from './src/login-identifier';
export type { Database } from '@yellowshifts/types';
export { getNativeWorkerContext, type WorkerContext } from './src/worker-context';
