import OwnedCard from "./OwnedCard.jsx";

export default function OwnedGrid({ cards }) {
  if (cards.length === 0) {
    return (
      <p className="empty-state">
        You don't own any cards yet — visit the Market tab to start your collection.
      </p>
    );
  }

  return (
    <div className="card-grid">
      {cards.map((character) => (
        <OwnedCard key={character.id} character={character} />
      ))}
    </div>
  );
}
