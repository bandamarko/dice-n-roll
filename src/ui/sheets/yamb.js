// ui/sheets/yamb.js
// Yamb and Flash Yamb scoresheet:
// - player chips (tap one to peek at that player's sheet, read-only)
// - the grid with icon labels, sums and open cells, plus the bottom bar
// - the floating score panel next to the tapped cell
// - a pending entry that only counts after "Confirm turn"
// - the tip notice when the previous player announced

import { ROWS, columnSums, bestValue } from "../../games/yamb.js";
import { openOverlay } from "../router.js";
import { el, button } from "../dom.js";
import { COLUMN_ICONS, ROW_ICONS, DICE, BACKSPACE } from "../icons.js";

const COLUMN_NAMES = {
    down: "Down", free: "Free", up: "Up", announce: "Announce", hand: "Hand",
    tip: "Tip", middle: "From middle", mandatory: "Mandatory", maximum: "Maximum",
};
const ROW_NAMES = {
    ones: "Ones", twos: "Twos", threes: "Threes", fours: "Fours", fives: "Fives", sixes: "Sixes",
    max: "Max", min: "Min", straight: "Straight", triple: "Triple", full: "Full house", poker: "Poker", yamb: "Yamb",
};
const SUM_NAMES = { sum1: "Sum 1", difference: "Difference", sum2: "Sum 2" };
const SUM_SYMBOLS = { sum1: "Σ", difference: "Δ", sum2: "Σ" };
const PLURAL = ["", "ones", "twos", "threes", "fours", "fives", "sixes"];
const ROW_RULES = {
    max: "Sum of all 5 dice, aim high (5–30).",
    min: "Sum of all 5 dice, aim low (5–30).",
    straight: "1–5 or 2–6: 66 on throw 1, 56 on throw 2, 46 on throw 3.",
    triple: "Three alike, sum + 20.",
    full: "Three alike + a pair, sum + 30. Five alike is not a Full.",
    poker: "Four alike, sum + 40.",
    yamb: "Five alike, sum + 50.",
};
const FACES = [1, 2, 3, 4, 5, 6];

// Arrow key → [columns to the right, rows down]
const ARROWS = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] };
// Straight by throw: 1 = made on throw 1 (66), 2 = throw 2 (56), 3 = throw 3 (46)
const STRAIGHT_KEYS = { 1: 66, 2: 56, 3: 46 };

// Rows top to bottom as drawn: the 13 scoring rows with the 3 sum rows in between
const LAYOUT = ["ones", "twos", "threes", "fours", "fives", "sixes", "sum1",
    "max", "min", "difference", "straight", "triple", "full", "poker", "yamb", "sum2"];

export function yambTitle(state, game) {
    return game.name;
}

