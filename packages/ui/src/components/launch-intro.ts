/** Matches the exit keyframe end in launch-intro.css; the timer only cleans up the DOM. */
export const LAUNCH_INTRO_MS = 1150;
export const LAUNCH_INTRO_KEY = 'ys-launch-intro';

/**
 * Runs before first paint: the intro plays once per app launch (sessionStorage lives for
 * the tab / standalone PWA process) and never on NFC attendance links or their login step.
 */
export const LAUNCH_INTRO_SCRIPT = `(function(){try{var k='${LAUNCH_INTRO_KEY}';var n='/nfc/';if(location.pathname.indexOf(n)===0||(new URLSearchParams(location.search).get('next')||'').indexOf(n)===0||sessionStorage.getItem(k)){document.documentElement.setAttribute('data-launch-intro','skip')}else{sessionStorage.setItem(k,'1')}}catch(e){}})()`;
