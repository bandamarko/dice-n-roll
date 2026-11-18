# Dice'n'Roll: design notes

Score tracker for physically thrown dice. Pass-and-play on one device.
Repo: bandamarko/dice-n-roll. Live at bandamarko.github.io/dice-n-roll/.
Features still to build are in TODO.md.

## Platform

- PWA built with Vite, plain HTML/CSS/JS, hosted free on GitHub Pages; also runs on localhost.
- Works in the browser on Android and iOS; installable (also on desktop via Chrome/Edge).
- Single-page app: one index.html, JS swaps screens inside <div id="app">.
  Phones get a 480 px column; on desktop (min-width 1024px and min-height 600px)
  screens with a desktop design (welcome, picker, Yamb sheet so far) widen to
  max 1440 px, centred.
- Deploy: .github/workflows/deploy.yml runs on every push to main: npm ci,
  npm run build (base "/dice-n-roll/" in vite.config.js), publishes dist/.
  Settings → Pages → Source must be "GitHub Actions" (with "Deploy from a branch",
  GitHub publishes the raw repo too, and the site asks for /src/main.js and breaks).

## Structure

- index.html: theme script, manifest, icons, theme-color meta, link-preview (Open Graph) tags
- public/: copied as-is into the built site
  - manifest.webmanifest, sw.js (service worker), favicon.svg, og-image.png
  - icons/: icon-192.png, icon-512.png, maskable-512.png, apple-touch-icon.png
- src/main.js: wires screens to the router, starts theme and router, registers the
  service worker (built app only)
- src/assets/: every SVG (logo, icons, Yamb column/row/dice icons), imported with ?raw
- src/games/: pure game rules, no DOM (index.js registry, zonk.js, yamb.js)
- src/state/: game.js (createGame, playMove, getWinners), history.js (undo/redo)
- src/storage/: storage.js (save/load JSON in localStorage)
- src/ui/: router.js, theme.js, themeSwitch.js, dom.js, icons.js, dialog.js,
  welcome.js, picker.js, setup.js, starterSpinner.js, game.js, gameMenu.js, end.js,
  confetti.js, sheets/zonk.js, sheets/yamb.js, rules.js
- Layers: games/ and state/ never touch the DOM; ui/ uses everything.

## Game state

- { gameId, players, currentPlayer, sheet, skipped }
- The sheet shape belongs to each game. Totals are always computed, never stored.
- Everything is immutable: functions return new objects (spread, map).
- null = empty cell, 0 = crossed out (shown as "/").
- The starting player is picked at random by createGame.
- skipped: players skipped by the last move (drives the "can't play" popup).

## Game interface

- id, name, summary, rules { extra?, bullets, tip? }, minPlayers, maxPlayers, dice, defaultOptions
- createSheet(players, options)
- canEnter(sheet, player, entry): checks everything, never trusts the UI
- applyEntry(sheet, player, entry) → { sheet, turnEnded }
- computeTotals(sheet) → one total per player
- isFinished(sheet)
- hasMove(sheet, player): optional; playMove skips players with no legal move
- Registry: getGame(id) (Object.hasOwn check), gameList

## Zonk

- 1–8 players, 6 dice. Target 3000 / 5000 (default) / 10000 / Custom (1000–100000).
- Every score is a multiple of 50.
- Each turn's first set of throws must reach 300 (300 counts) before "+" is used;
  after "+", any amount.
