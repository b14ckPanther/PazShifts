/** Only Phase 1 implemented routes are allowed; never accept an arbitrary URL. */
export function safeReturnPath(value: unknown): '/' {
  // Expand this explicit allowlist when schedule/NFC routes are implemented.
  void value;
  return '/';
}
