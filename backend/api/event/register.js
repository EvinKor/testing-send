const { applyCors, readJsonBody, getAuth, odooLogin } = require("../_lib/odoo");

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const body = await readJsonBody(req);
    const { db, user, pass } = getAuth(req, body);
    const uid = await odooLogin(db, user, pass);
    if (!uid) {
      return res.status(401).json({ ok: false, error: "Odoo login failed. Check DB/USER/PASS." });
    }

    const forward = await fetch(`${process.env.ODOO_URL}/api/event/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "call",
        params: { ...body, odoo_user: user, odoo_pass: pass, odoo_db: db },
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
    return res.status(500).json({ ok: false, error: e.message || String(e) });
  }
};
