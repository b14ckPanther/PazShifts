import type { CSSProperties } from 'react';
import '../styles/brand-reveal.css';

export const REVEAL_MONO = '/brand/logomark-mono.png';
export const REVEAL_MARK = '/brand/logomark.png';
const DEPTH_LAYERS = [1, 2, 3, 4, 5, 6, 7, 8];

/** The 3D logomark reveal shared by the launch intro and the navigation splash. */
export function BrandReveal() {
  return (
    <div className="brand-reveal" aria-hidden="true">
      <div className="brand-reveal__light" />
      <div className="brand-reveal__stage">
        <div className="brand-reveal__shadow" />
        <div className="brand-reveal__mark">
          {DEPTH_LAYERS.map((i) => (
            <img
              key={i}
              className="brand-reveal__layer"
              style={{ '--i': i } as CSSProperties}
              src={REVEAL_MONO}
              alt=""
              draggable={false}
            />
          ))}
          <img className="brand-reveal__layer" src={REVEAL_MONO} alt="" draggable={false} />
          <img
            className="brand-reveal__layer brand-reveal__face"
            src={REVEAL_MARK}
            alt=""
            draggable={false}
          />
          <span className="brand-reveal__sheen">
            <span />
          </span>
        </div>
      </div>
    </div>
  );
}
