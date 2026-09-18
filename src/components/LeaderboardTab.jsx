import { useEffect, useRef, useState } from "react";
import { useTelegram } from "../hooks/useTelegram.js";
import { fetchTopCollectors, fetchRichest } from "../api/leaderboardApi.js";
import PlayerProfileSheet from "./PlayerProfileSheet.jsx";
import TaskPanel from "./TaskPanel.jsx";
import { SkeletonRowList } from "./SkeletonRow.jsx";

function PlayerRow({ rank, row, metric, index, onSelectPlayer }) {
  return (
    <button
      type="button"
      className="leaderboard-row leaderboard-row--flat leaderboard-row--player card-build"
      style={{ "--i": index }}
      onClick={() => onSelectPlayer(row.user_id)}
    >
      <span className="leaderboard-row__rank">#{rank}</span>
      <span className="leaderboard-row__avatar">{row.display_name.charAt(0).toUpperCase()}</span>
      <span className="leaderboard-row__title leaderboard-row__title--player">{row.display_name}</span>
      <span className="leaderboard-row__count">{metric}</span>
    </button>
  );
}

// Tasks lives here as its own sheet (opened by the full-width button
// above the Collection/VɎ toggle) rather than a standalone bottom-nav
// tab - that slot is Arena's now.
const PAGE_SIZE = 10;

export default function LeaderboardTab({ notify }) {
  const { haptic } = useTelegram();
  const [mode, setMode] = useState("collectors");
  const [collectors, setCollectors] = useState(null);
  const [richest, setRichest] = useState(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [showTasks, setShowTasks] = useState(false);
  // Reveals PAGE_SIZE (10) more rows every time the list is scrolled
  // near its bottom, instead of rendering the whole ranking at once -
  // each "page" is a full screenful of 10, and reaching the end of one
  // is what loads the next.
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // TEMP DEBUG - remove once the scroll bug is found. Shows the actual
  // measurements live so we can tell "no real overflow" apart from
  // "overflow exists but touch-drag doesn't move it" apart from
  // "programmatic scroll doesn't even work".
  const scrollRef = useRef(null);
  const [debugInfo, setDebugInfo] = useState("measuring…");
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    function update() {
      setDebugInfo(
        `scrollTop=${Math.round(el.scrollTop)} clientH=${el.clientHeight} scrollH=${el.scrollHeight} canScroll=${el.scrollHeight > el.clientHeight}`
      );
    }
    update();
    el.addEventListener("scroll", update);
    const interval = setInterval(update, 500);
    return () => {
      el.removeEventListener("scroll", update);
      clearInterval(interval);
    };
  }, [visibleCount, mode]);

  useEffect(() => {
    if (mode === "collectors" && collectors === null) {
      fetchTopCollectors().then(setCollectors);
    }
    if (mode === "richest" && richest === null) {
      fetchRichest().then(setRichest);
    }
  }, [mode, collectors, richest]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [mode]);

  function changeMode(nextMode) {
    haptic?.("light");
    setMode(nextMode);
  }

  function openTasks() {
    haptic?.("light");
    setShowTasks(true);
  }

  const fullList = mode === "collectors" ? collectors : richest;
  const visibleList = fullList ? fullList.slice(0, visibleCount) : null;
  const hasMore = Boolean(fullList) && visibleCount < fullList.length;

  function handleScroll(event) {
    if (!hasMore) return;
    const el = event.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 150) {
      setVisibleCount((count) => count + PAGE_SIZE);
    }
  }

  return (
    <div className="leaderboard-tab">
      <div className="tab-header">
        <h1 className="brand-title">🏆 LEADERBOARD & TASKS</h1>

        <button type="button" className="leaderboard-tasks-button" onClick={openTasks}>
          📋 Tasks
        </button>

        <div className="leaderboard-toggle">
          <button type="button" data-active={mode === "collectors"} onClick={() => changeMode("collectors")}>
            ✦ Collection
          </button>
          <button type="button" data-active={mode === "richest"} onClick={() => changeMode("richest")}>
            💰 VɎ
          </button>
        </div>

        {/* TEMP DEBUG BAR - remove once the scroll bug is found */}
        <div
          style={{
            fontFamily: "monospace",
            fontSize: "10px",
            color: "#0f0",
            background: "#000",
            padding: "4px 8px",
            marginTop: "6px",
            borderRadius: "4px",
            display: "flex",
            justifyContent: "space-between",
            gap: "6px",
          }}
        >
          <span>{debugInfo}</span>
          <button
            type="button"
            style={{ background: "#333", color: "#0f0", border: "none", borderRadius: "3px", padding: "0 6px" }}
            onClick={() => {
              if (scrollRef.current) scrollRef.current.scrollTop += 200;
            }}
          >
            scroll+200
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="leaderboard-list tab-scroll-body build-fade-only"
        onScroll={handleScroll}
      >
        {visibleList === null ? (
          <SkeletonRowList count={6} />
        ) : visibleList.length === 0 ? (
          <p className="empty-state">
            {mode === "collectors" ? "No collections to rank yet." : "Nobody has any VɎ yet."}
          </p>
        ) : (
          <>
            {visibleList.map((row, index) => (
              <PlayerRow
                key={row.user_id}
                rank={index + 1}
                row={row}
                metric={mode === "collectors" ? `${row.card_count} 🧑` : `${row.balance} VɎ`}
                index={index}
                onSelectPlayer={setSelectedPlayerId}
              />
            ))}
            {!hasMore && <p className="end-of-list">That's everyone — you've reached the end 🙂</p>}
          </>
        )}
      </div>

      <PlayerProfileSheet userId={selectedPlayerId} onClose={() => setSelectedPlayerId(null)} />

      {showTasks && (
        <div className="sheet-overlay" onClick={() => setShowTasks(false)}>
          <div className="confirm-sheet arena-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="confirm-sheet__handle" />
            <TaskPanel notify={notify} />
            <div className="confirm-sheet__actions">
              <button type="button" className="sheet-button sheet-button--confirm" onClick={() => setShowTasks(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
