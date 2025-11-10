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
import bodyParser from "body-parser";
import { webhook } from "./controllers/phone-pay";
import * as paymentController from "./controllers/phone-pay";

const app: Application = express();
app.set("trust proxy", 1);

const allowedOrigins = [
  "http://localhost:5173", // dev
  "http://thescopematters-frontend.s3-website-us-east-1.amazonaws.com", // prod
];

app.use(
  cors({
    // origin: (origin, callback) => {
    //   // Allow requests with no origin (like Postman, curl, or same-origin)
    //   if (!origin) return callback(null, true);

    //   if (allowedOrigins.includes(origin)) {
    //     callback(null, true);
    //   } else {
    //     logger.warn(`CORS blocked origin: ${origin}`);
    //     callback(
    //       new Error(`CORS policy: The origin ${origin} is not allowed.`),
    //       false
    //     );
    //   }
    // },
    origin: '*',  
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

app.use("/api/v1/payment/webhook", 
  bodyParser.raw({ type: "*/*" }), 
  webhook
);
// Apply helmet AFTER CORS
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// Parse URL-encoded & JSON (remove duplicate parsers)
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(express.json({ limit: "10mb" }));

// 🧾 LOGGING
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

// 💚 HEALTH CHECK
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv,
  });
});

// 📁 STATIC FILES
app.use("/uploads", express.static("uploads"));

// 🧩 API ROUTES
app.use(config.api.prefix, apiLimiter);
app.use(`${config.api.prefix}/auth`, authRoutes);
app.use(`${config.api.prefix}/workspaces`, workspaceRoutes);
app.use(`${config.api.prefix}/workspaces`, documentRoutes);
app.use(`${config.api.prefix}/workspaces`, contentRoutes);
app.use(`${config.api.prefix}/workspaces`, dashboardRoutes);
app.use(`${config.api.prefix}/workspaces`, mediaRoutes);
app.use(`${config.api.prefix}/auth`, socialAuthRoutes);
app.use(`${config.api.prefix}/scheduler`, schedulerRoutes);
app.use(`${config.api.prefix}/payment`, paymentRoutes);
app.use(config.api.prefix, schedulePostRoutes);
app.use(`${config.api.prefix}/workspaces`, workspaceSocialAccountsRoutes);

// ❌ ERROR HANDLERS
app.use(notFoundHandler);
app.use(errorHandler);

// 🕒 SCHEDULER
schedulerController.startScheduler();
paymentController.startScheduler();

// 🚀 SERVER STARTUP
const startServer = () => {
  try {
    const HOST = process.env.HOST || "0.0.0.0";
    const BACKEND_URL =
      process.env.BACKEND_URL || `http://localhost:${config.port}`;

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

// 🧩 GLOBAL ERROR HANDLERS
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