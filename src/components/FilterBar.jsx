import { useEffect, useRef } from "react";
import { RARITY_NAMES } from "../data/rarities.js";

const RARITY_OPTIONS = ["All", ...RARITY_NAMES];

// A ripple that spreads from where the chip was pressed.
function rippleAt(event) {
  const chip = event.currentTarget;
  const rect = chip.getBoundingClientRect();
  const dot = document.createElement("span");
  dot.className = "filter-chip__ripple";
  const size = Math.max(rect.width, rect.height) * 2;
  Object.assign(dot.style, {
    width: `${size}px`,
    height: `${size}px`,
    left: `${(event.clientX || rect.left + rect.width / 2) - rect.left - size / 2}px`,
    top: `${(event.clientY || rect.top + rect.height / 2) - rect.top - size / 2}px`,
  });
  chip.appendChild(dot);
  dot.addEventListener("animationend", () => dot.remove());
}

export default function FilterBar({ activeRarity, onRarityChange, query, onQueryChange }) {
  const rowRef = useRef(null);
  const firstRender = useRef(true);

  // Slide the chosen chip to the middle of the row (it scrolls sideways).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const row = rowRef.current;
    const chip = row?.querySelector('[data-active="true"]');
    if (!row || !chip) return;
    row.scrollTo({ left: chip.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2, behavior: "smooth" });
  }, [activeRarity]);

  return (
    <div>
      <div className="filter-row" ref={rowRef}>
        {RARITY_OPTIONS.map((option, index) => (
          <button
            key={option}
            type="button"
            className="filter-chip"
            data-active={activeRarity === option}
            style={{ "--i": index }}
            onClick={(event) => {
              rippleAt(event);
              onRarityChange(option);
            }}
          >
            <span className="filter-chip__label">{option}</span>
          </button>
        ))}
      </div>

      <div className="search-box" data-filled={query ? "true" : undefined}>
        <svg className="search-box__icon" width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="2.2" />
          <path d="M15.5 15.5 L21 21" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          className="search-input"
          placeholder="Search by name or series..."
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
        {query && (
          <button type="button" className="search-box__clear" aria-label="Clear search" onClick={() => onQueryChange("")}>
            ✕
          </button>
        )}
        <span className="search-box__sweep" aria-hidden="true" />
      </div>
    </div>
  );
}
