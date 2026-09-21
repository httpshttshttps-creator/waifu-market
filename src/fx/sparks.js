// A little burst of sparks from a button: used by the empty-state buttons
// ("Clear filters", "Browse the Market"). The dots live in .app-shell so
// they pick up the theme colours, and outlive the button (which unmounts
// the instant it's pressed).

const rand = (a, b) => a + Math.random() * (b - a);

export function sparkBurst(rect) {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;
  const host = document.querySelector(".app-shell") || document.body;
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const made = [];

  const ring = document.createElement("div");
  ring.className = "cta-spark-ring";
  Object.assign(ring.style, { left: `${cx - 20}px`, top: `${cy - 20}px` });
  host.appendChild(ring);
  made.push(ring);
  ring.animate(
    [
      { transform: "scale(0.4)", opacity: 0.8 },
      { transform: `scale(${Math.max(4, rect.width / 14)})`, opacity: 0 },
    ],
    { duration: 520, easing: "cubic-bezier(0.1, 0.7, 0.3, 1)", fill: "forwards" }
  );

  for (let i = 0; i < 16; i++) {
    const dot = document.createElement("div");
    dot.className = i % 3 === 0 ? "cta-spark cta-spark--white" : "cta-spark";
    const size = rand(3, 7);
    Object.assign(dot.style, {
      left: `${cx - size / 2 + rand(-rect.width * 0.35, rect.width * 0.35)}px`,
      top: `${cy - size / 2 + rand(-rect.height * 0.2, rect.height * 0.2)}px`,
      width: `${size}px`,
      height: `${size}px`,
    });
    host.appendChild(dot);
    made.push(dot);
    const angle = rand(0, Math.PI * 2);
    const dist = rand(40, 120);
    dot.animate(
      [
        { transform: "translate(0, 0) scale(1)", opacity: 1 },
        { transform: `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist - 14}px) scale(0.3)`, opacity: 0 },
      ],
      { duration: rand(420, 780), easing: "cubic-bezier(0.1, 0.7, 0.3, 1)", fill: "forwards" }
    );
  }
  setTimeout(() => made.forEach((el) => el.remove()), 900);
}
