import CharacterCard from "./CharacterCard.jsx";

export default function CardGrid({ characters, ownedIds, balance, onBuy }) {
  if (characters.length === 0) {
    return <p className="empty-state">No cards match that search - try a different name, series, or rarity.</p>;
  }

  return (
    <div className="card-grid">
      {characters.map((character) => (
        <CharacterCard
          key={character.id}
          character={character}
          owned={ownedIds.has(character.id)}
          canAfford={balance >= character.price}
          onBuy={onBuy}
        />
      ))}
    </div>
  );
}
