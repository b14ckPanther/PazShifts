const listeners = new Set<(user: string) => void>();
export function onAttendanceChanged(listener: (user: string) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function attendanceChanged(user: string) {
  for (const listener of listeners) listener(user);
}
