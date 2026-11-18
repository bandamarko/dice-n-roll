// ui/picker.js
// "Pick a game": one card per game. Tapping a card flips it to its rules and back;
// only the Play button opens setup, so a stray tap never starts anything.

import { gameList } from "../games/index.js";
import { go, back } from "./router.js";
import { el, button } from "./dom.js";
import { appIcon, BOLT, FLIP, PLAY, BACK } from "./icons.js";

const TITLE_ICONS = { "flash-yamb": BOLT };

function playButton(game) {
  return button("card-play", { icon: PLAY, text: "Play", label: `Play ${game.name}`, onClick: () => go("setup", { gameId: game.id }) });
}

function cardTitle(game, text, className) {
  const title = el("span", className, text);
  if (TITLE_ICONS[game.id]) title.insertAdjacentHTML("beforeend", TITLE_ICONS[game.id]);
  return title;
}

// "Click" with a mouse, "Tap" on a touch screen
const verb = () => (matchMedia("(hover: hover)").matches ? "Click" : "Tap");

function gameCard(game) {
  const players = `${game.minPlayers}–${game.maxPlayers} players · ${game.dice} dice`;
  const card = el("section", "game-card");
  card.setAttribute("aria-label", game.name);
  const inner = el("div", "game-card-inner");

  const front = el("div", "game-card-face game-card-front");
  const flipToRules = button("card-flip", { label: `Show ${game.name} rules` });
  const hint = el("span", "card-hint");
  hint.innerHTML = FLIP;
  hint.append(`${verb()} for rules`);
  flipToRules.append(cardTitle(game, game.name, "card-title"), el("span", "card-summary", game.summary), hint);
  const frontBottom = el("div", "card-bottom");
  frontBottom.append(el("span", "card-players", players), playButton(game));
  front.append(flipToRules, frontBottom);

  const backFace = el("div", "game-card-face game-card-back");
  const flipToFront = button("card-flip", { label: `${game.name} rules, ${verb().toLowerCase()} to flip back` });
  const head = el("span", "card-rules-head");
  const flipBack = el("span", "card-hint");
  flipBack.innerHTML = FLIP;
  flipBack.append("Flip back");
  head.append(cardTitle(game, `${game.name} rules`, "card-rules-title"), flipBack);
  const facts = el("span", "card-facts", game.rules.extra ? `${players} · ${game.rules.extra}` : players);
  const list = el("ul", "card-rules");
  for (const rule of game.rules.bullets) list.append(el("li", "", rule));
  flipToFront.append(head, facts, list);
  const backBottom = el("div", "card-bottom");
  if (game.rules.tip) {
    const tip = el("span", "card-tip");
    tip.innerHTML = BOLT;
    tip.append(game.rules.tip);
    backBottom.append(tip);
  }
  backBottom.append(playButton(game));
  backFace.append(flipToFront, backBottom);

  // Flipping: the hidden side is made inert, so its buttons can't be tapped or focused
  const setFlipped = (flipped) => {
    card.classList.toggle("is-flipped", flipped);
    front.inert = flipped;
    backFace.inert = !flipped;
  };
  flipToRules.addEventListener("click", () => setFlipped(true));
  flipToFront.addEventListener("click", () => setFlipped(false));
  setFlipped(false);

  inner.append(front, backFace);
  card.append(inner);
  return card;
}

export function showPicker(root) {
  const screen = el("main", "picker");

  const header = el("header", "screen-header");
  const backButton = button("icon-button", { icon: BACK, label: "Back", onClick: back });
  const logo = el("span", "header-logo");
  logo.innerHTML = appIcon();
  header.append(backButton, el("h1", "screen-title", "Pick a game"), logo);

  const cards = el("div", "card-list");
  cards.append(...gameList.map(gameCard));

  screen.append(header, cards);
  root.append(screen);
}