/** Public, dependency-free contract. No database client or server credentials. */
export const stationRoles = ['owner', 'manager', 'operations', 'other'] as const;
export type StationRole = (typeof stationRoles)[number];
export type StationInterest = {
  full_name: string;
  phone: string;
  station_name_or_number: string;
  city: string;
  email: string;
  role: StationRole | '';
  notes: string;
};
export type InterestErrors = Partial<Record<keyof StationInterest, string>>;
export const emptyInterest: StationInterest = {
  full_name: '',
  phone: '',
  station_name_or_number: '',
  city: '',
  email: '',
  role: '',
  notes: '',
};
export function validateStationInterest(
  input: unknown
): { ok: true; value: StationInterest } | { ok: false; errors: InterestErrors } {
  const errors: InterestErrors = {};
  const data = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const value = { ...emptyInterest };
  const limits = {
    full_name: 80,
    phone: 30,
    station_name_or_number: 120,
    city: 80,
    email: 254,
    role: 20,
    notes: 1000,
  };
  for (const key of Object.keys(limits) as (keyof StationInterest)[]) {
    const raw = data[key] ?? '';
    if (
      typeof raw !== 'string' ||
      raw.length > limits[key] ||
      // eslint-disable-next-line no-control-regex
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(raw)
    ) {
      errors[key] = 'בדקו את התוכן ואת אורך השדה.';
      continue;
    }
    Object.assign(value, { [key]: raw.trim().replace(/\s+/g, ' ') });
  }
  for (const key of ['full_name', 'station_name_or_number', 'city'] as const) {
    if (value[key].length < 2) errors[key] = 'נדרשים לפחות שני תווים.';
  }
  value.phone = value.phone.replace(/[\s()-]/g, '').replace(/^\+972/, '0');
  if (!/^05\d{8}$/.test(value.phone)) errors.phone = 'הזינו מספר נייד ישראלי תקין.';
  if (value.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email))
    errors.email = 'בדקו את כתובת האימייל.';
  if (value.role && !stationRoles.includes(value.role)) errors.role = 'בחרו תפקיד מהרשימה.';
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value };
}
