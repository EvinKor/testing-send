import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import type { OdooAuth } from "./auth";

type Attendee = { name: string; email: string; phone: string };

type EventItem = {
  id: number;
  name: string;
  date_begin?: string | false;
  date_end?: string | false;
  seats_available?: number;
};

type TicketItem = {
  id: number;
  name: string;
  description?: string | false;
  seats_available?: number;
};

type ApiOk<T> = { ok: true } & T;
type ApiFail = { ok: false; error: any };

type Props = {
  auth: OdooAuth | null;
  onLogout: () => void;
};

export default function SendRegisterForm({ auth, onLogout }: Props) {
  const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:3001";
  const ODOO_ORIGIN = "http://127.0.0.1:8069";
  const navigate = useNavigate();

  const [events, setEvents] = useState<EventItem[]>([]);
  const [tickets, setTickets] = useState<TicketItem[]>([]);

  // IMPORTANT: keep these as number | "" only
  const [eventId, setEventId] = useState<number | "">("");
  const [ticketId, setTicketId] = useState<number | "">("");

  const [qty, setQty] = useState<number>(1);
  const [attendees, setAttendees] = useState<Attendee[]>([
    { name: "", email: "", phone: "" },
  ]);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>("");
  const [ticketUrl, setTicketUrl] = useState<string>("");
  const [autoOpenedUrl, setAutoOpenedUrl] = useState<string>("");

  // ------------ helpers ------------
  const safeErr = (e: any) => {
    if (!e) return "Unknown error";
    if (typeof e === "string") {
      if (e.includes("not enough seats available")) return "No seats left";
      return e;
    }
    if (e.message) {
      if (String(e.message).includes("not enough seats available")) return "No seats left";
      return e.message;
    }
    try {
      return JSON.stringify(e);
    } catch {
      return String(e);
    }
  };

  const authHeaders = () => {
    if (!auth) return {};
    return {
      "x-odoo-user": auth.user,
      "x-odoo-pass": auth.pass,
      ...(auth.db ? { "x-odoo-db": auth.db } : {}),
    };
  };

  async function fetchJson(url: string) {
    const res = await fetch(url, { headers: authHeaders() });
    const text = await res.text();
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(`Backend returned non-JSON: ${text.slice(0, 200)}`);
    }
    // normalize JSON-RPC style responses if you ever return {result:{...}}
    return parsed?.result ?? parsed;
  }

  function extractTicketUrl(data: any): string {
    if (!data) return "";
    const direct =
      data.tickets_url ||
      data.ticket_pdf_url ||
      data.ticket_url ||
      data.ticket_pdf ||
      data.download_url ||
      data.url;
    if (typeof direct === "string" && direct) return direct;

    if (Array.isArray(data.tickets) && data.tickets.length > 0) {
      const t = data.tickets[0];
      const fromTicket =
        t?.pdf_url || t?.ticket_pdf_url || t?.ticket_url || t?.download_url || t?.url;
      if (typeof fromTicket === "string" && fromTicket) return fromTicket;
    }

    if (data.result && data.result !== data) return extractTicketUrl(data.result);
    return "";
  }

  function normalizeTicketUrl(url: string) {
    const trimmed = url.trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("/")) return `${ODOO_ORIGIN}${trimmed}`;
    return trimmed;
  }

  // ------------ load events ------------
  useEffect(() => {
    (async () => {
      try {
        setResult("");
        const data = (await fetchJson(`${API}/api/events`)) as ApiOk<{ events: EventItem[] }> | ApiFail;

        if (!data.ok) {
          const message = safeErr(data.error);
          setResult(`? Failed to load events: ${message}`);
          if (String(message).toLowerCase().includes("login failed")) {
            onLogout();
            navigate("/login", { replace: true, state: { error: "Login failed. Please sign in again." } });
          }
          return;
        }

        const list = Array.isArray(data.events) ? data.events : [];
        setEvents(list);

        // auto select first event
        if (list.length > 0) setEventId(list[0].id);
        else setEventId("");
      } catch (e: any) {
        const message = safeErr(e);
        setResult(`? Failed to load events: ${message}`);
        if (String(message).toLowerCase().includes("login failed")) {
          onLogout();
          navigate("/login", { replace: true, state: { error: "Login failed. Please sign in again." } });
        }
      }
    })();
  }, [navigate, onLogout]);

  // ------------ load tickets when event changes ------------
