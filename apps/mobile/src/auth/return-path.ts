/** Explicit internal destination only; never redirect to caller-supplied URLs. */
export function safeReturnPath(value: unknown): '/' | '/attendance' {
  return value === 'attendance' ? '/attendance' : '/';
}
