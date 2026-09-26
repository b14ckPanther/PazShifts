/** Lightweight route placeholder: shape of a page, no splash, no delay. */
export function RouteSkeleton({ label = 'טוענים' }: { label?: string }) {
  return (
    <div className="route-loading" role="status" aria-busy="true" aria-label={label}>
      <span className="route-skeleton route-skeleton-title" />
      <span className="route-skeleton route-skeleton-subtitle" />
      <span className="route-skeleton route-skeleton-card" />
      <span className="route-skeleton route-skeleton-card" />
    </div>
  );
}
