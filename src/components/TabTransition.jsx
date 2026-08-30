// Seraphim's tab-switch transition: two large wings sweep in from the
// sides and meet in the middle, hold for a beat while the new tab mounts
// underneath, then sweep back out. Only ever rendered while theme is
// "seraphim" - see App.jsx.
export default function TabTransition({ active }) {
  if (!active) return null;

  return (
    <div className="tab-transition" aria-hidden="true">
      <div className="tab-transition__wing tab-transition__wing--left" />
      <div className="tab-transition__wing tab-transition__wing--right" />
      <div className="tab-transition__glow" />
    </div>
  );
}
