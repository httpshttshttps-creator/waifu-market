import { CHARACTERS } from "../data/characters.js";

// Set this (in a .env file, see .env.example) once the bot's API is
// deployed and reachable, e.g. https://your-bot.up.railway.app.
// Left empty, everything below quietly falls back to the mock catalog -
// handy for iterating on layout/design without a live backend.
const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

const MOCK_STARTING_BALANCE = 500;
const FAKE_LATENCY_MS = 250;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getInitData() {
  return typeof window !== "undefined" ? window.Telegram?.WebApp?.initData ?? "" : "";
}

async function apiFetch(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Telegram-Init-Data": getInitData(),
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed (${response.status})`);
  }
  return response.json();
}

function imageUrl(fileId) {
  if (!fileId) return null;
  return `${API_BASE}/api/market/image/${fileId}`;
}

// Deterministic placeholder gradient per character id - shown behind the
// real photo while it loads, and used on its own if a character has no
// photo yet (or the photo fails to load).
const GRADIENT_PALETTE = [
  ["#3A2E63", "#7B4FA6"],
  ["#4A1F3D", "#B9457A"],
  ["#173A4E", "#2C8CA6"],
  ["#2B2E1F", "#6B7A4A"],
  ["#4A1620", "#D9536A"],
  ["#1E2A4A", "#4C6FB0"],
  ["#2E1F4A", "#8B5FC9"],
  ["#241E33", "#5C5378"],
];

function gradientFor(characterId) {
  return GRADIENT_PALETTE[Math.abs(characterId) % GRADIENT_PALETTE.length];
}

function normalizeListing(listing) {
  return {
    id: listing.listing_id,
    name: listing.name,
    series: listing.series,
    rarity: listing.rarity_name || "Unranked",
    price: listing.price,
    seller: listing.seller_username ? `@${listing.seller_username}` : `Player ${listing.seller_id}`,
    imageUrl: imageUrl(listing.image_file_id),
    gradient: gradientFor(listing.character_id),
  };
}

export async function fetchCharacters() {
  if (!API_BASE) {
    await delay(FAKE_LATENCY_MS);
    return CHARACTERS;
  }
  const listings = await apiFetch("/api/market/listings");
  return listings.map(normalizeListing);
}

export async function fetchBalance() {
  if (!API_BASE) {
    await delay(FAKE_LATENCY_MS / 2);
    return MOCK_STARTING_BALANCE;
  }
  const data = await apiFetch("/api/market/balance");
  return data.balance;
}

function normalizeOwnedCard(card) {
  return {
    id: card.id,
    name: card.name,
    series: card.series,
    rarity: card.rarity_name || "Unranked",
    imageUrl: imageUrl(card.image_file_id),
    gradient: gradientFor(card.id),
    quantity: card.quantity,
  };
}

export async function fetchProfile() {
  if (!API_BASE) {
    await delay(FAKE_LATENCY_MS);
    return {
      name: "Player",
      balance: MOCK_STARTING_BALANCE,
      cardCount: CHARACTERS.length,
      cards: CHARACTERS.map((character) => ({
        id: character.id,
        name: character.name,
        series: character.series,
        rarity: character.rarity,
        imageUrl: null,
        gradient: character.gradient,
        quantity: 1,
      })),
    };
  }
  const data = await apiFetch("/api/market/profile");
  return {
    name: data.name,
    balance: data.balance,
    cardCount: data.card_count,
    cards: data.cards.map(normalizeOwnedCard),
  };
}

export async function purchaseCharacter(id, currentBalance) {
  if (!API_BASE) {
    await delay(FAKE_LATENCY_MS);
    const character = CHARACTERS.find((c) => c.id === id);
    if (!character) return { ok: false, reason: "not_found" };
    if (currentBalance < character.price) return { ok: false, reason: "insufficient_funds" };
    return { ok: true, newBalance: currentBalance - character.price };
  }

  try {
    const data = await apiFetch("/api/market/buy", {
      method: "POST",
      body: JSON.stringify({ listing_id: id }),
    });
    return { ok: true, newBalance: currentBalance - data.price };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}
