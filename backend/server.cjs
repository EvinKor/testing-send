const express = require("express");
const cors = require("cors");

const app = express();

app.use(
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    credentials: true,
  })
);

app.use(express.json());

// =========================
// ✅ CONFIG (EDIT THESE)
// =========================
const ODOO_URL = "http://127.0.0.1:8069";
const ODOO_DB = "odoo_database_clear2"; // <-- CHANGE to your real DB name
const ODOO_USER = "admin"; // <-- CHANGE
const ODOO_PASS = "admin"; // <-- CHANGE

// =========================
// JSON-RPC helper
// =========================
async function jsonRpc(payload) {
  const res = await fetch(`${ODOO_URL}/jsonrpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Odoo did not return JSON. Status=${res.status}. Body=${text}`);
  }

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
  if (data.error) throw new Error(`Odoo JSON-RPC error: ${JSON.stringify(data.error)}`);
  return data;
}

function getAuth(req) {
  const user =
    req.header("x-odoo-user") ||
    req.body?.odoo_user ||
    req.body?.user ||
    ODOO_USER;
  const pass =
    req.header("x-odoo-pass") ||
    req.body?.odoo_pass ||
    req.body?.pass ||
    ODOO_PASS;
  const db =
    req.header("x-odoo-db") ||
    req.body?.odoo_db ||
    req.body?.db ||
    ODOO_DB;
  return { user, pass, db };
}

async function odooLogin(db, user, pass) {
  const loginResp = await jsonRpc({
    jsonrpc: "2.0",
    method: "call",
    params: {
      service: "common",
      method: "login",
      args: [db, user, pass],
    },
    id: 1,
  });
  return loginResp.result; // uid
}

async function odooExecuteKw(db, uid, pass, model, method, args = [], kwargs = {}) {
  const resp = await jsonRpc({
    jsonrpc: "2.0",
    method: "call",
    params: {
      service: "object",
      method: "execute_kw",
      args: [db, uid, pass, model, method, args, kwargs],
    },
    id: 2,
  });
  return resp.result;
}

async function getFields(model) {
  const loginResp = await jsonRpc({
    jsonrpc: "2.0",
    method: "call",
    params: { service: "common", method: "login", args: [ODOO_DB, ODOO_USER, ODOO_PASS] },
    id: 1,
  });
  const uid = loginResp.result;

  const resp = await jsonRpc({
    jsonrpc: "2.0",
    method: "call",
    params: {
      service: "object",
      method: "execute_kw",
      args: [
        ODOO_DB,
        uid,
        ODOO_PASS,
        model,
        "fields_get",
        [],
        { attributes: ["string", "type"] },
      ],
    },
    id: 2,
  });

  return Object.keys(resp.result || {});
}


// =========================
// Routes
// =========================
app.get("/health", (req, res) => {
  res.json({ ok: true, msg: "backend is running" });
});

app.get("/debug/odoo", async (req, res) => {
  try {
    const { db, user, pass } = getAuth(req);
    const uid = await odooLogin(db, user, pass);
    if (!uid) return res.status(401).json({ ok: false, error: "Login failed (uid is null/0)" });
    res.json({ ok: true, uid });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || String(e) });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { db, user, pass } = getAuth(req);
    if (!user || !pass) return res.status(400).json({ ok: false, error: "Missing user or pass" });
    const uid = await odooLogin(db, user, pass);
    if (!uid) return res.status(401).json({ ok: false, error: "Odoo login failed" });
    return res.json({ ok: true, uid });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || String(e) });
  }
});

