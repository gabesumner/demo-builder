import express from "express";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const SITE_PASSWORD = process.env.SITE_PASSWORD;
const storageMode = process.env.DATABASE_URL ? "postgres" : "local";

// HTTP Basic Auth
if (SITE_PASSWORD) {
  app.use((req, res, next) => {
    const auth = req.headers.authorization;
    if (auth) {
      const [, encoded] = auth.split(" ");
      const [, password] = Buffer.from(encoded, "base64").toString().split(":");
      if (password === SITE_PASSWORD) return next();
    }
    res.set("WWW-Authenticate", 'Basic realm="Protected"');
    res.status(401).send("Unauthorized");
  });
}

// Config endpoint — tells the frontend which storage mode to use
app.get("/api/config", (_req, res) => {
  res.json({ storageMode });
});

// --- Postgres API (only when DATABASE_URL is set) ---
if (process.env.DATABASE_URL) {
  const { initDb, getPool } = await import("./src/db/db.js");
  await initDb();

  app.use(express.json({ limit: "20mb" }));

  // List all demos (metadata only)
  app.get("/api/demos", async (_req, res) => {
    const { rows } = await getPool().query(
      "SELECT id, name, last_modified FROM demos ORDER BY last_modified DESC"
    );
    res.json(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        lastModified: Number(r.last_modified),
        storage: "postgres",
      }))
    );
  });

  // Get single demo
  app.get("/api/demos/:id", async (req, res) => {
    const { rows } = await getPool().query(
      "SELECT name, data, last_modified FROM demos WHERE id = $1",
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    res.json({
      name: rows[0].name,
      data: rows[0].data,
      lastModified: Number(rows[0].last_modified),
    });
  });

  // Create demo
  app.post("/api/demos", async (req, res) => {
    const { id, name, data } = req.body;
    const now = Date.now();
    await getPool().query(
      "INSERT INTO demos (id, name, data, last_modified) VALUES ($1, $2, $3, $4)",
      [id, name, JSON.stringify(data), now]
    );
    res.json({ id, name, lastModified: now, storage: "postgres" });
  });

  // Update demo
  app.put("/api/demos/:id", async (req, res) => {
    const { data, name } = req.body;
    const now = Date.now();
    const sets = [];
    const params = [];
    if (data !== undefined) {
      sets.push(`data = $${params.length + 1}`);
      params.push(JSON.stringify(data));
    }
    if (name !== undefined) {
      sets.push(`name = $${params.length + 1}`);
      params.push(name);
    }
    sets.push(`last_modified = $${params.length + 1}`);
    params.push(now);
    params.push(req.params.id);
    const { rowCount } = await getPool().query(
      `UPDATE demos SET ${sets.join(", ")} WHERE id = $${params.length}`,
      params
    );
    if (!rowCount) return res.status(404).json({ error: "Not found" });
    res.json({ lastModified: now });
  });

  // Delete demo
  app.delete("/api/demos/:id", async (req, res) => {
    await getPool().query("DELETE FROM demos WHERE id = $1", [req.params.id]);
    res.status(204).end();
  });
}

app.use(express.static(join(__dirname, "dist")));

// SPA fallback — send all routes to index.html
app.get("*splat", (_req, res) => {
  res.sendFile(join(__dirname, "dist", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} (storage: ${storageMode})`);
});
