/** Lightweight navigation placeholder. Startup branding belongs to BrandSplash. */
export function RouteLoading() {
  return (
    <main className="route-loading" aria-busy="true" aria-label="טוענים את המסך">
      <p role="status">טוענים את המסך…</p>
      <div aria-hidden="true">
        <div className="route-skeleton route-skeleton-title" />
        <div className="route-skeleton route-skeleton-subtitle" />
        <div className="route-skeleton route-skeleton-card" />
        <div className="route-skeleton route-skeleton-card" />
      </div>
    </main>
  );
}
