require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const QRCode = require("qrcode");

const app = express();
app.use(express.json({ limit: "5mb" }));
app.use(express.static(path.join(__dirname)));

// ── Gateway selector ──────────────────────────────────────────────────────────
const GATEWAY = (process.env.PAYMENT_GATEWAY || "blackcat").trim().toLowerCase();

// ── BrutalCash config ─────────────────────────────────────────────────────────
const BRUTAL_BASE   = "https://api.brutalcash.com/v1";
const BRUTAL_PUBLIC = (process.env.BRUTAL_PUBLIC_KEY || "").trim();
const BRUTAL_SECRET = (process.env.BRUTAL_SECRET_KEY || "").trim();

// ── BlackCat config ───────────────────────────────────────────────────────────
const BLACKCAT_BASE    = "https://api.blackcatpay.com.br/api";
const BLACKCAT_API_KEY = (process.env.BLACKCAT_API_KEY || "").trim();

// ── Shared config ─────────────────────────────────────────────────────────────
const UTMIFY_URL       = "https://api.utmify.com.br/api-credentials/orders";
const UTMIFY_TOKEN     = (process.env.UTMIFY_API_TOKEN || "").trim();
const SITE_URL         = (process.env.SITE_URL || "http://localhost:" + (process.env.PORT || 3000)).replace(/\/$/, "");
const PENDING_FILE     = path.join(__dirname, "data", "pending-utmify-orders.json");
const POLL_INTERVAL_MS = 30 * 1000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function toUtcDateTime(date) {
  const d = date instanceof Date ? date : new Date(date);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

function ensureDataDir() {
  const dir = path.join(__dirname, "data");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readPending() {
  ensureDataDir();
  try { return JSON.parse(fs.readFileSync(PENDING_FILE, "utf8")) || []; } catch { return []; }
}

function writePending(list) {
  ensureDataDir();
  fs.writeFileSync(PENDING_FILE, JSON.stringify(list), "utf8");
}

// ── BrutalCash API ────────────────────────────────────────────────────────────

function brutalAuth() {
  return "Basic " + Buffer.from(`${BRUTAL_PUBLIC}:${BRUTAL_SECRET}`).toString("base64");
}

async function brutalRequest(method, endpoint, body) {
  const url  = `${BRUTAL_BASE}${endpoint}`;
  const opts = {
    method,
    headers: { "Content-Type": "application/json", "authorization": brutalAuth() },
  };
  if (body) opts.body = JSON.stringify(body);
  const res  = await fetch(url, opts);
  const json = await res.json();
  if (!res.ok) {
    const err = new Error(json.message || json.error || "BrutalCash API error");
    err.status = res.status; err.body = json; throw err;
  }
  return json.data !== undefined ? json.data : json;
}

// ── BlackCat API ──────────────────────────────────────────────────────────────

async function blackcatRequest(method, endpoint, body) {
  const url  = `${BLACKCAT_BASE}${endpoint}`;
  const opts = {
    method,
    headers: { "Content-Type": "application/json", "X-API-Key": BLACKCAT_API_KEY },
  };
  if (body) opts.body = JSON.stringify(body);
  const res  = await fetch(url, opts);
  const json = await res.json();
  if (!res.ok) {
    const err = new Error(json.message || json.error || "BlackCat API error");
    err.status = res.status; err.body = json; throw err;
  }
  return json.data !== undefined ? json.data : json;
}

// ── UTMify ────────────────────────────────────────────────────────────────────

function buildUtmifyPayload({ orderId, status, createdAt, approvedDate, customer, products, tracking, totalPriceInCents }) {
  const gatewayFee     = Math.round(totalPriceInCents * 0.01) || 0;
  const userCommission = Math.max(1, totalPriceInCents - gatewayFee);
  return {
    orderId: String(orderId),
    platform: "ZeDelivery",
    paymentMethod: "pix",
    status,
    createdAt,
    approvedDate: approvedDate || null,
    refundedAt: null,
    customer: {
      name:     customer.name,
      email:    customer.email || "cliente@zedelivery.com.br",
      phone:    customer.phone    || null,
      document: customer.document || null,
      country:  "BR",
      ip:       customer.ip || "0.0.0.0",
    },
    products: products.map((p) => ({
      id:           String(p.id || p.name),
      name:         p.name,
      planId:       null,
      planName:     null,
      quantity:     p.quantity || 1,
      priceInCents: p.priceInCents,
    })),
    trackingParameters: {
      src:          tracking?.src          ?? null,
      sck:          tracking?.sck          ?? null,
      utm_source:   tracking?.utm_source   ?? null,
      utm_campaign: tracking?.utm_campaign ?? null,
      utm_medium:   tracking?.utm_medium   ?? null,
      utm_content:  tracking?.utm_content  ?? null,
      utm_term:     tracking?.utm_term     ?? null,
    },
    commission: { totalPriceInCents, gatewayFeeInCents: gatewayFee, userCommissionInCents: userCommission },
  };
}

async function sendToUtmify(payload) {
  if (!UTMIFY_TOKEN) return;
  try {
    const res  = await fetch(UTMIFY_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "x-api-token": UTMIFY_TOKEN },
      body:    JSON.stringify(payload),
    });
    const text = await res.text();
    if (!res.ok) console.error(`UTMify erro ${res.status}:`, text);
    else         console.log(`UTMify: pedido ${payload.orderId} → ${payload.status}`);
  } catch (err) {
    console.error("UTMify erro:", err.message);
  }
}