- "+" when all dice have scored; Bank adds the turn to the total; Zonk ends the turn with 0.
- Reaching the target ends the game immediately.
- No confirm step: Bank and Zonk are already deliberate.
- Scoring table (for the rules pages, the app doesn't check it):
  each 1 = 100, each 5 = 50; three 1s = 1,000, three 2s–6s = 200–600;
  four / five / six of a kind = three of a kind ×2 / ×4 / ×8;
  straight 1–6 = 1,500; three pairs = 750.

## Yamb

- 2–8 players, 6 dice, 3 throws, one cell per turn.
- Rows: ones–sixes, (Sum 1), Max, Min, (Difference), Straight, Triple, Full house,
  Poker, Yamb, (Sum 2).
- Sheet: { grids: [{ column: [13 cells] } per player], pendingTip: row name or null }

### Scoring

- Sum 1 = ones–sixes, +30 if 60 or more.
- Max / Min = sum of the best 5 dice (5–30).
- Difference = (Max − Min) × Ones, never below 0, same column.
- Straight = 1–5 or 2–6; the player picks 66 (made on throw 1), 56 (throw 2) or 46 (throw 3).
- Triple = 3 × face + 20. Full house = sum + 30 (two different numbers; five of a
  kind is not a Full). Poker = 4 × face + 40. Yamb = 5 × face + 50.
- Final = all Sum 1 + all Difference + all Sum 2.
- Highest total wins; equal totals share the win.
- Impossible values are refused (e.g. Full house 59).

### Columns (in this order)

- Down: top to bottom. Free: any order. Up: bottom to top.
- Announce: called on the first throw. Any entry in Announce (score or "/") sets
  pendingTip to that row for the next player.
- Hand: all dice in one throw.
- Tip: only filled from the previous player's announce. With a tip waiting, that
  Tip cell is the only legal move; without one, Tip is closed. Each row can be
  announced only once, so the announced Tip cell is always still empty.
- From middle: from Max upward and from Min downward.
- Mandatory: opens when every other column is full, Tip included; top to bottom.
- Maximum: only the best value for the row, or "/".
  (5, 10, 15, 20, 25, 30, Max 30, Min 5, Straight 66, Triple 38, Full 58,
  Poker 64, Yamb 80)
- The app doesn't check physical things (one throw for Hand, announcing on the
  first throw, 3 throws): players' honour.

### Turns

- A player with no legal move is skipped with a popup. That happens when only
  Tip cells are left and nobody announced for them; the turn passes until someone does.
  Applies to Yamb and Flash Yamb.

## Flash Yamb

