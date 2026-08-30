export default function ProfileHeader({ name, balance, cardCount, onOpenSettings }) {
  return (
    <div className="profile-header">
      <button
        type="button"
        className="profile-header__settings"
        onClick={onOpenSettings}
        aria-label="Settings"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
          <path
            d="M19.4 13a7.5 7.5 0 0 0 0-2l2.1-1.6-2-3.4-2.5 1a7.6 7.6 0 0 0-1.7-1L15 3h-4l-.3 2.6a7.6 7.6 0 0 0-1.7 1l-2.5-1-2 3.4L6.6 11a7.5 7.5 0 0 0 0 2l-2.1 1.6 2 3.4 2.5-1a7.6 7.6 0 0 0 1.7 1L11 21h4l.3-2.6a7.6 7.6 0 0 0 1.7-1l2.5 1 2-3.4-2.1-1.6Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      </button>

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
