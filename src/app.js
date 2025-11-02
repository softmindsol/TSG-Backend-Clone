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
import aiRoutes from "./routes/ai.routes.js";
import subscriptionRoutes from "./routes/subscription.routes.js";
import rateLimit from "express-rate-limit";
import addMemberRoutes from "./routes/addTeamMember.routes.js";
import checkoutRoutes from "./routes/checkout.routes.js";

dotenv.config();

const app = express();

// ✅ Fix for Vercel reverse proxy issue
app.set("trust proxy", 1);

// ✅ 1. Stripe Webhook must be mounted BEFORE express.json()
import { handleSubscriptionSuccess } from "./controllers/subscription.controller.js";
app.post(
  "/api/subscription/webhook",
  express.raw({ type: "application/json" }),
  handleSubscriptionSuccess
);

// ✅ 2. Standard Middlewares
const corsOptions = {
  origin: [
    process.env.FRONTEND_URL,
    process.env.FRONTEND_URL_2,
    process.env.ADMIN_FRONTEND_URL,
    "http://localhost:5173",
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  credentials: true,
};
app.use(cors(corsOptions));
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ✅ 3. Rate limiter (AI + Checkout)
const aiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { statusCode: 429, message: "Too many requests" },
});

// ✅ 4. Routes
app.get("/", (req, res) => res.send("Welcome to TSG Backend"));
app.use("/api/subscription", subscriptionRoutes);
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
app.use("/api/member", addMemberRoutes);
app.use("/api/checkout", aiLimiter, checkoutRoutes);

// ✅ 5. Global error handler
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal Server Error",
    errors: err.errors || [],
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
});

// ✅ 6. Connect DB
connectDb().catch((err) => {
  console.error("❌ Database connection failed:", err);
});

export default app;
