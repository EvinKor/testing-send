const express = require("express");

const app = express();
app.use(express.json());

const health = require("./api/health");
const login = require("./api/login");
const events = require("./api/events");
const tickets = require("./api/events/[id]/tickets");
const register = require("./api/event/register");
const debugOdoo = require("./api/debug/odoo");
const debugTicketFields = require("./api/debug/ticket-fields");

// Use the same handlers locally and on Vercel to avoid divergence.
app.get("/health", (req, res) => health(req, res));
app.get("/debug/odoo", (req, res) => debugOdoo(req, res));
app.get("/debug/ticket-fields", (req, res) => debugTicketFields(req, res));
app.post("/api/login", (req, res) => login(req, res));
app.get("/api/events", (req, res) => events(req, res));
app.get("/api/events/:id/tickets", (req, res) => {
  req.query.id = req.params.id;
  return tickets(req, res);
});
app.post("/api/event/register", (req, res) => register(req, res));

app.listen(3001, "127.0.0.1", () => {
  console.log("Backend running at http://127.0.0.1:3001");
  console.log("Health check: http://127.0.0.1:3001/health");
  console.log("Odoo debug:   http://127.0.0.1:3001/debug/odoo");
  console.log("Events:       http://127.0.0.1:3001/api/events");
  console.log("Tickets:      http://127.0.0.1:3001/api/events/3/tickets");
});
