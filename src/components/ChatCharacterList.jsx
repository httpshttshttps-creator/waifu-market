import CardMedia from "./CardMedia.jsx";

function timeLabel(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function ChatAvatar({ character }) {
  const [artFrom, artTo] = character.gradient ?? ["#241E33", "#5C5378"];
  return (
    <div className="chat-avatar" style={{ "--art-from": artFrom, "--art-to": artTo }}>
      {character.imageUrl ? (
        <CardMedia
          src={character.imageUrl}
          mediaType={character.mediaType}
          alt={character.name}
          className="chat-avatar__media"
        />
      ) : (
        <span className="chat-avatar__initial">{character.name.charAt(0)}</span>
      )}
    </div>
  );
}

export default function ChatCharacterList({ characters, loading, onSelect }) {
  if (loading) {
    return (
      <div className="chat-list">
        {[0, 1, 2, 3].map((i) => (
          <div className="chat-list-row chat-list-row--skeleton card-build" style={{ "--i": i }} key={i}>
            <div className="chat-avatar chat-avatar--skeleton" />
            <div className="chat-list-row__text">
              <div className="skeleton-line skeleton-line--short" />
              <div className="skeleton-line" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (characters.length === 0) {
    return (
      <div className="chat-empty card-build">
        <p className="chat-empty__title">No characters yet</p>
        <p className="chat-empty__text">
          Get a character from the Market or a spawn drop, then come back here to chat with them.
        </p>
      </div>
    );
  }

  return (
    <div className="chat-list">
      {characters.map((character, i) => (
        <button
          type="button"
          key={character.id}
          className="chat-list-row card-build"
          style={{ "--i": Math.min(i, 6) }}
          onClick={() => onSelect(character)}
        >
          <ChatAvatar character={character} />
          <div className="chat-list-row__text">
            <div className="chat-list-row__top">
              <span className="chat-list-row__name">{character.name}</span>
              <span className="chat-list-row__time">{timeLabel(character.lastMessageAt)}</span>
            </div>
            <p className="chat-list-row__preview">
              {character.lastMessage
                ? `${character.lastMessageSender === "user" ? "You: " : ""}${character.lastMessage}`
                : `Say hi to ${character.name}`}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}

export { ChatAvatar, timeLabel };
