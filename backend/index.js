import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

function getAuth(req) {
  const user =
    req.header("x-odoo-user") ||
    req.body?.odoo_user ||
    req.body?.user ||
    process.env.ODOO_USER;
  const pass =
    req.header("x-odoo-pass") ||
    req.body?.odoo_pass ||
    req.body?.pass ||
    process.env.ODOO_PASS;
  const db =
    req.header("x-odoo-db") ||
    req.body?.odoo_db ||
    req.body?.db ||
    process.env.ODOO_DB;
  return { user, pass, db };
}

app.post("/api/login", async (req, res) => {
  try {
    const { user, pass, db } = getAuth(req);
    if (!user || !pass) {
      return res.status(400).json({ ok: false, error: "Missing user or pass" });
    }

    const loginRes = await fetch(`${process.env.ODOO_URL}/jsonrpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "call",
        params: {
          service: "common",
          method: "login",
          args: [db, user, pass],
        },
        id: 1,
      }),
    });

    const loginData = await loginRes.json();
    const uid = loginData.result;
    if (!uid) {
      return res.status(401).json({ ok: false, error: "Odoo login failed" });
    }

    return res.json({ ok: true, uid });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

app.post("/api/event/register", async (req, res) => {
  try {
    const { event_id, attendees } = req.body;
    const { user, pass, db } = getAuth(req);

    if (!event_id || !Array.isArray(attendees) || attendees.length === 0) {
      return res.status(400).json({ ok: false, error: "Invalid payload" });
    }

    /* 1️⃣ Login to Odoo */
    const loginRes = await fetch(`${process.env.ODOO_URL}/jsonrpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "call",
        params: {
          service: "common",
          method: "login",
          args: [db, user, pass],
        },
        id: 1,
      }),
    });

    const loginData = await loginRes.json();
    const uid = loginData.result;

    if (!uid) {
      return res.status(401).json({ ok: false, error: "Odoo login failed" });
    }

    /* 2️⃣ Create event.registration records */
    const registrations = attendees.map((a) => ({
      event_id,
      name: a.name,
      email: a.email,
      phone: a.phone || false,
    }));

    const createRes = await fetch(`${process.env.ODOO_URL}/jsonrpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "call",
        params: {
          service: "object",
          method: "execute_kw",
          args: [
            db,
            uid,
            pass,
            "event.registration",
            "create",
            [registrations],
          ],
        },
        id: 2,
      }),
    });

    const createData = await createRes.json();
    const registration_ids = createData.result;

    /* 3️⃣ Build ticket PDF URL (first ticket) */
    const ticket_pdf_url =
      registration_ids && registration_ids.length
        ? `${process.env.ODOO_URL}/api/event/ticket/${registration_ids[0]}`
        : null;

    /* 4️⃣ Final response to React */
    return res.json({
      ok: true,
      registration_ids,
      ticket_pdf_url,
    });
  } catch (e) {
    console.error("❌ Backend error:", e);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/debug/odoo", async (req, res) => {
  try {
    const login = await jsonRpc({
      jsonrpc: "2.0",
      method: "call",
      params: {
        service: "common",
        method: "login",
        args: [ODOO_DB, ODOO_USER, ODOO_PASS],
      },
      id: 1,
    });

    const uid = login.result;
    if (!uid) return res.status(401).json({ ok: false, error: "Odoo login failed", raw: login });

    return res.json({ ok: true, uid });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || String(e) });
  }
});

app.listen(3001, () => {
  console.log("Backend running on http://localhost:3001");
});
