import cors from "cors";
import express from "express";
import morgan from "morgan";
import userRoutes from "./routes/user.routes";

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

app.use("/api/user", userRoutes);

app.get("/", (req, res) => {
  res.json({ message: "✅ API is running." });
});

export default app;
