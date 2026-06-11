import Fastify from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import dotenv from "dotenv";
import otpRoutes from "./otpsend.routes.js";
import { whatsappService } from "./whatsapp.service.js";

// Load environment variables
dotenv.config();

// Safe global error handlers to prevent crashes from internal Puppeteer timeouts
// This ensures the server stays up even if the WhatsApp library throws an unhandled rejection.
process.on("unhandledRejection", (reason, promise) => {
  console.error("⚠️ Unhandled Rejection (Caught by Safe Handler):", reason?.message || reason);
});

process.on("uncaughtException", (error) => {
  console.error("⚠️ Uncaught Exception (Caught by Safe Handler):", error?.message || error);
});

// Removed global error handlers to prevent auto-restarts for a single-user system

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
  }
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
