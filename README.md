# Phase 10 Score Keeper

A lightweight, static Phase 10 score-tracking app. No build step, no backend,
no database — just `index.html`, `styles.css`, and `app.js`. Game state lives
in the browser's `localStorage` for the current session.

## Running it

Open `index.html` directly in a browser, or serve the folder with any static
file server, e.g.:

```
npx serve .
```

## How it works

1. **Add players** — enter names one at a time on the setup screen (2+
   required), then **Start Game**.
2. **Play a round** — after each hand, enter each player's points for the
   round and check **Completed phase** for anyone who finished their current
   Phase 10 phase. Submit to advance the round.
3. The scoreboard shows each player's current phase and running total score;
   round-by-round history is available further down the page.
4. Once a player completes all 10 phases, they're flagged as a leader (lowest
   score among finishers wins, per standard Phase 10 rules).
5. **New Game** clears the session and starts fresh.

No scores or player data are sent anywhere — everything stays local to the
browser tab/session.

## SEO / landing content

`index.html` also carries a short marketing intro (tagline, feature list, "how
it works", FAQ) above the setup form — real static copy for search engines and
new visitors, hidden automatically once a game is in progress so returning
players go straight to their scoreboard. Related files:

- `robots.txt`, `sitemap.xml` — crawler discovery, at the repo root
- `assets/og-image.png` — social share preview (Open Graph / Twitter Card)
- Meta description, canonical link, and JSON-LD `WebApplication` structured
  data live in `<head>`

The canonical/OG URLs assume this is served at
`https://salocreative.github.io/Phase-10/` — update them if that changes
(e.g. a custom domain).