// ── POST /api/criar-pix ───────────────────────────────────────────────────────

app.post("/api/criar-pix", async (req, res) => {
  const { customer, items = [], tracking } = req.body;

  if (!customer?.name) return res.status(400).json({ error: "Nome do cliente é obrigatório." });
  if (!items.length)   return res.status(400).json({ error: "Carrinho vazio." });

  const amountCents = items.reduce((sum, i) => sum + Math.round((i.unitPrice || 0) * (i.quantity || 1)), 0);
  if (amountCents <= 0) return res.status(400).json({ error: "Valor inválido." });

  const createdAt = toUtcDateTime(new Date());
  const cpfClean  = (customer.document?.number || customer.cpf || "").replace(/\D/g, "");
  const telClean  = (customer.phone || "").replace(/\D/g, "");

  let transactionId, pixCode, pixImage = null, expiresAt = null;

  if (GATEWAY === "brutal") {
    // ── BrutalCash ────────────────────────────────────────────────────────────
    let transaction;
    try {
      transaction = await brutalRequest("POST", "/payment-transaction/create", {
        amount:         amountCents,
        payment_method: "pix",
        pix:            { expires_in_days: 1 },
        postback_url:   SITE_URL.startsWith("https://") ? `${SITE_URL}/api/webhooks/brutal` : undefined,
        customer: {
          name:     customer.name,
          email:    customer.email || "cliente@zedelivery.com.br",
          phone:    telClean ? `+55${telClean}` : null,
          document: { number: cpfClean || "00000000000", type: "CPF" },
        },
        items: items.map((i) => ({
          title:      i.title || i.name || "Item",
          unit_price: i.unitPrice || 0,
          quantity:   i.quantity  || 1,
          tangible:   false,
        })),
      });
    } catch (err) {
      console.error("BrutalCash PIX error:", err.body || err.message);
      return res.status(502).json({ error: "Falha ao gerar PIX. Tente novamente." });
    }
    transactionId = transaction.id;
    const pixObj  = Array.isArray(transaction.pix) ? transaction.pix[0] : (transaction.pix || {});
    pixCode       = pixObj.qr_code || "";
    expiresAt     = pixObj.expiration_date || null;

  } else {
    // ── BlackCat ──────────────────────────────────────────────────────────────
    let bcTransaction;
    try {
      bcTransaction = await blackcatRequest("POST", "/sales/create-sale", {
        amount:        amountCents,
        currency:      "BRL",
        paymentMethod: "pix",
        pix:           { expiresInDays: 1 },
        postbackUrl:   SITE_URL.startsWith("https://") ? `${SITE_URL}/api/webhooks/blackcat` : undefined,
        customer: {
          name:     customer.name,
          email:    customer.email || "cliente@zedelivery.com.br",
          phone:    telClean || "00000000000",
          document: { number: cpfClean || "00000000000", type: "cpf" },
        },
        items: items.map((i, idx) => ({
          title:     i.title || `Produto ${String(idx + 1).padStart(2, "0")}`,
          unitPrice: i.unitPrice || 0,
          quantity:  i.quantity  || 1,
          tangible:  false,
        })),
        ...(tracking?.utm_source   && { utm_source:   tracking.utm_source   }),
        ...(tracking?.utm_medium   && { utm_medium:   tracking.utm_medium   }),
        ...(tracking?.utm_campaign && { utm_campaign: tracking.utm_campaign }),
        ...(tracking?.utm_content  && { utm_content:  tracking.utm_content  }),
        ...(tracking?.utm_term     && { utm_term:     tracking.utm_term     }),
      });
    } catch (err) {
      console.error("BlackCat PIX error:", err.body || err.message);
      return res.status(502).json({ error: "Falha ao gerar PIX. Tente novamente." });
    }
    transactionId = bcTransaction.transactionId;
    pixCode       = bcTransaction.paymentData?.copyPaste || bcTransaction.paymentData?.qrCode || "";
    expiresAt     = bcTransaction.paymentData?.expiresAt || null;
  }

  // Gera QR Code local
  if (pixCode) {
    try { pixImage = await QRCode.toDataURL(pixCode, { width: 280, margin: 2 }); }
    catch (e) { console.error("QR gen error:", e.message); }
  }

  // UTMify → waiting_payment
  if (UTMIFY_TOKEN) {
    const clientIp    = ((req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket?.remoteAddress || "0.0.0.0").replace(/^::ffff:/, "");
    const utmProducts = items.map((i) => ({
      id:           String(i.id || i.title || i.name),
      name:         i.title || i.name || "Item",
      quantity:     i.quantity || 1,
      priceInCents: i.unitPrice || 0,
    }));
    const utmPayload = buildUtmifyPayload({
      orderId: transactionId,
      status: "waiting_payment",
      createdAt,
      approvedDate: null,
      customer: { name: customer.name, email: customer.email, phone: telClean || null, document: cpfClean || null, ip: clientIp },
      products: utmProducts,
      tracking: tracking || {},
      totalPriceInCents: amountCents,
    });
    await sendToUtmify(utmPayload);
    const pending = readPending();
    pending.push({ transactionId: String(transactionId), createdAt, utmPayload, gateway: GATEWAY });
    writePending(pending);
  }

  return res.json({ id: transactionId, pixCode, pixImage, expiresAt, amount: amountCents });
});

// ── GET /api/status-pix ───────────────────────────────────────────────────────

app.get("/api/status-pix", async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "id é obrigatório" });

  const pending = readPending();
  const row     = pending.find((r) => r.transactionId === String(id));
  const gw      = row?.gateway || GATEWAY;

  try {
    if (gw === "brutal") {
      const tx     = await brutalRequest("GET", `/payment-transaction/info/${id}`);
      const status = tx.status || "";
      return res.json({
        paid: status === "PAID",
        finalizadoSemPagar: ["REFUSED", "REFUNDED", "CHARGEBACK", "EXPIRED", "ERROR", "FAILED"].includes(status),
        status,
      });
    } else {
      const tx     = await blackcatRequest("GET", `/sales/${id}/status`);
      const status = tx.status || "";
      return res.json({
        paid: status === "PAID",
        finalizadoSemPagar: ["CANCELLED", "REFUNDED"].includes(status),
        status,
      });
    }
  } catch (err) {
    console.error("status-pix error:", err.body || err.message);
    return res.status(502).json({ error: "Falha ao consultar pagamento." });
  }
});

