const { applyCors, getAuth, odooLogin } = require("../_lib/odoo");

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  try {
    const { db, user, pass } = getAuth(req);
    const uid = await odooLogin(db, user, pass);
    if (!uid) return res.status(401).json({ ok: false, error: "Login failed (uid is null/0)" });
    res.json({ ok: true, uid });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || String(e) });
  }
};
