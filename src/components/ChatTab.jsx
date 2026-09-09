import { useEffect, useState } from "react";
import ProfileHeader from "./ProfileHeader.jsx";
import ChatCharacterList from "./ChatCharacterList.jsx";
import ChatConversation from "./ChatConversation.jsx";
import { fetchChatCharacters } from "../api/chatApi.js";

export default function ChatTab({ profile, balance, onOpenSettings, notify }) {
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCharacter, setActiveCharacter] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchChatCharacters().then((rows) => {
      if (!cancelled) {
        setCharacters(rows);
        setLoading(false);
        // Keep the open conversation's preview (last message/time) fresh
        // if the player backs out to the list and this reloads.
        setActiveCharacter((current) =>
          current ? rows.find((c) => c.id === current.id) || current : current
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (activeCharacter) {
    return (
      <ChatConversation
        character={activeCharacter}
        onBack={() => setActiveCharacter(null)}
        notify={notify}
      />
    );
  }

  return (
    <div className="chat-tab">
      <ProfileHeader
        name={profile.name}
        balance={balance}
        cardCount={profile.cardCount}
        onOpenSettings={onOpenSettings}
      />
      <h2 className="chat-tab__heading">Chat</h2>
      <ChatCharacterList characters={characters} loading={loading} onSelect={setActiveCharacter} />
    </div>
  );
}
