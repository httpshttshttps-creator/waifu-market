import { useState } from "react";
import ArenaFighterCard from "./ArenaFighterCard.jsx";

export default function ArenaTeamPickerSheet({ teamType, cards, initialSelected, onSave, onClose }) {
  const [selected, setSelected] = useState(() => initialSelected.map((c) => c.user_character_id));
  const [saving, setSaving] = useState(false);
  const title = teamType === "attack" ? "⚔ Attack Team" : "🛡 Defense Team";

  function toggle(userCharacterId) {
    setSelected((prev) => {
      if (prev.includes(userCharacterId)) {
        return prev.filter((id) => id !== userCharacterId);
      }
      if (prev.length >= 3) return prev;
      return [...prev, userCharacterId];
    });
  }

  async function handleSave() {
    setSaving(true);
    await onSave(selected);
    setSaving(false);
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="confirm-sheet arena-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="confirm-sheet__handle" />
        <p className="confirm-sheet__title">{title}</p>
        <p className="confirm-sheet__subtitle">Pick up to 3 Fighter cards - {selected.length}/3 selected</p>

        {cards.length === 0 ? (
          <p className="empty-state empty-state--tight">
            You don't own any Fighter cards yet - collect one from the Market or Home tab first.
          </p>
        ) : (
          <div className="fighter-grid fighter-grid--scroll">
            {cards.map((card) => (
              <ArenaFighterCard
                key={card.user_character_id}
                card={card}
                selected={selected.includes(card.user_character_id)}
                onClick={() => toggle(card.user_character_id)}
              />
            ))}
          </div>
        )}

        <div className="confirm-sheet__actions">
          <button type="button" className="sheet-button sheet-button--cancel" onClick={onClose} disabled={saving}>
            ❌ Cancel
          </button>
          <button type="button" className="sheet-button sheet-button--confirm" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "✅ Save Team"}
          </button>
        </div>
      </div>
    </div>
  );
}
