import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { prisma } from "./lib/prisma.js";
import { errorHandler } from "./middleware/error.js";
import medicamentosRouter from "./routes/medicamentos.js";
import lotesRouter from "./routes/lotes.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/medicamentos", medicamentosRouter);
app.use("/api/lotes", lotesRouter);

app.use(errorHandler);

app.listen(config.port, async () => {
  await prisma.$connect();
  console.log(`API escuchando en http://localhost:${config.port}`);
});
