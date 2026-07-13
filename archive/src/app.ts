import cors from "cors";
import express from "express";
import listEndpoints from "express-list-endpoints";
import morgan from "morgan";
import { ITransferInput } from "./interfaces/transaction.interface";
import { AccountModel } from "./models/account.model";
import { AccountTypeModel } from "./models/accountType.model";
import { TransactionModel } from "./models/transaction.model";
import { TransactionTypeModel } from "./models/transactionType.model";
import accountRoutes from "./routes/account.routes";
import accountTypeRoutes from "./routes/accountType.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import transactionRoutes from "./routes/transaction.routes";
import transactionTypeRoutes from "./routes/transactionType.routes";
import { getEmptyObjectFromSchema } from "./utils/getEmptyObjectFromSchema";

const emptyAccount = getEmptyObjectFromSchema(AccountModel);
const emptyAccountType = getEmptyObjectFromSchema(AccountTypeModel);
const emptyTransactionType = getEmptyObjectFromSchema(TransactionTypeModel);
const emptyTransaction = getEmptyObjectFromSchema(TransactionModel);
const exampleTransfer: ITransferInput = {
  from_id_account: 1,
  to_id_account: 2,
  amount: 1000,
  date: Math.floor(Date.now() / 1000),
};

const app = express(); // ✅ Daftar origin yang diizinkan
const allowedOrigins = [
  "http://localhost:3000", // dev local
  "http://localhost:5173", // jika kamu pakai Vite
  "https://tosm-networthtracker.netlify.app", // production
];

// ✅ Custom CORS middleware
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  })
);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

app.use("/api/account", accountRoutes);
app.use("/api/account-type", accountTypeRoutes);
app.use("/api/transaction", transactionRoutes);
app.use("/api/transaction-type", transactionTypeRoutes);
app.use("/api/dashboard", dashboardRoutes);

// Auto list route
app.get("/", (req, res) => {
  const endpoints = listEndpoints(app);

  // Struktur akhir: { [modelName]: { path:Set, methods:Set, exampleBody } }
  const modelMap: Record<
    string,
    { path: Set<string>; methods: Set<string>; exampleBody: any }
  > = {};

  endpoints.forEach((ep) => {
    const match = ep.path.match(/^\/api\/([^\/:]+)/); // ambil nama model (contoh: "account")
    if (!match) return;
    const modelName = match[1];

    if (!modelMap[modelName]) {
      modelMap[modelName] = {
        path: new Set(),
        methods: new Set(),
        exampleBody: {},
      };
    }

    // Tambah path & methods
    modelMap[modelName].path.add(ep.path);
    ep.methods.forEach((m) => modelMap[modelName].methods.add(m));

    // Tentukan example body sesuai model
    if (modelName === "account")
      modelMap[modelName].exampleBody = [emptyAccount];
    if (modelName === "account-type")
      modelMap[modelName].exampleBody = [emptyAccountType];
    if (modelName === "transaction-type")
      modelMap[modelName].exampleBody = [emptyTransactionType];
    if (modelName === "transaction")
      modelMap[modelName].exampleBody = [emptyTransaction, exampleTransfer];
  });

  // Ubah ke array agar mudah dibaca
  const routes = Object.entries(modelMap).map(([model, info]) => ({
    models: model,
    path: Array.from(info.path),
    methods: Array.from(info.methods),
    exampleBody: info.exampleBody,
  }));

  res.json({
    message: "✅ API is running.",
    routes,
  });
});

export default app;
