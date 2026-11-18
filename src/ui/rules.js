// ui/rules.js
// The rules as pages you swipe through (or pick with the tabs, or step with Back / Next).
// rulesPager(game, { onDone }) returns one element, so the game menu uses it now
// and the desktop setup screen can use it later.
//
// Swiping is the browser's own sideways scrolling: the pages sit in a strip with
// CSS scroll-snap, so it follows the finger and always stops on a whole page.
// The code only works out which page is showing and updates the tabs and buttons.

import { el, button } from "./dom.js";
import { BACK, CHEVRON, BOLT, DICE, ROW_ICONS, COLUMN_ICONS } from "./icons.js";

// ---------- Small builders ----------

// "Write into **one** open cell" → text with <b>one</b>, without innerHTML
function rich(className, text) {
  const node = el("span", className);
  text.split("**").forEach((part, i) => node.append(i % 2 ? el("b", "", part) : part));
  return node;
}

function steps(lines) {
  const list = el("ol", "rules-steps");
  lines.forEach((line, i) => {
    const item = el("li", "rules-step");
    item.append(el("span", "rules-step-number", String(i + 1)), rich("rules-step-text", line));
    list.append(item);
  });
  return list;
}

function note(text, icon) {
  const box = el("p", "rules-note");
  if (icon) box.insertAdjacentHTML("beforeend", icon);
  box.append(text);
  return box;
}

function card(title, text, example) {
  const box = el("div", "rules-card");
  box.append(el("span", "rules-card-title", title), rich("rules-card-text", text));
  if (example) box.append(el("span", "rules-card-example", example));
  return box;
}

// One line of a table: icon(s) | name and how | points
function row({ icon, name, how, points }) {
  const line = el("div", "rules-row");
  const pic = el("span", "rules-row-icon");
  pic.innerHTML = icon;
  const text = el("span", "rules-row-text");
  text.append(el("span", "rules-row-name", name));
  if (how) text.append(el("span", "rules-row-how", how));
  line.append(pic, text, el("span", "rules-row-points", points));
  return line;
}

function group(label, rows) {
  const box = el("div", "rules-group");
  if (label) box.append(el("span", "rules-group-label", label));
  box.append(...rows.map(row));
  return box;
}

const dice = (...faces) => faces.map((f) => DICE[f]).join("");
const small = (text) => el("p", "rules-small", text);

// ---------- Zonk ----------

function zonkPages() {
  return [
    {
      tab: "Rules",
      title: "How to play",
      build: () => [
        steps([
          "Throw all 6 dice. Set aside the dice that score.",
          "The first score of each turn must be **300+**.",
          "Throw the rest again, or **Bank** to keep your points.",
          "All 6 dice scored? Press **+** and throw all 6 again.",
          "Nothing scores? That's a **Zonk**: the turn's points are lost.",
        ]),
        note("First to the target score wins."),
      ],
    },
    {
      tab: "Scoring",
      title: "Scoring",
      build: () => [
        small("Only scoring dice count · add up what you set aside"),
        group("Single dice", [
          { icon: dice(1), name: "Each 1", points: "100" },
          { icon: dice(5), name: "Each 5", points: "50" },
        ]),
        group("Three of a kind", [
          { icon: dice(1, 1, 1), name: "Three 1s", points: "1,000" },
          ...[2, 3, 4, 5, 6].map((f) => ({ icon: dice(f, f, f), name: `Three ${f}s`, points: String(f * 100) })),
        ]),
      ],
    },
    {
      tab: "Big throws",
      title: "Big throws",
      build: () => [
        group("More of a kind", [
          { icon: dice(4, 4, 4, 4), name: "Four of a kind", how: "four 4s = 800", points: "×2" },
          { icon: dice(4, 4, 4, 4, 4), name: "Five of a kind", how: "five 4s = 1,600", points: "×4" },
          { icon: dice(4, 4, 4, 4, 4, 4), name: "Six of a kind", how: "six 4s = 3,200", points: "×8" },
        ]),
        group("Special throws", [
          { icon: dice(1, 2, 3, 4, 5, 6), name: "Straight", how: "1 to 6", points: "1,500" },
          { icon: dice(2, 2, 4, 4, 6, 6), name: "Three pairs", points: "750" },
        ]),
        small("Four, five and six of a kind multiply the three-of-a-kind score."),
      ],
    },
  ];
}

// ---------- Yamb and Flash Yamb ----------

const COLUMNS = {
  down: ["Down", "Top to bottom"],
  free: ["Free", "Any order"],
  up: ["Up", "Bottom to top"],
  announce: ["Announce", "Call it on throw 1"],
  hand: ["Hand", "One throw only"],
  tip: ["Tip", "Play their announce"],
  middle: ["Middle", "From Max and Min outwards"],
  mandatory: ["Mandatory", "Opens last, top to bottom"],
  maximum: ["Maximum", "Best score only, or /"],
};

