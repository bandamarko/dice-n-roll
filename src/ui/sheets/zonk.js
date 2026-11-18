// ui/sheets/zonk.js
// Zonk scoresheet: player totals with progress toward the target, this turn's points,
// a numpad for the current throw, and Zonk / + / Bank.

import { el, button } from "../dom.js";
import { BACKSPACE } from "../icons.js";

const MAX_DIGITS = 5;
const format = (n) => n.toLocaleString("en-US");

export function zonkTitle(state) {
  return `Zonk · to ${format(state.sheet.options.target)}`;
}

export function renderZonk(container, { state, game, play, signal }) {
  const { sheet, players, currentPlayer } = state;
  const totals = game.computeTotals(sheet);
  const target = sheet.options.target;
  let typed = ""; // the throw being typed, as a string of digits
  const leader = Math.max(...totals);

  // Players. On desktop they're shown in turn order, starting one player back, with
  // Last / Playing / Next, who's leading and how far each one is from the target
  const orderTitle = el("p", "zonk-order-title", `Turn order · first to ${format(target)} wins`);
  const list = el("ol", players.length > 4 ? "zonk-players is-compact" : "zonk-players");
  players.forEach((name, i) => {
    const row = el("li", i === currentPlayer ? "zonk-player is-current" : "zonk-player");
    if (i === currentPlayer) row.setAttribute("aria-current", "true");
    const step = (i - currentPlayer + 1 + players.length) % players.length; // 0 = the player before, 1 = now
    row.style.setProperty("--turn", step); // desktop CSS sorts the rows by this
    const top = el("div", "zonk-player-top");
    top.append(el("span", "zonk-player-name", name));
    const tag = players.length > 2 || step > 0 ? ["Last", "Playing", "Next"][step] : null;
    if (tag) top.append(el("span", tag === "Playing" ? "zonk-player-tag is-playing" : "zonk-player-tag", tag));
    if (players.length > 1 && totals[i] === leader && leader > 0) top.append(el("span", "zonk-player-lead", "Leading"));
    top.append(el("span", "zonk-player-togo", `${format(Math.max(0, target - totals[i]))} to go`));
    top.append(el("span", "zonk-player-total", format(totals[i])));
    const bar = el("div", "zonk-bar");
    const fillBar = el("div", "zonk-bar-fill");
    fillBar.style.width = `${Math.min(100, (totals[i] / target) * 100)}%`; // data, not layout
    bar.append(fillBar);
    row.append(top, bar);
    list.append(row);
  });

  const turn = el("section", "zonk-turn");
  const turnLine = el("div", "zonk-turn-line");
  const subtotal = el("span", "zonk-turn-value", format(sheet.turn.subtotal));
  if (sheet.turn.plusUsed) subtotal.append(el("span", "zonk-plus-tag", "+ used"));
  turnLine.append(el("span", "zonk-turn-label", "This turn"), subtotal);
  const throwLine = el("div", "zonk-throw-line");
  const throwValue = el("output", "zonk-throw-value");
  throwValue.setAttribute("aria-live", "polite");
  throwLine.append(el("span", "zonk-turn-label", "Throw"), throwValue);
  const hint = el("p", "zonk-hint");
  turn.append(turnLine, throwLine, hint);

  const pad = el("div", "numpad");
  const press = (digits) => {
    const next = (typed + digits).replace(/^0+/, "");
    if (next.length <= MAX_DIGITS) typed = next;
    refresh();
  };
  for (const key of ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0"]) {
    pad.append(button("numpad-key", { text: key, onClick: () => press(key) }));
  }
  pad.append(button("numpad-key", { icon: BACKSPACE, label: "Backspace", onClick: () => { typed = typed.slice(0, -1); refresh(); } }));

  const actions = el("div", "zonk-actions");
  const zonkButton = button("zonk-action zonk-action-zonk", { text: "Zonk", onClick: () => play({ type: "zonk" }) });
  const plusButton = button("zonk-action zonk-action-plus", { text: "+", label: "Plus: all dice scored, keep throwing", onClick: () => play({ type: "plus", points: Number(typed) }) });
  const bankButton = button("zonk-action zonk-action-bank", { onClick: () => play({ type: "bank", points: Number(typed) }) });
  const bankLabel = el("span", "zonk-action-label");
  bankButton.append(bankLabel);
  // The key for each button, shown under it on desktop
  zonkButton.append(el("span", "zonk-key", "Z"));
  plusButton.append(el("span", "zonk-key", "+"));
  bankButton.append(el("span", "zonk-key", "Enter"));
  actions.append(zonkButton, plusButton, bankButton);

  // What Bank would do, shown above the buttons on desktop
  const preview = el("p", "zonk-bank-preview");
  const previewValue = el("span", "zonk-bank-preview-value");
  preview.append(`If ${players[currentPlayer]} banks now`, previewValue);

  function refresh() {
    const points = Number(typed);
    throwValue.textContent = typed ? format(points) : "–";
    const entry = (type) => ({ type, points });
    plusButton.disabled = !game.canEnter(sheet, currentPlayer, entry("plus"));
    bankButton.disabled = !game.canEnter(sheet, currentPlayer, entry("bank"));
    bankLabel.textContent = `Bank ${format(sheet.turn.subtotal + points)}`;
    const now = totals[currentPlayer];
    previewValue.textContent = bankButton.disabled ? `${format(now)} → –` : `${format(now)} → ${format(now + sheet.turn.subtotal + points)}`;

    // Say why the buttons are off, so a typo or the 300 rule is never a mystery
    if (!typed) hint.textContent = sheet.turn.plusUsed ? "Type your next throw" : `Type your throw (first one needs ${game.entryThreshold}+)`;
    else if (points % game.pointStep !== 0) hint.textContent = `Scores go in steps of ${game.pointStep}`;
    else if (!sheet.turn.plusUsed && points < game.entryThreshold) hint.textContent = `The first throw needs ${game.entryThreshold}+`;
    else hint.textContent = "";
  }

  // On phones the panel is invisible to the layout (display: contents); on desktop it's the right column
  const panel = el("div", "zonk-panel");
  panel.append(turn, pad, preview, actions);
  container.append(orderTitle, list, panel);
  refresh();

  // Keyboard: digits type the throw, Backspace deletes, Delete clears, + = Plus,
  // Enter = Bank (only when allowed), Z = Zonk. It presses the real buttons.
  function onKey(event) {
    if (event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return;
    if (document.querySelector(".menu-layer, .dialog-layer, .spinner-layer")) return; // a menu, popup or the spinner has the keys
    const k = event.key;
    if (/^[0-9]$/.test(k)) press(k);
    else if (k === "Backspace") { typed = typed.slice(0, -1); refresh(); }
    else if (k === "Delete") { typed = ""; refresh(); }
    else if (k === "+") { if (!plusButton.disabled) plusButton.click(); }
    else if (k === "Enter") {
      if (event.target.closest("button")) return; // a focused button (menu, Undo, a key) gets its own Enter
      if (!bankButton.disabled) bankButton.click();
    }
    else if (k === "z" || k === "Z") zonkButton.click();
    else return;
    event.preventDefault(); // handled: no double press of a focused button, no page scroll
  }
  window.addEventListener("keydown", onKey, { signal }); // removed when the sheet is redrawn or left
}
