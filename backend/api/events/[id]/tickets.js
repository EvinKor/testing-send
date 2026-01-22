const { applyCors, getAuth, odooLogin, odooExecuteKw } = require("../../_lib/odoo");

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const eventId = Number(req.query?.id || req.params?.id);
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
};
