const { applyCors, readJsonBody, getAuth, odooLogin } = require("./_lib/odoo");

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const body = await readJsonBody(req);
    const { db, user, pass } = getAuth(req, body);
    if (!user || !pass) return res.status(400).json({ ok: false, error: "Missing user or pass" });
    const uid = await odooLogin(db, user, pass);
    if (!uid) return res.status(401).json({ ok: false, error: "Odoo login failed" });
    return res.json({ ok: true, uid });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || String(e) });
  }
};
