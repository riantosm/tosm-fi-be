import cors from "cors";
import express from "express";
import morgan from "morgan";
import accountRoutes from "./routes/account.routes";
import assistantRoutes from "./routes/assistant.routes";
import authRoutes from "./routes/auth.routes";
import budgetRoutes from "./routes/budget.routes";
import categoryRoutes from "./routes/category.routes";
import clientErrorRoutes from "./routes/client-error.routes";
import instrumentRoutes from "./routes/instrument.routes";
import investmentTransactionRoutes from "./routes/investment-transaction.routes";
import reportRoutes from "./routes/report.routes";
import scheduleRoutes from "./routes/schedule.routes";
import transactionRoutes from "./routes/transaction.routes";
import userRoutes from "./routes/user.routes";
import walletRoutes from "./routes/wallet.routes";
import { connectDB } from "./config/database";

const app = express();

const ALLOWED_ORIGINS = ["http://localhost:5173", "https://tosm-fi.netlify.app"];

app.use(cors({ origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// Every request waits for a ready DB connection before reaching a route —
// connectDB() itself caches the connection, so this is instant once warm.
// On a cold instance where the connection genuinely fails, this still sends
// back a normal HTTP response (with the cors() headers already applied
// above) instead of the request hanging/crashing with no response, which is
// what made connection failures look like CORS errors in the browser.
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error);
    res.status(503).json({
      message: "Database unavailable, please retry.",
      data: null,
      isSuccess: false,
      status: 503,
    });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/account", accountRoutes);
app.use("/api/user", userRoutes);
app.use("/api/wallets", walletRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/budgets", budgetRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/schedules", scheduleRoutes);
app.use("/api/instruments", instrumentRoutes);
app.use("/api/investment-transactions", investmentTransactionRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/errors", clientErrorRoutes);
app.use("/api/assistant", assistantRoutes);

app.get("/", (req, res) => {
  res.json({ message: "✅ API is running." });
});

export default app;
