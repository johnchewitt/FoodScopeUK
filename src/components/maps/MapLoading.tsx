/** Map loading overlay shown while the SDK chunk downloads and while the view initialises. */
export function MapLoading({ label = "Loading map" }: { label?: string }) {
  return (
    <div className="map-host" data-map-state="loading">
      <div className="map-overlay" aria-live="polite">
        <div className="map-overlay__card glass">
          <calcite-loader label={label} scale="m" />
          <p>{label}</p>
        </div>
      </div>
    </div>
  );
}
