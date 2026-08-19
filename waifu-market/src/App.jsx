import { useEffect, useMemo, useState } from "react";
import { useTelegram } from "./hooks/useTelegram.js";
import { fetchCharacters, fetchBalance, purchaseCharacter } from "./api/marketApi.js";
import Header from "./components/Header.jsx";
import FilterBar from "./components/FilterBar.jsx";
import CardGrid from "./components/CardGrid.jsx";
import BuyConfirmSheet from "./components/BuyConfirmSheet.jsx";
import Toast from "./components/Toast.jsx";

export default function App() {
  const { haptic, notify } = useTelegram();

  const [characters, setCharacters] = useState([]);
  const [balance, setBalance] = useState(0);
  const [ownedIds, setOwnedIds] = useState(() => new Set());
  const [loading, setLoading] = useState(true);

  const [activeRarity, setActiveRarity] = useState("All");
  const [query, setQuery] = useState("");

  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [purchasePending, setPurchasePending] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchCharacters(), fetchBalance()]).then(([characterList, startingBalance]) => {
      if (cancelled) return;
      setCharacters(characterList);
      setBalance(startingBalance);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleCharacters = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return characters.filter((character) => {
      const matchesRarity = activeRarity === "All" || character.rarity === activeRarity;
      const matchesQuery =
        !normalizedQuery ||
        character.name.toLowerCase().includes(normalizedQuery) ||
        character.series.toLowerCase().includes(normalizedQuery);
      return matchesRarity && matchesQuery;
    });
  }, [characters, activeRarity, query]);

  function openConfirm(character) {
    haptic("light");
    setSelectedCharacter(character);
  }

  function closeConfirm() {
    if (purchasePending) return;
    setSelectedCharacter(null);
  }

  async function confirmPurchase() {
    if (!selectedCharacter) return;
    setPurchasePending(true);
    const result = await purchaseCharacter(selectedCharacter.id, balance);

    if (result.ok) {
      setBalance(result.newBalance);
      setOwnedIds((prev) => new Set(prev).add(selectedCharacter.id));
      setToastMessage(`✅ ${selectedCharacter.name} added to your collection`);
      notify("success");
    } else {
      setToastMessage("ʏᴏᴜ ᴅᴏɴ'ᴛ ʜᴀᴠᴇ ᴇɴᴏᴜɢʜ VɎ");
      notify("error");
    }

    setPurchasePending(false);
    setSelectedCharacter(null);
  }

  return (
    <div className="app-shell">
      <div className="app-shell__inner">
        <Header balance={balance} />
        <FilterBar
          activeRarity={activeRarity}
          onRarityChange={setActiveRarity}
          query={query}
          onQueryChange={setQuery}
        />

        {loading ? (
          <p className="empty-state">Loading the stall…</p>
        ) : (
          <CardGrid
            characters={visibleCharacters}
            ownedIds={ownedIds}
            balance={balance}
            onBuy={openConfirm}
          />
        )}
      </div>

      <BuyConfirmSheet
        character={selectedCharacter}
        balance={balance}
        pending={purchasePending}
        onConfirm={confirmPurchase}
        onCancel={closeConfirm}
      />

      <Toast message={toastMessage} onDone={() => setToastMessage("")} />
    </div>
  );
}
