import { useEffect, useRef, useState } from "react";
import { useCountUp } from "../fx/useCountUp.js";
import { runMarketDoor, cancelMarketDoor } from "../fx/marketDoor.js";
import { play } from "../audio/engine.js";

export default function Header({ balance }) {
  const titleRef = useRef(null);
  const [shownBalance, runCount] = useCountUp(balance);
  const [pop, setPop] = useState(0);

  // Leaving the tab mid-animation must not leave the door hanging around.
  useEffect(() => () => cancelMarketDoor(), []);

  // Same reaction as the Balance on Home: jelly squash, count-up, ripple.
  function popBalance() {
    setPop((n) => n + 1);
    runCount();
    play("pop");
  }

  function openDoor() {
    runMarketDoor(titleRef.current);
  }

  const activate = (handler) => (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handler();
    }
  };

  return (
    <header className="market-header">
      <div>
        <h1
          ref={titleRef}
          className="brand-title market-title"
          role="button"
          tabIndex={0}
          data-click-sound="none"
          onClick={openDoor}
          onKeyDown={activate(openDoor)}
        >
          𝐕𝐘𝐑𝐎 𝐌𝐀𝐑𝐊𝐄𝐓
        </h1>
      </div>
      <div
        className="balance-pill"
        role="button"
        tabIndex={0}
        data-click-sound="none"
        onClick={popBalance}
        onKeyDown={activate(popBalance)}
      >
        <span key={pop} className="balance-pill__inner" data-popping={pop > 0 || undefined}>
          <span className="balance-pill__amount">{shownBalance}</span>
          <span>VɎ</span>
        </span>
        {pop > 0 && <span key={`r${pop}`} className="balance-pill__ring" />}
      </div>
    </header>
  );
}
