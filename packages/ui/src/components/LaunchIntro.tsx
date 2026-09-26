'use client';

import { useEffect, useState } from 'react';
import { preload } from 'react-dom';
import { BrandReveal, REVEAL_MARK, REVEAL_MONO } from './BrandReveal';
import { LAUNCH_INTRO_MS } from './launch-intro';
import '../styles/launch-intro.css';

/**
 * Visual-only launch reveal, rendered on the server so it is the first paint. The app
 * hydrates and fetches underneath; CSS alone fades the overlay, so a slow hydration
 * never extends it. This component only removes the finished overlay from the DOM.
 */
export function LaunchIntro() {
  const [done, setDone] = useState(false);
  preload(REVEAL_MONO, { as: 'image', fetchPriority: 'high' });
  preload(REVEAL_MARK, { as: 'image' });

  useEffect(() => {
    const skipped = document.documentElement.getAttribute('data-launch-intro') === 'skip';
    const timer = window.setTimeout(() => setDone(true), skipped ? 0 : LAUNCH_INTRO_MS + 200);
    return () => window.clearTimeout(timer);
  }, []);

  if (done) return null;
  return (
    <div
      className="launch-intro"
      aria-hidden="true"
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget) setDone(true);
      }}
    >
      <BrandReveal />
    </div>
  );
}
