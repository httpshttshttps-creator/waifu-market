import { useEffect, useState } from "react";
import ChatCharacterList, { ChatAvatar } from "./ChatCharacterList.jsx";
import ChatConversation from "./ChatConversation.jsx";
import { fetchChatCharacters } from "../api/chatApi.js";

function PencilIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 20h4L18.5 9.5a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 15.5V20Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M13.5 6.5 17.5 10.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export default function ChatTab({ notify, onExit }) {
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCharacter, setActiveCharacter] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchChatCharacters().then((rows) => {
      if (!cancelled) {
        setCharacters(rows);
        setLoading(false);
        setActiveCharacter((current) =>
          current ? rows.find((c) => c.id === current.id) || current : current
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // The main screen only ever shows conversations the player actually
  // started - the full roster (for starting a NEW one) lives in the
  // pencil's picker sheet instead (see ChatCharacterList below).
  const conversations = characters.filter((c) => c.lastMessage);

  function openConversation(character) {
    setPickerOpen(false);
    setActiveCharacter(character);
  }

  function backToList() {
    setActiveCharacter(null);
    setTyping(false);
  }

  return (
    <div className="chat-tab">
      <div className="chat-topbar">
        {activeCharacter ? (
          <>
            <button type="button" className="chat-topbar__back" onClick={backToList} aria-label="Back">
              ‹
            </button>
            <ChatAvatar character={activeCharacter} />
            <div className="chat-topbar__identity">
              <span className="chat-topbar__name">{activeCharacter.name}</span>
              <span className="chat-topbar__status">
                {typing ? <span className="chat-conversation__typing">typing…</span> : activeCharacter.series}
              </span>
            </div>
          </>
        ) : (
          <span className="chat-topbar__title">Chats</span>
        )}
        <button type="button" className="chat-topbar__close" onClick={onExit} aria-label="Close">
          ✕
        </button>
      </div>

      {activeCharacter ? (
        <ChatConversation character={activeCharacter} notify={notify} onTypingChange={setTyping} />
      ) : (
        <>
          {loading ? (
            <ChatCharacterList characters={[]} loading onSelect={() => {}} />
          ) : conversations.length === 0 ? (
            <div className="chat-empty-state">
              <button type="button" className="chat-empty-state__fab" onClick={() => setPickerOpen(true)}>
                <PencilIcon />
              </button>
              <p className="chat-empty-state__text">
                No conversations yet - tap the pencil to pick one of your characters and say hi.
              </p>
            </div>
          ) : (
            <>
              <ChatCharacterList characters={conversations} loading={false} onSelect={openConversation} />
              <button
                type="button"
                className="chat-fab"
                onClick={() => setPickerOpen(true)}
                aria-label="Start a new chat"
              >
                <PencilIcon />
              </button>
            </>
          )}
        </>
      )}

      {pickerOpen && (
        <div className="sheet-overlay" onClick={() => setPickerOpen(false)}>
          <div className="confirm-sheet chat-picker-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="confirm-sheet__handle" />
            <p className="chat-picker-sheet__title">Start a chat</p>
            <div className="chat-picker-sheet__list">
              <ChatCharacterList characters={characters} loading={loading} onSelect={openConversation} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
