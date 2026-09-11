import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTelegram } from "./hooks/useTelegram.js";
import {
  fetchCharacters,
  fetchBalance,
  fetchProfile,
  purchaseCharacter,
  fetchSellPrices,
  sellCharacterToBot,
} from "./api/marketApi.js";
import Header from "./components/Header.jsx";
import FilterBar from "./components/FilterBar.jsx";
import CardGrid from "./components/CardGrid.jsx";
import BuyConfirmSheet from "./components/BuyConfirmSheet.jsx";
import SellConfirmSheet from "./components/SellConfirmSheet.jsx";
import SettingsSheet from "./components/SettingsSheet.jsx";
import Toast from "./components/Toast.jsx";
import BottomNav, { TAB_ORDER } from "./components/BottomNav.jsx";
import ProfileHeader from "./components/ProfileHeader.jsx";
import OwnedGrid from "./components/OwnedGrid.jsx";
import LeaderboardTab from "./components/LeaderboardTab.jsx";
import ArenaTab from "./components/ArenaTab.jsx";
import ChatTab from "./components/ChatTab.jsx";
import RiderGame from "./components/RiderGame/index.jsx";
import CardRevealOverlay from "./components/CardRevealOverlay.jsx";
import { SkeletonGrid } from "./components/SkeletonCard.jsx";
import BootScreen from "./components/BootScreen.jsx";
import SortFilterBar from "./components/SortFilterBar.jsx";

export default function App() {
  // Accent color for the Classic theme (see SettingsSheet's color drawer) -
  // just an accent recolor, not a full alternate theme (those - Seraphim,
  // Tenebris - stay separate/"coming soon"). Persisted locally so it
  // survives a reload; applied via [data-accent] on .app-shell below, and
  // handed to useTelegram so Telegram's own header/backdrop color matches
  // it too.
  const [accentColor, setAccentColor] = useState(() => {
    try {
      return window.localStorage.getItem("theme.accent") || "red";
    } catch {
      return "red";
    }
  });

  const { haptic, notify } = useTelegram(accentColor);

  const [activeTab, setActiveTab] = useState("home");
  // Which side the tab-build animation should slide in from, for the
  // tab you're about to land on - see changeTab below and the
  // data-direction rules in index.css.
  const [tabDirection, setTabDirection] = useState(null);
  const [appReady, setAppReady] = useState(false);

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
  const [settingsOpen, setSettingsOpen] = useState(false);

  function changeAccentColor(id) {
    setAccentColor(id);
    try {
      window.localStorage.setItem("theme.accent", id);
    } catch {
      /* storage unavailable - the choice just won't persist across reloads */
    }
  }

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
        setLoading(false);
        setProfileLoading(false);
      }
    );
  }, []);

  // Initial load. A short minimum delay keeps the boot screen from just
  // flashing on a fast connection - it should read as a deliberate
  // "welcome" beat, not a layout glitch.
  useEffect(() => {
    let cancelled = false;
    const minDelay = new Promise((resolve) => setTimeout(resolve, 500));
    Promise.allSettled([refreshAll(), minDelay]).then(() => {
      if (!cancelled) setAppReady(true);
    });
    return () => {
      cancelled = true;
    };
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
      setRevealCharacter(selectedCharacter);
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

  if (!appReady) {
    // Wrapped in .app-shell[data-accent] too - BootScreen's colors are
    // var(--gold)/var(--gold-bright), which only resolve to the picked
    // accent when read from inside that scoped element. Without this
    // wrapper the boot screen always showed the default red regardless
    // of the saved theme.
    return (
      <div className="app-shell" data-accent={accentColor}>
        <BootScreen />
      </div>
    );
  }

  // Switches tabs and records which direction the new one sits in
  // relative to the current one (using BottomNav's left-to-right
  // TAB_ORDER), so the tab-build animation can slide in from that side
  // - see the data-direction rules in index.css.
  function changeTab(tabId) {
    if (tabId === activeTab) return;
    const fromIndex = TAB_ORDER.indexOf(activeTab);
    const toIndex = TAB_ORDER.indexOf(tabId);
    setTabDirection(fromIndex === -1 || toIndex === -1 ? null : toIndex > fromIndex ? "right" : "left");
    setActiveTab(tabId);
  }

  // Ride and Chat are full-screen/immersive: the bottom nav fades out
  // while they're open (see .bottom-nav[data-hidden] / .app-shell[data-immersive]
  // in index.css) and each screen gets its own ✕ that calls exitImmersive
  // to jump straight back to Home and bring the nav back.
  // Ride is only immersive (nav hidden) while a run is actually playing -
  // its own intro/result screens report that via onImmersiveChange below.
  // Chat is immersive any time it's open.
  const [ridePlaying, setRidePlaying] = useState(false);
  const immersive = (activeTab === "game" && ridePlaying) || activeTab === "chat";
  function exitImmersive() {
    changeTab("home");
  }

  return (
    <div className="app-shell" data-accent={accentColor} data-immersive={immersive || undefined}>
      <div className="app-shell__inner">
        <div className="tab-build" data-direction={tabDirection || undefined} key={activeTab}>
          {activeTab === "home" && (
          <div className="home-tab">
            <div className="tab-header">
              <ProfileHeader
                name={profile.name}
                balance={balance}
                cardCount={profile.cardCount}
                onOpenSettings={() => setSettingsOpen(true)}
              />
              <SortFilterBar onFilterChange={refreshAll} />
            </div>
            <div className="tab-scroll-body">
              {profileLoading ? (
                <SkeletonGrid count={4} />
              ) : (
                <OwnedGrid cards={profile.cards} sellPrices={sellPrices} onSell={openSellConfirm} onBrowseMarket={() => changeTab("market")} />
              )}
            </div>
          </div>
        )}

        {activeTab === "market" && (
          <div className="market-tab">
            <div className="tab-header">
              <Header balance={balance} />
              <FilterBar
                activeRarity={activeRarity}
                onRarityChange={setActiveRarity}
                query={query}
                onQueryChange={setQuery}
              />
            </div>

            <div className="tab-scroll-body">
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
            </div>
          </div>
        )}

        {activeTab === "leaderboard" && <LeaderboardTab notify={notify} />}

        {activeTab === "game" && (
          <RiderGame
            notify={notify}
            onBalanceChange={setBalance}
            onExit={exitImmersive}
            onImmersiveChange={setRidePlaying}
          />
        )}

        {activeTab === "arena" && <ArenaTab notify={notify} onNavigate={changeTab} />}

        {activeTab === "chat" && <ChatTab notify={notify} onExit={exitImmersive} />}
      </div>
      </div>

      <BottomNav active={activeTab} onChange={changeTab} hidden={immersive} />

      <BuyConfirmSheet
        character={selectedCharacter}
        balance={balance}
        pending={purchasePending}
        onConfirm={confirmPurchase}
        onCancel={closeConfirm}
      />

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
        onClose={() => setSettingsOpen(false)}
        accent={accentColor}
        onAccentChange={changeAccentColor}
      />

      <Toast message={toastMessage} onDone={() => setToastMessage("")} />

      <CardRevealOverlay character={revealCharacter} onDismiss={() => setRevealCharacter(null)} />
    </div>
  );
}
