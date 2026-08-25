import { apiFetch, API_BASE } from "./marketApi.js";

// The server re-derives the reward from the score (score // 10 currency
// units) and clamps it against real elapsed wall-clock time, so this call
// is a report of what happened, not a request that's trusted blindly.
export async function submitRiderRun(score) {
  if (!API_BASE) {
    const reward = Math.floor(score / 10);
    return { ok: true, score, reward, newBalance: 500 + reward };
  }

  try {
    const data = await apiFetch("/api/game/rider-finish", {
      method: "POST",
      body: JSON.stringify({ score }),
    });
    return { ok: true, score: data.score, reward: data.reward, newBalance: data.new_balance };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}
