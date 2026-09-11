/** Israeli local numbers or explicit international E.164; never guess other countries. */
export function normalizePhone(value: string): string | null {
  let phone = value.trim().replace(/[\s().-]/g, '');
  if (/^0[2-9]\d{7,8}$/.test(phone)) phone = '+972' + phone.slice(1);
  if (phone.startsWith('00')) phone = '+' + phone.slice(2);
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null;
}

export function passwordCredentials(identifier: string, password: string) {
  const value = identifier.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return { email: value.toLowerCase(), password };
  const phone = normalizePhone(value);
  return phone ? { phone, password } : null;
}
