import { useLayoutEffect, useRef } from "react";
import { getRarityTier } from "../data/rarities.js";
import { useExitPresence } from "../fx/exitPresence.js";
import { runRabbitExit } from "../fx/rabbitExit.js";

export default function SellConfirmSheet({ character, price, balance, pending, onConfirm, onCancel }) {
  // The parent nulls `character` the moment the sheet closes; keep what we
  // last showed so the sheet can play its closing animation (a rabbit drops
  // in and hops it shut - fx/rabbitExit.js) before it goes.
  const last = useRef({ character, price, balance });
  if (character) last.current = { character, price, balance };

  const { mounted, exiting, finish } = useExitPresence(Boolean(character));
  const overlayRef = useRef(null);
  const sheetRef = useRef(null);

  useLayoutEffect(() => {
    if (!exiting) return undefined;
    return runRabbitExit({ overlay: overlayRef.current, sheet: sheetRef.current, onDone: finish });
  }, [exiting, finish]);

  if (!mounted) return null;

  const shown = character ? { character, price, balance } : last.current;
  const tier = getRarityTier(shown.character.rarity);
  const [artFrom, artTo] = shown.character.gradient;
  const balanceAfter = shown.balance + shown.price;

  return (
    <div ref={overlayRef} className="sheet-overlay" data-exiting={exiting || undefined} onClick={onCancel}>
      <div ref={sheetRef} className="confirm-sheet" onClick={(event) => event.stopPropagation()}>
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
          </div>
        </div>

        <div className="confirm-sheet__ledger">
          <div className="confirm-sheet__ledger-row">
            <span>Sell price</span>
            <span>{shown.price} VɎ</span>
          </div>
          <div className="confirm-sheet__ledger-row">
            <span>Balance</span>
            <span>{shown.balance} VɎ</span>
          </div>
          <div className="confirm-sheet__ledger-row" data-emphasis="true">
            <span>After sale</span>
            <span>{balanceAfter} VɎ</span>
          </div>
        </div>

        <p className="confirm-sheet__error confirm-sheet__error--neutral">
          This sells one copy straight to the bot, not on the Market — it can't be undone.
        </p>

        <div className="confirm-sheet__actions">
          <button type="button" className="sheet-button sheet-button--cancel" onClick={onCancel}>
            ❌ Cancel
          </button>
          <button
            type="button"
            className="sheet-button sheet-button--confirm"
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? "Selling…" : "🏪 Confirm sale"}
          </button>
        </div>
      </div>
    </div>
  );
}