function yambPages(game) {
  const hasMandatory = game.columns.includes("mandatory");
  return [
    {
      tab: "Turn",
      title: "Your turn",
      build: () => [
        steps([
          "Throw up to 3 times. Keep any dice you like between throws.",
          "Write your best 5 dice into **one** open cell.",
          "Can't use the throw? Cross a cell out with **/**. It counts as 0.",
          "Next player. When every cell is full, the highest total wins.",
        ]),
        ...(game.rules.tip ? [note(game.rules.tip, BOLT)] : []),
      ],
    },
    {
      tab: "Rows",
      title: "Rows",
      build: () => [
        group("", [
          { icon: ROW_ICONS.ones, name: "Ones to Sixes", how: "Add up only that number", points: "e.g. 4 4 4 → 12" },
          { icon: ROW_ICONS.max, name: "Max", how: "Sum of all 5 dice, aim high", points: "5–30" },
          { icon: ROW_ICONS.min, name: "Min", how: "Sum of all 5 dice, aim low", points: "5–30" },
          { icon: ROW_ICONS.straight, name: "Straight", how: "1–5 or 2–6", points: "66 · 56 · 46" },
          { icon: ROW_ICONS.triple, name: "Triple", how: "Three alike", points: "sum + 20" },
          { icon: ROW_ICONS.full, name: "Full", how: "Three alike + a pair", points: "sum + 30" },
          { icon: ROW_ICONS.poker, name: "Poker", how: "Four alike", points: "sum + 40" },
          { icon: ROW_ICONS.yamb, name: "Yamb", how: "Five alike", points: "sum + 50" },
        ]),
        small("Straight: 66 on throw 1, 56 on throw 2, 46 on throw 3. Five alike is not a Full."),
      ],
    },
    {
      tab: "Totals",
      title: "Totals",
      build: () => [
        card("Sum 1", "Ones to Sixes added up. **+30** if it reaches 60."),
        card("Difference", "(Max − Min) × Ones", "e.g. Max 28, Min 9, Ones 3 → 19 × 3 = 57"),
        card("Sum 2", "Straight to Yamb added up."),
        card("Your total", "Sum 1 + Difference + Sum 2 of every column."),
      ],
    },
    {
      tab: "Columns",
      title: "Columns",
      build: () => {
        const grid = el("div", "rules-columns");
        for (const column of game.columns) {
          const [name, how] = COLUMNS[column];
          const tile = el("div", "rules-column");
          const text = el("span", "rules-row-text");
          text.append(el("span", "rules-row-name", name), el("span", "rules-row-how", how));
          tile.innerHTML = COLUMN_ICONS[column];
          tile.append(text);
          grid.append(tile);
        }
        return [small(`${game.columns.length} columns, each with its own order`), grid];
      },
    },
    {
      tab: "Tip",
      title: "Announce & Tip",
      build: () => [
        card("Announce", "After your first throw, say which row you're going for. You must fill that row in Announce, or cross it out."),
        card("Tip", "The next player then plays that same row in their Tip column. It's their only move that turn."),
        ...(hasMandatory ? [card("Mandatory", "Opens only when all your other columns are full, Tip included.")] : []),
        card("Skipped turn", "Only Tip cells left and nobody announced for you? Your turn passes until someone does."),
      ],
    },
  ];
}

// ---------- Keys (only with a mouse and keyboard) ----------

const HAS_KEYBOARD = "(hover: hover) and (pointer: fine)";

// One line: key caps | what they do. "Ctrl+Z" becomes two caps, "1–5" stays one
function keyRow(keys, what) {
  const line = el("div", "rules-key");
  const caps = el("span", "rules-key-caps");
  for (const key of keys) caps.append(el("kbd", "", key));
  line.append(caps, rich("rules-key-what", what));
  return line;
}

function keyGroup(label, rows) {
  const box = el("div", "rules-group");
  box.append(el("span", "rules-group-label", label), ...rows.map(([keys, what]) => keyRow(keys, what)));
  return box;
}

const EVERYWHERE = [
  [["Esc"], "Back, or close what's open"],
  [["Ctrl", "Z"], "Undo"],
  [["Ctrl", "Y"], "Redo"],
];

