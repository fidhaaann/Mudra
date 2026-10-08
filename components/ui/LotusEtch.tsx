/**
 * Static etched lotus pattern for a panel background. Same tile, colours and
 * shadow/highlight look as the loading screen's backdrop, but pre-composited
 * into one image (public/images/lotus-etched.webp: black shadow above, gold
 * catch-light below, antique-gold face) so it's a plain repeating background —
 * no CSS masks to re-rasterise when the form repaints.
 * Place inside a `relative isolate overflow-hidden` container.
 */

// Tile is 608×784; width-only sizing keeps the flower aspect ratio.
const LOTUS_TILE_W = "clamp(150px, 36vw, 280px)";

export function LotusEtch() {
  return (
    <div
      className="pointer-events-none absolute inset-0 -z-10"
      aria-hidden="true"
      style={{
        backgroundImage:
          "radial-gradient(ellipse at 50% 50%, rgba(17,11,11,0) 55%, rgba(10,6,6,0.6) 100%), url(/images/lotus-etched.webp)",
        backgroundSize: `100% 100%, ${LOTUS_TILE_W} auto`,
        backgroundRepeat: "no-repeat, repeat",
        backgroundPosition: "center, center",
      }}
    />
  );
}
