import pkg from "whatsapp-web.js";
import QRCode from "qrcode";
import { whatsappQueue } from "../utils/queue.js";
import { logInfo, logError } from "../utils/logger.js";

const { Client, LocalAuth } = pkg;

class WhatsappService {
  constructor() {
    this.client = null;
    this.status = "DISCONNECTED"; // INITIALIZING, QR_READY, READY, ERROR, DISCONNECTED
    this.qrCode = null;
    this.error = null;
    this.initPromise = null;

    // Graceful shutdown event listeners
    const cleanup = async (signal) => {
      console.log(`[WhatsAppService] Received ${signal}. Cleaning up WhatsApp Client...`);
      await this.destroy();
      
      if (signal === "SIGUSR2") {
        // Nodemon standard way to signal readiness to restart
        process.kill(process.pid, "SIGUSR2");
      } else {
        process.exit(0);
      }
    };

    // Use once to prevent multiple bindings/executions
    process.once("SIGINT", () => cleanup("SIGINT"));
    process.once("SIGTERM", () => cleanup("SIGTERM"));
    process.once("SIGUSR2", () => cleanup("SIGUSR2"));
  }

  async initialize() {
    // Idempotent initialization
    if (this.initPromise) {
      console.log("[WhatsAppService] Initialization already in progress, returning existing promise.");
      return this.initPromise;
    }

    if (this.status === "READY" && this.client) {
      console.log("[WhatsAppService] Client is already READY.");
      return;
    }

    this.status = "INITIALIZING";
    this.qrCode = null;
    this.error = null;

    console.log("[WhatsAppService] Starting new WhatsApp Client initialization...");

    this.initPromise = new Promise((resolve, reject) => {
      try {
        this.client = new Client({
          takeoverOnConflict: true,
          takeoverTimeoutMs: 10000,
          authStrategy: new LocalAuth({
            clientId: "sound-whatsapp-session",
            dataPath: "./.wwebjs_auth"
          }),
          webVersionCache: {
            type: "remote",
            remotePath: "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/{version}.html"
          },
          puppeteer: {
            headless: true,
            executablePath: process.env.CHROME_BIN,
            args: [
              "--no-sandbox",
              "--disable-setuid-sandbox",
              "--disable-dev-shm-usage",
              "--disable-accelerated-2d-canvas",
              "--no-first-run",
              "--no-zygote",
              "--disable-gpu",
              "--disable-extensions"
            ]
          }
        });

        this.client.on("qr", async (qr) => {
          console.log("[WhatsAppService] QR Code received. Generating Data URL...");
          try {
            this.qrCode = await QRCode.toDataURL(qr);
            this.status = "QR_READY";
            this.error = null;
            resolve(false); // Initialized but needs scan
          } catch (err) {
            console.error("[WhatsAppService] Failed to generate QR Code:", err);
            this.error = "Failed to generate QR Code";
            this.status = "ERROR";
            reject(err);
          }
        });

        this.client.on("authenticated", () => {
          console.log("[WhatsAppService] ✅ AUTHENTICATED successfully. Session loaded.");
          // Clear QR code to save memory
          this.qrCode = null;
        });

        this.client.on("ready", () => {
          console.log("[WhatsAppService] ✅ READY to send messages.");
          this.status = "READY";
          this.qrCode = null;
          this.error = null;
          resolve(true);
        });

        this.client.on("auth_failure", (msg) => {
          console.error("[WhatsAppService] ❌ AUTH FAILURE:", msg);
          this.status = "AUTH_FAILURE";
          this.qrCode = null;
          this.error = msg;
          reject(new Error(`Auth Failure: ${msg}`));
          // Usually requires manual intervention/re-scan, so we destroy
          this.destroy();
        });

        this.client.on("disconnected", (reason) => {
          console.log("[WhatsAppService] WhatsApp Disconnected:", reason);
          this.status = "DISCONNECTED";
          this.destroy().then(() => {
            console.log("[WhatsAppService] Attempting to auto-reconnect in 5 seconds...");
            setTimeout(() => this.initialize(), 5000);
          });
        });

        this.client.initialize().catch(err => {
          console.error("[WhatsAppService] ❌ Error during client.initialize():", err.message);
          this.status = "ERROR";
          this.error = err.message;
          reject(err);

          // Handle execution context destroyed
          if (err.message && (err.message.includes("Execution context was destroyed") || err.message.includes("detached Frame"))) {
            console.warn("[WhatsAppService] ⚠️ Execution context destroyed. Retrying in 5 seconds...");
            this.destroy().then(() => {
              setTimeout(() => this.initialize(), 5000);
            });
          }
        });

      } catch (err) {
        console.error("[WhatsAppService] ❌ Error setting up WhatsApp Client:", err);
        this.status = "ERROR";
        this.error = err.message;
        reject(err);
      }
    });

    try {
      await this.initPromise;
    } finally {
      // Clear the promise so future calls can re-init if destroyed
      this.initPromise = null;
    }
  }

  async destroy() {
    console.log("[WhatsAppService] Destroying client...");
    if (this.client) {
      try {
        await this.client.destroy();
        console.log("[WhatsAppService] Client destroyed successfully.");
      } catch (err) {
        console.error("[WhatsAppService] Error destroying client (may already be dead):", err.message);
      }
      this.client = null;
    }
    // Also reset state safely
    if (this.status !== "AUTH_FAILURE") {
        this.status = "DISCONNECTED";
    }
    this.initPromise = null;
  }

  getQRState() {
    return {
      status: this.status,
      qr: this.qrCode,
      error: this.error
    };
  }

  async sendMessage(to, message) {
    if (this.status !== "READY" || !this.client) {
      throw new Error(`WhatsApp client is not ready. Current status: ${this.status}`);
    }

    // Format the number: remove any non-digit character
    let formattedNumber = to.replace(/\D/g, "");

    if (!formattedNumber) {
      throw new Error("Invalid phone number provided");
    }

    if (formattedNumber.length < 10 || formattedNumber.length > 15) {
      throw new Error("Invalid phone number length");
    }

    // Prepend India country code (91) if it's a 10-digit number
    if (formattedNumber.length === 10) {
      formattedNumber = `91${formattedNumber}`;
    }

    if (!formattedNumber.endsWith("@c.us")) {
      formattedNumber = `${formattedNumber}@c.us`;
    }

    return whatsappQueue.add(async () => {
      try {
        const response = await Promise.race([
          this.client.sendMessage(formattedNumber, message),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Send timeout")), 30000)
          )
        ]);
        logInfo(`Message sent to ${formattedNumber}`);
        return response;
      } catch (err) {
        logError(`Failed to send message to ${to}: ${err.message}`);
        if (err.message && (err.message.includes("detached Frame") || err.message.includes("Execution context was destroyed") || err.message.includes("Protocol error"))) {
          console.warn("[WhatsAppService] ⚠️ Browser crash detected. Re-initializing WhatsApp Client...");
          this.destroy().then(() => this.initialize());
        }
        throw new Error(`Failed to send WhatsApp message: ${err.message}`);
      }
    });
  }
}

export const whatsappService = new WhatsappService();
