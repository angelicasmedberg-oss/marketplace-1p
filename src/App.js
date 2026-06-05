// src/App.js
// deps: @supabase/supabase-js papaparse recharts
// env:  REACT_APP_SUPABASE_URL  REACT_APP_SUPABASE_ANON_KEY

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  CartesianGrid, LineChart, Line, ReferenceLine, AreaChart, Area,
} from "recharts";

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

// ── Constants ────────────────────────────────────────────────────────────────
const ROLE_META = [
  { id: "t",  label: "Transcribers",   hex: "#378ADD", bg: "#eff6ff", tx: "#1e40af" },
  { id: "r",  label: "Reviewers",      hex: "#1D9E75", bg: "#f0fdf4", tx: "#166534" },
  { id: "er", label: "Exec Reviewers", hex: "#7F77DD", bg: "#f5f3ff", tx: "#4c1d95" },
];

const waitMult = (u) =>
  u <= 0.50 ? 0.02 : u <= 0.70 ? 0.07 : u <= 0.80 ? 0.15 :
  u <= 0.90 ? 0.35 : u <= 0.95 ? 0.90 : 3.0;

const r1  = (v) => Math.round(v * 10) / 10;
const fmt = (v) => r1(v).toFixed(1);
const pct = (v) => `${Math.round(v * 100)}%`;

// ── Styles ───────────────────────────────────────────────────────────────────
const S = {
  card: {
    background: "white",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: "1.25rem",
    boxShadow: "0 1px 4px rgba(0,0,0,.05)",
  },
  label: {
    fontSize: 11,
    fontWeight: 600,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: ".07em",
    marginBottom: 6,
    display: "block",
  },
  pill: (ok) => ({
    display: "inline-block",
    padding: "2px 10px",
    borderRadius: 99,
    fontSize: 12,
    fontWeight: 600,
    background: ok ? "#dcfce7" : "#fee2e2",
    color: ok ? "#166534" : "#dc2626",
    border: `1px solid ${ok ? "#bbf7d0" : "#fecaca"}`,
  }),
};

// ── Small components ──────────────────────────────────────────────────────────
const Tab = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    style={{
      padding: "7px 16px",
      borderRadius: 8,
      fontSize: 13,
      fontWeight: active ? 600 : 400,
      cursor: "pointer",
      background: active ? "white" : "transparent",
      color: active ? "#1e293b" : "#64748b",
      border: `1px solid ${active ? "#e2e8f0" : "transparent"}`,
      boxShadow: active ? "0 1px 3px rgba(0,0,0,.06)" : "none",
      transition: "all .15s",
    }}
  >
    {children}
  </button>
);

const Slider = ({ label, value, min, max, step = 1, onChange, disp }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 13 }}>
      <span style={{ color: "#64748b" }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{disp !== undefined ? disp : value}</span>
    </div>
    <input
      type="range" min={min} max={max} step={step} value={value}
      onChange={(e) => onChange(+e.target.value)}
      style={{ width: "100%", accentColor: "#378ADD" }}
    />
  </div>
);

const StatBox = ({ label, value, sub, color = "#1e293b" }) => (
  <div style={{ ...S.card, textAlign: "center" }}>
    <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 26, fontWeight: 700, color }}>{value}</div>
    {sub && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{sub}</div>}
  </div>
);

