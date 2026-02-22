# Demo Builder

A guided workflow app for planning and scripting product demos. Walk through each stage of demo preparation — from gathering requirements to writing a talk track — all in one place.

## What It Does

Demo Builder breaks demo creation into seven sequential steps:

1. **Requirements** — Capture what the demo needs to cover. Items can be marked pending, completed, or rejected, and reordered via drag-and-drop.
2. **Takeaway** — Design a thumbnail card with a headline, gradient background, and image. Also compose a social-style post with poster avatar and title.
3. **From/To Shift** — Illustrate the before and after: life without vs. with the product, using images and text.
4. **Storyboard** — Lay out the demo narrative across visual panels (Context, Challenge, Solutions, Outcome). Drag images between panels to rearrange.
5. **Outline** — Build an ordered list of talking points with drag-and-drop reordering and length guidance.
6. **Script** — A detailed grid of screenshot, talk track, and click path for each step. Supports smart-paste from spreadsheets/tables.
7. **Watch** — Embed a video of the finished demo (supports Vidyard and Google Drive video links).

Navigate between steps using the top nav bar or the left/right arrow keys.

### Image Handling

Images are stored **out-of-band** — separately from the demo's JSON data — and referenced by ID. This preserves full-resolution originals without bloating autosaves or sync payloads.

- **Local mode** — images are stored as full-resolution PNGs in IndexedDB.
- **Postgres mode** — images are stored in a dedicated `images` table and served at `/images/:id` with immutable cache headers. Right-clicking an image and choosing "Save Image As" gives a meaningful filename.
- **Migration** — demos that contain legacy inline base64 images (from older versions) are automatically migrated to out-of-band storage the first time they are saved.

### Storage & Sync

- **Local storage** — Demos are saved automatically to IndexedDB in the browser.
- **PostgreSQL** — When a `DATABASE_URL` is configured on the server, all demos and images are stored in a Postgres database.
- **Import / Export** — Demos are exported as **ZIP files** containing `demo.json` and a `images/` folder with all referenced images. Legacy JSON exports from older versions can still be imported.

### Auto-Save Behavior

All changes are saved automatically — there is no manual save button.

- Saves are **debounced**: after you stop making changes, a short delay fires before writing. Local saves use a ~400ms delay; Postgres saves use ~2 seconds to avoid excessive network requests.
- A **save status indicator** in the top bar shows when a save is in-flight and confirms when it completes.
- On page close or refresh, any pending changes are **flushed immediately** to localStorage as a safety net and recovered on the next load, guarding against data loss if the network is slow.

### Remote Change Detection

When using PostgreSQL, the app polls for external changes every 30 seconds.

- Polling checks only a **lightweight metadata endpoint** (last-modified timestamp) before deciding whether to fetch full data, keeping background traffic minimal.
- Polling is **paused while the tab is hidden** and resumes when you switch back.
- If an external change is detected, the local state is updated automatically with no action required.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)

### Install & Run

```bash
npm install
npm run dev
```

The app will be available at `http://localhost:5173`.

### Build for Production

```bash
npm run build
npm start          # serves the production build on port 3000 (or $PORT)
```

## Configuration

All configuration is done via environment variables. Create a `.env` file in the project root (for local dev) or set these as config vars in your hosting environment.

### PostgreSQL (Optional)

Set a Postgres connection string to switch the app into database mode:

```
DATABASE_URL=postgres://user:password@host:5432/dbname
```

When this is set, all demo data and images are stored in Postgres tables which are created automatically on startup.

For remote databases (e.g. Heroku Postgres), SSL is enabled automatically. For `localhost`, SSL is skipped.

### Site Password (Optional)

To restrict access to the app with HTTP Basic Auth, set:

```
SITE_PASSWORD=your-password
```

When set, the browser will prompt for a password before allowing access. Any username is accepted; only the password is checked. Credentials are cached by the browser for the session.

## Deploying to Heroku

1. Create a Heroku app and add the **Heroku Postgres** add-on.
2. Set config vars in the Heroku dashboard (or via the CLI):

```bash
heroku config:set SITE_PASSWORD=your-password
```

`DATABASE_URL` is set automatically by the Heroku Postgres add-on.

3. Push and deploy:

```bash
git push heroku main
```

Heroku will run `npm run build` and then `npm start`. The server listens on `$PORT`, which Heroku sets automatically.

## Tech Stack

- React 19, Vite 7, Tailwind CSS 4
- dnd-kit for drag-and-drop
- react-router-dom for routing
- IndexedDB (local) + PostgreSQL (server) for image and demo storage
- JSZip for ZIP-based export/import
- Express for the production server and API