function keysPage(game) {
  const groups = [keyGroup("Everywhere", EVERYWHERE)];
  if (game.id === "zonk") {
    groups.push(
      keyGroup("On the sheet", [
        [["0–9"], "Type the throw"],
        [["Backspace"], "Delete the last digit"],
        [["+"], "Plus: all dice scored, keep throwing"],
        [["Enter"], "Bank"],
        [["Z"], "Zonk"],
      ]),
    );
  } else {
    groups.push(
      keyGroup("On the sheet", [
        [["←", "↑", "→", "↓"], "Jump between open cells"],
        [["Enter"], "Score the chosen cell"],
        [["Enter"], "Again: **Confirm turn**"],
      ]),
      keyGroup("In the score panel", [
        [["1–5"], "Ones to Sixes: how many"],
        [["0–9"], "Max / Min: type the sum"],
        [["1", "2", "3"], "Straight: which throw (66 / 56 / 46)"],
        [["1–6"], "Triple, Poker, Yamb: the number"],
        [["1–6", "1–6"], "Full: the three, then the pair"],
        [["/"], "Cross out"],
        [["Enter"], "Enter"],
      ]),
    );
  }
  return { tab: "Keys", title: "Keyboard shortcuts", build: () => groups };
}

// ---------- The pager ----------

export function rulesPager(game, { onDone } = {}) {
  const pages = game.id === "zonk" ? zonkPages() : yambPages(game);
  if (matchMedia(HAS_KEYBOARD).matches) pages.push(keysPage(game)); // phones don't get a Keys page
  const last = pages.length - 1;
  let current = 0;

  const pager = el("div", "rules-pager");

  // Tabs: jump straight to a page
  const tabs = el("div", "rules-tabs");
  tabs.setAttribute("role", "tablist");
  const tabButtons = pages.map((page, i) => {
    const tab = button("rules-tab", { text: page.tab, onClick: () => goTo(i) });
    tab.setAttribute("role", "tab");
    tabs.append(tab);
    return tab;
  });

  // The strip of pages; scroll-snap (CSS) makes every swipe stop on a whole page
  const strip = el("div", "rules-strip");
  pages.forEach((page) => {
    const section = el("section", "rules-page");
    section.setAttribute("role", "tabpanel");
    section.setAttribute("aria-label", page.title);
    section.append(el("h3", "rules-page-title", page.title), ...page.build());
    strip.append(section);
  });

  // Back / count / Next (Done on the last page)
  const nav = el("div", "rules-nav");
  const prev = button("rules-prev", { icon: BACK, text: "Back", onClick: () => goTo(current - 1) });
  const count = el("span", "rules-count");
  const next = button("rules-next", { onClick: () => (current === last ? onDone() : goTo(current + 1)) });
  nav.append(prev, count, next);

  pager.append(tabs, strip, nav);

  let target = null; // the page goTo is sliding to; the scroll listener waits for it
  function goTo(i) {
    const page = Math.max(0, Math.min(last, i));
    const smooth = !matchMedia("(prefers-reduced-motion: reduce)").matches;
    target = page;
    strip.scrollTo({ left: page * strip.clientWidth, behavior: smooth ? "smooth" : "auto" });
    show(page); // update right away; the scroll listener agrees once the slide ends
  }

  // Tabs, count and buttons follow whichever page is showing
  function show(page) {
    current = page;
    tabButtons.forEach((tab, i) => {
      tab.setAttribute("aria-selected", String(i === page));
      tab.tabIndex = i === page ? 0 : -1; // Tab reaches only the selected tab; ← → move between them
    });
    count.textContent = `${page + 1} / ${pages.length}`;
    prev.disabled = page === 0;
    next.replaceChildren(page === last && onDone ? "Done" : "Next");
    next.disabled = page === last && !onDone; // without onDone (setup), the last page just stops
    next.insertAdjacentHTML("beforeend", CHEVRON);
  }

  // A swipe moves the strip itself; read the page from how far it has scrolled
    // A swipe moves the strip itself; read the page from how far it has scrolled
  let frame = 0;
  strip.addEventListener("scroll", () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const page = Math.round(strip.scrollLeft / strip.clientWidth);
      if (target !== null) {
        if (page !== target) return; // still sliding to the page goTo chose: don't jump back
        target = null;
      }
      if (page !== current) show(page);
    });
  });
  // A swipe or the mouse wheel takes over from goTo's slide
  for (const type of ["pointerdown", "touchstart", "wheel"]) {
    strip.addEventListener(type, () => (target = null), { passive: true });
  }

  // Keyboard: ← and → also turn pages (handy on desktop). If a tab has the focus,
  // the focus moves along with the page, so the ring is always on the selected tab
  pager.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight") goTo(current + 1);
    else if (event.key === "ArrowLeft") goTo(current - 1);
    else return;
    event.preventDefault();
    if (tabButtons.includes(document.activeElement)) tabButtons[current].focus();
  });

  show(0);
  return pager;
}