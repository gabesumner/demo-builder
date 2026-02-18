import express from "express";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const SITE_PASSWORD = process.env.SITE_PASSWORD;

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

app.use(express.static(join(__dirname, "dist")));

// SPA fallback — send all routes to index.html
app.get("*splat", (_req, res) => {
  res.sendFile(join(__dirname, "dist", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
