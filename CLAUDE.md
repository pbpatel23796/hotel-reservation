# hotel-reservation

A small Express + SQLite reservation system for hotel rooms, meeting rooms, and parking spaces: browse resources, price a stay, create a booking, and cancel it.

## Stack

- Node.js (ES modules), Express
- SQLite via `better-sqlite3` (file-based, `booking.db` in the project root, WAL mode)
- Static frontend served from `public/` (vanilla HTML/CSS/JS, no build step)
- Vitest for unit tests, Playwright for e2e tests

## Commands

```
npm start           # run the server (http://localhost:3000)
npm run dev          # run with --watch for local development
npm test             # run unit tests (vitest)
npm run test:watch   # unit tests in watch mode
npm run test:e2e      # run Playwright e2e tests
npm run test:e2e:ui   # Playwright UI mode
npm run lint          # eslint src tests
```

Copy `.env.example` to `.env` to override `PORT` / `NODE_ENV`.

## Architecture

- `src/db.js` — opens the SQLite connection, creates the `resources`, `bookings`, and `pricing_rules` tables on startup, and seeds a few sample resources if the table is empty.
- `src/bookingLogic.js` — all business logic: availability checks, price calculation, booking creation/cancellation, and lookups. No HTTP concerns here; everything takes plain arguments and returns plain objects, and talks to SQLite directly via `db.prepare(...)`.
- `src/server.js` — Express app wiring HTTP routes under `/api/*` to the functions in `bookingLogic.js`. Thin: each route parses the request, calls one function, and maps the result/error to a response.
- `public/index.html` — single-page frontend that calls the `/api/*` endpoints with `fetch`. No framework, no bundler.

Data flow for a booking: frontend → `POST /api/bookings` → `createBooking()` (checks availability, calculates price, inserts a row) → response back to the frontend, which reloads the bookings list.

## Database

Three tables, defined in `src/db.js`:
- `resources` — bookable things (rooms, conference rooms, parking), with a nightly `hourly_rate`.
- `bookings` — one row per reservation, with computed `base_price` / `discount_amount` / `total_price`, and a `status` (`confirmed` / `cancelled`).
- `pricing_rules` — schema exists but is currently unused by the application logic.

The database file and its WAL/SHM siblings are gitignored; deleting `booking.db*` resets to the seeded sample data on next server start.

## Notes

- No feature-development workflow is mandated in this repo — just build and test normally.
