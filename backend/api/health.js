const { applyCors } = require("./_lib/odoo");

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  res.status(200).json({ ok: true, msg: "backend is running" });
};
