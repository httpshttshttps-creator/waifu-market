import CharacterCard from "./CharacterCard.jsx";
import EmptyStateCta from "./EmptyStateCta.jsx";

export default function CardGrid({ characters, ownedIds, balance, onBuy, onClearFilters }) {
  if (characters.length === 0) {
    return (
      <div className="empty-state empty-state--action">
        <p>No cards match that search - try a different name, series, or rarity.</p>
        {onClearFilters && <EmptyStateCta onClick={onClearFilters}>✕ Clear filters</EmptyStateCta>}
      </div>
    );
  }

  return (
    <div className="card-grid">
      {characters.map((character, index) => (
        <CharacterCard
          key={character.id}
          character={character}
          owned={ownedIds.has(character.id)}
          canAfford={balance >= character.price}
          onBuy={onBuy}
          index={index}
        />
      ))}
    </div>
  );
}
