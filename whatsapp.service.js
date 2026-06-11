import pkg from "whatsapp-web.js";
import QRCode from "qrcode";

const { Client, LocalAuth } = pkg;

class WhatsappService {
  constructor() {
    this.client = null;
    this.status = "INITIALIZING";
    this.qrCode = null;
    this.error = null;
    this.isInitializing = false;

    // Graceful shutdown event listeners
    const cleanup = async (signal) => {
      console.log(`Received ${signal}. Cleaning up WhatsApp Client...`);
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

  initialize() {
    if (this.isInitializing) {
      console.log("Already initializing...");
      return;
    }
    this.isInitializing = true;

    if (this.client) {
      console.log("Client already exists");
      return;
    }

    console.log("Initializing WhatsApp Client...");
    this.status = "INITIALIZING";
    this.qrCode = null;
    this.error = null;

    try {
      this.client = new Client({
        authStrategy: new LocalAuth({
          clientId: "sound-whatsapp-session",
          dataPath: "./.wwebjs_auth"
        }),
        webVersionCache: {
          type: "remote",
          remotePath: "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1040891482-alpha.html"
        },
        puppeteer: {
          headless: true,
          executablePath: "/snap/bin/chromium",
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--no-zygote"
          ]
        }
      });

      this.client.on("qr", async (qr) => {
        console.log("WhatsApp QR Code received. Generating Data URL...");
        try {
          this.qrCode = await QRCode.toDataURL(qr);
          this.status = "QR_READY";
          this.error = null;
        } catch (err) {
          console.error("Failed to generate QR Code data URL:", err);
          this.error = "Failed to generate QR Code";
        }
      });

      this.client.on("ready", () => {
        console.log("✅ WhatsApp Client is READY!");
        this.isInitializing = false;
        this.status = "READY";
        this.qrCode = null;
        this.error = null;
      });

      this.client.on("auth_failure", (msg) => {
        console.error("❌ WhatsApp Authentication Failure:", msg);
        this.status = "AUTH_FAILURE";
        this.qrCode = null;
        this.error = msg;
      });

      this.client.on("disconnected", async (reason) => {
        console.log("⚠️ WhatsApp Client Disconnected:", reason);
        this.status = "DISCONNECTED";
        this.qrCode = null;
        this.error = reason;
        
        await this.destroy();
        
        // Attempt to reinitialize after some delay
        setTimeout(() => {
          this.initialize();
        }, 5000);
      });

      this.client.initialize().catch(err => {
        console.error("❌ Error calling client.initialize():", err);
        this.status = "ERROR";
        this.error = err.message;
      });

    } catch (err) {
      console.error("❌ Error setting up WhatsApp Client:", err);
      this.isInitializing = false;
      this.status = "ERROR";
      this.error = err.message;
    }
  }

  async destroy() {
    if (this.client) {
      try {
        await this.client.destroy();
        console.log("WhatsApp client destroyed successfully.");
      } catch (err) {
        console.error("Error destroying WhatsApp client:", err);
      }
      this.client = null;
      this.status = "DISCONNECTED";
    }
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

    // Prepend India country code (91) if it's a 10-digit number
    if (formattedNumber.length === 10) {
      formattedNumber = `91${formattedNumber}`;
    }

    if (!formattedNumber.endsWith("@c.us")) {
      formattedNumber = `${formattedNumber}@c.us`;
    }

    try {
      const response = await this.client.sendMessage(formattedNumber, message);
      return response;
    } catch (err) {
      console.error(`Failed to send WhatsApp message to ${to}:`, err);
      if (err.message && (err.message.includes("detached Frame") || err.message.includes("Execution context was destroyed"))) {
        console.warn("⚠️ Detached frame or destroyed execution context detected. Re-initializing WhatsApp Client...");
        this.destroy().then(() => this.initialize());
      }
      throw new Error(`Failed to send WhatsApp message: ${err.message}`);
    }
  }
}

export const whatsappService = new WhatsappService();
