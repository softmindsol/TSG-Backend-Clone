import express from "express";
import helmet from "helmet";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import connectDb from "./config/db.js";
import agentRoutes from "./routes/agent.routes.js";
import clientRoutes from "./routes/client.routes.js";
import dealRoutes from "./routes/deal.routes.js";
import eventRoutes from "./routes/event.routes.js";
import amlRoutes from "./routes/aml.routes.js";
import templateRoutes from "./routes/template.routes.js";
import reportRoutes from "./routes/report.routes.js";
import documentRoutes from "./routes/document.routes.js";
import adminRoutes from "./routes/adminRoutes/admin.routes.js";
import aiRoutes from "./routes/ai.routes.js"

import rateLimit from "express-rate-limit";
dotenv.config();
const app = express();

// CORS
const corsOptions = {
  origin: [process.env.FRONTEND_URL, "http://localhost:5173"],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  credentials: true,
};
app.use(cors(corsOptions));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(helmet());
const aiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,          // 5 minutes
  max: 60,                          // 60 requests / window / IP (tune per user later)
  standardHeaders: true,
  legacyHeaders: false,
  message: { statusCode: 429, message: "Too many requests" },
});

// Routes
app.get("/", (req, res) => res.send("Welcome to TSG Backend"));
app.use("/api/agents", agentRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/deal", dealRoutes);
app.use("/api/event", eventRoutes);
app.use("/api/aml", amlRoutes);
app.use("/api/template", templateRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/ai", aiLimiter, aiRoutes);


// Global error handler
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal Server Error",
    errors: err.errors || [],
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
});

// Connect to DB once when cold-started
connectDb().catch((err) => {
  console.error("❌ Database connection failed:", err);
});

export default app;
