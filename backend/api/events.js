const { applyCors, getAuth, odooLogin, jsonRpc } = require("./_lib/odoo");

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const { db, user, pass } = getAuth(req);
    const uid = await odooLogin(db, user, pass);
    if (!uid) {
      return res.status(401).json({ ok: false, error: "Odoo login failed" });
    }

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
              ["website_published", "=", true],
              ["active", "=", true],
            ],
          ],
          {
            fields: ["id", "name", "date_begin", "date_end", "seats_max", "seats_available"],
            order: "date_begin asc",
          },
        ],
      },
      id: 2,
    });

    res.json({ ok: true, events: eventsResp.result || [] });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || String(e) });
  }
};
