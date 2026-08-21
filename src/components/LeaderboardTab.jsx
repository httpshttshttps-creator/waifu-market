import { useEffect, useState } from "react";
import { fetchTopSeries, fetchSeriesCharacters, fetchRichest } from "../api/leaderboardApi.js";
import { getRarityTier } from "../data/rarities.js";
import PlayerProfileSheet from "./PlayerProfileSheet.jsx";

function SeriesRow({ rank, row }) {
  const [expanded, setExpanded] = useState(false);
  const [characters, setCharacters] = useState(null);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (!expanded && characters === null) {
      setLoading(true);
      const rows = await fetchSeriesCharacters(row.series);
      setCharacters(rows);
      setLoading(false);
    }
    setExpanded((prev) => !prev);
  }

  return (
    <div className="leaderboard-row" data-expanded={expanded}>
      <button type="button" className="leaderboard-row__head" onClick={toggle}>
        <span className="leaderboard-row__rank">#{rank}</span>
        <span className="leaderboard-row__title">{row.series}</span>
        <span className="leaderboard-row__count">{row.character_count} 🧑</span>
        <span className="leaderboard-row__chevron">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="leaderboard-row__body">
          {loading ? (
            <p className="empty-state empty-state--tight">Loading characters…</p>
          ) : characters.length === 0 ? (
            <p className="empty-state empty-state--tight">No characters found in this series.</p>
          ) : (
            <ul className="series-character-list">
              {characters.map((character) => {
                const tier = getRarityTier(character.rarity_name);
                return (
                  <li key={character.id} className="series-character-list__item">
                    <span className="rarity-chip" style={{ background: tier.chipBackground ?? tier.accent }}>
                      {tier.label}
                    </span>
                    <span>{character.name}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function RichestRow({ rank, row, onSelectPlayer }) {
  return (
    <button
      type="button"
      className="leaderboard-row leaderboard-row--flat leaderboard-row--player"
      onClick={() => onSelectPlayer(row.user_id)}
    >
      <span className="leaderboard-row__rank">#{rank}</span>
      <span className="leaderboard-row__title leaderboard-row__title--player">{row.display_name}</span>
      <span className="leaderboard-row__count">{row.balance} VɎ</span>
    </button>
  );
}

export default function LeaderboardTab() {
  const [mode, setMode] = useState("constellations");
  const [series, setSeries] = useState(null);
  const [richest, setRichest] = useState(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);

  useEffect(() => {
    if (mode === "constellations" && series === null) {
      fetchTopSeries().then(setSeries);
    }
    if (mode === "richest" && richest === null) {
      fetchRichest().then(setRichest);
    }
  }, [mode, series, richest]);

  return (
    <div className="leaderboard-tab">
      <h1 className="brand-title">🏆 LEADERBOARD</h1>

      <div className="leaderboard-toggle">
        <button
          type="button"
          data-active={mode === "constellations"}
          onClick={() => setMode("constellations")}
        >
          ✦ Constellation
        </button>
        <button
          type="button"
          data-active={mode === "richest"}
          onClick={() => setMode("richest")}
        >
          💰 VɎ
        </button>
      </div>

      <div className="leaderboard-list">
        {mode === "constellations" ? (
          series === null ? (
            <p className="empty-state">Loading top series…</p>
          ) : series.length === 0 ? (
            <p className="empty-state">No series to rank yet.</p>
          ) : (
            series.map((row, index) => <SeriesRow key={row.series} rank={index + 1} row={row} />)
          )
        ) : richest === null ? (
          <p className="empty-state">Loading richest players…</p>
        ) : richest.length === 0 ? (
          <p className="empty-state">Nobody has any VɎ yet.</p>
        ) : (
          richest.map((row, index) => (
            <RichestRow key={row.user_id} rank={index + 1} row={row} onSelectPlayer={setSelectedPlayerId} />
          ))
        )}
      </div>

      <PlayerProfileSheet userId={selectedPlayerId} onClose={() => setSelectedPlayerId(null)} />
    </div>
  );
}
