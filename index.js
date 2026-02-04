import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;

// ===============================
// CONFIG SHOPIFY (ENV VARS)
// ===============================
const SHOP = process.env.SHOPIFY_SHOP; // ej: murai-cl.myshopify.com
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN; // Admin API token (debe ser Admin token real)
const API_VERSION = process.env.SHOPIFY_API_VERSION || "2024-01";

// ===============================
// HEALTH CHECK (Render)
// ===============================
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// ===============================
// ROOT (required by Shopify iframe)
// ===============================
app.get("/", (req, res) => {
  res.send("Pedido Status API funcionando");
});

// ===============================
// ORDER STATUS ENDPOINT
// (esto es lo que llama el App Proxy)
// ===============================
app.get("/order-status", async (req, res) => {
  let orderNumber = req.query.order;

  if (!orderNumber) {
    return res.status(400).json({
      error: "Debes enviar el número de pedido. Ej: ?order=1001 o ?order=#1001",
    });
  }

  // Normaliza: acepta "1001" o "#1001"
  orderNumber = String(orderNumber).trim();
  if (!orderNumber.startsWith("#")) orderNumber = `#${orderNumber}`;

  try {
    if (!SHOP || !TOKEN) {
      return res.status(500).json({
        error:
          "Faltan variables de entorno. Revisa SHOPIFY_SHOP y SHOPIFY_ADMIN_TOKEN en Render.",
      });
    }

    // IMPORTANTE: encodeURIComponent para que # no rompa la URL
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

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      return res.status(500).json({
        error: "Shopify respondió error",
        status: response.status,
        details: data,
      });
    }

    if (!data.orders || data.orders.length === 0) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    const order = data.orders[0];

    res.json({
      orderName: order.name,
      updatedAt: order.updated_at || order.created_at,
      financial_status: order.financial_status,
      fulfillment_status: order.fulfillment_status,
      created_at: order.created_at,

      // Campos opcionales para tu UI:
      stageIndex: order.fulfillment_status ? 3 : 1,
      finalLabel: order.fulfillment_status ? "Listo" : "Retiro en tienda / En camino",
      methodLabel: order.fulfillment_status ? "Despachado / Listo" : "En preparación",
      note: "",
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