- Same rules and scoring as Yamb; only Down, Free, Up, Announce, Hand, Tip (Yamb's order).
- 2–8 players. Its own card; rules add "Tip: try it with 5 dice".
- Code: createYambVariant({ id, name, summary, rules, columns }) exports yamb and flashYamb.

## Undo / redo

- history = { current, undoStack, redoStack }; snapshots by reference (state is immutable).
- A new move clears redo. pendingTip lives in the sheet, so undo handles tips too.

## Storage

- localStorage key "dice-n-roll:current-game", SAVE_VERSION 1.
- Older saves under "dice-n-fun:…" (the old name) are moved once, unchanged, to
  the new keys on start (moveOldSaves in storage.js).
- Saves { version, current, undoStack } after every move; redo isn't saved.
- Missing, broken or old-version save → start fresh.
- A finished game stays saved while its end screen is open (a refresh still shows
  the results); Done, Play again or back clears it.
- Theme stored under "dice-n-roll:theme" (index.html also reads the old
  "dice-n-fun:theme" on that first start, so dark mode doesn't flash).
- The service worker's copy of the app is separate: updating the app never touches saves.
- Only the last 50 undo steps are saved (SAVED_UNDOS); in the open app undo goes all the way back.

## Offline and updates (public/sw.js)

- On install, saves index.html, every assets/ file it points to, the manifest,
  favicon and two icons. One missing file makes the install fail (and it retries
  on the next visit).
- Updates: the app opens from the saved copy and downloads a new version in the background.
  It also checks when you come back to it (at most once a minute). When a newer version is saved,
  a bar at the bottom says "New version ready" with Reload and ×. Nothing reloads by itself; × hides it until the next open.
- Downloads run one at a time, so opening the app and a check can't clash.
- Vite renames a file when its content changes, so saved assets never go stale.
  Files are saved before the page; files older than the previous version are deleted.
- Fonts are our own (public/fonts), saved with the app; no requests to Google.
- Only registered in the built app (import.meta.env.PROD), never during npm run dev.
- Manifest: "Dice'n'Roll", standalone, portrait, background and theme #EAF4FB,
  icons 192 / 512 / maskable 512 (the die inside the middle 80%).

## Versions

- Numbered MAJOR.MINOR.PATCH in package.json ("version").
- 0.0: before publishing.
- 1.0.0: the publish.
- 2.0.0: online / peer-to-peer play.
- After 1.0: a new feature bumps MINOR (1.1.0), a bug fix bumps PATCH (1.1.1).
- The update check doesn't use this number; it compares the built file names.

## UI

- Screens: welcome → picker → setup → (spinner) → scoresheet → end screen.
- The app always starts on welcome (refresh, reopen or killed app alike);
  "Continue game" shows when a save exists.
- Welcome: sticker logo, "Score tracker for real dice", theme switch, Continue game, New game.
- Welcome on desktop: the same screen centred and about 1.5× bigger (logo text 70 px,
  die 99 px, tagline 20 px), logo and buttons together in the middle, buttons 420 px
  wide, theme switch in the top-right corner. Canvas board 20A.
- Picker: one card per game, all the same height. Tap the card to flip it to its
  rules (several can be flipped); a separate Play button opens setup. Coming back,
  all cards are unflipped.
- Picker on desktop: the cards in one row (auto-fit, min 260 px, so a 4th game
  still fits), centred on the screen, max 1200 px with the header lined up; bigger
  text; the card under the mouse gets an accent outline; the hint says "Click for rules".
- Setup: names up to 16 characters, no duplicates; reorder by the grip handle
  (drag, or arrow keys). Names stay when switching games; the player-count check
  only runs when Start is pressed. Start saves the game, then opens it.
  - With a mouse and keyboard, the name field has the focus when setup opens (not on touch screens).
  - Setup on desktop (canvas board 18): the rules pages on the left (rulesPager without
    onDone, so the last page has no Done), Players (+ Target score for Zonk) on the right,
    Start game pinned to the bottom; name rows 40 px so 8 players fit without scrolling.
- Starter spinner: after Start, names roll through a slot window and stop on the
  (already random) starting player. Tap skips; no re-spins; skipped for 1 player
  and on Continue. The header hides the turn name until it closes.
- Game menu (tap the logo on a scoresheet): Rules (opens the rules pages), Theme |
  New game (asks to confirm, ends the saved game), Quit to welcome (game stays saved).
- Popups use one shared dialog; back closes it.
- The phone's status bar follows the theme (theme-color meta, set by the inline
  script and by theme.js).
- No zooming: viewport maximum-scale=1 / user-scalable=no (Android), html
  touch-action: pan-x pan-y (pinch and double tap), gesturestart prevented (iPhone).
- No overscroll: html and body have overscroll-behavior: none, so screens that fit
  don't bounce or stretch, and pull-to-refresh can't reload the page mid-game.
  Screens that are taller (the picker on small phones) still scroll normally.
- Keyboard (any screen size): Esc = back (closes overlays, leave popup, previous
  screen); does nothing on the first screen with nothing open, or while typing in a
  field. On a scoresheet Ctrl+Z = Undo, Ctrl+Y / Ctrl+Shift+Z = Redo (Cmd on Mac);
  they press the real buttons and are ignored while a menu, popup or score panel is open.
- Focus ring: :focus-visible gets a 2 px accent outline (keyboard only, not on taps).
- Short phone screens (≤ 760 px tall): Zonk's numpad keys, action buttons and player
  cards shrink (clamp on dvh) so 1–8 players fit without scrolling.
- Desktop setup is exactly the screen's height; the rules pages and the name list
  scroll inside their cards.
- Tap targets on phones are at least 40 px (rules tabs, peek bar); the Yamb rows
  shrink a little while the peek bar is showing.

### End screen

- "<Game> · game over", then the trophy card: trophy, "<Name> wins!", the winning
  score, "points · N ahead of <runner-up>".
  - Tie: "It's a tie!", "points each · Ana & Marko share the win".
  - One player (Zonk): "Well done, <Name>!".
- Ranking: rank circle (gold / silver / bronze, then plain), name, "−N" behind the
  winner, total, and a bar (score ÷ winner's score). Tied players share a rank
  (1, 1, 3); every winner gets the gold circle, bold name and the accent bar.
- Play again: clears the save, opens setup with the same players (same order)
  and the same options (e.g. Zonk target); back from there goes to welcome.
- Done (and back): clears the save, goes to welcome.
- Victory effect, only when the last move just ended the game (not on Continue):
  the trophy pops in, then confetti bursts from behind it (blues + gold from the
  theme), floats down for ~5 s and fades. Canvas, taps go through. Skipped when
  the phone asks for reduced motion.
- Designed on the canvas (option B, trophy card), with light, dark and tie boards.

#### Desktop (style.css, Desktop section; canvas board 19)

- Two columns, kept together in the middle: the trophy card (580 × 580, shorter on
  short screens) on the left; the ranking, Play again and Done on the right (480 px).
- Bigger type: title 44 px, score 72 px, ranks 36 px, names and totals 18 px.
- With many players on a short screen the ranking scrolls; the buttons stay visible.
- "Compare sheets" (Yamb) joins Play again when that feature is built.

### Rules pages (ui/rules.js)

- rulesPager(game, { onDone } = {}) builds tabs, a swipeable strip of pages and
  Back / "2 / 5" / Next. With onDone (the game menu), Next becomes Done on the last
  page; without it (the desktop setup screen), Next is disabled there. One element,
  so both places reuse it.
- In the game menu: a full-height panel (same size on every page) with a back arrow
  to the menu, "<Game> rules" and the facts line. Done closes the whole menu.
  On desktop it is 600 px wide, under the logo (canvas board 23A).
  Back / Esc return to the menu list, like the back arrow; Done and tapping outside close the whole menu.
- Swiping is native scrolling: CSS scroll-snap (x mandatory, snap-stop always), so it
  follows the finger and stops on a whole page. The code only reads which page is
  showing (scrollLeft ÷ width) and updates the tabs, count and buttons. Tabs and
  Back / Next scroll there smoothly (instantly with reduced motion). While they slide
  the strip, the scroll listener waits for the slide to end, so the highlight never
  jumps back to the old tab; a swipe or the mouse wheel takes over.
- Keyboard: ← / → turn the pages; when a tab has the focus it moves with the page.
  Only the selected tab is reachable with Tab, and tabs have no focus ring (the
  highlight shows it). The strip and the pages are not Tab stops (tabIndex -1, no focus ring).
- Text uses **bold** markers turned into <b> elements (never innerHTML).
- Zonk, 3 pages: Rules (5 steps, "First to the target score wins") · Scoring (single
  dice, three of a kind) · Big throws (four / five / six of a kind ×2 / ×4 / ×8,
  straight, three pairs). Dice drawn solid blue.
- Yamb and Flash Yamb, 5 pages: Turn (4 steps; Flash adds its 5-dice tip) · Rows
  (icon, how, points) · Totals (Sum 1, Difference with an example, Sum 2, total) ·
  Columns (icon tiles from game.columns: 9 or 6) · Tip (Announce, Tip, Mandatory
  for Yamb only, Skipped turn).
- The picker card's flipped side keeps the short bullets from game.rules.
- Designed on the canvas: boards 13 (light + dark).
- Keys page (last tab), only with a mouse and keyboard ((hover: hover) and
  (pointer: fine)): key caps (<kbd>) with what they do, grouped Everywhere /
  On the sheet / In the score panel. Zonk: 0–9, Backspace, +, Enter = Bank, Z = Zonk.
  -When the window is resized, the same page stays in view (ResizeObserver).

### Zonk sheet

- Player rows with totals and progress bars toward the target (two columns for 5–8).
- "This turn" (with "+ used"), the throw being typed, a numpad, Zonk / + / Bank N.
- A hint explains why + or Bank is disabled (steps of 50, first throw 300+).
- Keyboard: 0–9 type the throw, Backspace deletes, Delete clears, + = Plus,
  Enter = Bank (only when allowed and no button has the focus; a focused button gets
  its own Enter), Z = Zonk. Listed on the rules' Keys page.

### Yamb sheet

- Player chips at the top (scroll sideways for many players); tap another player's
  chip to view their sheet read-only ("Back to <name>'s turn", or back button).
- Grid with icons for rows and columns (names in the HTML, hidden on phones);
  rows shrink on short phones so the sheet never scrolls.
- Open cells = what canEnter allows; locked cells are grey; finished columns look the same.
- Tapping an open cell opens a floating score panel next to it (below the cell in
  the top half, above it in the bottom half) with the column's icon and a live preview:
  dice count for Ones–Sixes, numpad for Max/Min, 66/56/46 for Straight (by throw), faces for
  Triple/Poker/Yamb, two face rows for Full house; Maximum shows only its best value.
  Enter only enables for a legal value.
- Enter or "/" makes a pending entry (own color, sums and total preview); another
  cell can replace it; "Confirm turn" in the bottom bar plays it. Pending entries
  aren't saved.
- Tip turn: a notice dims the screen except the tip cell ("Tip from <name>: <row>");
  it shows every time a tip turn is drawn (new turn, undo, redo, Continue); the
  bottom bar can reopen it.
  - Undo with a pending entry only erases it (the turn stays); with nothing pending,
    Undo goes back a real move. Redo is disabled while an entry is pending.

#### Desktop (style.css, Desktop section; canvas board 15)

- Three columns: mini sheets (232 px) | the sheet | a right card (330 px).
- Mini sheets: name, tag, total and a tiny map of the sheet (filled / crossed /
  empty), in turn order starting one player back, so the current player is always
  2nd (Last · Playing · Next). Four fit; the rest scroll (thin themed scrollbar).
  Clicking one peeks at that sheet, same as the chips on phones.
- The sheet shows row and column names (already in the HTML, hidden on phones).
- The right card: Total and Confirm turn at the bottom (the bottom bar, restyled);
  the score panel fills its top part, with a line saying what the row scores.
  No dimming: clicking another open cell switches the panel (closeInput).
- placeNear() only sets --panel-top / --panel-bottom; phones use them, desktop ignores them.
- The hint says "Click" with a mouse, "Tap" on touch screens.
- Keyboard: arrows jump to the nearest open cell in that direction (same row / column
  preferred; the first press starts on the first open cell, an open panel closes);
  Enter opens the focused cell. In the panel: Ones–Sixes 1–5 = how many; Max / Min
  type the sum, Backspace, Delete clears; Straight 1 / 2 / 3 = which throw (66 / 56 / 46);
  Triple / Poker / Yamb 1–6; Full house first digit = three, second = pair; / = cross
  out; Enter = Enter; Esc = cancel. With an entry pending, Enter again = Confirm turn.
  The keys are listed on the rules' Keys page.

### Back button

- Closes an open overlay first (score panel, game menu, popup, peek, spinner); in the game menu's rules it goes back to the menu list first.
- On a scoresheet with nothing open: "Leave the game? It stays saved." [Keep playing] [Leave].
- On the end screen: same as Done.
- Setup → picker → welcome; back on welcome closes the app.
- The router keeps its own screen stack and only adds history entries during a tap
  (browsers skip ones added without user interaction); it never removes them.
  Many backs in a row without touching the screen eventually leave the app;
  the game is saved, so Continue resumes it.
- screenSignal(): an AbortSignal cancelled when the screen changes; window listeners use it (and the sheet's own per redraw), so none are left behind.

## Theme

- Light and dark; default follows the phone, the toggle's last tap wins.
  - <meta name="color-scheme" content="light dark">: the browser knows we have both, so
    Android's "darken websites" / in-app browsers don't repaint the page and report the
    phone's real setting. The light theme uses "color-scheme: only light" for the same reason.
- CSS variables in style.css, switched by data-theme on <html>; an inline
  script in index.html sets it before the first paint.
- Switching fades the color variables (@property, 0.3 s) and slides the switch;
  instant when the phone asks for reduced motion.
  - Self-hosted variable fonts: Inter 100–900, Bricolage Grotesque 200–800.
- New theme colors need: a light value, a dark value, an @property line and a transition line.
- Light: bg #EAF4FB, text #0E2A3D, muted #4A6578, card #FFFFFF, accent #1F6FC2.
- Dark: bg #0B1824, text #E6F1FA, muted #9DB6CA, card #14273A, accent #4A9EEB.
- Danger (Zonk button, destructive actions): #C0392B (dark #E0604F).
- End screen: gold #FFC24B, silver #C9D3DD, bronze #E3A869; bar #5B9BD9 (dark #6FAEE8).
- SVG assets carry their light colors as attributes on the element that has the
  class, so CSS can override them per theme.
  - Hover (mouse only, @media (hover: hover)), canvas board 22 option A: colour shift +
    soft shadow + 3 px glow ring, 0.15 s. Filled buttons get 14 % lighter and glow in
    their own colour (red for Zonk / danger); everything else gets a 12 % accent tint
    and the accent glow. Built from --hover-glow, --hover-glow-danger, --hover-lighten
    and --hover-tint; the colour shift is an inset shadow so it fades with the glow.
    Disabled and already-selected things don't react. Yamb open cells and mini sheets
    included.

## Branding

- Name: Dice'n'Roll. Icon: 3D rounded die (faces 1, 2, 3 visible) on a blue tile.
- Logo: sticker version with a dice trail and a yellow sparkle.
- The app icon doubles as the game-menu button on scoresheets, the favicon and
  the home-screen icon.
- Link preview: public/og-image.png (1200 × 630, canvas board 21C: the sticker logo
  on the accent blue, "Keep score. Roll real dice.", the tagline, game chips).
  Open Graph + twitter:card tags in index.html, with full https addresses.
