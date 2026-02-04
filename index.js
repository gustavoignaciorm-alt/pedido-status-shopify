import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;

// ===============================
// CONFIG SHOPIFY (ENV VARS)
// ===============================
const SHOP = process.env.SHOPIFY_SHOP; // ej: murai-cl.myshopify.com
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN; // Admin API token
const API_VERSION = "2024-01";

// ===============================
// HEALTH CHECK (Render)
// ===============================
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// ===============================
// ORDER STATUS ENDPOINT
// ===============================
app.get("/order-status", async (req, res) => {
  const orderNumber = req.query.order;

  if (!orderNumber) {
    return res.status(400).json({
      error: "Debes enviar el número de pedido ?order=XXXX",
    });
  }

  try {
    const url = `https://${SHOP}/admin/api/${API_VERSION}/orders.json?name=${orderNumber}&status=any`;

    const response = await fetch(url, {
      headers: {
        "X-Shopify-Access-Token": TOKEN,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (!data.orders || data.orders.length === 0) {
      return res.status(404).json({
        error: "Pedido no encontrado",
      });
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
    res.status(500).json({
      error: "Error consultando Shopify",
    });
  }
});

// ===============================
// START SERVER
// ===============================
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