// ── POST /api/webhooks/brutal ─────────────────────────────────────────────────

const seenWebhooks = new Set();

app.post("/api/webhooks/brutal", (req, res) => {
  res.json({ received: true });
  const event         = req.body;
  const transactionId = String(event?.Id || event?.id || "");
  const status        = String(event?.Status || event?.status || "");
  if (!transactionId || seenWebhooks.has(transactionId)) return;
  seenWebhooks.add(transactionId);
  setImmediate(async () => {
    console.log(`[webhook/brutal] transactionId=${transactionId} status=${status}`);
    if (status === "PAID" && UTMIFY_TOKEN) {
      const approvedDate = event?.paid_at ? toUtcDateTime(new Date(event.paid_at)) : toUtcDateTime(new Date());
      const pending      = readPending();
      const row          = pending.find((r) => r.transactionId === transactionId);
      if (row) {
        await sendToUtmify({ ...row.utmPayload, status: "paid", approvedDate });
        writePending(pending.filter((r) => r.transactionId !== transactionId));
      }
    }
  });
});

// ── POST /api/webhooks/blackcat ───────────────────────────────────────────────

app.post("/api/webhooks/blackcat", (req, res) => {
  res.json({ received: true });
  const event         = req.body;
  const transactionId = String(event?.transactionId || event?.id || "");
  const status        = String(event?.status || "");
  if (!transactionId || seenWebhooks.has(transactionId)) return;
  seenWebhooks.add(transactionId);
  setImmediate(async () => {
    console.log(`[webhook/blackcat] transactionId=${transactionId} status=${status}`);
    if (status === "PAID" && UTMIFY_TOKEN) {
      const approvedDate = event?.paidAt ? toUtcDateTime(new Date(event.paidAt)) : toUtcDateTime(new Date());
      const pending      = readPending();
      const row          = pending.find((r) => r.transactionId === transactionId);
      if (row) {
        await sendToUtmify({ ...row.utmPayload, status: "paid", approvedDate });
        writePending(pending.filter((r) => r.transactionId !== transactionId));
      }
    }
  });
});

