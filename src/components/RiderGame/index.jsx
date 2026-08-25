import { useState } from "react";
import GameCanvas from "./GameCanvas.jsx";
import { submitRiderRun } from "../../api/gameApi.js";

const STAGE_INTRO = "intro";
const STAGE_PLAYING = "playing";
const STAGE_RESULT = "result";

export default function RiderGame({ notify, onBalanceChange }) {
  const [stage, setStage] = useState(STAGE_INTRO);
  const [result, setResult] = useState(null);
  const [runKey, setRunKey] = useState(0);

  function startRun() {
    setResult(null);
    setStage(STAGE_PLAYING);
  }

  async function handleGameOver(score) {
    setStage(STAGE_RESULT);
    setResult({ score, reward: 0, loading: true });

    const outcome = await submitRiderRun(score);
    if (outcome.ok) {
      setResult({ score: outcome.score, reward: outcome.reward, loading: false });
      onBalanceChange?.(outcome.newBalance);
      if (outcome.reward > 0) notify?.("success");
    } else {
      setResult({ score, reward: 0, loading: false, failed: true });
    }
  }

  function playAgain() {
    setRunKey((key) => key + 1);
    startRun();
  }

  return (
    <div className="rider-game">
      {stage === STAGE_INTRO && (
        <div className="rider-game__intro">
          <h1 className="brand-title">🏍 NEON RIDER</h1>
          <p className="rider-game__intro-text">
            Hold anywhere on the screen to gas it. Let go to coast. Speed off ramps to clear
            gaps and traps - and don't land on your frame.
          </p>
          <p className="rider-game__intro-text rider-game__intro-text--dim">
            +1 VɎ for every 10 seconds you survive. No finish line - just go as far as you can.
          </p>
          <button type="button" className="sheet-button sheet-button--confirm rider-game__start" onClick={startRun}>
            ▶ Start ride
          </button>
        </div>
      )}

      {stage === STAGE_PLAYING && (
        <GameCanvas key={runKey} onGameOver={handleGameOver} onQuit={() => setStage(STAGE_INTRO)} />
      )}

      {stage === STAGE_RESULT && result && (
        <div className="sheet-overlay">
          <div className="confirm-sheet rider-game__result">
            <div className="confirm-sheet__handle" />
            <p className="rider-game__result-title">
              {result.failed ? "💥 Crashed!" : "🎉 Nice ride!"}
            </p>
            <div className="confirm-sheet__ledger">
              <div className="confirm-sheet__ledger-row">
                <span>Time survived</span>
                <span>{result.score}s</span>
              </div>
              <div className="confirm-sheet__ledger-row" data-emphasis="true">
                <span>Reward</span>
                <span>{result.loading ? "…" : `+${result.reward} VɎ`}</span>
              </div>
            </div>
            {result.failed && (
              <p className="confirm-sheet__error confirm-sheet__error--neutral">
                Couldn't reach the bot to record your reward - your run still counts locally.
              </p>
            )}
            <div className="confirm-sheet__actions">
              <button
                type="button"
                className="sheet-button sheet-button--cancel"
                onClick={() => setStage(STAGE_INTRO)}
              >
                Menu
              </button>
              <button type="button" className="sheet-button sheet-button--confirm" onClick={playAgain}>
                ↻ Play again
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
