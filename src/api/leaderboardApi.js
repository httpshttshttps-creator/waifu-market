import { apiFetch, API_BASE, imageUrl } from "./marketApi.js";

// Small mock fallback so the tab still renders something sensible
// while iterating on layout without a live backend (mirrors the
// pattern marketApi.js already uses for the Market/Home tabs).
const MOCK_SERIES = [
  { series: "Nightfall Requiem", character_count: 42 },
  { series: "Aurora Veil", character_count: 37 },
  { series: "Crimson Atelier", character_count: 29 },
];
const MOCK_RICHEST = [
  { user_id: 1, display_name: "@shadowmint", balance: 18420 },
  { user_id: 2, display_name: "@lunarforge", balance: 15230 },
  { user_id: 3, display_name: "@velvetash", balance: 12110 },
];

export async function fetchTopSeries() {
  if (!API_BASE) return MOCK_SERIES;
  return apiFetch("/api/leaderboard/constellations");
}

export async function fetchSeriesCharacters(series) {
  if (!API_BASE) return [];
  const rows = await apiFetch(`/api/leaderboard/constellations/${encodeURIComponent(series)}`);
  return rows.map((row) => ({ ...row, imageUrl: imageUrl(row.image_file_id) }));
}

export async function fetchRichest() {
  if (!API_BASE) return MOCK_RICHEST;
  return apiFetch("/api/leaderboard/richest");
}
