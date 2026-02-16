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

### Storage & Sync

- **Local storage** — Demos are saved automatically to IndexedDB in the browser.
- **Google Drive** — Optionally sign in with Google to save demos to Drive, with background polling for external changes. Demos can be moved between local and Drive storage at any time.
- **Import / Export** — Demos can be exported as JSON files and imported on another machine.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)

### Install & Run

```bash
npm install
npm run dev
```

The app will be available at `http://localhost:5173`.

### Google Drive Integration (Optional)

To enable Google Drive sync, create a `.env` file in the project root:

```
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id
VITE_GOOGLE_API_KEY=your-google-api-key
```

These come from a Google Cloud project with the Google Drive API enabled and an OAuth 2.0 client ID configured. Without these variables the app works fully in local-only mode.

### Build for Production

```bash
npm run build
npm run preview   # preview the production build locally
```

## Tech Stack

- React 19, Vite 7, Tailwind CSS 4
- dnd-kit for drag-and-drop
- react-router-dom for routing
- IndexedDB + Google Drive API for storage
