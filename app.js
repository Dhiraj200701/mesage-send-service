import Fastify from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import dotenv from "dotenv";
import otpRoutes from "./otpsend.routes.js";
import { whatsappService } from "./whatsapp.service.js";

// Load environment variables
dotenv.config();

// Global process error handlers to prevent crashes from transient Puppeteer/WhatsApp Web navigation issues
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  const errMsg = reason?.message || String(reason);
  if (
    errMsg.includes("Execution context was destroyed") ||
    errMsg.includes("detached Frame") ||
    errMsg.includes("Session closed")
  ) {
    console.warn("⚠️ Transient Puppeteer error detected. Attempting to recover and re-initialize WhatsApp client...");
    console.error(reason);
    // whatsappService.destroy()
    //   .then(() => whatsappService.initialize())
    //   .catch(err => console.error("Failed to re-initialize WhatsApp client after unhandled rejection:", err));
  }
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  const errMsg = error?.message || String(error);
  if (
    errMsg.includes("Execution context was destroyed") ||
    errMsg.includes("detached Frame") ||
    errMsg.includes("Session closed")
  ) {
    console.warn("⚠️ Transient Puppeteer error detected. Attempting to recover and re-initialize WhatsApp client...");
    console.error(error);
    // whatsappService.destroy()
    //   .then(() => whatsappService.initialize())
    //   .catch(err => console.error("Failed to re-initialize WhatsApp client after uncaught exception:", err));
  } else {
    // For other critical errors, exit the process so it can be restarted by nodemon/PM2
    console.error("Critical error. Exiting process...");
    process.exit(1);
  }
});

const app = Fastify({
  logger: true
});

// Register CORS
await app.register(cors, {
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"]
});

// Register Swagger
await app.register(swagger, {
  openapi: {
    info: {
      title: "OTP Send Service API",
      description: "API documentation for the standalone WhatsApp OTP Send Service",
      version: "1.0.0"
    }
  }
});

// Register Swagger UI
await app.register(swaggerUi, {
  routePrefix: "/documentation",
  uiConfig: {
    docExpansion: "list",
    deepLinking: false
  },
  staticCSP: true,
  transformStaticCSP: (header) => header
});

// Root path status check
app.get("/", async () => {
  return {
    success: true,
    message: "OTP Send Service Running"
  };
});

// Register routes exactly with the same prefix to maintain backward compatibility
app.register(otpRoutes, {
  prefix: "/api/v1/otp"
});

const start = async () => {
  try {
    // Initialize WhatsApp Web Client
    whatsappService.initialize();

    const port = process.env.PORT || 3002;
    await app.listen({
      port: Number(port),
      host: "0.0.0.0"
    });

    console.log(`🚀 OTP Service Running On Port ${port}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();
