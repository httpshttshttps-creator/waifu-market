import { useEffect, useRef, useState } from "react";
import GearIcon from "./GearIcon.jsx";
import { launchGear, subscribeGear } from "../fx/gearFlight.js";
import { launchFireworks } from "../fx/fireworks.js";
import { play } from "../audio/engine.js";
import { useCountUp } from "../fx/useCountUp.js";

export default function ProfileHeader({ name, balance, cardCount, onOpenSettings }) {
  const gearButtonRef = useRef(null);
  const nameRef = useRef(null);
  const [gearAway, setGearAway] = useState(false);
  const [gearPop, setGearPop] = useState(0);
  const [balancePop, setBalancePop] = useState(0);
  const [cardsPop, setCardsPop] = useState(0);
  const [shownBalance, runBalanceCount] = useCountUp(balance);
  const [shownCards, runCardsCount] = useCountUp(cardCount);

  // The Settings sheet closed: the gear comes back into the header.
  useEffect(
    () =>
      subscribeGear((event) => {
        if (event === "returned") {
          setGearAway((away) => {
            if (away) setGearPop((n) => n + 1);
            return false;
          });
        }
      }),
    []
  );

  function openSettings() {
    // launchGear makes a spinning copy of the icon that flies to the sheet;
    // the button hides its own icon meanwhile.
    if (launchGear(gearButtonRef.current)) setGearAway(true);
    onOpenSettings();
  }

  function popBalance() {
    setBalancePop((n) => n + 1);
    runBalanceCount();
    play("pop");
  }

  function popCards() {
    setCardsPop((n) => n + 1);
    runCardsCount();
    play("pop", { delay: 0.04 });
  }

  function cheerName() {
    // While a show is running, further taps do nothing (no restart, no pile-up).
    if (!launchFireworks()) return;
    // Replay the name's glow/bounce alongside the show.
    const el = nameRef.current;
    if (el) {
      el.classList.remove("is-cheering");
      void el.offsetWidth; // restart the animation
      el.classList.add("is-cheering");
    }
  }

  const activate = (handler) => (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handler();
    }
  };

  return (
    <div className="profile-header">
      <button
        ref={gearButtonRef}
        type="button"
        className="profile-header__settings"
        onClick={openSettings}
        aria-label="Settings"
        data-click-sound="none"
      >
        <span
          key={gearPop}
          className="profile-header__gear"
          data-away={gearAway || undefined}
          data-pop={gearPop > 0 || undefined}
        >
          <GearIcon />
        </span>
      </button>

      <p className="profile-header__eyebrow">
        <span className="brand-eyebrow__diamond">❖</span> your stall
      </p>
      <h1
        ref={nameRef}
        className="profile-header__name"
        role="button"
        tabIndex={0}
        onClick={cheerName}
        onKeyDown={activate(cheerName)}
      >
        {name}
      </h1>

      <div className="profile-stats">
        <div
          className="profile-stat"
          role="button"
          tabIndex={0}
          data-click-sound="none"
          onClick={popBalance}
          onKeyDown={activate(popBalance)}
        >
          <div key={`b${balancePop}`} className="profile-stat__inner" data-popping={balancePop > 0 || undefined}>
            <span className="profile-stat__value profile-stat__value--gold">{shownBalance} VɎ</span>
            <span className="profile-stat__label">Balance</span>
          </div>
          {balancePop > 0 && <span key={`br${balancePop}`} className="profile-stat__ring" />}
        </div>
        <div className="profile-stat__divider" />
        <div
          className="profile-stat"
          role="button"
          tabIndex={0}
          data-click-sound="none"
          onClick={popCards}
          onKeyDown={activate(popCards)}
        >
          <div key={`c${cardsPop}`} className="profile-stat__inner" data-popping={cardsPop > 0 || undefined}>
            <span className="profile-stat__value">{shownCards}</span>
            <span className="profile-stat__label">Cards Owned</span>
          </div>
          {cardsPop > 0 && <span key={`cr${cardsPop}`} className="profile-stat__ring" />}
        </div>
      </div>
    </div>
  );
}
