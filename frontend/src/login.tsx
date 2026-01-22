import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { OdooAuth } from "./auth";

type Props = {
  auth: OdooAuth | null;
  onLogin: (next: OdooAuth) => void;
};

export default function LoginPage({ auth, onLogin }: Props) {
  const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:3001";
  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser] = useState(auth?.user ?? "");
  const [pass, setPass] = useState(auth?.pass ?? "");
  const [db, setDb] = useState(auth?.db ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (auth) navigate("/register", { replace: true });
  }, [auth, navigate]);

  useEffect(() => {
    const stateError = (location.state as { error?: string } | null)?.error;
    if (stateError) setError(stateError);
  }, [location.state]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user: user.trim(),
          pass,
          db: db.trim() || undefined,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.error || `Login failed (HTTP ${res.status})`);
        return;
      }

      onLogin({ user: user.trim(), pass, db: db.trim() || undefined });
      navigate("/register", { replace: true });
    } catch (err: any) {
      setError(err?.message || "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <div className="shell two-col">
        <aside className="side-panel">
          <div className="brand-mark">Odoo Events</div>
          <h1 className="headline">Sign in to manage event registrations.</h1>
          <p className="muted">
            Use your Odoo credentials so registrations are tied to your account. This session
            stays in your browser until you sign out.
          </p>
          <div className="accent-card">
            <div className="accent-title">Secure Flow</div>
            <p className="muted">
              Credentials are used only to authenticate against your Odoo instance for this
              session.
            </p>
          </div>
        </aside>

        <main className="card">
          <div className="card-header">
            <div>
              <div className="eyebrow">Odoo Login</div>
              <h2 className="title">Welcome back</h2>
              <p className="muted">Enter your Odoo username, password, and optional database.</p>
            </div>
          </div>

          <form className="form" onSubmit={submit}>
            <label className="label">
              Username
              <input
                className="input"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                placeholder="admin"
                required
              />
            </label>

            <label className="label">
              Password
              <input
                className="input"
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="password"
                required
              />
            </label>

            <label className="label">
              Database (optional)
              <input
                className="input"
                value={db}
                onChange={(e) => setDb(e.target.value)}
                placeholder="odoo_database"
              />
            </label>

            {error && <div className="alert error">{error}</div>}

            <button className="btn primary" type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </main>
      </div>
    </div>
  );
}
