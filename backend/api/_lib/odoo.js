const DEFAULT_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

function parseOriginList(value) {
  return (value || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function applyCors(req, res) {
  const allowed = parseOriginList(process.env.CORS_ORIGINS).length
    ? parseOriginList(process.env.CORS_ORIGINS)
    : DEFAULT_ORIGINS;

  const origin = req.headers.origin;
  if (origin && allowed.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Odoo-User, X-Odoo-Pass, X-Odoo-Db");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return true;
  }
  return false;
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

const ODOO_URL = process.env.ODOO_URL;
const ODOO_DB = process.env.ODOO_DB;
const ODOO_USER = process.env.ODOO_USER;
const ODOO_PASS = process.env.ODOO_PASS;

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

function getAuth(req, body = null) {
  const user =
    req.headers["x-odoo-user"] ||
    body?.odoo_user ||
    body?.user ||
    ODOO_USER;
  const pass =
    req.headers["x-odoo-pass"] ||
    body?.odoo_pass ||
    body?.pass ||
    ODOO_PASS;
  const db =
    req.headers["x-odoo-db"] ||
    body?.odoo_db ||
    body?.db ||
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
  return loginResp.result;
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

module.exports = {
  applyCors,
  readJsonBody,
  jsonRpc,
  getAuth,
  odooLogin,
  odooExecuteKw,
  getFields,
};
