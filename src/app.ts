import cors from "cors";
import express from "express";
import morgan from "morgan";
import accountRoutes from "./routes/account.routes";
import authRoutes from "./routes/auth.routes";
import categoryRoutes from "./routes/category.routes";
import clientErrorRoutes from "./routes/client-error.routes";
import instrumentRoutes from "./routes/instrument.routes";
import investmentTransactionRoutes from "./routes/investment-transaction.routes";
import reportRoutes from "./routes/report.routes";
import transactionRoutes from "./routes/transaction.routes";
import userRoutes from "./routes/user.routes";
import walletRoutes from "./routes/wallet.routes";

const app = express();

const ALLOWED_ORIGINS = ["http://localhost:5173", "https://tosm-fi.netlify.app"];

app.use(cors({ origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

app.use("/api/auth", authRoutes);
app.use("/api/account", accountRoutes);
app.use("/api/user", userRoutes);
app.use("/api/wallets", walletRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/instruments", instrumentRoutes);
app.use("/api/investment-transactions", investmentTransactionRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/errors", clientErrorRoutes);

app.get("/", (req, res) => {
  res.json({ message: "✅ API is running." });
});

export default app;