export function renderYamb(container, { state, game, play, setPendingUndo }) {
    const { players, currentPlayer, sheet } = state;
    const screen = container.closest(".game-screen"); // floating panels are placed inside it
    const totals = game.computeTotals(sheet);
    let viewed = currentPlayer;   // whose sheet is on screen
    let closePeek = null;         // set while peeking; closes the peek like the back button
    let pending = null;           // { column, row, value } entered but not confirmed yet
    let closeInput = null;        // set while the score panel is open

    let panelKey = null;          // the open score panel's key handler
    let inputCell = null;         // the cell the open score panel belongs to

    function clearPending() {
        pending = null;
        setPendingUndo(null);
        draw();
    }

    // The sheet as it would be with the pending entry, for the sums and the total preview
    // The sheet as it would be with the pending entry, for the sums and the total preview
    function previewSheet() {
        return pending ? game.applyEntry(sheet, currentPlayer, pending).sheet : sheet;
    }

    function draw() {
        const mine = viewed === currentPlayer;
        const parts = [chips(), rail()]; // chips on phones, the mini sheets on desktop (CSS picks)
        if (!mine) parts.push(peekBar());
        parts.push(grid(mine), bottomBar(mine));
        container.replaceChildren(...parts);
        container.querySelector(".yamb-chip.is-current")?.scrollIntoView({ inline: "nearest", block: "nearest" });
    }

    // ---------- Player chips ----------
    function chips() {
        const row = el("div", "yamb-chips");
        players.forEach((name, i) => {
            const chip = button("yamb-chip", {
                onClick: () => {
                    if (i === viewed) return;
                    if (i === currentPlayer) return closePeek?.();
                    peek(i);
                },
            });
            if (i === currentPlayer) chip.classList.add("is-current");
            if (i === viewed) chip.setAttribute("aria-pressed", "true");
            chip.setAttribute("aria-label", `${name}, ${totals[i]} points${i === currentPlayer ? ", playing now" : ", tap to see their sheet"}`);
            chip.append(el("span", "yamb-chip-name", name), el("span", "yamb-chip-total", String(totals[i])));
            row.append(chip);
        });
        return row;
    }
    // ---------- Mini sheets (desktop) ----------
    // Turn order starting one player back, so the player whose turn it is is always 2nd
    function rail() {
        const box = el("aside", "yamb-rail");
        box.append(el("span", "yamb-rail-title", "Turn order · click to view"));
        const list = el("div", "yamb-rail-list");
        const tags = ["Last", "Playing", "Next"];
        for (let step = 0; step < players.length; step++) {
            const i = (currentPlayer - 1 + step + players.length) % players.length;
            list.append(miniSheet(i, players.length > 2 || step > 0 ? tags[step] : null));
        }
        box.append(list);
        return box;
    }

    function miniSheet(i, tag) {
        const card = button("yamb-mini", {
            onClick: () => {
                if (i === viewed) return;
                if (i === currentPlayer) return closePeek?.();
                peek(i);
            },
        });
        if (i === currentPlayer) card.classList.add("is-current");
        if (i === viewed) card.setAttribute("aria-pressed", "true");
        card.setAttribute("aria-label", `${players[i]}, ${totals[i]} points${i === currentPlayer ? ", playing now" : ", click to see their sheet"}`);

        const top = el("span", "yamb-mini-top");
        top.append(el("span", "yamb-mini-name", players[i]));
        if (tag) top.append(el("span", tag === "Playing" ? "yamb-mini-tag is-playing" : "yamb-mini-tag", tag));
        top.append(el("span", "yamb-mini-total", String(totals[i])));

        // A tiny map of the sheet: one square per cell, row by row
        const map = el("span", "yamb-mini-map");
        map.style.setProperty("--columns", game.columns.length);
        const cells = sheet.grids[i];
        for (let r = 0; r < ROWS.length; r++) {
            for (const column of game.columns) {
                const v = cells[column][r];
                map.append(el("span", v === null ? "yamb-mini-cell" : v === 0 ? "yamb-mini-cell is-crossed" : "yamb-mini-cell is-filled"));
            }
        }
        card.append(top, map);
        return card;
    }
    // Peeking is an overlay as far as the router knows, so the back button ends it
    function peek(i) {
        if (!closePeek) {
            const dismiss = openOverlay(() => {
                closePeek = null;
                viewed = currentPlayer;
                draw();
            });
            closePeek = () => dismiss();
        }
        viewed = i;
        draw();
    }

    function peekBar() {
        const bar = button("yamb-peek-bar", { onClick: () => closePeek?.() });
        bar.append(el("span", "", `${players[viewed]}'s sheet`), el("span", "yamb-peek-back", `Back to ${players[currentPlayer]}'s turn`));
        return bar;
    }

    // ---------- The grid ----------
    function grid(mine) {
        const cells = sheet.grids[viewed];
        const shown = mine ? previewSheet().grids[viewed] : cells; // sums include the pending entry
        const sums = Object.fromEntries(game.columns.map((column) => [column, columnSums(shown[column])]));
        const table = el("div", "yamb-grid");
        table.setAttribute("aria-label", `${players[viewed]}'s scoresheet`);
        table.style.setProperty("--columns", game.columns.length); // data: 9 for Yamb, 6 for Flash Yamb

        // Header: empty corner, then one icon per column
        table.append(el("span", "yamb-corner"));
        for (const column of game.columns) {
            const head = el("span", "yamb-col-head");
            head.dataset.column = column;
            head.innerHTML = COLUMN_ICONS[column];
            head.append(el("span", "yamb-label", COLUMN_NAMES[column])); // hidden on phones, for desktop later
            head.title = COLUMN_NAMES[column];
            table.append(head);
        }

        for (const key of LAYOUT) {
            const isSum = key in SUM_NAMES;

            // Row label: an icon (or Σ / Δ for sums), with the name hidden on phones
            const label = el("span", isSum ? "yamb-row-head is-sum" : "yamb-row-head");
            label.dataset.row = key;
            if (isSum) label.append(el("span", "yamb-symbol", SUM_SYMBOLS[key]));
            else label.innerHTML = ROW_ICONS[key];
            label.append(el("span", "yamb-label", isSum ? SUM_NAMES[key] : ROW_NAMES[key]));
            label.title = isSum ? SUM_NAMES[key] : ROW_NAMES[key];
            table.append(label);

            for (const column of game.columns) {
                table.append(isSum ? sumCell(sums[column][key]) : scoreCell(cells, column, key, mine));
            }
        }
        return table;
    }

    function sumCell(value) {
        return el("span", "yamb-cell is-sum", value === null ? "" : String(value));
    }

    function scoreCell(cells, column, key, mine) {
        const value = cells[column][ROWS.indexOf(key)];
        const name = `${ROW_NAMES[key]}, ${COLUMN_NAMES[column]}`;

        // The entry waiting for "Confirm turn": its own color, and tapping it changes the score
        if (mine && pending && pending.column === column && pending.row === key) {
            const shownValue = pending.value === 0 ? "/" : String(pending.value);
            const cell = button("yamb-cell is-pending", { text: shownValue, label: `${name}: ${pending.value === 0 ? "crossed out" : pending.value}, not confirmed yet, tap to change` });
            cell.dataset.column = column;
            cell.dataset.row = key;
            cell.addEventListener("click", () => openInput(cell, column, key));
            return cell;
        }

        if (value !== null) {
            const cell = el("span", value === 0 ? "yamb-cell is-filled is-crossed" : "yamb-cell is-filled", value === 0 ? "/" : String(value));
            cell.setAttribute("aria-label", `${name}: ${value === 0 ? "crossed out" : value}`);
            return cell;
        }

        // Open = the engine would accept "/" here, so every column rule comes from games/yamb.js
        if (mine && game.canEnter(sheet, currentPlayer, { column, row: key, value: 0 })) {
            const isTip = column === "tip";
            const cell = button(isTip ? "yamb-cell is-open is-tip" : "yamb-cell is-open", { label: `${name}, open` });
            if (isTip) cell.innerHTML = COLUMN_ICONS.tip;
            cell.dataset.column = column;
            cell.dataset.row = key;
            cell.addEventListener("click", () => openInput(cell, column, key));
            return cell;
        }

        return el("span", "yamb-cell is-locked");
    }

    // ---------- Bottom bar ----------
    function bottomBar(mine) {
        const bar = el("div", "yamb-bar");
        const tip = sheet.pendingTip;
        if (mine && pending) {
            // Nothing counts until this is pressed; then the move is made and the turn passes
            bar.append(button("yamb-confirm", { text: "Confirm turn", onClick: () => play(pending) }));
        } else if (mine && tip) {
            // During a tip turn the bar says what's owed, and tapping it shows the notice again
            const again = button("yamb-bar-tip", { onClick: () => showTipNotice() });
            again.innerHTML = COLUMN_ICONS.tip;
            again.append(`Tip from ${announcer()}: ${ROW_NAMES[tip]}`);
            bar.append(again);
        } else {
            const verb = matchMedia("(hover: hover)").matches ? "Click" : "Tap"; // mouse or finger
            bar.append(el("span", "yamb-bar-hint", mine ? `${verb} an outlined cell to score` : "Read-only"));
        }
        const total = el("span", "yamb-bar-total");
        const shownTotal = mine && pending ? game.computeTotals(previewSheet())[viewed] : totals[viewed];
        total.append(el("span", "yamb-bar-total-label", "Total"), el("span", "yamb-bar-total-value", String(shownTotal)));
        bar.append(total);
        return bar;
    }

    // The tip always comes from the player right before the current one
    function announcer() {
        return players[(currentPlayer - 1 + players.length) % players.length];
    }

    // ---------- Floating panels (score panel, tip notice) ----------

    // Puts a panel above or below a cell inside the game screen, with its arrow at the cell
    function placeNear(panel, cell) {
        const area = screen.getBoundingClientRect();
        const target = cell.getBoundingClientRect();
        const below = target.top + target.height / 2 < area.top + area.height * 0.5;
        panel.classList.toggle("is-below", below);
        panel.classList.toggle("is-above", !below);
        // Variables, not top/bottom: the desktop CSS ignores them and uses the side column
        panel.style.setProperty("--panel-top", `${target.bottom - area.top + 10}px`);
        panel.style.setProperty("--panel-bottom", `${area.bottom - target.top + 10}px`);
        const arrowX = target.left + target.width / 2 - area.left - panel.offsetLeft - 7;
        panel.style.setProperty("--arrow-x", `${Math.round(arrowX)}px`);
    }

    function highlight(column, key, on) {
        const table = container.querySelector(".yamb-grid");
        table.querySelector(`.yamb-col-head[data-column="${column}"]`)?.classList.toggle("is-active", on);
        table.querySelector(`.yamb-row-head[data-row="${key}"]`)?.classList.toggle("is-active", on);
    }

    function openInput(cell, column, key) {
        closeInput?.(); // on desktop another cell can be clicked while a panel is open
        const layer = el("div", "yamb-layer");
        const panel = el("div", "yamb-panel");
        panel.setAttribute("role", "dialog");
        panel.setAttribute("aria-label", `${ROW_NAMES[key]}, ${COLUMN_NAMES[column]} column`);
        layer.append(panel);

        cell.classList.add("is-selected");
        highlight(column, key, true);
        const dismiss = openOverlay(() => {
            closeInput = null;
            panelKey = null;
            inputCell = null;
            layer.remove();
            cell.classList.remove("is-selected");
            highlight(column, key, false);
        });
        closeInput = dismiss;
        inputCell = cell;
        layer.addEventListener("click", (event) => {
            if (event.target === layer) dismiss();
        });

        const face = ROWS.indexOf(key) + 1; // 1–6 for ones..sixes
        const pick = { count: null, typed: "", straight: null, a: null, b: null };
        const isMaximum = column === "maximum";

        function value() {
            if (isMaximum) return bestValue(key);
            if (face <= 6) return pick.count ? pick.count * face : null;
            if (key === "max" || key === "min") return pick.typed ? Number(pick.typed) : null;
            if (key === "straight") return pick.straight;
            if (key === "full") return pick.a && pick.b && pick.a !== pick.b ? 3 * pick.a + 2 * pick.b + 30 : null;
            const [times, bonus] = { triple: [3, 20], poker: [4, 40], yamb: [5, 50] }[key];
            return pick.a ? times * pick.a + bonus : null;
        }

        // Head: column icon, row name, live preview
        const head = el("div", "yamb-panel-head");
        const tile = el("span", "yamb-panel-icon");
        tile.innerHTML = COLUMN_ICONS[column];
        const names = el("span", "yamb-panel-names");
        names.append(el("span", "yamb-panel-title", ROW_NAMES[key]), el("span", "yamb-panel-sub", `${COLUMN_NAMES[column]} column`));
        const preview = el("output", "yamb-panel-preview");
        head.append(tile, names, preview);
        const rule = el("p", "yamb-panel-rule", ROW_RULES[key] ?? `Add up only the ${PLURAL[face]}, best 5 dice.`); // shown on desktop

        const body = el("div", "yamb-panel-body");
        const hint = el("p", "yamb-panel-hint");

        function choices(labelText, options, isOn, onPick, className = "yamb-choice") {
            const group = el("div", "yamb-choices");
            group.append(el("span", "yamb-panel-label", labelText));
            const row = el("div", `yamb-choice-row is-${options.length}`);
            for (const option of options) {
                const choice = button(className, { onClick: () => { onPick(option.value); refresh(); } });
                if (option.icon) choice.innerHTML = option.icon;
                if (option.text) choice.append(option.text);
                choice.setAttribute("aria-label", option.label ?? option.text);
                choice.dataset.value = option.value;
                row.append(choice);
            }
            group.append(row);
            group.update = () => row.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(isOn(Number(b.dataset.value)))));
            return group;
        }

        const parts = [];
        if (isMaximum) {
            body.append(el("p", "yamb-panel-note", `Maximum only takes the best score, ${bestValue(key)}, or "/".`));
        } else if (face <= 6) {
            parts.push(choices(`How many ${PLURAL[face]}?`, [1, 2, 3, 4, 5].map((n) => ({ value: n, text: String(n) })), (v) => pick.count === v, (v) => (pick.count = v)));
        } else if (key === "max" || key === "min") {
            const pad = el("div", "yamb-numpad");
            const press = (digit) => { if (pick.typed.length < 2) pick.typed = (pick.typed + digit).replace(/^0+/, ""); refresh(); };
            for (const d of ["1", "2", "3", "4", "5", "6", "7", "8", "9"]) pad.append(button("yamb-key", { text: d, onClick: () => press(d) }));
            pad.append(button("yamb-key", { text: "C", label: "Clear", onClick: () => { pick.typed = ""; refresh(); } }));
            pad.append(button("yamb-key", { text: "0", onClick: () => press("0") }));
            pad.append(button("yamb-key", { icon: BACKSPACE, label: "Backspace", onClick: () => { pick.typed = pick.typed.slice(0, -1); refresh(); } }));
            body.append(el("span", "yamb-panel-label", "Sum of your best 5 dice (5–30)"), pad);
        } else if (key === "straight") {
            parts.push(choices("Pick the value (66 on throw 1, 56 on 2, 46 on 3)", [66, 56, 46].map((v) => ({ value: v, text: String(v) })), (v) => pick.straight === v, (v) => (pick.straight = v), "yamb-choice is-big"));
        } else {
            // Screen-reader names for the face buttons, e.g. "Four sixes" for Poker
            const dice = (prefix) => FACES.map((f) => ({ value: f, icon: DICE[f], label: `${prefix} ${PLURAL[f]}` }));
            const howMany = { triple: "Three", full: "Three", poker: "Four", yamb: "Five" }[key];
            parts.push(choices(key === "full" ? "Three of" : "Which number?", dice(howMany), (v) => pick.a === v, (v) => (pick.a = v), "yamb-choice is-die"));
            if (key === "full") parts.push(choices("Pair of", dice("Pair of"), (v) => pick.b === v, (v) => (pick.b = v), "yamb-choice is-die"));
        }
        body.append(...parts);

        const actions = el("div", "yamb-panel-actions");
        // Enter and "/" don't play yet: they set the pending entry (replacing any earlier one)
        const choose = (v) => {
            dismiss();
            pending = { column, row: key, value: v };
            setPendingUndo(clearPending); // Undo now erases this entry instead of the last move
            draw();
        };
        const cross = button("yamb-cross", { text: "/", label: "Cross out", onClick: () => choose(0) });
        const cancel = button("yamb-cancel", { text: "Cancel", onClick: () => dismiss() });
        const enter = button("yamb-enter", { text: "Enter", onClick: () => choose(value()) });
        actions.append(cross, cancel, enter);

        function refresh() {
            const v = value();
            const ok = v !== null && sheetAllows(column, key, v);
            preview.textContent = v === null ? "–" : String(v);
            enter.disabled = !ok;
            parts.forEach((p) => p.update());
            if (key === "full" && pick.a && pick.a === pick.b) hint.textContent = "Pick two different numbers";
            else if ((key === "max" || key === "min") && pick.typed && !ok) hint.textContent = "Must be 5–30";
            else hint.textContent = "";
        }

        // Keyboard, for the panel that's open (see onKey below)
        panelKey = (event) => {
            const k = event.key;
            const digit = /^[0-9]$/.test(k) ? Number(k) : null;
            if (k === "Enter") {
                if (!enter.disabled) choose(value());
            } else if (k === "/") {
                choose(0);
            } else if (isMaximum) {
                return false;
            } else if (face <= 6) {
                if (digit === null || digit < 1 || digit > 5) return false;
                pick.count = digit;
            } else if (key === "max" || key === "min") {
                if (digit !== null) { if (pick.typed.length < 2) pick.typed = (pick.typed + k).replace(/^0+/, ""); }
                else if (k === "Backspace") pick.typed = pick.typed.slice(0, -1);
                else if (k === "Delete") pick.typed = "";
                else return false;
            } else if (key === "straight") {
                if (!STRAIGHT_KEYS[digit]) return false;
                pick.straight = STRAIGHT_KEYS[digit];
            } else {
                if (digit === null || digit < 1 || digit > 6) return false;
                // Full house: the first number is the three, the second the pair; a third press starts over
                if (key === "full" && pick.a && !pick.b) pick.b = digit;
                else { pick.a = digit; pick.b = null; }
            }
            if (closeInput) refresh(); // still open (Enter and / close it)
            return true;
        };

        panel.append(head, rule, body, hint, actions);
        screen.append(layer);
        placeNear(panel, cell);
        refresh();
        (panel.querySelector(".yamb-choice, .yamb-key") ?? enter).focus();
    }

    function sheetAllows(column, key, value) {
        return game.canEnter(sheet, currentPlayer, { column, row: key, value });
    }

    // The notice at the start of a tip turn: dims the screen except the tip cell
    function showTipNotice() {
        const key = sheet.pendingTip;
        const cell = container.querySelector(`.yamb-cell.is-tip[data-row="${key}"]`);
        if (!cell) return;

        const layer = el("div", "yamb-layer is-dimmed");
        const spot = el("div", "yamb-spotlight");
        const area = screen.getBoundingClientRect();
        const target = cell.getBoundingClientRect();
        spot.style.left = `${target.left - area.left}px`;
        spot.style.top = `${target.top - area.top}px`;
        spot.style.width = `${target.width}px`;
        spot.style.height = `${target.height}px`;

        const panel = el("div", "yamb-panel yamb-notice");
        panel.setAttribute("role", "dialog");
        panel.setAttribute("aria-label", `Tip from ${announcer()}`);
        const head = el("div", "yamb-panel-head");
        const tile = el("span", "yamb-panel-icon");
        tile.innerHTML = COLUMN_ICONS.tip;
        const names = el("span", "yamb-panel-names");
        names.append(el("span", "yamb-panel-title", `Tip from ${announcer()}`), el("span", "yamb-panel-sub", "This is your whole turn"));
        head.append(tile, names);
        const what = el("div", "yamb-notice-row");
        what.innerHTML = ROW_ICONS[key];
        what.append(el("span", "yamb-notice-name", ROW_NAMES[key]), el("span", "yamb-notice-col", "Tip column"));
        const text = el("p", "yamb-notice-text", `${announcer()} announced ${ROW_NAMES[key]}. Throw for it, then score it in your Tip column. It's the only cell you can play this turn.`);
        const dismiss = openOverlay(() => layer.remove());
        const ok = button("button-primary yamb-notice-ok", { text: "Got it", onClick: () => dismiss() });
        panel.append(head, what, text, ok);

        layer.append(spot, panel);
        layer.addEventListener("click", (event) => {
            if (event.target === layer) dismiss();
        });
        screen.append(layer);
        placeNear(panel, cell);
        ok.focus();
    }

    draw();
    // Every time a tip turn's sheet is drawn (new turn, undo, redo, Continue), show the notice
    if (sheet.pendingTip) showTipNotice();
}