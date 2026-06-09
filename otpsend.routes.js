import {
  getScannerController,
  sendMessageController,
  getStatusController
} from "./otpsend.controller.js";

const getScannerSchema = {
  description: "Get current WhatsApp client status and QR scanner code",
  tags: ["WhatsApp OTP"],
  summary: "Get WhatsApp Status & QR Scanner",
  querystring: {
    type: "object",
    properties: {
      format: {
        type: "string",
        enum: ["html", "json"],
        default: "html",
        description: "Response format. Defaults to 'html' to render scanner UI in browser. Use 'json' for raw JSON status."
      }
    }
  },
  response: {
    200: {
      description: "Success response",
      type: "object",
      properties: {
        success: { type: "boolean" },
        status: { type: "string", description: "Current status: INITIALIZING, QR_READY, READY, ERROR, DISCONNECTED" },
        qr: { type: ["string", "null"], description: "Base64 QR image code if status is QR_READY" },
        error: { type: ["string", "null"], description: "Error message if status is ERROR" }
      }
    }
  }
};

const sendMessageSchema = {
  description: "Send a WhatsApp message or OTP to a recipient",
  tags: ["WhatsApp OTP"],
  summary: "Send WhatsApp Message / OTP",
  body: {
    type: "object",
    required: ["message"],
    properties: {
      to: { 
        type: "string", 
        pattern: "^[0-9]+$", 
        description: "Phone number with country code (e.g. 919876543210)" 
      },
      phone_number: {
        type: "string",
        pattern: "^[0-9]+$",
        description: "Alternative parameter name for recipient phone number"
      },
      message: { 
        type: "string", 
        minLength: 1, 
        description: "Text message or OTP body to send" 
      }
    },
    anyOf: [
      { required: ["to"] },
      { required: ["phone_number"] }
    ]
  },
  response: {
    200: {
      description: "Message sent successfully",
      type: "object",
      properties: {
        success: { type: "boolean" },
        message: { type: "string" },
        recipient: { type: "string" }
      }
    },
    400: {
      description: "Validation error or sending failure",
      type: "object",
      properties: {
        success: { type: "boolean" },
        message: { type: "string" }
      }
    }
  }
};

const getStatusSchema = {
  description: "Check if the WhatsApp client is connected and ready to send messages",
  tags: ["WhatsApp OTP"],
  summary: "Get WhatsApp Connection Status",
  response: {
    200: {
      description: "Success response",
      type: "object",
      properties: {
        success: { type: "boolean" },
        connected: { type: "boolean", description: "True if status is READY and authenticated" },
        status: { type: "string", description: "Current status: INITIALIZING, QR_READY, READY, ERROR, DISCONNECTED" }
      }
    },
    500: {
      description: "Server error response",
      type: "object",
      properties: {
        success: { type: "boolean" },
        connected: { type: "boolean" },
        message: { type: "string" }
      }
    }
  }
};

export default async function (fastify) {
  // GET /scanner (defaults to html visual view, use ?format=json for raw JSON)
  fastify.get(
    "/scanner",
    {
      schema: getScannerSchema
    },
    getScannerController
  );

  // GET /status
  fastify.get(
    "/status",
    {
      schema: getStatusSchema
    },
    getStatusController
  );

  // POST /send
  fastify.post(
    "/send",
    {
      schema: sendMessageSchema
    },
    sendMessageController
  );
}
