import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import config from "./config/environment";
import logger from "./config/logger";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { apiLimiter } from "./middleware/rateLimiter";

import authRoutes from "./routes/auth.routes";
import workspaceRoutes from "./routes/workspace.routes";
import documentRoutes from "./routes/document.routes";
import contentRoutes from "./routes/content.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import socialAuthRoutes from "./routes/socialAuth.routes";
import schedulerRoutes from "./routes/scheduler.routes";
import { schedulerController } from "./controllers/scheduler.controller";
import schedulePostRoutes from "./routes/schedulePost.routes";
import workspaceSocialAccountsRoutes from "./routes/workspaceSocialAccounts.routes";
import mediaRoutes from "./routes/media.routes";
import paymentRoutes from "./routes/payment.routes";
import imageGenerationRoutes from "./routes/imageGeneration.routes";
import { webhook } from "./controllers/phone-pay";
import * as paymentController from "./controllers/phone-pay";

import bodyParser from "body-parser";
import dotenv from "dotenv";
dotenv.config();

const app: Application = express();
app.set("trust proxy", 1);

const allowedOrigins = [
  "https://zeroeffortposts.com", // dev
  "http://thescopematters-frontend.s3-website-us-east-1.amazonaws.com", // prod
];

// ------------------- CORS -------------------
app.use(
  cors({
    origin: "https://zeroeffortposts.com", // or dynamic logic with allowedOrigins
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Cache-Control",
      "Pragma",
      "X-Requested-With",
      "ngrok-skip-browser-warning",
    ],
  })
);

// ------------------- Webhook -------------------
app.use(
  "/api/v1/payment/webhook",
  bodyParser.raw({ type: "*/*" }),
  webhook
);

// ------------------- Security -------------------
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// ------------------- Parsers -------------------
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(express.json({ limit: "10mb" }));

// ------------------- Logging -------------------
if (config.nodeEnv === "development") {
  app.use(morgan("dev"));
} else {
  app.use(
    morgan("combined", {
      stream: {
        write: (message: string) => logger.info(message.trim()),
      },
    })
  );
}

// ------------------- Health -------------------
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv,
  });
});

// ------------------- Static -------------------
app.use("/uploads", express.static("uploads"));

// ------------------- API Routes -------------------
app.use(config.api.prefix, apiLimiter);
app.use(`${config.api.prefix}/auth`, authRoutes);
app.use(`${config.api.prefix}/workspaces`, workspaceRoutes);
app.use(`${config.api.prefix}/workspaces`, documentRoutes);
app.use(`${config.api.prefix}/workspaces`, contentRoutes);
app.use(`${config.api.prefix}/workspaces`, dashboardRoutes);
app.use(`${config.api.prefix}/workspaces`, mediaRoutes);
app.use(`${config.api.prefix}/workspaces`, imageGenerationRoutes);
app.use(`${config.api.prefix}/auth`, socialAuthRoutes);
app.use(`${config.api.prefix}/scheduler`, schedulerRoutes);
app.use(`${config.api.prefix}/payment`, paymentRoutes);
app.use(config.api.prefix, schedulePostRoutes);
app.use(`${config.api.prefix}/workspaces`, workspaceSocialAccountsRoutes);

// ------------------- Error Handlers -------------------
app.use(notFoundHandler);
app.use(errorHandler);

// ------------------- Scheduler -------------------
schedulerController.startScheduler();
paymentController.startScheduler();

// ------------------- Start Server -------------------
const startServer = () => {
  try {
    const HOST = process.env.HOST || "0.0.0.0";
    const BACKEND_URL =
      process.env.BACKEND_URL || `https://api.zeroeffortposts.com`;

    app.listen(config.port, HOST, () => {
      logger.info(`🚀 Server running on port ${config.port}`);
      logger.info(`📝 Env: ${config.nodeEnv}`);
      logger.info(`🔗 API Base URL: ${BACKEND_URL}${config.api.prefix}`);
      logger.info(`💚 Health Check: ${BACKEND_URL}/health`);
      logger.info(`🌐 Allowed origins: ${allowedOrigins.join(", ")}`);
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
};

// ------------------- Global Errors -------------------
process.on("unhandledRejection", (reason: any) => {
  logger.error("Unhandled Rejection:", reason);
  process.exit(1);
});

process.on("uncaughtException", (error: Error) => {
  logger.error("Uncaught Exception:", error);
  process.exit(1);
});

process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully");
  process.exit(0);
});

startServer();

export default app;
