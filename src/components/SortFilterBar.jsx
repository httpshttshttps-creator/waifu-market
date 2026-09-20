import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { runMorph } from "../fx/morph.js";
import { play } from "../audio/engine.js";
import { fetchProfileFilter, fetchFilterOptions, setProfileFilter, clearProfileFilter } from "../api/profileFilterApi.js";

const MODE_LABEL = { character: "Character", series: "Series", rarity: "Rarity" };

export default function SortFilterBar({ onFilterChange }) {
  const [filter, setFilter] = useState({ filter_type: null, filter_value: null });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mode, setMode] = useState("character");
  const [options, setOptions] = useState(null);
  // "morph": the button is still turning into the menu (panel hidden);
  // "ready": the panel is showing and building its content.
  const [phase, setPhase] = useState("ready");
  const [returning, setReturning] = useState(false);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const morphRef = useRef(null);
  const fromRef = useRef(null);

  useEffect(() => {
    fetchProfileFilter().then(setFilter);
  }, []);

  function openSheet() {
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const trigger = triggerRef.current;
    if (!reduceMotion && trigger) {
      const rect = trigger.getBoundingClientRect();
      const style = getComputedStyle(trigger);
      fromRef.current = {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        background: style.backgroundColor,
        border: style.borderColor,
        color: style.color,
        html: trigger.innerHTML,
      };
      setPhase("morph");
      play("morph");
    } else {
      setPhase("ready");
    }
    setSheetOpen(true);
    if (!options) fetchFilterOptions().then(setOptions);
  }

  // Run the button -> menu morph as soon as the (still hidden) panel exists.
  useLayoutEffect(() => {
    if (!sheetOpen || phase !== "morph") return undefined;
    const morph = morphRef.current;
    const panel = panelRef.current;
    if (!morph || !panel || !fromRef.current) {
      setPhase("ready");
      return undefined;
    }
    return runMorph({ morph, panel, from: fromRef.current, onDone: () => setPhase("ready") });
  }, [sheetOpen, phase]);

  // When the menu closes the button springs back.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !sheetOpen) {
      setReturning(true);
      const timer = setTimeout(() => setReturning(false), 600);
      return () => clearTimeout(timer);
    }
    wasOpen.current = sheetOpen;
    return undefined;
  }, [sheetOpen]);

  async function pick(filterType, value) {
    const result = await setProfileFilter(filterType, value);
    setFilter({ filter_type: result.filter_type, filter_value: result.filter_value });
    setSheetOpen(false);
    onFilterChange?.();
  }

  async function clear() {
    const result = await clearProfileFilter();
    setFilter({ filter_type: result.filter_type, filter_value: result.filter_value });
    setSheetOpen(false);
    onFilterChange?.();
  }

  const list = mode === "character" ? options?.characters : mode === "series" ? options?.series : options?.rarities;

  return (
    <>
      <div className="sort-bar">
        <button
          ref={triggerRef}
          type="button"
          className="sort-bar__trigger"
          data-away={sheetOpen || undefined}
          data-return={returning || undefined}
          data-click-sound="none"
          onClick={openSheet}
        >
          {filter.filter_type ? (
            <span>
              {MODE_LABEL[filter.filter_type]}: <strong>{filter.filter_value}</strong>
            </span>
          ) : (
            <span>Sort / Filter</span>
          )}
          <span className="sort-bar__chevron">⌄</span>
        </button>
        {filter.filter_type && (
          <button type="button" className="sort-bar__clear" onClick={clear} aria-label="Clear filter">
            ✕
          </button>
        )}
      </div>

      {sheetOpen &&
        createPortal(
        <div className="sheet-overlay sort-sheet-overlay" onClick={() => setSheetOpen(false)}>
          {phase === "morph" && fromRef.current && (
            <div
              ref={morphRef}
              className="sort-morph"
              aria-hidden="true"
              style={{
                left: fromRef.current.left,
                top: fromRef.current.top,
                width: fromRef.current.width,
                height: fromRef.current.height,
                background: fromRef.current.background,
                borderColor: fromRef.current.border,
                color: fromRef.current.color,
              }}
            >
              <span className="sort-morph__label" dangerouslySetInnerHTML={{ __html: fromRef.current.html }} />
            </div>
          )}
          <div
            ref={panelRef}
            className="confirm-sheet sort-sheet"
            data-morphing={phase === "morph" || undefined}
            data-ready={phase === "ready" || undefined}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="confirm-sheet__handle" />
            <p className="sort-sheet__title">Sort your constellation</p>

            <div className="sort-sheet__modes">
              {Object.entries(MODE_LABEL).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className="sort-sheet__mode"
                  data-active={mode === key || undefined}
                  onClick={() => setMode(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="sort-sheet__list">
              {!options ? (
                <p className="sort-sheet__hint">Loading…</p>
              ) : !list || list.length === 0 ? (
                <p className="sort-sheet__hint">Nothing to pick yet.</p>
              ) : (
                list.map((value, index) => (
                  <button
                    key={value}
                    type="button"
                    className="sort-sheet__option"
                    style={{ "--i": Math.min(index, 14) }}
                    data-active={filter.filter_type === mode && filter.filter_value === value}
                    onClick={() => pick(mode, value)}
                  >
                    {value}
                  </button>
                ))
              )}
            </div>

            <div className="confirm-sheet__actions">
              <button type="button" className="sheet-button" onClick={clear}>
                Clear filter
              </button>
              <button type="button" className="sheet-button sheet-button--confirm" onClick={() => setSheetOpen(false)}>
                Done
              </button>
            </div>
          </div>
        </div>,
        // Rendered outside .tab-header: that element keeps a transform/filter from the
        // tab-build animation, which makes position:fixed size against the header box
        // instead of the screen. .app-shell (not body) keeps the theme CSS variables.
        document.querySelector(".app-shell") || document.body
      )}
    </>
  );
}
