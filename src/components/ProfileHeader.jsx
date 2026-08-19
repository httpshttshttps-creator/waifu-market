export default function ProfileHeader({ name, balance, cardCount }) {
  return (
    <div className="profile-header">
      <p className="profile-header__eyebrow">
        <span className="brand-eyebrow__diamond">❖</span> your stall
      </p>
      <h1 className="profile-header__name">{name}</h1>

      <div className="profile-stats">
        <div className="profile-stat">
          <span className="profile-stat__value profile-stat__value--gold">{balance} VɎ</span>
          <span className="profile-stat__label">Balance</span>
        </div>
        <div className="profile-stat__divider" />
        <div className="profile-stat">
          <span className="profile-stat__value">{cardCount}</span>
          <span className="profile-stat__label">Cards Owned</span>
        </div>
      </div>
    </div>
  );
}
