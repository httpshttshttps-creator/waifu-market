import { useEffect, useRef } from "react";
import { getRarityTier } from "../data/rarities.js";
import { useExitPresence } from "../fx/exitPresence.js";

const EXIT_MS = 300;

export default function BuyConfirmSheet({ character, balance, pending, onConfirm, onCancel }) {
  // Keep the last card shown so the sheet can slide away (a short, simple
  // exit) instead of vanishing the instant the parent clears it.
  const last = useRef({ character, balance });
  if (character) last.current = { character, balance };

  const { mounted, exiting, finish } = useExitPresence(Boolean(character));

  useEffect(() => {
    if (!exiting) return undefined;
    const timer = setTimeout(finish, EXIT_MS + 20);
    return () => clearTimeout(timer);
  }, [exiting, finish]);

  if (!mounted) return null;

  const shown = character ? { character, balance } : last.current;
  const tier = getRarityTier(shown.character.rarity);
  const [artFrom, artTo] = shown.character.gradient;
  const affordable = shown.balance >= shown.character.price;
  const balanceAfter = shown.balance - shown.character.price;

  return (
    <div className="sheet-overlay" data-exit={exiting ? "simple" : undefined} onClick={onCancel}>
      <div className="confirm-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="confirm-sheet__handle" />

        <div className="confirm-sheet__row">
          <div
            className="confirm-sheet__thumb"
            style={{ "--art-from": artFrom, "--art-to": artTo }}
          >
            {shown.character.name.charAt(0)}
          </div>
          <div>
            <p className="confirm-sheet__title">{shown.character.name}</p>
            <p className="confirm-sheet__subtitle">
              {shown.character.series} · {tier.label}
            </p>
            <p className="confirm-sheet__subtitle">Seller {shown.character.seller}</p>
          </div>
        </div>

        <div className="confirm-sheet__ledger">
          <div className="confirm-sheet__ledger-row">
            <span>Price</span>
            <span>{shown.character.price} VɎ</span>
          </div>
          <div className="confirm-sheet__ledger-row">
            <span>Balance</span>
            <span>{shown.balance} VɎ</span>
          </div>
          <div className="confirm-sheet__ledger-row" data-emphasis="true">
            <span>Left after</span>
            <span>{affordable ? balanceAfter : "—"} VɎ</span>
          </div>
        </div>

        {!affordable && <p className="confirm-sheet__error">ʏᴏᴜ ᴅᴏɴ'ᴛ ʜᴀᴠᴇ ᴇɴᴏᴜɢʜ VɎ</p>}

        <div className="confirm-sheet__actions">
          <button type="button" className="sheet-button sheet-button--cancel" onClick={onCancel}>
            ❌ Cancel
          </button>
          <button
            type="button"
            className="sheet-button sheet-button--confirm"
            disabled={!affordable || pending}
            onClick={onConfirm}
          >
            {pending ? "Buying…" : "✅ Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
