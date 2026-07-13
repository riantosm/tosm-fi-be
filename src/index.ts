import dotenv from "dotenv";
dotenv.config();

import app from "./app";
import { connectDB } from "./config/database";

const port = process.env.PORT || 3000;

connectDB();

app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});
