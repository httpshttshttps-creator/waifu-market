import { useEffect, useState } from "react";
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

export default function LeaderboardTab({ notify }) {
  const { haptic } = useTelegram();
  const [mode, setMode] = useState("collectors");
  const [collectors, setCollectors] = useState(null);
  const [richest, setRichest] = useState(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [showTasks, setShowTasks] = useState(false);

  useEffect(() => {
    if (mode === "collectors" && collectors === null) {
      fetchTopCollectors().then(setCollectors);
    }
    if (mode === "richest" && richest === null) {
      fetchRichest().then(setRichest);
    }
  }, [mode, collectors, richest]);

  function changeMode(nextMode) {
    haptic?.("light");
    setMode(nextMode);
  }

  function openTasks() {
    haptic?.("light");
    setShowTasks(true);
  }

  const list = mode === "collectors" ? collectors : richest;

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
      </div>

      <div className="leaderboard-list tab-scroll-body build-fade-only">
        {list === null ? (
          <SkeletonRowList count={6} />
        ) : list.length === 0 ? (
          <p className="empty-state">
            {mode === "collectors" ? "No collections to rank yet." : "Nobody has any VɎ yet."}
          </p>
        ) : (
          <>
            {list.map((row, index) => (
              <PlayerRow
                key={row.user_id}
                rank={index + 1}
                row={row}
                metric={mode === "collectors" ? `${row.card_count} 🧑` : `${row.balance} VɎ`}
                index={index}
                onSelectPlayer={setSelectedPlayerId}
              />
            ))}
            <p className="end-of-list">That's everyone — you've reached the end 🙂</p>
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
