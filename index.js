import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;

// ===============================
// CONFIG SHOPIFY (ENV VARS)
// ===============================
const SHOP = process.env.SHOPIFY_SHOP; // ej: murai-cl.myshopify.com
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN; // Admin API token
const API_VERSION = process.env.SHOPIFY_API_VERSION || "2024-01";

// ===============================
// MIDDLEWARE
// ===============================
app.use(express.json());

// (Opcional) Si vas a llamar esto desde el front (otro dominio), deja esto.
// Si no lo necesitas, puedes borrarlo.
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// ===============================
// HOME (IMPORTANTE para Shopify / App URL)
// ===============================
app.get("/", (req, res) => {
  res
    .status(200)
    .send(
      "Pedido Status API funcionando ✅ | Usa /health o /order-status?order=#1001"
    );
});

// ===============================
// HEALTH CHECK (Render)
// ===============================
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    shop_configured: Boolean(SHOP),
    token_configured: Boolean(TOKEN),
    api_version: API_VERSION,
  });
});

// ===============================
// ORDER STATUS ENDPOINT
// ===============================
// Ejemplo: /order-status?order=#1001  o  /order-status?order=1001
app.get("/order-status", async (req, res) => {
  let orderNumber = req.query.order;

  if (!orderNumber) {
    return res.status(400).json({
      error: "Debes enviar el número de pedido. Ej: /order-status?order=#1001",
    });
  }

  // Normaliza: si llega "1001" lo convertimos a "#1001"
  orderNumber = String(orderNumber).trim();
  if (!orderNumber.startsWith("#")) orderNumber = `#${orderNumber}`;

  // Validación de ENV
  if (!SHOP || !TOKEN) {
    return res.status(500).json({
      error:
        "Faltan variables de entorno. Revisa SHOPIFY_SHOP y SHOPIFY_ADMIN_TOKEN en Render.",
    });
  }

  try {
    const url = `https://${SHOP}/admin/api/${API_VERSION}/orders.json?name=${encodeURIComponent(
      orderNumber
    )}&status=any`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-Shopify-Access-Token": TOKEN,
        "Content-Type": "application/json",
      },
    });

    // Si Shopify responde error, mostramos info útil
    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({
        error: "Shopify respondió error",
        status: response.status,
        details: text,
      });
    }

    const data = await response.json();

    if (!data.orders || data.orders.length === 0) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    const order = data.orders[0];

    res.json({
      order_number: order.name,
      financial_status: order.financial_status,
      fulfillment_status: order.fulfillment_status,
      created_at: order.created_at,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error consultando Shopify" });
  }
});

// ===============================
// START SERVER
// ===============================
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
