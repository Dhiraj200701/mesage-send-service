import { whatsappService } from "./whatsapp.service.js";

/**
 * Controller to get the WhatsApp connection status and QR code scanner.
 * Supports standard JSON response and HTML visual response via '?format=html' query parameter.
 */
export const getScannerController = async (request, reply) => {
  try {
    const qrState = whatsappService.getQRState();
    const { status, qr, error } = qrState;

    // Default to visual HTML format for easy scanning in browser, unless format=json is requested
    if (request.query.format !== "json") {
      if (status === "READY") {
        return reply.type("text/html").send(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>WhatsApp Connected</title>
              <style>
                body {
                  font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
                  text-align: center;
                  padding: 50px 20px;
                  background-color: #f0f2f5;
                  margin: 0;
                }
                .card {
                  background: white;
                  padding: 40px 30px;
                  border-radius: 12px;
                  display: inline-block;
                  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
                  max-width: 450px;
                  width: 100%;
                }
                h1 {
                  color: #075e54;
                  margin-top: 0;
                }
                .status-badge {
                  background-color: #d1fae5;
                  color: #065f46;
                  padding: 8px 16px;
                  border-radius: 20px;
                  font-weight: 600;
                  display: inline-block;
                  margin: 15px 0;
                }
                p {
                  color: #4b5563;
                  line-height: 1.5;
                }
              </style>
            </head>
            <body>
              <div class="card">
                <h1>WhatsApp Status</h1>
                <div class="status-badge">✅ Connected & Ready</div>
                <p>The WhatsApp client is fully authenticated and ready to send messages.</p>
              </div>
            </body>
          </html>
        `);
      }

      if (status === "QR_READY" && qr) {
        return reply.type("text/html").send(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Scan WhatsApp QR Code</title>
              <meta http-equiv="refresh" content="5">
              <style>
                body {
                  font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
                  text-align: center;
                  padding: 50px 20px;
                  background-color: #f0f2f5;
                  margin: 0;
                }
                .card {
                  background: white;
                  padding: 40px 30px;
                  border-radius: 12px;
                  display: inline-block;
                  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
                  max-width: 450px;
                  width: 100%;
                }
                h1 {
                  color: #075e54;
                  margin-top: 0;
                }
                .status-badge {
                  background-color: #fef3c7;
                  color: #92400e;
                  padding: 8px 16px;
                  border-radius: 20px;
                  font-weight: 600;
                  display: inline-block;
                  margin: 10px 0;
                }
                p {
                  color: #4b5563;
                  margin-bottom: 20px;
                }
                img {
                  border: 1px solid #e5e7eb;
                  border-radius: 8px;
                  padding: 10px;
                  background: white;
                  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                }
                .info {
                  font-size: 0.85em;
                  color: #9ca3af;
                  margin-top: 15px;
                }
              </style>
            </head>
            <body>
              <div class="card">
                <h1>WhatsApp Authentication</h1>
                <div class="status-badge">Scan QR Code</div>
                <p>Please open WhatsApp on your phone, go to Linked Devices, and scan the QR code below.</p>
                <div>
                  <img src="${qr}" alt="WhatsApp QR Code" width="250" height="250" />
                </div>
                <div class="info">This page refreshes automatically every 5 seconds.</div>
              </div>
            </body>
          </html>
        `);
      }

      return reply.type("text/html").send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>WhatsApp Service Loading</title>
            <meta http-equiv="refresh" content="3">
            <style>
              body {
                font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
                text-align: center;
                padding: 50px 20px;
                background-color: #f0f2f5;
                margin: 0;
              }
              .card {
                background: white;
                padding: 40px 30px;
                border-radius: 12px;
                display: inline-block;
                box-shadow: 0 4px 12px rgba(0,0,0,0.08);
                max-width: 450px;
                width: 100%;
              }
              h1 {
                color: #075e54;
                margin-top: 0;
              }
              .status-badge {
                background-color: #e5e7eb;
                color: #374151;
                padding: 8px 16px;
                border-radius: 20px;
                font-weight: 600;
                display: inline-block;
                margin: 15px 0;
              }
              p {
                color: #4b5563;
              }
              .error-msg {
                color: #dc2626;
                background-color: #fee2e2;
                padding: 10px;
                border-radius: 6px;
                font-size: 0.9em;
                margin-top: 15px;
              }
            </style>
          </head>
          <body>
            <div class="card">
              <h1>WhatsApp Status</h1>
              <div class="status-badge">${status}</div>
              <p>The WhatsApp service is currently in the <strong>${status}</strong> state. Please wait...</p>
              ${error ? `<div class="error-msg"><strong>Error:</strong> ${error}</div>` : ""}
            </div>
          </body>
        </html>
      `);
    }

    // Default JSON Response
    return reply.code(200).send({
      success: true,
      status,
      qr,
      error
    });
  } catch (error) {
    return reply.code(500).send({
      success: false,
      message: error.message
    });
  }
};

/**
 * Controller to send a WhatsApp message.
 * Expects a JSON payload: { "to": "91XXXXXXXXXX", "message": "Your text message" }
 */
export const sendMessageController = async (request, reply) => {
  try {
    const { to, phone_number, message } = request.body || {};
    const recipient = to || phone_number;

    if (!recipient || !message) {
      return reply.code(400).send({
        success: false,
        message: "Missing recipient ('to' or 'phone_number') or 'message' field in request body."
      });
    }

    await whatsappService.sendMessage(recipient, message);

    return reply.code(200).send({
      success: true,
      message: "Message sent successfully",
      recipient
    });
  } catch (error) {
    return reply.code(400).send({
      success: false,
      message: error.message
    });
  }
};

/**
 * Controller to check if the WhatsApp client is connected.
 * Returns simple JSON status.
 */
export const getStatusController = async (request, reply) => {
  try {
    const qrState = whatsappService.getQRState();
    const { status } = qrState;
    const connected = status === "READY";

    return reply.code(200).send({
      success: true,
      connected,
      status
    });
  } catch (error) {
    return reply.code(500).send({
      success: false,
      connected: false,
      message: error.message
    });
  }
};

