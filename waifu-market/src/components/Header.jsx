export default function Header({ balance }) {
  return (
    <header className="market-header">
      <div>
        <p className="brand-eyebrow">
          <span className="brand-eyebrow__diamond">❖</span> night market · vol. 1
        </p>
        <h1 className="brand-title">𝐕𝐘𝐑𝐎 𝐌𝐀𝐑𝐊𝐄𝐓</h1>
      </div>
      <div className="balance-pill">
        <span className="balance-pill__amount">{balance}</span>
        <span>VɎ</span>
      </div>
    </header>
  );
}
