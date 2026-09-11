/** Accept only internal paths, including NFC return paths; reject URL parser ambiguities. */
export function safeNextPath(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    value.includes(':') ||
    Array.from(value).some(
      (character) => character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127
    )
  ) {
    return '/';
  }
  return value;
}
