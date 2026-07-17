import dotenv from "dotenv";
dotenv.config();

import app from "./app";

const port = process.env.PORT || 3000;

// Connecting is now handled per-request by app.ts's DB-readiness middleware
// (cached across requests once established) — no need to connect eagerly here.
app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});