// ── LP Calculation ────────────────────────────────────────────────────────────
function runLP({ vol, spd, pool }) {
  const days          = vol.days;
  const dailyTx       = vol.monthlyTranscripts / days;
  const dailyAudioMin = vol.monthlyAudioMin / days;
  const avgAudioPerTx = vol.monthlyAudioMin / Math.max(vol.monthlyTranscripts, 1);

  // Capacity per person per day
  const tCapPerPerson  = spd.tHrsPerDay  * spd.tAudioMinPerHr;
  const rCapPerPerson  = spd.rHrsPerDay  * spd.rAudioMinPerHr;
  const erCapPerPerson = spd.erHrsPerDay * spd.erAudioMinPerHr;

  // Total capacity
  const tCap  = pool.t  * tCapPerPerson;
  const rCap  = pool.r  * rCapPerPerson;
  const erCap = pool.er * erCapPerPerson;

  // Utilization
  const tUtil  = dailyAudioMin / Math.max(tCap,  0.001);
  const rUtil  = dailyAudioMin / Math.max(rCap,  0.001);
  const erUtil = dailyAudioMin / Math.max(erCap, 0.001);

  // Queue wait (minutes)
  const tWait  = tUtil  >= 1 ? Infinity : waitMult(tUtil)  * (avgAudioPerTx / spd.tAudioMinPerHr)  * 60;
  const rWait  = rUtil  >= 1 ? Infinity : waitMult(rUtil)  * (avgAudioPerTx / spd.rAudioMinPerHr)  * 60;
  const erWait = erUtil >= 1 ? Infinity : waitMult(erUtil) * (avgAudioPerTx / spd.erAudioMinPerHr) * 60;

  // TAT estimate (hours) = processing time + wait time
  const tTat  = avgAudioPerTx / Math.max(spd.tAudioMinPerHr,  1) + tWait  / 60;
  const rTat  = avgAudioPerTx / Math.max(spd.rAudioMinPerHr,  1) + rWait  / 60;
  const erTat = avgAudioPerTx / Math.max(spd.erAudioMinPerHr, 1) + erWait / 60;
  const totalTat = tTat + rTat + erTat;

  // Required headcount for ≤80% utilization
  const targetUtil = 0.80;
  const reqT  = Math.ceil(dailyAudioMin / (tCapPerPerson  * targetUtil));
  const reqR  = Math.ceil(dailyAudioMin / (rCapPerPerson  * targetUtil));
  const reqEr = Math.ceil(dailyAudioMin / (erCapPerPerson * targetUtil));

  return {
    days, dailyTx, dailyAudioMin, avgAudioPerTx,
    tCap, tUtil, tWait,
    rCap, rUtil, rWait,
    erCap, erUtil, erWait,
    totalTat,
    reqT, reqR, reqEr,
  };
}

