import { BrandEntrance } from './BrandSplash';

/** Branded route splash screen. Mustard yellow Paz branding. */
export function RouteLoading() {
  return (
    <div
      className="brand-splash brand-splash-visible"
      role="status"
      aria-busy="true"
      aria-label="טוענים"
    >
      <BrandEntrance />
    </div>
  );
}
