import express from "express";
import helmet from "helmet";
import cors from "cors";
import dotenv from "dotenv";
import connectDb from "./src/config/db.js";
import agentRoutes from "./src/routes/agent.routes.js";
import cookieParser from "cookie-parser";
import clientRoutes from "./src/routes/client.routes.js";
import dealRoutes from "./src/routes/deal.routes.js";
import eventRoutes from './src/routes/event.routes.js'
import amlRoutes from "./src/routes/aml.routes.js"
import templateRoutes from './src/routes/template.routes.js'
import reportRoutes from "./src/routes/report.routes.js"
dotenv.config();

// Initialize Express app
const app = express();
const port = process.env.PORT || 8000;

//CORS 
const corsOptions = {
  origin: [
    process.env.FRONTEND_URL,
    "http://localhost:5173",
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  credentials: true,
};
app.use(cors(corsOptions));

// General middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Base route
app.get("/", (req, res) => {
  res.send("Welcome to TSG Frontend");
});

// prefix routes
app.use("/api/agents", agentRoutes);

app.use("/api/clients", clientRoutes);

// deal routes

app.use("/api/deal", dealRoutes);

//event routes

app.use("/api/event", eventRoutes);

// aml Compliance
app.use("/api/aml", amlRoutes);

app.use("/api/template", templateRoutes);

// Report endpoint

app.use("/api/reports", reportRoutes);


// ✅ Global error handler (must be after all routes)
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;

  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal Server Error",
    errors: err.errors || [],
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
});

// Connect to DB and start server
connectDb()
  .then(() => {
    app.listen(port, () => {
      console.log(`🚀 Server running on port ${port}`);
    });
  })
  .catch((err) => {
    console.error("❌ Database connection failed:", err);
    process.exit(1);
  });
