'use client';

import { useSyncExternalStore } from 'react';

// One visible-tab timer, regardless of team size. Only duration labels rerender each second.
const listeners = new Set<() => void>();
let now = 0;
let timer: ReturnType<typeof setInterval> | undefined;
function tick() {
  if (document.visibilityState === 'hidden') return;
  now = Date.now();
  listeners.forEach((listener) => listener());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    timer = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    tick();
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      clearInterval(timer);
      timer = undefined;
      document.removeEventListener('visibilitychange', tick);
    }
  };
}
const snapshot = () => now;
const serverSnapshot = () => 0;
export function ElapsedDuration({ start }: { start: string }) {
  const current = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  if (!current) return <>—</>;
  const seconds = Math.max(0, Math.floor((current - Date.parse(start)) / 1000));
  return (
    <>
      {[Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60]
        .map((n) => String(n).padStart(2, '0'))
        .join(':')}
    </>
  );
}