// ✅ list events for dropdown
app.get("/api/events", async (req, res) => {
  try {
    const { db, user, pass } = getAuth(req);
    // 1) login
    const login = await jsonRpc({
      jsonrpc: "2.0",
      method: "call",
      params: {
        service: "common",
        method: "login",
        args: [db, user, pass],
      },
      id: 1,
    });

    const uid = login.result;
    if (!uid) {
      return res.status(401).json({ ok: false, error: "Odoo login failed" });
    }

    // 2) fetch ALL published events
    const eventsResp = await jsonRpc({
      jsonrpc: "2.0",
      method: "call",
      params: {
        service: "object",
        method: "execute_kw",
        args: [
          db,
          uid,
          pass,
          "event.event",
          "search_read",
          [
            [
              ["website_published", "=", true], // IMPORTANT
              ["active", "=", true],
            ],
          ],
          {
            fields: [
              "id",
              "name",
              "date_begin",
              "date_end",
              "seats_max",
              "seats_available",
            ],
            order: "date_begin asc",
          },
        ],
      },
      id: 2,
    });

    res.json({
      ok: true,
      events: eventsResp.result || [],
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});


// ✅ list tickets for the selected event
app.get("/api/events/:id/tickets", async (req, res) => {
  try {
    const eventId = Number(req.params.id);
    if (!eventId) return res.status(200).json({ ok: false, error: "Invalid event id" });

    const { db, user, pass } = getAuth(req);
    const uid = await odooLogin(db, user, pass);
    if (!uid) return res.status(401).json({ ok: false, error: "Odoo login failed" });

    const tickets = await odooExecuteKw(
      db,
      uid,
      pass,
      "event.event.ticket",
      "search_read",
      [
        [["event_id", "=", eventId]],
        ["name", "description", "seats_available", "sequence"],
      ],
      { order: "sequence asc", limit: 200 }
    );

    return res.json({ ok: true, tickets: tickets || [] });
  } catch (e) {
    return res.status(200).json({ ok: false, error: e.message || String(e) });
  }
});


// ✅ React submits here, backend forwards to Odoo controller you already built
app.post("/api/event/register", async (req, res) => {
  console.log("✅ /api/event/register hit");
  console.log(req.body);

  try {
    const { db, user, pass } = getAuth(req);
    const uid = await odooLogin(db, user, pass);
    if (!uid) {
      return res.status(401).json({ ok: false, error: "Odoo login failed. Check DB/USER/PASS." });
    }

    // Forward to Odoo custom controller route
    const forward = await fetch(`${ODOO_URL}/api/event/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "call",
        params: { ...req.body, odoo_user: user, odoo_pass: pass, odoo_db: db },
        id: 1,
      }),
    });

    const text = await forward.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(502).json({ ok: false, error: `Odoo returned non-JSON: ${text}` });
    }

    return res.status(forward.status).json(data);
  } catch (e) {
    console.error("❌ Backend error:", e);
    return res.status(500).json({ ok: false, error: e.message || String(e) });
  }
});

// ✅ Debug: list all fields on event.event.ticket
app.get("/debug/ticket-fields", async (req, res) => {
  try {
    // 1) login
    const loginResp = await jsonRpc({
      jsonrpc: "2.0",
      method: "call",
      params: {
        service: "common",
        method: "login",
        args: [ODOO_DB, ODOO_USER, ODOO_PASS],
      },
      id: 1,
    });

    const uid = loginResp.result;
    if (!uid) {
      return res.status(401).json({ ok: false, error: "Odoo login failed" });
    }

    // 2) fields_get
    const fieldsResp = await jsonRpc({
      jsonrpc: "2.0",
      method: "call",
      params: {
        service: "object",
        method: "execute_kw",
        args: [
          ODOO_DB,
          uid,
          ODOO_PASS,
          "event.event.ticket",
          "fields_get",
          [],
          { attributes: ["string", "type"] },
        ],
      },
      id: 2,
    });

    return res.json({ ok: true, fields: Object.keys(fieldsResp.result || {}) });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || String(e) });
  }
});


app.listen(3001, "127.0.0.1", () => {
  console.log("✅ Backend running at http://127.0.0.1:3001");
  console.log("✅ Health check: http://127.0.0.1:3001/health");
  console.log("✅ Odoo debug:   http://127.0.0.1:3001/debug/odoo");
  console.log("✅ Events:       http://127.0.0.1:3001/api/events");
  console.log("✅ Tickets:      http://127.0.0.1:3001/api/events/3/tickets");
});
