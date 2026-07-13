import cors from "cors";
import express from "express";
import morgan from "morgan";
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import walletRoutes from "./routes/wallet.routes";

const app = express();

const ALLOWED_ORIGINS = ["http://localhost:5173", "https://tosm-fi.netlify.app"];

app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/wallets", walletRoutes);

app.get("/", (req, res) => {
  res.json({ message: "✅ API is running." });
});

export default app;
