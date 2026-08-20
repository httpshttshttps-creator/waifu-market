import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTelegram } from "./hooks/useTelegram.js";
import { fetchCharacters, fetchBalance, fetchProfile, purchaseCharacter } from "./api/marketApi.js";
import Header from "./components/Header.jsx";
import FilterBar from "./components/FilterBar.jsx";
import CardGrid from "./components/CardGrid.jsx";
import BuyConfirmSheet from "./components/BuyConfirmSheet.jsx";
import Toast from "./components/Toast.jsx";
import BottomNav from "./components/BottomNav.jsx";
import ProfileHeader from "./components/ProfileHeader.jsx";
import OwnedGrid from "./components/OwnedGrid.jsx";
import LeaderboardTab from "./components/LeaderboardTab.jsx";
import TaskTab from "./components/TaskTab.jsx";

export default function App() {
  const { haptic, notify } = useTelegram();

  const [activeTab, setActiveTab] = useState("home");

  const [characters, setCharacters] = useState([]);
  const [balance, setBalance] = useState(0);
  const [ownedIds, setOwnedIds] = useState(() => new Set());
  const [loading, setLoading] = useState(true);

  const [profile, setProfile] = useState({ name: "", cardCount: 0, cards: [] });
  const [profileLoading, setProfileLoading] = useState(true);

  const [activeRarity, setActiveRarity] = useState("All");
  const [query, setQuery] = useState("");

  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [purchasePending, setPurchasePending] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // Listings, balance, and the owned-cards collection all live in the
  // bot's database and can change from OUTSIDE this app at any moment -
  // someone /sell's a card, buys one from another chat's market view,
  // gets a spawn drop, a gift, or a /pay. So "fetch once on mount" isn't
  // enough: we re-pull everything whenever this app becomes the thing
  // the player is looking at again (first load, switching tabs, or
  // coming back from the Telegram chat) and on a light interval while
  // it stays open, so the Market and Home tabs never show stale data.
  const isFirstLoad = useRef(true);

  const refreshAll = useCallback(() => {
    return Promise.all([fetchCharacters(), fetchBalance(), fetchProfile()]).then(
      ([characterList, latestBalance, profileData]) => {
        setCharacters(characterList);
        setBalance(latestBalance);
        setProfile(profileData);
        setLoading(false);
        setProfileLoading(false);
      }
    );
  }, []);

  // Initial load.
  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Re-fetch every time the player switches tabs (skip the very first
  // render - the mount effect above already covers it).
  useEffect(() => {
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      return;
    }
    refreshAll();
  }, [activeTab, refreshAll]);

  // Re-fetch when the Mini App regains focus - e.g. the player switched
  // back to the bot chat, ran /sell or /pay, then reopened this window.
  useEffect(() => {
    function handleVisible() {
      if (document.visibilityState === "visible") refreshAll();
    }
    document.addEventListener("visibilitychange", handleVisible);
    window.addEventListener("focus", refreshAll);
    return () => {
      document.removeEventListener("visibilitychange", handleVisible);
      window.removeEventListener("focus", refreshAll);
    };
  }, [refreshAll]);

  // Light polling as a backstop while the app just sits open, so a
  // listing someone else buys or a card someone else lists still shows
  // up without the player having to do anything.
  useEffect(() => {
    const interval = setInterval(refreshAll, 15000);
    return () => clearInterval(interval);
  }, [refreshAll]);

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
      // Re-pull everything (not just profile) so the listing this card
      // came from also disappears from the Market tab right away.
      refreshAll();
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
        {activeTab === "home" && (
          <>
            <ProfileHeader name={profile.name} balance={balance} cardCount={profile.cardCount} />
            {profileLoading ? (
              <p className="empty-state">Loading your collection…</p>
            ) : (
              <OwnedGrid cards={profile.cards} />
            )}
          </>
        )}

        {activeTab === "market" && (
          <>
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
          </>
        )}

        {activeTab === "leaderboard" && <LeaderboardTab />}

        {activeTab === "task" && <TaskTab notify={notify} />}
      </div>

      <BottomNav active={activeTab} onChange={setActiveTab} />

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
