import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTelegram } from "./hooks/useTelegram.js";
import {
  fetchCharacters,
  fetchBalance,
  fetchProfile,
  purchaseCharacter,
  fetchSellPrices,
  sellCharacterToBot,
  setTheme as apiSetTheme,
} from "./api/marketApi.js";
import Header from "./components/Header.jsx";
import FilterBar from "./components/FilterBar.jsx";
import CardGrid from "./components/CardGrid.jsx";
import BuyConfirmSheet from "./components/BuyConfirmSheet.jsx";
import SellConfirmSheet from "./components/SellConfirmSheet.jsx";
import SettingsSheet from "./components/SettingsSheet.jsx";
import Toast from "./components/Toast.jsx";
import BottomNav from "./components/BottomNav.jsx";
import ProfileHeader from "./components/ProfileHeader.jsx";
import OwnedGrid from "./components/OwnedGrid.jsx";
import LeaderboardTab from "./components/LeaderboardTab.jsx";
import ArenaTab from "./components/ArenaTab.jsx";
import RiderGame from "./components/RiderGame/index.jsx";
import CardRevealOverlay from "./components/CardRevealOverlay.jsx";
import TabTransition from "./components/TabTransition.jsx";
import SeraphimHome from "./components/SeraphimHome.jsx";
import { SkeletonGrid } from "./components/SkeletonCard.jsx";