// ── Polling fallback UTMify ───────────────────────────────────────────────────

async function pollPending() {
  if (!UTMIFY_TOKEN) return;
  const pending = readPending();
  if (!pending.length) return;

  const stillPending = [];
  for (const row of pending) {
    const gw = row.gateway || GATEWAY;
    try {
      if (gw === "brutal") {
        const tx     = await brutalRequest("GET", `/payment-transaction/info/${row.transactionId}`);
        const status = tx.status || "";
        if (status === "PAID") {
          const approvedDate = tx.paid_at ? toUtcDateTime(new Date(tx.paid_at)) : toUtcDateTime(new Date());
          await sendToUtmify({ ...row.utmPayload, status: "paid", approvedDate });
          console.log(`UTMify polling [brutal]: ${row.transactionId} confirmado`);
        } else { stillPending.push(row); }
      } else {
        const tx     = await blackcatRequest("GET", `/sales/${row.transactionId}/status`);
        const status = tx.status || "";
        if (status === "PAID") {
          const approvedDate = tx.paidAt ? toUtcDateTime(new Date(tx.paidAt)) : toUtcDateTime(new Date());
          await sendToUtmify({ ...row.utmPayload, status: "paid", approvedDate });
          console.log(`UTMify polling [blackcat]: ${row.transactionId} confirmado`);
        } else { stillPending.push(row); }
      }
    } catch (err) {
      console.error("Poll error:", row.transactionId, err.message);
      stillPending.push(row);
    }
  }
  if (stillPending.length !== pending.length) writePending(stillPending);
}

// ── Start ─────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Zé Delivery rodando na porta ${PORT}`);
  console.log(`Gateway ativo: ${GATEWAY.toUpperCase()}`);
  if (GATEWAY === "brutal") {
    console.log(`BrutalCash: ${BRUTAL_BASE}`);
  } else {
    console.log(`BlackCat: ${BLACKCAT_BASE}`);
  }
  if (UTMIFY_TOKEN) {
    console.log("UTMify: ativo");
    setInterval(pollPending, POLL_INTERVAL_MS);
    pollPending();
  } else {
    console.warn("UTMify: UTMIFY_API_TOKEN não configurado — tracking desativado.");
  }
});
