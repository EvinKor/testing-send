const { applyCors, getFields } = require("../_lib/odoo");

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  try {
    const fields = await getFields("event.event.ticket");
    return res.json({ ok: true, fields });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || String(e) });
  }
};