useEffect(() => {
  if (!eventId) return;

  setTicketId("");
  setTickets([]);
  setResult("");

  fetch(`${API}/api/events/${eventId}/tickets`, { headers: authHeaders() })
    .then(async (r) => {
      const text = await r.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Non-JSON from backend: ${text.slice(0, 200)}`);
      }

      if (!r.ok || !data.ok) {
        throw new Error(data.error || `HTTP ${r.status}`);
      }

      const list: TicketItem[] = data.tickets || [];
      setTickets(list);

      if (list.length > 0) setTicketId(list[0].id);
    })
    .catch((e) => setResult(`❌ Failed to load tickets: ${e.message}`));
}, [eventId]);


  // ------------ resize attendee inputs when qty changes ------------
  useEffect(() => {
    setAttendees((prev) => {
      const next = [...prev];
      if (qty > next.length) {
        for (let i = next.length; i < qty; i++) {
          next.push({ name: "", email: "", phone: "" });
        }
      } else if (qty < next.length) {
        next.length = qty;
      }
      return next;
    });
  }, [qty]);

  function updateAttendee(index: number, key: keyof Attendee, value: string) {
    setAttendees((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  }

  function validate(): string | null {
    if (!eventId) return "Please choose an event";
    if (qty < 1) return "Ticket quantity must be at least 1";
    if (attendees.length !== qty) return "Attendees count must match quantity";

    for (let i = 0; i < attendees.length; i++) {
      const a = attendees[i];
      if (!a.name.trim()) return `Ticket #${i + 1}: Name is required`;
      if (!a.email.trim()) return `Ticket #${i + 1}: Email is required`;
    }
    return null;
  }

  useEffect(() => {
    if (ticketUrl && ticketUrl !== autoOpenedUrl) {
      window.open(ticketUrl, "_blank", "noopener,noreferrer");
      setAutoOpenedUrl(ticketUrl);
    }
  }, [ticketUrl, autoOpenedUrl]);

  // ------------ submit registration ------------
  async function submit() {
    setResult("");
    setTicketUrl("");
    const err = validate();
    if (err) {
      setResult(`❌ ${err}`);
      return;
    }

    setLoading(true);
    try {
      const payload = {
        event_id: eventId, // number
        // ticket_id optional; only send when selected
        ...(ticketId ? { ticket_id: ticketId } : {}),
        tickets_qty: qty,
        attendees,
        ...(auth ? { odoo_user: auth.user, odoo_pass: auth.pass, odoo_db: auth.db } : {}),
      };

      const res = await fetch(`${API}/api/event/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch {
        setResult(`❌ Backend returned non-JSON:\n${text.slice(0, 200)}`);
        return;
      }

      const data = parsed?.result ?? parsed; // normalize JSON-RPC

      if (!res.ok || !data?.ok) {
        setResult(`❌ ${safeErr(data?.error)} (HTTP ${res.status})`);
        return;
      }

      const ids = Array.isArray(data.registration_ids) ? data.registration_ids : [];
      setResult(`Registration successful! IDs: ${ids.join(", ") || "(none)"}`);

      let nextTicketUrl = "";
      const ticketsUrl = data?.tickets_url || data?.result?.tickets_url;
      if (ticketsUrl) {
        nextTicketUrl = ticketsUrl;
        if (!nextTicketUrl.includes("download=1")) {
          nextTicketUrl += (nextTicketUrl.includes("?") ? "&" : "?") + "download=1";
        }
      } else {
        nextTicketUrl = extractTicketUrl(data) || extractTicketUrl(parsed);
      }

      if (!nextTicketUrl && ids.length > 0) {
        nextTicketUrl = `${ODOO_ORIGIN}/my/event-registration/${ids[0]}/ticket`;
      }

      nextTicketUrl = normalizeTicketUrl(nextTicketUrl);

      if (nextTicketUrl) {
        setTicketUrl(nextTicketUrl);
      } else {
        setResult((prev) =>
          prev
            ? `${prev}\nNo ticket download URL returned by the backend.`
            : "No ticket download URL returned by the backend."
        );
      }
    } catch (e: any) {
      setResult(`❌ Network error: ${safeErr(e)}`);
    } finally {
      setLoading(false);
    }
  }

  const selectedEvent = useMemo(
    () => events.find((e) => e.id === eventId),
    [events, eventId]
  );
  const selectedTicket = useMemo(
    () => tickets.find((t) => t.id === ticketId),
    [tickets, ticketId]
  );

  if (!auth) return <Navigate to="/login" replace />;

  return (
    <div className="page">
      <div className="shell two-col">
        <aside className="side-panel">
          <div className="brand-mark">Odoo Events</div>
          <h1 className="headline">Registration desk</h1>
          <p className="muted">
            Capture attendee details and generate tickets without leaving your Odoo account.
          </p>

          <div className="event-card">
            {selectedEvent ? (
              <>
                <div className="event-name">{selectedEvent.name}</div>
                <div className="event-meta">
                  {selectedEvent.date_begin && <span>Start: {String(selectedEvent.date_begin)}</span>}
                  {selectedEvent.date_end && <span>End: {String(selectedEvent.date_end)}</span>}
                  {selectedEvent.seats_available !== undefined && (
                    <span>Seats available: {selectedEvent.seats_available}</span>
                  )}
                </div>
              </>
            ) : (
              <div className="muted">Loading event...</div>
            )}
          </div>

          <div className="pill-row">
            <div className="pill">Signed in as {auth.user}</div>
            <button className="btn ghost" type="button" onClick={onLogout}>
              Sign out
            </button>
          </div>
        </aside>

        <main className="card">
          <div className="card-header">
            <div>
              <div className="eyebrow">Event Registration</div>
              <h2 className="title">Add attendees</h2>
              <p className="muted">Select an event, set quantity, and fill the attendee details.</p>
            </div>
          </div>

          <div className="grid-2">
            <label className="label">
              Choose Event
              <select
                className="input"
                value={eventId === "" ? "" : String(eventId)}
                onChange={(e) => {
                  const v = e.target.value;
                  setEventId(v ? Number(v) : "");
                }}
              >
                {events.length === 0 ? (
                  <option value="">No events</option>
                ) : (
                  events.map((ev) => (
                    <option key={ev.id} value={String(ev.id)}>
                      #{ev.id} - {ev.name}
                    </option>
                  ))
                )}
              </select>
            </label>

            <label className="label">
              Number of Tickets
              <select
                className="input"
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
                disabled={!tickets.length}
              >
                {!tickets.length ? (
                  <option value={1}>No tickets</option>
                ) : (
                  Array.from(
                    { length: Math.max(1, Math.min(selectedTicket?.seats_available ?? 10, 10)) },
                    (_, i) => i + 1
                  ).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))
                )}
              </select>
              {selectedTicket && selectedTicket.seats_available !== undefined && (
                <span className="help">Seats available: {selectedTicket.seats_available}</span>
              )}
            </label>
          </div>

          <div className="ticket-list">
            {attendees.map((a, idx) => (
              <div key={idx} className="ticket-card">
                <div className="ticket-title">Ticket #{idx + 1}</div>
                <div className="grid-2">
                  <label className="label">
                    Name *
                    <input
                      className="input"
                      value={a.name}
                      onChange={(e) => updateAttendee(idx, "name", e.target.value)}
                    />
                  </label>

                  <label className="label">
                    Email *
                    <input
                      className="input"
                      value={a.email}
                      onChange={(e) => updateAttendee(idx, "email", e.target.value)}
                    />
                  </label>

                  <label className="label">
                    Phone
                    <input
                      className="input"
                      value={a.phone}
                      onChange={(e) => updateAttendee(idx, "phone", e.target.value)}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className="actions">
            <button className="btn primary" onClick={submit} disabled={loading}>
              {loading ? "Submitting..." : "Register"}
            </button>
            {ticketUrl && (
              <a className="btn outline" href={ticketUrl} target="_blank" rel="noreferrer">
                Download ticket PDF
              </a>
            )}
          </div>

          {result && <div className="alert">{result}</div>}
        </main>
      </div>
    </div>
  );
}
