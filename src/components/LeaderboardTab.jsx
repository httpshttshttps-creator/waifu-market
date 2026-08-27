import { useEffect, useState } from "react";
import { fetchTopCollectors, fetchRichest } from "../api/leaderboardApi.js";
import PlayerProfileSheet from "./PlayerProfileSheet.jsx";
import TaskPanel from "./TaskPanel.jsx";

function PlayerRow({ rank, row, metric, onSelectPlayer }) {
  return (
    <button
      type="button"
      className="leaderboard-row leaderboard-row--flat leaderboard-row--player"
      onClick={() => onSelectPlayer(row.user_id)}
    >
      <span className="leaderboard-row__rank">#{rank}</span>
      <span className="leaderboard-row__title leaderboard-row__title--player">{row.display_name}</span>
      <span className="leaderboard-row__count">{metric}</span>
    </button>
  );
}

// Tasks lives here as its own sheet (opened by the full-width button
// above the Collection/VɎ toggle) rather than a standalone bottom-nav
// tab - that slot is Arena's now.
export default function LeaderboardTab({ notify }) {
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

  return (
    <div className="leaderboard-tab">
      <h1 className="brand-title">🏆 LEADERBOARD & TASKS</h1>

      <button type="button" className="leaderboard-tasks-button" onClick={() => setShowTasks(true)}>
        📋 Tasks
      </button>

      <div className="leaderboard-toggle">
        <button type="button" data-active={mode === "collectors"} onClick={() => setMode("collectors")}>
          ✦ Collection
        </button>
        <button type="button" data-active={mode === "richest"} onClick={() => setMode("richest")}>
          💰 VɎ
        </button>
      </div>

      <div className="leaderboard-list">
        {mode === "collectors" ? (
          collectors === null ? (
            <p className="empty-state">Loading top collectors…</p>
          ) : collectors.length === 0 ? (
            <p className="empty-state">No collections to rank yet.</p>
          ) : (
            collectors.map((row, index) => (
              <PlayerRow
                key={row.user_id}
                rank={index + 1}
                row={row}
                metric={`${row.card_count} 🧑`}
                onSelectPlayer={setSelectedPlayerId}
              />
            ))
          )
        ) : richest === null ? (
          <p className="empty-state">Loading richest players…</p>
        ) : richest.length === 0 ? (
          <p className="empty-state">Nobody has any VɎ yet.</p>
        ) : (
          richest.map((row, index) => (
            <PlayerRow
              key={row.user_id}
              rank={index + 1}
              row={row}
              metric={`${row.balance} VɎ`}
              onSelectPlayer={setSelectedPlayerId}
            />
          ))
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