export default function App() {
  const { haptic, notify } = useTelegram();

  const [activeTab, setActiveTab] = useState("home");
  const [transitioning, setTransitioning] = useState(false);
  const pendingTabRef = useRef(null);

  const [characters, setCharacters] = useState([]);
  const [balance, setBalance] = useState(0);
  const [ownedIds, setOwnedIds] = useState(() => new Set());
  const [loading, setLoading] = useState(true);

  const [profile, setProfile] = useState({ name: "", cardCount: 0, cards: [] });
  const [profileLoading, setProfileLoading] = useState(true);
  const [sellPrices, setSellPrices] = useState({});

  const [activeRarity, setActiveRarity] = useState("All");
  const [query, setQuery] = useState("");

  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [purchasePending, setPurchasePending] = useState(false);
  const [sellCandidate, setSellCandidate] = useState(null);
  const [sellPending, setSellPending] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [revealCharacter, setRevealCharacter] = useState(null);
  const [buyStamp, setBuyStamp] = useState(false);

  const [theme, setThemeState] = useState("default");
  const [isPremium, setIsPremium] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

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
    return Promise.all([fetchCharacters(), fetchBalance(), fetchProfile(), fetchSellPrices()]).then(
      ([characterList, latestBalance, profileData, sellPriceMap]) => {
        setCharacters(characterList);
        setBalance(latestBalance);
        setProfile(profileData);
        setSellPrices(sellPriceMap);
        setIsPremium(Boolean(profileData.isPremium));
        setThemeState(profileData.theme || "default");
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
      notify("success");
      if (theme === "seraphim") {
        // A gold seal flashes over the card before it flies off to the
        // Inventory - see .buy-stamp in index.css.
        setBuyStamp(true);
        setTimeout(() => {
          setBuyStamp(false);
          setRevealCharacter(selectedCharacter);
        }, 650);
      } else {
        setRevealCharacter(selectedCharacter);
      }
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

  function openSellConfirm(character) {
    haptic("light");
    setSellCandidate(character);
  }

  function closeSellConfirm() {
    if (sellPending) return;
    setSellCandidate(null);
  }

  async function confirmSell() {
    if (!sellCandidate) return;
    setSellPending(true);
    const result = await sellCharacterToBot(sellCandidate.id);

    if (result.ok) {
      setBalance(result.newBalance);
      setToastMessage(`🏪 Sold ${sellCandidate.name} for ${result.price} VɎ`);
      notify("success");
      // Re-pull everything - the card's quantity (or the card itself,
      // if that was the last copy) needs to reflect in the Home tab.
      refreshAll();
    } else {
      setToastMessage("❓ Couldn't sell that card - it may no longer be yours.");
      notify("error");
    }

    setSellPending(false);
    setSellCandidate(null);
  }

  // Seraphim's tab-switch transition: two wings sweep in and cover the
  // screen, the new tab mounts underneath while hidden, then the wings
  // sweep back out. Every other theme just switches instantly.
  function handleTabChange(tabId) {
    if (tabId === activeTab) return;
    if (theme !== "seraphim") {
      setActiveTab(tabId);
      return;
    }
    pendingTabRef.current = tabId;
    setTransitioning(true);
    setTimeout(() => {
      setActiveTab(pendingTabRef.current);
    }, 420);
    setTimeout(() => {
      setTransitioning(false);
    }, 420 + 460);
  }

  async function handleSelectTheme(themeId) {
    const previous = theme;
    setThemeState(themeId);
    haptic?.("light");
    const result = await apiSetTheme(themeId);
    if (!result?.ok) {
      setThemeState(previous);
      setToastMessage("❓ Couldn't switch themes - try again.");
    }
  }

  return (
    <div className="app-shell" data-theme={theme}>
      {theme === "seraphim" && activeTab !== "home" && <div className="seraphim-bg" aria-hidden="true" />}

      <div className="app-shell__inner">
        {activeTab === "home" && (
          <>
            {theme === "seraphim" ? (
              <SeraphimHome
                name={profile.name}
                balance={balance}
                cardCount={profile.cardCount}
                cards={profile.cards}
                sellPrices={sellPrices}
                onSell={openSellConfirm}
                onBrowseMarket={() => handleTabChange("market")}
                onOpenSettings={() => setSettingsOpen(true)}
              />
            ) : (
              <>
                <ProfileHeader
                  name={profile.name}
                  balance={balance}
                  cardCount={profile.cardCount}
                  onOpenSettings={() => setSettingsOpen(true)}
                />
                {profileLoading ? (
                  <SkeletonGrid count={4} />
                ) : (
                  <OwnedGrid cards={profile.cards} sellPrices={sellPrices} onSell={openSellConfirm} onBrowseMarket={() => handleTabChange("market")} />
                )}
              </>
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
              <SkeletonGrid count={6} />
            ) : (
              <CardGrid
                characters={visibleCharacters}
                ownedIds={ownedIds}
                balance={balance}
                onBuy={openConfirm}
                onClearFilters={() => {
                  setActiveRarity("All");
                  setQuery("");
                }}
              />
            )}
          </>
        )}

        {activeTab === "leaderboard" && <LeaderboardTab notify={notify} theme={theme} />}

        {activeTab === "game" && <RiderGame notify={notify} onBalanceChange={setBalance} theme={theme} />}

        {activeTab === "arena" && <ArenaTab notify={notify} onNavigate={handleTabChange} theme={theme} />}
      </div>

      <BottomNav active={activeTab} onChange={handleTabChange} theme={theme} />

      <BuyConfirmSheet
        character={selectedCharacter}
        balance={balance}
        pending={purchasePending}
        onConfirm={confirmPurchase}
        onCancel={closeConfirm}
      />

      {buyStamp && (
        <div className="buy-stamp" aria-hidden="true">
          <div className="buy-stamp__seal">✦</div>
        </div>
      )}

      <SellConfirmSheet
        character={sellCandidate}
        price={sellCandidate ? sellPrices[sellCandidate.rarity] || 0 : 0}
        balance={balance}
        pending={sellPending}
        onConfirm={confirmSell}
        onCancel={closeSellConfirm}
      />

      <SettingsSheet
        open={settingsOpen}
        isPremium={isPremium}
        theme={theme}
        onSelectTheme={handleSelectTheme}
        onClose={() => setSettingsOpen(false)}
      />

      <Toast message={toastMessage} onDone={() => setToastMessage("")} />

      <CardRevealOverlay character={revealCharacter} onDismiss={() => setRevealCharacter(null)} theme={theme} />

      <TabTransition active={transitioning} />
    </div>
  );
}
