# Dice'n'Roll

Keep score. Roll real dice.

A score tracker for dice games played with real dice: **Zonk**, **Yamb** and
**Flash Yamb**. Add the players, pick a game, and the app keeps the sheet, the
totals and whose turn it is.

**Play it:** https://bandamarko.github.io/dice-n-roll/

## Features

- Zonk: typed throws, Plus, Bank and Zonk, first to the target score wins
- Yamb and Flash Yamb: the full scoresheet, with announce, tip and every column
- Undo and redo, and the game is saved after every move
- Rules for every game inside the app
- Works offline and installs like an app (PWA)
- Light and dark mode
- Phone and desktop layouts, with keyboard shortcuts on desktop

## Running it locally

You need [Node.js](https://nodejs.org/) (version 20 or newer).

    npm install
    npm run dev

`npm run build` makes the finished site in `dist/`. Every push to `main` is
built and published to GitHub Pages by `.github/workflows/deploy.yml`.

Built with [Vite](https://vite.dev/) and plain JavaScript, no framework.
`DESIGN.md` describes how the app is put together.

## Privacy

Dice'n'Roll has no accounts, no ads and no tracking. Players, scores and saved
games stay on your device (in the browser's storage) and are never sent
anywhere. The site is hosted on GitHub Pages, which keeps the usual server logs;
see [GitHub's privacy statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement).

## License

Source-available under the [PolyForm Noncommercial License 1.0.0](LICENSE.md):
free to use, change and share for non-commercial purposes (personal projects,
learning, schools, charities), as long as the copyright notice stays with it.
For commercial use, ask me first.
© 2026 Marko Banda (bandamarko)

The fonts [Inter](https://github.com/rsms/inter) and
[Bricolage Grotesque](https://github.com/ateliertriay/bricolage) are licensed
under the SIL Open Font License 1.1 (`public/fonts/OFL.txt`).