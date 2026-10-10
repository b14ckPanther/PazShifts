'use client';

import { useCallback, useEffect, useState } from 'react';
import { BellGlyph, CloseGlyph } from '@yellowshifts/icons';
import { removePushSubscriptionAction, savePushSubscriptionAction } from '../actions/push';
import './push-notifications.css';

/** unavailable: no push here; install: iPhone not opened from the home screen yet. */
type PushState = 'unavailable' | 'install' | 'default' | 'denied' | 'on' | 'off' | 'busy';

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const DISMISSED = 'ys-push-prompt-dismissed';
// Header and home both mount the hook; re-register the existing subscription once per load.
let synced = false;

function applicationServerKey(base64: string) {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

export function usePushNotifications() {
  const [state, setState] = useState<PushState>('unavailable');
  useEffect(() => {
    if (!PUBLIC_KEY) return;
    let live = true;
    (async () => {
      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        if (live) setState(ios && !standalone ? 'install' : 'unavailable');
        return;
      }
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) return;
      if (Notification.permission === 'denied') return live && setState('denied');
      const subscription = await registration.pushManager.getSubscription();
      if (subscription && Notification.permission === 'granted') {
        if (live) setState('on');
        if (!synced) {
          synced = true;
          void savePushSubscriptionAction(subscription.toJSON(), navigator.userAgent);
        }
        return;
      }
      if (live) setState(Notification.permission === 'granted' ? 'off' : 'default');
    })().catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const enable = useCallback(async () => {
    if (!PUBLIC_KEY) return;
    setState('busy');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return setState(permission === 'denied' ? 'denied' : 'default');
      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey(PUBLIC_KEY),
        }));
      const saved = await savePushSubscriptionAction(subscription.toJSON(), navigator.userAgent);
      setState(saved.ok ? 'on' : 'off');
    } catch {
      setState('default');
    }
  }, []);

  const disable = useCallback(async () => {
    setState('busy');
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await removePushSubscriptionAction(subscription.endpoint);
        await subscription.unsubscribe();
      }
    } finally {
      setState('off');
    }
  }, []);

  return { state, enable, disable };
}

const INSTALL_HINT =
  'כדי לקבל התראות באייפון: בתפריט השיתוף של Safari בחרו "הוספה למסך הבית", ופתחו את האפליקציה מהמסך הראשי.';

/** Menu drawer row: one switch for every worker notification on this phone. */
export function NotificationSetting() {
  const { state, enable, disable } = usePushNotifications();
  if (state === 'unavailable') return null;
  const on = state === 'on';
  return (
    <section className="push-setting" aria-label="התראות">
      <span className="push-setting-icon" aria-hidden="true">
        <BellGlyph size={20} variant={on ? 'solid' : 'duo'} />
      </span>
      <span className="push-setting-text">
        <strong>התראות</strong>
        <small>
          {state === 'denied'
            ? 'ההתראות חסומות. אפשר להפעיל אותן בהגדרות הטלפון.'
            : state === 'install'
              ? INSTALL_HINT
              : 'משמרות, זמינות ותזכורת לדיווח יציאה'}
        </small>
      </span>
      {state !== 'denied' && state !== 'install' && (
        <input
          type="checkbox"
          role="switch"
          className="ys-switch"
          aria-label="קבלת התראות"
          checked={on}
          disabled={state === 'busy'}
          onChange={() => void (on ? disable() : enable())}
        />
      )}
    </section>
  );
}

/** Home card: asks once, only while the worker has not decided yet. */
export function NotificationPrompt() {
  const { state, enable } = usePushNotifications();
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISSED) === '1');
    } catch {
      setDismissed(false);
    }
  }, []);
  if (dismissed || (state !== 'default' && state !== 'install' && state !== 'busy')) return null;
  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED, '1');
    } catch {
      /* Private mode: the card simply returns next visit. */
    }
  };
  return (
    <section className="push-prompt" aria-labelledby="push-prompt-title">
      <span className="push-prompt-icon" aria-hidden="true">
        <BellGlyph size={22} variant="solid" />
      </span>
      <span className="push-prompt-text">
        <strong id="push-prompt-title">תזכורות למשמרות</strong>
        <small>
          {state === 'install'
            ? INSTALL_HINT
            : 'נזכיר לך לפני משמרת, כשהסידור מתפרסם ולדווח יציאה.'}
        </small>
      </span>
      {state !== 'install' && (
        <button
          type="button"
          className="push-prompt-action"
          disabled={state === 'busy'}
          onClick={() => void enable()}
        >
          הפעלה
        </button>
      )}
      <button type="button" className="push-prompt-close" aria-label="סגירה" onClick={dismiss}>
        <CloseGlyph size={18} strokeWidth={2} />
      </button>
    </section>
  );
}