// ── Auth Screen ───────────────────────────────────────────────────────────────
function AuthScreen() {
  const [mode, setMode]       = useState("login");
  const [email, setEmail]     = useState("");
  const [pw, setPw]           = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr]         = useState("");
  const [msg, setMsg]         = useState("");
  const [loading, setLoading] = useState(false);

  const switchMode = (m) => { setMode(m); setErr(""); setMsg(""); };

  const handleSubmit = async () => {
    setLoading(true); setErr(""); setMsg("");
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
      if (error) { setErr(error.message); setLoading(false); }
    } else if (mode === "signup") {
      if (pw !== confirm) { setErr("Passwords don't match."); setLoading(false); return; }
      if (pw.length < 8)  { setErr("Password must be at least 8 characters."); setLoading(false); return; }
      const { error } = await supabase.auth.signUp({ email, password: pw });
      if (error) { setErr(error.message); setLoading(false); }
      else { setMsg("Account created! Check your email to confirm, then sign in."); setLoading(false); }
    } else {
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) { setErr(error.message); setLoading(false); }
      else { setMsg("Magic link sent — check your email."); setLoading(false); }
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f1f5f9" }}>
      <div style={{ width: 400, ...S.card, padding: "2.5rem" }}>
        <div style={{ marginBottom: "1.75rem" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#378ADD", letterSpacing: ".12em", textTransform: "uppercase", marginBottom: 4 }}>
            DBF · Parrot
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#0f172a" }}>
            Transcription Forecasting Tool
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 14, color: "#64748b" }}>
            {mode === "login" ? "Sign in to continue" : mode === "signup" ? "Create a new account" : "Get a magic link"}
          </p>
        </div>

        {err && (
          <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, fontSize: 13, color: "#dc2626", marginBottom: 16 }}>
            {err}
          </div>
        )}
        {msg && (
          <div style={{ padding: "10px 14px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, fontSize: 13, color: "#166534", marginBottom: 16 }}>
            {msg}
          </div>
        )}

        <div style={{ marginBottom: 14 }}>
          <label style={S.label}>Email</label>
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="you@filevine.com"
            style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, boxSizing: "border-box", outline: "none" }}
          />
        </div>

        {(mode === "login" || mode === "signup") && (
          <div style={{ marginBottom: 14 }}>
            <label style={S.label}>Password</label>
            <input
              type="password" value={pw} onChange={(e) => setPw(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder={mode === "signup" ? "Min. 8 characters" : ""}
              style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, boxSizing: "border-box", outline: "none" }}
            />
          </div>
        )}

        {mode === "signup" && (
          <div style={{ marginBottom: 14 }}>
            <label style={S.label}>Confirm password</label>
            <input
              type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, boxSizing: "border-box", outline: "none" }}
            />
          </div>
        )}

        <button
          onClick={handleSubmit} disabled={loading}
          style={{ width: "100%", padding: "11px", background: "#1e293b", color: "white", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", opacity: loading ? 0.6 : 1, marginBottom: 12 }}
        >
          {loading
            ? (mode === "login" ? "Signing in…" : mode === "signup" ? "Creating account…" : "Sending…")
            : (mode === "login" ? "Sign in" : mode === "signup" ? "Create account" : "Send magic link")}
        </button>

        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginTop: 4 }}>
          {mode !== "login" && (
            <button onClick={() => switchMode("login")}
              style={{ background: "none", border: "none", color: "#378ADD", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
              Sign in with password
            </button>
          )}
          {mode !== "signup" && (
            <button onClick={() => switchMode("signup")}
              style={{ background: "none", border: "none", color: "#378ADD", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
              Create account
            </button>
          )}
          {mode === "login" && (
            <button onClick={() => switchMode("magic")}
              style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 13 }}>
              Use magic link
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState(null);
  const [tab, setTab]         = useState("results");

  const [vol, setVol] = useState({
    days: 30,
    monthlyTranscripts: 196,
    monthlyAudioMin: 9800,
  });

  const [spd, setSpd] = useState({
    tHrsPerDay:      1.0,
    tAudioMinPerHr:  18,
    rHrsPerDay:      2.0,
    rAudioMinPerHr:  20,
    erHrsPerDay:     2.0,
    erAudioMinPerHr: 35,
  });

  const [pool, setPool] = useState({ t: 37, r: 12, er: 5 });

  const [delta, setDelta] = useState({ t: 0, r: 0, er: 0, volMult: 1.0 });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  const base = useMemo(() => runLP({ vol, spd, pool }), [vol, spd, pool]);

  const wi = useMemo(() => runLP({
    vol: {
      ...vol,
      monthlyTranscripts: vol.monthlyTranscripts * delta.volMult,
      monthlyAudioMin:    vol.monthlyAudioMin    * delta.volMult,
    },
    spd,
    pool: { t: pool.t + delta.t, r: pool.r + delta.r, er: pool.er + delta.er },
  }), [vol, spd, pool, delta]);

  const sensitivityData = useMemo(() => {
    const rows = [];
    for (let mult = 0.5; mult <= 1.51; mult += 0.1) {
      const p = {
        t:  Math.max(1, Math.round(pool.t  * mult)),
        r:  Math.max(1, Math.round(pool.r  * mult)),
        er: Math.max(1, Math.round(pool.er * mult)),
      };
      const r = runLP({ vol, spd, pool: p });
      rows.push({
        label:  `${Math.round(mult * 100)}%`,
        tUtil:  Math.round(r.tUtil  * 100),
        rUtil:  Math.round(r.rUtil  * 100),
        erUtil: Math.round(r.erUtil * 100),
        tat:    Math.round(r.totalTat),
      });
    }
    return rows;
  }, [vol, spd, pool]);

  if (!session) return <AuthScreen />;

  const TABS = ["results", "what-if", "configure", "sensitivity"];

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Nav */}
      <div style={{ background: "white", borderBottom: "1px solid #e2e8f0", padding: "0 24px", display: "flex", alignItems: "center", gap: 16, height: 56 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#378ADD", letterSpacing: ".1em", textTransform: "uppercase" }}>DBF</div>
        <div style={{ width: 1, height: 20, background: "#e2e8f0" }} />
        <div style={{ fontSize: 15, fontWeight: 600, color: "#0f172a" }}>Transcription Forecasting Tool</div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          {TABS.map((t) => (
            <Tab key={t} active={tab === t} onClick={() => setTab(t)}>
              {t === "what-if" ? "What-If" : t.charAt(0).toUpperCase() + t.slice(1)}
            </Tab>
          ))}
          <button
            onClick={() => supabase.auth.signOut()}
            style={{ marginLeft: 8, padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 500, color: "#64748b", background: "transparent", border: "1px solid #e2e8f0", cursor: "pointer" }}
          >
            Sign out
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px" }}>

        {/* ── RESULTS ── */}
        {tab === "results" && (
          <>
            <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700, color: "#0f172a" }}>Current Capacity Overview</h2>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
              <StatBox label="Daily transcripts"   value={fmt(base.dailyTx)}       sub={`${vol.monthlyTranscripts} / ${vol.days} days`} />
              <StatBox label="Daily audio (min)"   value={fmt(base.dailyAudioMin)} sub={`${vol.monthlyAudioMin.toLocaleString()} total`} />
              <StatBox label="Avg audio / TX"      value={fmt(base.avgAudioPerTx) + " min"} />
              <StatBox label="Est. total TAT"      value={fmt(base.totalTat) + " hr"} color={base.totalTat > 72 ? "#dc2626" : "#166534"} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
              {ROLE_META.map((rm) => {
                const util = base[`${rm.id}Util`];
                const wait = base[`${rm.id}Wait`];
                const ok   = util < 0.9;
                return (
                  <div key={rm.id} style={S.card}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{rm.label}</span>
                      <span style={S.pill(ok)}>{pct(util)}</span>
                    </div>
                    <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.7 }}>
                      <div>Headcount: <strong>{pool[rm.id]}</strong></div>
                      <div>Capacity: <strong>{fmt(base[`${rm.id}Cap`])} audio-min/day</strong></div>
                      <div>Queue wait: <strong>{isFinite(wait) ? fmt(wait) + " min" : "⚠ overloaded"}</strong></div>
                    </div>
                    <div style={{ height: 6, background: "#f1f5f9", borderRadius: 99, marginTop: 12 }}>
                      <div style={{ height: "100%", borderRadius: 99, background: ok ? rm.hex : "#ef4444", width: `${Math.min(util * 100, 100)}%`, transition: "width .4s" }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ ...S.card, marginBottom: 24 }}>
              <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700 }}>Recommended Headcount (≤80% utilization)</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                {[
                  { rm: ROLE_META[0], req: base.reqT,  cur: pool.t  },
                  { rm: ROLE_META[1], req: base.reqR,  cur: pool.r  },
                  { rm: ROLE_META[2], req: base.reqEr, cur: pool.er },
                ].map(({ rm, req, cur }) => {
                  const gap = req - cur;
                  return (
                    <div key={rm.id} style={{ background: rm.bg, border: `1px solid ${rm.hex}30`, borderRadius: 10, padding: "14px 16px" }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: rm.tx, textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 6 }}>{rm.label}</div>
                      <div style={{ fontSize: 28, fontWeight: 700, color: rm.tx }}>{req}</div>
                      <div style={{ fontSize: 12, color: rm.tx, opacity: 0.8, marginTop: 2 }}>
                        Currently {cur} → {gap > 0 ? `+${gap} needed` : gap === 0 ? "✓ on target" : `${Math.abs(gap)} surplus`}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={S.card}>
              <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700 }}>Utilization by Role</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={ROLE_META.map((rm) => ({ name: rm.label, Utilization: Math.round(base[`${rm.id}Util`] * 100), fill: rm.hex }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 110]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => `${v}%`} />
                  <ReferenceLine y={80} stroke="#f59e0b" strokeDasharray="5 4" label={{ value: "80% target", position: "insideTopRight", fontSize: 11, fill: "#f59e0b" }} />
                  <ReferenceLine y={90} stroke="#ef4444" strokeDasharray="5 4" label={{ value: "90% danger", position: "insideTopRight", fontSize: 11, fill: "#ef4444" }} />
                  <Bar dataKey="Utilization" radius={[4, 4, 0, 0]}
                    fill="#378ADD"
                    label={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {/* ── WHAT-IF ── */}
        {tab === "what-if" && (
          <>
            <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700 }}>What-If Scenarios</h2>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "#64748b" }}>
              Adjust headcount and volume to see projected impact. Results tab is unaffected.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20 }}>
              <div style={S.card}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>Scenario controls</div>
                <Slider label="Volume multiplier" value={delta.volMult} min={0.5} max={3} step={0.05}
                  onChange={(v) => setDelta((d) => ({ ...d, volMult: v }))}
                  disp={`${Math.round(delta.volMult * 100)}%`} />
                {ROLE_META.map((rm) => (
                  <Slider key={rm.id} label={`${rm.label} added`} value={delta[rm.id]} min={-20} max={50}
                    onChange={(v) => setDelta((d) => ({ ...d, [rm.id]: v }))}
                    disp={delta[rm.id] >= 0 ? `+${delta[rm.id]}` : String(delta[rm.id])} />
                ))}
                <button onClick={() => setDelta({ t: 0, r: 0, er: 0, volMult: 1.0 })}
                  style={{ width: "100%", padding: "8px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, cursor: "pointer", marginTop: 8 }}>
                  Reset
                </button>
              </div>

              <div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                  <StatBox label="Est. total TAT" value={fmt(wi.totalTat) + " hr"}
                    color={wi.totalTat > 72 ? "#dc2626" : "#166534"}
                    sub={`Base: ${fmt(base.totalTat)} hr`} />
                  <StatBox label="Daily audio demand" value={fmt(wi.dailyAudioMin) + " min"}
                    sub={`Base: ${fmt(base.dailyAudioMin)} min`} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
                  {ROLE_META.map((rm) => {
                    const util     = wi[`${rm.id}Util`];
                    const baseUtil = base[`${rm.id}Util`];
                    const ok       = util < 0.9;
                    const diff     = Math.round((util - baseUtil) * 100);
                    return (
                      <div key={rm.id} style={S.card}>
                        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>{rm.label}</div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: ok ? "#166534" : "#dc2626" }}>{pct(util)}</div>
                        <div style={{ fontSize: 12, color: "#64748b" }}>
                          {pool[rm.id] + delta[rm.id]} ICs (was {pool[rm.id]})
                        </div>
                        <div style={{ fontSize: 11, marginTop: 4, color: diff < 0 ? "#166534" : diff > 0 ? "#f59e0b" : "#94a3b8" }}>
                          {diff < 0 ? `▼ ${Math.abs(diff)}pp` : diff > 0 ? `▲ ${diff}pp` : "no change"}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={S.card}>
                  <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700 }}>Utilization: Base vs. What-If</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={ROLE_META.map((rm) => ({
                      name: rm.label,
                      Base: Math.round(base[`${rm.id}Util`] * 100),
                      "What-If": Math.round(wi[`${rm.id}Util`] * 100),
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis domain={[0, 110]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(v) => `${v}%`} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <ReferenceLine y={80} stroke="#f59e0b" strokeDasharray="4 3" />
                      <Bar dataKey="Base"     fill="#94a3b8" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="What-If"  fill="#378ADD" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── CONFIGURE ── */}
        {tab === "configure" && (
          <>
            <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700 }}>Configure Model</h2>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "#64748b" }}>
              Changes here update Results, What-If baseline, and Sensitivity.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>

              <div style={S.card}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Volume &amp; demand</div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 16 }}>Pull from Metabase monthly</div>
                <Slider label="Days in period" value={vol.days} min={1} max={31}
                  onChange={(v) => setVol((d) => ({ ...d, days: v }))} />
                <Slider label="Monthly transcripts" value={vol.monthlyTranscripts} min={50} max={1000} step={5}
                  onChange={(v) => setVol((d) => ({ ...d, monthlyTranscripts: v }))} />
                <Slider label="Monthly audio (min)" value={vol.monthlyAudioMin} min={500} max={50000} step={100}
                  disp={vol.monthlyAudioMin.toLocaleString()}
                  onChange={(v) => setVol((d) => ({ ...d, monthlyAudioMin: v }))} />
                <div style={{ marginTop: 10, padding: "10px 12px", background: "#f8fafc", borderRadius: 8, fontSize: 12, color: "#64748b", lineHeight: 1.7 }}>
                  <div>Daily transcripts: <strong>{fmt(vol.monthlyTranscripts / vol.days)}</strong></div>
                  <div>Daily audio: <strong>{fmt(vol.monthlyAudioMin / vol.days)} min</strong></div>
                  <div>Avg audio/TX: <strong>{fmt(vol.monthlyAudioMin / Math.max(vol.monthlyTranscripts, 1))} min</strong></div>
                </div>
              </div>

              <div style={S.card}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>IC speed</div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 16 }}>Update from Metabase actuals</div>

                <div style={{ fontWeight: 600, fontSize: 12, color: "#378ADD", marginBottom: 8 }}>Transcribers</div>
                <Slider label="Hrs/day active" value={spd.tHrsPerDay} min={0.1} max={8} step={0.1}
                  disp={fmt(spd.tHrsPerDay) + " hr"}
                  onChange={(v) => setSpd((d) => ({ ...d, tHrsPerDay: v }))} />
                <Slider label="Audio-min / work-hr" value={spd.tAudioMinPerHr} min={5} max={60}
                  onChange={(v) => setSpd((d) => ({ ...d, tAudioMinPerHr: v }))} />

                <div style={{ fontWeight: 600, fontSize: 12, color: "#1D9E75", margin: "12px 0 8px" }}>Reviewers</div>
                <Slider label="Hrs/day active" value={spd.rHrsPerDay} min={0.1} max={8} step={0.1}
                  disp={fmt(spd.rHrsPerDay) + " hr"}
                  onChange={(v) => setSpd((d) => ({ ...d, rHrsPerDay: v }))} />
                <Slider label="Audio-min / work-hr" value={spd.rAudioMinPerHr} min={5} max={60}
                  onChange={(v) => setSpd((d) => ({ ...d, rAudioMinPerHr: v }))} />

                <div style={{ fontWeight: 600, fontSize: 12, color: "#7F77DD", margin: "12px 0 8px" }}>Exec Reviewers</div>
                <Slider label="Hrs/day active" value={spd.erHrsPerDay} min={0.1} max={8} step={0.1}
                  disp={fmt(spd.erHrsPerDay) + " hr"}
                  onChange={(v) => setSpd((d) => ({ ...d, erHrsPerDay: v }))} />
                <Slider label="Audio-min / work-hr" value={spd.erAudioMinPerHr} min={5} max={60}
                  onChange={(v) => setSpd((d) => ({ ...d, erAudioMinPerHr: v }))} />
              </div>

              <div style={S.card}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Current headcount</div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 16 }}>Active ICs in the pool</div>
                {ROLE_META.map((rm) => (
                  <Slider key={rm.id} label={rm.label} value={pool[rm.id]} min={1} max={200}
                    onChange={(v) => setPool((d) => ({ ...d, [rm.id]: v }))} />
                ))}
                <div style={{ marginTop: 10, padding: "10px 12px", background: "#f8fafc", borderRadius: 8, fontSize: 12, color: "#64748b", lineHeight: 1.7 }}>
                  {ROLE_META.map((rm) => (
                    <div key={rm.id}>{rm.label}: <strong>{pct(base[`${rm.id}Util`])}</strong> utilization</div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── SENSITIVITY ── */}
        {tab === "sensitivity" && (
          <>
            <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700 }}>Sensitivity Analysis</h2>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "#64748b" }}>
              How does utilization and TAT shift if total headcount scales from 50% to 150% of current levels?
            </p>

            <div style={{ ...S.card, marginBottom: 20 }}>
              <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700 }}>Utilization across headcount scenarios</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={sensitivityData} margin={{ right: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} label={{ value: "Headcount scaling", position: "insideBottom", offset: -2, fontSize: 12 }} />
                  <YAxis domain={[0, 120]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => `${v}%`} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <ReferenceLine y={80} stroke="#f59e0b" strokeDasharray="5 3" label={{ value: "80%", position: "right", fontSize: 11, fill: "#f59e0b" }} />
                  <ReferenceLine y={90} stroke="#ef4444" strokeDasharray="5 3" label={{ value: "90%", position: "right", fontSize: 11, fill: "#ef4444" }} />
                  {ROLE_META.map((rm) => (
                    <Line key={rm.id} type="monotone" dataKey={`${rm.id}Util`} name={rm.label} stroke={rm.hex} strokeWidth={2} dot={{ r: 3 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div style={S.card}>
              <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700 }}>Estimated TAT across headcount scenarios</h3>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={sensitivityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}h`} />
                  <Tooltip formatter={(v) => `${v} hr`} />
                  <ReferenceLine y={24} stroke="#f59e0b" strokeDasharray="4 3" label={{ value: "24h", position: "insideTopRight", fontSize: 11, fill: "#f59e0b" }} />
                  <Area type="monotone" dataKey="tat" name="Total TAT" stroke="#378ADD" fill="#dbeafe" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
