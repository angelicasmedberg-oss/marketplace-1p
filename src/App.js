// src/App.js
// deps: @supabase/supabase-js papaparse recharts
// env:  REACT_APP_SUPABASE_URL  REACT_APP_SUPABASE_ANON_KEY


import { useState, useEffect, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import Papa from "papaparse";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  CartesianGrid, LineChart, Line, ReferenceLine, AreaChart, Area,
} from "recharts";


// ── Supabase ─────────────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);


// ── Constants ─────────────────────────────────────────────────────────────────
const TIERS = [
  { id:"surge", label:"Surge 24hr",  tatTgt:24,  avgSubtasks:8,  avgMin:30  },
  { id:"three", label:"Three-day",   tatTgt:72,  avgSubtasks:20, avgMin:90  },
  { id:"seven", label:"Seven-day",   tatTgt:168, avgSubtasks:12, avgMin:50  },
];
const ROLE_META = [
  { id:"t",  label:"Transcribers",   hex:"#378ADD", bg:"#eff6ff", tx:"#1e40af" },
  { id:"r",  label:"Reviewers",      hex:"#1D9E75", bg:"#f0fdf4", tx:"#166534" },
  { id:"er", label:"Exec reviewers", hex:"#7F77DD", bg:"#f5f3ff", tx:"#4c1d95" },
];


const waitMult = u => u<=.50?.02:u<=.70?.07:u<=.80?.15:u<=.90?.35:u<=.95?.90:3.0;
const r1  = v => Math.round(v*10)/10;
const fmt = v => r1(v).toFixed(1);
const pct = v => `${Math.round(v*100)}%`;


// ── CSV parsers ───────────────────────────────────────────────────────────────
const parseCSV = (file) => new Promise((res, rej) =>
  Papa.parse(file, { header:true, skipEmptyLines:true, dynamicTyping:true,
    complete: r => res(r.data), error: rej })
);


function parseTranscribers(rows) {
  return rows
    .filter(r => +r.subtasks_completed > 0)
    .map(r => ({ name: r.transcriber_name || "Unknown", state: r.state || "", output: +r.subtasks_completed }))
    .sort((a,b) => b.output - a.output);
}
function parseReviewers(rows) {
  const rev = [], er = [];
  rows.filter(r => +r.reviews_completed > 0).forEach(r => {
    const obj = { name: r.reviewer_name || "Unknown", state: r.state || "", output: +r.reviews_completed };
    r.role === "EXECUTIVE_REVIEWER" ? er.push(obj) : rev.push(obj);
  });
  return {
    reviewers: rev.sort((a,b) => b.output-a.output),
    ers:       er.sort((a,b)  => b.output-a.output),
  };
}


// ── LP engine ─────────────────────────────────────────────────────────────────
function computeLP(dem, tOut, rOut, erOut, spd, days) {
  const daily = arr => arr.reduce((s,v)=>s+v,0) / days;
  const supH = { t: daily(tOut)/spd.t, r: daily(rOut)/spd.r, er: daily(erOut)/spd.er };
  const tiers = TIERS.map(t => {
    const D=dem[t.id], tau=t.avgSubtasks/spd.t, rho=t.avgMin/spd.r, eps=t.avgMin/spd.er;
    return { ...t, D, tau, rho, eps, demT:D*tau, demR:D*rho, demE:D*eps };
  });
  const demH = { t:tiers.reduce((s,t)=>s+t.demT,0), r:tiers.reduce((s,t)=>s+t.demR,0), er:tiers.reduce((s,t)=>s+t.demE,0) };
  const util = {
    t:  supH.t  > 0 ? demH.t/supH.t  : Infinity,
    r:  supH.r  > 0 ? demH.r/supH.r  : Infinity,
    er: supH.er > 0 ? demH.er/supH.er : Infinity,
  };
  const tat = tiers.map(t => {
    const u = k => Math.min(util[k], .999);
    const wT=t.tau*waitMult(u("t")), wR=t.rho*waitMult(u("r")), wE=t.eps*waitMult(u("er"));
    const tot=t.tau+wT+t.rho+wR+t.eps+wE;
    return { ...t, wT, wR, wE, tot, ok:tot<=t.tatTgt };
  });
  const headroom = Math.min(supH.t/demH.t, supH.r/demH.r, supH.er/demH.er);
  const bnId = Object.entries(util).sort((a,b)=>b[1]-a[1])[0][0];
  return { tiers, demH, supH, util, tat, headroom, bnId,
    feasible: util.t<=1 && util.r<=1 && util.er<=1 };
}


// ── Shared UI ─────────────────────────────────────────────────────────────────
const S = {
  page: { fontFamily:"system-ui, -apple-system, sans-serif", background:"#f8fafc", minHeight:"100vh", padding:"2rem 1rem" },
  card: { background:"white", border:"1px solid #e2e8f0", borderRadius:12, padding:"1rem 1.25rem", marginBottom:0 },
  lbl:  { margin:"0 0 8px", fontSize:11, fontWeight:600, color:"#94a3b8", textTransform:"uppercase", letterSpacing:".07em" },
  h3:   { margin:"0 0 14px", fontSize:15, fontWeight:600 },
};
const Card = ({ children, style={} }) => <div style={{ ...S.card, ...style }}>{children}</div>;
const Lbl  = ({ children, color }) => <p style={{ ...S.lbl, color:color||"#94a3b8" }}>{children}</p>;
const Slider = ({ label, value, min, max, step=1, onChange, disp }) => (
  <div style={{ marginBottom:14 }}>
    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4, fontSize:13 }}>
      <span style={{ color:"#64748b" }}>{label}</span>
      <span style={{ fontWeight:600 }}>{disp ?? value}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value}
      onChange={e=>onChange(+e.target.value)}
      style={{ width:"100%", accentColor:"#378ADD" }} />
  </div>
);
const Badge = ({ ok, children }) => (
  <span style={{ padding:"2px 10px", borderRadius:999, fontSize:12, fontWeight:600,
    background: ok?"#dcfce7":"#fee2e2", color: ok?"#166534":"#dc2626",
    border: `1px solid ${ok?"#bbf7d0":"#fecaca"}` }}>{children}</span>
);
const Tab = ({ active, onClick, children }) => (
  <button onClick={onClick} style={{ padding:"6px 14px", borderRadius:8, fontSize:13,
    fontWeight: active?600:400, cursor:"pointer",
    background: active?"white":"transparent",
    color: active?"#1e293b":"#64748b",
    border: `1px solid ${active?"#e2e8f0":"transparent"}`,
    boxShadow: active?"0 1px 3px rgba(0,0,0,.06)":"none" }}>
    {children}
  </button>
);


// ── Login ─────────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);


  const go = async () => {
    setLoading(true); setErr("");
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    if (error) { setErr(error.message); setLoading(false); }
    else onLogin();
  };


  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center",
      justifyContent:"center", background:"#f8fafc" }}>
      <div style={{ width:380, ...S.card, padding:"2rem" }}>
        <h2 style={{ margin:"0 0 4px", fontSize:22, fontWeight:700 }}>Marketplace LP</h2>
        <p style={{ margin:"0 0 1.5rem", fontSize:14, color:"#64748b" }}>Sign in to continue</p>
        {err && <div style={{ padding:"10px 14px", background:"#fef2f2", border:"1px solid #fecaca",
          borderRadius:8, fontSize:13, color:"#dc2626", marginBottom:16 }}>{err}</div>}
        {[["Email","email",email,setEmail],["Password","password",pw,setPw]].map(([lbl,type,val,set])=>(
          <div key={lbl} style={{ marginBottom:14 }}>
            <label style={{ display:"block", fontSize:13, fontWeight:500, marginBottom:6 }}>{lbl}</label>
            <input type={type} value={val} onChange={e=>set(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&go()}
              style={{ width:"100%", padding:"9px 12px", borderRadius:8,
                border:"1px solid #e2e8f0", fontSize:14, boxSizing:"border-box" }} />
          </div>
        ))}
        <button onClick={go} disabled={loading}
          style={{ width:"100%", padding:"10px", background:"#1e293b", color:"white",
            border:"none", borderRadius:8, fontSize:14, fontWeight:600, cursor:"pointer",
            opacity: loading?.6:1 }}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </div>
    </div>
  );
}


// ── Upload ────────────────────────────────────────────────────────────────────
function UploadScreen({ onDataLoaded }) {
  const [tFile, setTFile] = useState(null);
  const [rFile, setRFile] = useState(null);
  const [days, setDays] = useState(29);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);


  const handleLoad = async () => {
    if (!tFile || !rFile) { setErr("Upload both CSV files first."); return; }
    setLoading(true); setErr("");
    try {
      const [tRows, rRows] = await Promise.all([parseCSV(tFile), parseCSV(rFile)]);
      const transcribers = parseTranscribers(tRows);
      const { reviewers, ers } = parseReviewers(rRows);
      if (!transcribers.length) throw new Error("No transcriber rows found — check column names.");
      if (!reviewers.length && !ers.length) throw new Error("No reviewer rows found — check column names.");
      onDataLoaded({ transcribers, reviewers, ers, days });
    } catch(e) { setErr(e.message || "Parse error — check CSV format."); }
    setLoading(false);
  };


  const Zone = ({ label, hint, file, onFile }) => (
    <label style={{ display:"block", border:`2px dashed ${file?"#86efac":"#e2e8f0"}`,
      borderRadius:10, padding:"1.25rem", textAlign:"center", cursor:"pointer",
      background: file?"#f0fdf4":"#fafafa", marginBottom:16 }}>
      <input type="file" accept=".csv" style={{ display:"none" }} onChange={e=>onFile(e.target.files[0])} />
      <p style={{ margin:"0 0 4px", fontSize:14, fontWeight:600,
        color: file?"#16a34a":"#374151" }}>
        {file ? `✓  ${file.name}` : label}
      </p>
      <p style={{ margin:0, fontSize:12, color:"#94a3b8" }}>{hint}</p>
    </label>
  );


  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center",
      justifyContent:"center", background:"#f8fafc" }}>
      <div style={{ width:480, ...S.card, padding:"2rem" }}>
        <h2 style={{ margin:"0 0 4px", fontSize:20, fontWeight:700 }}>Load workforce data</h2>
        <p style={{ margin:"0 0 1.5rem", fontSize:14, color:"#64748b" }}>
          Upload your Metabase CSV exports to run the model
        </p>
        {err && <div style={{ padding:"10px 14px", background:"#fef2f2", border:"1px solid #fecaca",
          borderRadius:8, fontSize:13, color:"#dc2626", marginBottom:16 }}>{err}</div>}
        <Zone label="Transcriber export" file={tFile} onFile={setTFile}
          hint="transcriber_name · state · subtasks_completed · last_active_date" />
        <Zone label="Reviewer / ER export" file={rFile} onFile={setRFile}
          hint="reviewer_name · state · role · reviews_completed · last_active_date" />
        <div style={{ marginBottom:20, display:"flex", alignItems:"center", gap:12 }}>
          <label style={{ fontSize:13, fontWeight:500 }}>Days in this period</label>
          <input type="number" value={days} min={1} max={365}
            onChange={e=>setDays(+e.target.value)}
            style={{ width:70, padding:"6px 10px", borderRadius:8,
              border:"1px solid #e2e8f0", fontSize:14 }} />
        </div>
        <button onClick={handleLoad} disabled={loading}
          style={{ width:"100%", padding:"10px", background:"#1e293b", color:"white",
            border:"none", borderRadius:8, fontSize:14, fontWeight:600, cursor:"pointer" }}>
          {loading ? "Loading…" : "Run model →"}
        </button>
      </div>
    </div>
  );
}


// ── Main app ──────────────────────────────────────────────────────────────────
function ModelApp({ data, onReload, onSignOut }) {
  const { transcribers, reviewers, ers, days } = data;
  const [tab, setTab] = useState("results");
  const [dem, setDem] = useState(() => {
    const total = 6.8;
    return { surge: +(total * .077).toFixed(1), three: +(total * .056).toFixed(1), seven: +(total * .867).toFixed(1) };
  });
  const [spd, setSpd] = useState({ t:1, r:20, er:35 });


  const tOut  = transcribers.map(w=>w.output);
  const rOut  = reviewers.map(w=>w.output);
  const erOut = ers.map(w=>w.output);


  const lp = useMemo(()=>computeLP(dem, tOut, rOut, erOut, spd, days),
    [dem, spd, tOut, rOut, erOut, days]);
  const sens = useMemo(()=>
    [50,60,70,75,80,85,90,95,100,110,120,130,150,175,200].map(p=>({
      vol:`${p}%`, T:Math.round(lp.util.t*p), R:Math.round(lp.util.r*p), ER:Math.round(lp.util.er*p)
    })), [lp.util]);


  const upD=(k,v)=>setDem(p=>({...p,[k]:v}));
  const upS=(k,v)=>setSpd(p=>({...p,[k]:v}));
  const bn = ROLE_META.find(r=>r.id===lp.bnId);
  const totalDem = dem.surge+dem.three+dem.seven;


  const TABS = [
    ["results","Results"],["whatif","What-if"],["configure","Configure"],
    ["sensitivity","Sensitivity"],["concentration","Concentration"],
  ];


  return (
    <div style={{ maxWidth:940, margin:"0 auto", ...S.page }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"1.25rem" }}>
        <div>
          <h1 style={{ margin:"0 0 2px", fontSize:20, fontWeight:700 }}>Marketplace LP balancing model</h1>
          <p style={{ margin:0, fontSize:13, color:"#64748b" }}>
            {transcribers.length}T · {reviewers.length}R · {ers.length}ER · {days}-day period
          </p>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={onReload} style={{ padding:"6px 14px", fontSize:13, borderRadius:8,
            border:"1px solid #e2e8f0", background:"white", cursor:"pointer" }}>↑ New data</button>
          <button onClick={onSignOut} style={{ padding:"6px 14px", fontSize:13, borderRadius:8,
            border:"1px solid #e2e8f0", background:"white", cursor:"pointer", color:"#64748b" }}>Sign out</button>
        </div>
      </div>


      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
        padding:"10px 16px", borderRadius:10, marginBottom:"1.25rem",
        background: lp.feasible?"#dcfce7":"#fee2e2",
        border: `1px solid ${lp.feasible?"#bbf7d0":"#fecaca"}` }}>
        <span style={{ fontSize:14, fontWeight:600, color:lp.feasible?"#166534":"#dc2626" }}>
          {lp.feasible ? "LP feasible — solution exists" : "LP infeasible — capacity deficit"}
        </span>
        <span style={{ fontSize:12, color:"#475569" }}>
          Bottleneck: <b style={{ color:bn?.hex }}>{bn?.label}</b> at {pct(lp.util[lp.bnId])}
          {lp.feasible && ` · +${Math.max(0,Math.round((lp.headroom-1)*100))}% demand headroom`}
        </span>
      </div>


      <div style={{ display:"flex", gap:4, marginBottom:"1.25rem", background:"#f1f5f9",
        borderRadius:10, padding:4 }}>
        {TABS.map(([id,lbl])=><Tab key={id} active={tab===id} onClick={()=>setTab(id)}>{lbl}</Tab>)}
      </div>


      {tab==="results"      && <ResultsTab    lp={lp} />}
      {tab==="whatif"       && <WhatIfTab     data={data} spd={spd} dem={dem} />}
      {tab==="configure"    && <ConfigureTab  dem={dem} spd={spd} lp={lp} totalDem={totalDem} upD={upD} upS={upS} data={data} />}
      {tab==="sensitivity"  && <SensitivityTab sens={sens} />}
      {tab==="concentration"&& <ConcentrationTab data={data} />}
    </div>
  );
}


// ── Results tab ───────────────────────────────────────────────────────────────
function ResultsTab({ lp }) {
  const capData = ROLE_META.map(r=>({
    name: r.label.split(" ")[0],
    Supply: r1(lp.supH[r.id]),
    Demand: r1(lp.demH[r.id]),
  }));
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
        {ROLE_META.map(role=>{
          const u=lp.util[role.id], pv=Math.round(u*100);
          const [bg,tc,bc] = u<.70?["#dcfce7","#166534","#bbf7d0"]:u<.85?["#fef9c3","#854d0e","#fde68a"]:["#fee2e2","#dc2626","#fecaca"];
          return (
            <div key={role.id} style={{ padding:"16px 14px", borderRadius:12, background:bg,
              border:`1px solid ${bc}`, textAlign:"center" }}>
              <p style={{ margin:"0 0 6px", fontSize:11, fontWeight:700, color:tc,
                textTransform:"uppercase", letterSpacing:".06em" }}>{role.label}</p>
              <p style={{ margin:"0 0 2px", fontSize:40, fontWeight:700, lineHeight:1, color:tc }}>{pv}%</p>
              <p style={{ margin:"0 0 10px", fontSize:11, color:tc }}>utilization</p>
              <div style={{ height:6, borderRadius:999, background:"rgba(0,0,0,.1)", overflow:"hidden" }}>
                <div style={{ width:`${Math.min(pv,100)}%`, height:"100%", background:role.hex, borderRadius:999 }} />
              </div>
              <p style={{ margin:"8px 0 0", fontSize:11, color:tc }}>
                {fmt(lp.demH[role.id])}h needed · {fmt(lp.supH[role.id])}h available
              </p>
            </div>
          );
        })}
      </div>
      <Card>
        <Lbl>Supply vs. demand (worker-hours/day)</Lbl>
        <div style={{ height:200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={capData} barGap={6}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize:12, fill:"#64748b" }} />
              <YAxis tick={{ fontSize:11, fill:"#94a3b8" }} />
              <Tooltip formatter={v=>`${v}h`} />
              <Legend wrapperStyle={{ fontSize:12 }} />
              <Bar dataKey="Supply" fill="#378ADD" radius={[4,4,0,0]} />
              <Bar dataKey="Demand" fill="#E24B4A" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card>
        <Lbl>TAT estimate by tier</Lbl>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {lp.tat.map(t=>(
            <div key={t.id} style={{ padding:"12px 14px", borderRadius:10,
              background:t.ok?"#f0fdf4":"#fef2f2",
              border:`1px solid ${t.ok?"#bbf7d0":"#fecaca"}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <div>
                  <b style={{ fontSize:14 }}>{t.label}</b>
                  <span style={{ fontSize:12, color:"#94a3b8", marginLeft:8 }}>
                    {t.D.toFixed(1)}/day · target {t.tatTgt}h
                  </span>
                </div>
                <Badge ok={t.ok}>{t.ok?`✓ ${fmt(t.tot)}h`:`✗ ${fmt(t.tot)}h`}</Badge>
              </div>
              <div style={{ height:8, borderRadius:4, overflow:"hidden", display:"flex" }}>
                {[{v:t.tau,c:"#378ADD"},{v:t.wT,c:"#bfdbfe"},{v:t.rho,c:"#1D9E75"},
                  {v:t.wR,c:"#bbf7d0"},{v:t.eps,c:"#7F77DD"},{v:t.wE,c:"#ddd6fe"}]
                  .map(({v,c},i)=>(
                  <div key={i} style={{ width:`${v/t.tot*100}%`, background:c, minWidth:v>.001?2:0 }} />
                ))}
              </div>
              <div style={{ display:"flex", gap:12, marginTop:6, flexWrap:"wrap" }}>
                {[["#378ADD","Transcription",t.tau],["#bfdbfe","T-queue",t.wT],
                  ["#1D9E75","Review",t.rho],["#bbf7d0","R-queue",t.wR],
                  ["#7F77DD","ER",t.eps],["#ddd6fe","ER-queue",t.wE]].map(([c,l,v])=>(
                  <span key={l} style={{ display:"flex", alignItems:"center", gap:4, fontSize:11, color:"#64748b" }}>
                    <span style={{ width:8, height:8, borderRadius:2, background:c, display:"inline-block" }} />
                    {l}: {fmt(v)}h
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}


// ── Configure tab ─────────────────────────────────────────────────────────────
function ConfigureTab({ dem, spd, lp, totalDem, upD, upS, data }) {
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
      <Card>
        <h3 style={S.h3}>Daily demand by TAT tier</h3>
        <Slider label="Surge 24hr" value={dem.surge} min={0} max={15} step={.1}
          onChange={v=>upD("surge",v)} disp={`${dem.surge.toFixed(1)}/day`} />
        <Slider label="Three-day"  value={dem.three} min={0} max={30} step={.1}
          onChange={v=>upD("three",v)} disp={`${dem.three.toFixed(1)}/day`} />
        <Slider label="Seven-day"  value={dem.seven} min={0} max={60} step={.1}
          onChange={v=>upD("seven",v)} disp={`${dem.seven.toFixed(1)}/day`} />
        <p style={{ margin:"8px 0 0", fontSize:12, color:"#64748b" }}>
          Total: <b>{totalDem.toFixed(1)} transcripts/day</b>
        </p>
      </Card>
      <Card>
        <h3 style={S.h3}>Processing speeds</h3>
        <Slider label="Transcriber speed" value={spd.t} min={1} max={25}
          onChange={v=>upS("t",v)} disp={`${spd.t} subtasks/hr`} />
        <p style={{ margin:"-10px 0 12px", fontSize:11, color:"#94a3b8" }}>
          ≈ {Math.round(60/spd.t)} min/subtask
        </p>
        <Slider label="Reviewer speed" value={spd.r} min={10} max={120} step={5}
          onChange={v=>upS("r",v)} disp={`${spd.r} audio-min/hr`} />
        <Slider label="Exec reviewer speed" value={spd.er} min={10} max={100} step={5}
          onChange={v=>upS("er",v)} disp={`${spd.er} audio-min/hr`} />
      </Card>
      {ROLE_META.map(role=>{
        const workers = role.id==="t" ? data.transcribers : role.id==="r" ? data.reviewers : data.ers;
        const total   = workers.reduce((s,w)=>s+w.output,0);
        return (
          <Card key={role.id}>
            <h3 style={{ ...S.h3, color:role.hex }}>{role.label}</h3>
            <p style={{ margin:"0 0 10px", fontSize:13, color:"#64748b" }}>
              <b style={{ fontWeight:600 }}>{workers.length} active workers</b> · {total} total output in period
            </p>
            <div style={{ padding:"10px 12px", borderRadius:8, background:role.bg,
              fontSize:12, color:role.tx }}>
              Utilization: <b>{pct(lp.util[role.id])}</b> ·{" "}
              {lp.util[role.id]<=1
                ? `${Math.round((1-lp.util[role.id])*100)}% headroom`
                : `${Math.round((lp.util[role.id]-1)*100)}% over capacity`}
            </div>
          </Card>
        );
      })}
    </div>
  );
}


// ── What-if tab ───────────────────────────────────────────────────────────────
function WhatIfTab({ data, spd, dem }) {
  const { transcribers, reviewers, ers, days } = data;
  const [removed, setRemoved] = useState({ t:[], r:[], er:[] });


  const toggle = (role, idx) => setRemoved(prev => {
    const s = new Set(prev[role]);
    s.has(idx) ? s.delete(idx) : s.add(idx);
    return { ...prev, [role]:[...s] };
  });
  const reset = () => setRemoved({ t:[],r:[],er:[] });


  const effectiveOut = (role, workers) =>
    workers.filter((_,i) => !removed[role].includes(i)).map(w=>w.output);


  const tOut  = effectiveOut("t",  transcribers);
  const rOut  = effectiveOut("r",  reviewers);
  const erOut = effectiveOut("er", ers);


  const simLP  = useMemo(()=>computeLP(dem, tOut, rOut, erOut, spd, days), [removed, dem, spd]);
  const baseLP = useMemo(()=>computeLP(dem,
    transcribers.map(w=>w.output), reviewers.map(w=>w.output), ers.map(w=>w.output), spd, days),
    [dem, spd]);


  const totalRemoved = removed.t.length + removed.r.length + removed.er.length;


  const WorkerList = ({ role, workers }) => {
    const total = workers.reduce((s,w)=>s+w.output,0);
    const rm = ROLE_META.find(r=>r.id===role);
    return (
      <Card>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
          <Lbl color={rm.hex}>{rm.label}</Lbl>
          {removed[role].length > 0 &&
            <span style={{ fontSize:11, padding:"2px 8px", borderRadius:999,
              background:"#fee2e2", color:"#dc2626", border:"1px solid #fecaca" }}>
              {removed[role].length} off
            </span>}
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:5, maxHeight:240, overflowY:"auto" }}>
          {workers.map((w,i)=>{
            const isOff = removed[role].includes(i);
            const share = Math.round(w.output/total*100);
            return (
              <button key={i} onClick={()=>toggle(role,i)} style={{
                display:"flex", justifyContent:"space-between", alignItems:"center",
                padding:"6px 10px", borderRadius:8, cursor:"pointer", textAlign:"left",
                border:`1px solid ${isOff?"#fecaca":"#e2e8f0"}`,
                background: isOff?"#fef2f2":"#f8fafc" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ width:10, height:10, borderRadius:2, flexShrink:0,
                    background: isOff?"#dc2626":rm.hex, display:"inline-block" }} />
                  <span style={{ fontSize:13, color: isOff?"#dc2626":"#1e293b",
                    textDecoration: isOff?"line-through":"none" }}>{w.name}</span>
                  {w.state && <span style={{ fontSize:11, color:"#94a3b8" }}>{w.state}</span>}
                </div>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <div style={{ width:40, height:4, borderRadius:2, background:"#e2e8f0", overflow:"hidden" }}>
                    <div style={{ width:`${Math.min(share*3,100)}%`, height:"100%",
                      background: isOff?"#dc2626":rm.hex }} />
                  </div>
                  <span style={{ fontSize:11, color:"#94a3b8", minWidth:28, textAlign:"right" }}>{share}%</span>
                </div>
              </button>
            );
          })}
        </div>
      </Card>
    );
  };


  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
        padding:"10px 16px", borderRadius:10,
        background: simLP.feasible?"#dcfce7":"#fee2e2",
        border:`1px solid ${simLP.feasible?"#bbf7d0":"#fecaca"}` }}>
        <span style={{ fontSize:14, fontWeight:600, color:simLP.feasible?"#166534":"#dc2626" }}>
          {simLP.feasible?"Scenario feasible":"Scenario infeasible — capacity deficit"}
        </span>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          {totalRemoved>0 && <span style={{ fontSize:12, color:"#64748b" }}>{totalRemoved} worker{totalRemoved>1?"s":""} removed</span>}
          {totalRemoved>0 && <button onClick={reset} style={{ padding:"4px 12px", fontSize:12,
            borderRadius:8, cursor:"pointer", border:"1px solid #e2e8f0", background:"white" }}>Reset</button>}
        </div>
      </div>


      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
        {ROLE_META.map(role=>{
          const u = simLP.util[role.id];
          const [bg,tc] = u>.99?["#fee2e2","#dc2626"]:u>.85?["#fef9c3","#854d0e"]:["#f1f5f9","#475569"];
          return (
            <div key={role.id} style={{ padding:"14px", borderRadius:12,
              background:bg, border:"1px solid #e2e8f0", textAlign:"center" }}>
              <p style={{ margin:"0 0 4px", fontSize:11, fontWeight:700,
                textTransform:"uppercase", letterSpacing:".06em", color:role.hex }}>{role.label}</p>
              <p style={{ margin:"0 0 4px", fontSize:30, fontWeight:700, color:tc }}>
                {Math.round(u*100)}%
              </p>
              <p style={{ margin:0, fontSize:11, color:tc }}>utilization</p>
            </div>
          );
        })}
      </div>


      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14 }}>
        <WorkerList role="t"  workers={transcribers} />
        <WorkerList role="r"  workers={reviewers} />
        <WorkerList role="er" workers={ers} />
      </div>


      <Card>
        <Lbl>TAT impact — baseline vs. scenario</Lbl>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {simLP.tat.map((t,i)=>{
            const base = baseLP.tat[i];
            const delta = t.tot - base.tot;
            return (
              <div key={t.id} style={{ padding:"12px 14px", borderRadius:10,
                background:t.ok?"#f0fdf4":"#fef2f2",
                border:`1px solid ${t.ok?"#bbf7d0":"#fecaca"}` }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                  <b style={{ fontSize:14 }}>{t.label}</b>
                  <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                    <span style={{ fontSize:12, color:"#94a3b8" }}>baseline: {fmt(base.tot)}h</span>
                    <Badge ok={t.ok}>{t.ok?"✓":"✗"} {fmt(t.tot)}h</Badge>
                    {delta > 0.05 &&
                      <span style={{ fontSize:12, fontWeight:600, color:"#dc2626" }}>+{fmt(delta)}h</span>}
                  </div>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                  {[["Baseline",base.tot,"#94a3b8"],["Scenario",t.tot,t.ok?"#22c55e":"#ef4444"]].map(([lbl,val,col])=>(
                    <div key={lbl}>
                      <p style={{ margin:"0 0 4px", fontSize:10, color:"#94a3b8",
                        textTransform:"uppercase", letterSpacing:".05em" }}>{lbl}</p>
                      <div style={{ height:6, borderRadius:3, background:"#f1f5f9", overflow:"hidden" }}>
                        <div style={{ width:`${Math.min(val/t.tatTgt*100,100)}%`, height:"100%",
                          background:col, borderRadius:3 }} />
                      </div>
                      <p style={{ margin:"3px 0 0", fontSize:11, color:"#64748b" }}>
                        {fmt(val)}h / {t.tatTgt}h target
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}


// ── Sensitivity tab ───────────────────────────────────────────────────────────
function SensitivityTab({ sens }) {
  const cc = v => v>100?"#dc2626":v>85?"#d97706":"#1e293b";
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <Card>
        <Lbl>Utilization vs. demand volume</Lbl>
        <p style={{ margin:"-4px 0 12px", fontSize:12, color:"#94a3b8" }}>
          Red line = 100% capacity. Amber = 85% recommended ceiling.
        </p>
        <div style={{ height:250 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sens}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="vol" tick={{ fontSize:11, fill:"#94a3b8" }} interval={2} />
              <YAxis tick={{ fontSize:11, fill:"#94a3b8" }} unit="%" domain={[0,220]} />
              <Tooltip formatter={v=>`${v}%`} />
              <Legend wrapperStyle={{ fontSize:12 }} />
              <ReferenceLine y={100} stroke="#ef4444" strokeDasharray="5 3" />
              <ReferenceLine y={85}  stroke="#f59e0b" strokeDasharray="5 3" />
              <Line type="monotone" dataKey="T"  stroke="#378ADD" strokeWidth={2} dot={false} name="Transcribers" />
              <Line type="monotone" dataKey="R"  stroke="#1D9E75" strokeWidth={2} dot={false} name="Reviewers" />
              <Line type="monotone" dataKey="ER" stroke="#7F77DD" strokeWidth={2} dot={false} name="Exec reviewers" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card>
        <Lbl>Volume feasibility table</Lbl>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr>{["Volume","Transcribers","Reviewers","Exec reviewers","Status"].map(h=>(
                <th key={h} style={{ padding:"8px 12px", textAlign:"center", fontSize:11,
                  fontWeight:700, color:"#94a3b8", textTransform:"uppercase",
                  borderBottom:"1px solid #f1f5f9", letterSpacing:".06em" }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {sens.map((row,i)=>{
                const bad=row.T>100||row.R>100||row.ER>100;
                const warn=!bad&&(row.T>85||row.R>85||row.ER>85);
                const cur=row.vol==="100%";
                return (
                  <tr key={i} style={{ borderBottom:"1px solid #f8fafc",
                    background:cur?"#eff6ff":"transparent" }}>
                    <td style={{ padding:"8px 12px", textAlign:"center",
                      fontWeight:cur?700:400, color:cur?"#1d4ed8":"#1e293b" }}>{row.vol}</td>
                    {[row.T,row.R,row.ER].map((v,j)=>(
                      <td key={j} style={{ padding:"8px 12px", textAlign:"center",
                        color:cc(v), fontWeight:v>85?700:400 }}>{v}%</td>
                    ))}
                    <td style={{ padding:"8px 12px", textAlign:"center" }}>
                      <Badge ok={!bad && !warn}>{bad?"Infeasible":warn?"Near limit":"Feasible"}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}


// ── Concentration tab ─────────────────────────────────────────────────────────
const hhi = arr => {
  const tot=arr.reduce((s,v)=>s+v,0);
  return Math.round(arr.reduce((s,v)=>s+(v/tot*100)**2,0));
};
const hhiLabel = h => h>2500?"Highly concentrated":h>1500?"Moderately concentrated":"Competitive";
const hhiColor = h => h>2500?"#dc2626":h>1500?"#d97706":"#16a34a";
const concDrop = (arr, n) => {
  const s=[...arr].sort((a,b)=>b-a), tot=s.reduce((x,v)=>x+v,0);
  return Math.round(s.slice(n).reduce((x,v)=>x+v,0)/tot*100);
};


function ConcentrationTab({ data }) {
  const { transcribers, reviewers, ers } = data;
  const groups = [
    { label:"Transcribers",   hex:"#378ADD", workers:transcribers },
    { label:"Reviewers",      hex:"#1D9E75", workers:reviewers    },
    { label:"Exec reviewers", hex:"#7F77DD", workers:ers          },
  ];


  const concChart = Array.from({length:11},(_,n)=>({
    n,
    T:  concDrop(transcribers.map(w=>w.output), n),
    R:  concDrop(reviewers.map(w=>w.output), n),
    ER: concDrop(ers.map(w=>w.output), Math.min(n, ers.length)),
  }));


  const lorenz = workers => {
    const sorted=[...workers].sort((a,b)=>b.output-a.output);
    const tot=sorted.reduce((s,w)=>s+w.output,0);
    let cum=0;
    return sorted.map((w,i)=>{ cum+=w.output; return { worker:i+1, share:Math.round(cum/tot*100) }; });
  };


  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
        {groups.map(({label,hex,workers})=>{
          const h=hhi(workers.map(w=>w.output));
          return (
            <div key={label} style={{ padding:"14px", borderRadius:12,
              background:"white", border:"1px solid #e2e8f0", textAlign:"center" }}>
              <p style={{ margin:"0 0 4px", fontSize:11, fontWeight:700, color:"#94a3b8",
                textTransform:"uppercase", letterSpacing:".06em" }}>{label}</p>
              <p style={{ margin:"0 0 2px", fontSize:30, fontWeight:700, color:hex }}>{h}</p>
              <p style={{ margin:"0 0 2px", fontSize:12, fontWeight:600, color:hhiColor(h) }}>{hhiLabel(h)}</p>
              <p style={{ margin:0, fontSize:11, color:"#94a3b8" }}>HHI (max 10,000)</p>
            </div>
          );
        })}
      </div>


      <Card>
        <Lbl>Remaining capacity if top N workers go inactive</Lbl>
        <div style={{ height:220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={concChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="n" tick={{ fontSize:11, fill:"#94a3b8" }}
                label={{ value:"Workers removed", position:"insideBottom", offset:-2, fontSize:11, fill:"#94a3b8" }} />
              <YAxis unit="%" domain={[0,105]} tick={{ fontSize:11, fill:"#94a3b8" }} />
              <Tooltip formatter={v=>`${v}%`} labelFormatter={n=>`Remove top ${n}`} />
              <Legend wrapperStyle={{ fontSize:12 }} />
              <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="5 3" />
              <ReferenceLine y={85} stroke="#f59e0b" strokeDasharray="5 3" />
              <Line type="monotone" dataKey="T"  stroke="#378ADD" strokeWidth={2} dot name="Transcribers" />
              <Line type="monotone" dataKey="R"  stroke="#1D9E75" strokeWidth={2} dot name="Reviewers" />
              <Line type="monotone" dataKey="ER" stroke="#7F77DD" strokeWidth={2} dot name="Exec reviewers" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>


      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14 }}>
        {groups.map(({label,hex,workers})=>{
          const tot=workers.reduce((s,w)=>s+w.output,0);
          const top3=Math.round(workers.slice(0,3).reduce((s,w)=>s+w.output,0)/tot*100);
          return (
            <Card key={label}>
              <Lbl color={hex}>{label}</Lbl>
              <p style={{ margin:"0 0 10px", fontSize:12, color:"#64748b" }}>
                Top 3 = <b style={{ color:top3>60?"#dc2626":"#d97706" }}>{top3}% of output</b>
              </p>
              <div style={{ height:130 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={lorenz(workers).slice(0,15)}>
                    <XAxis dataKey="worker" tick={{ fontSize:10, fill:"#94a3b8" }} />
                    <YAxis unit="%" domain={[0,100]} tick={{ fontSize:10, fill:"#94a3b8" }} />
                    <Tooltip formatter={v=>`${v}%`} labelFormatter={n=>`Top ${n}`} />
                    <ReferenceLine y={80} stroke="#f59e0b" strokeDasharray="4 2" />
                    <Area type="monotone" dataKey="share" stroke={hex}
                      fill={hex} fillOpacity={.12} strokeWidth={2} dot={false} name="Cumulative share" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div style={{ marginTop:10, display:"flex", flexDirection:"column", gap:5 }}>
                {[1,2,3,5].map(n=>{
                  const rem=concDrop(workers.map(w=>w.output),n);
                  return (
                    <div key={n} style={{ display:"flex", justifyContent:"space-between", fontSize:12 }}>
                      <span style={{ color:"#64748b" }}>Remove top {n}</span>
                      <span style={{ fontWeight:600, color:rem<70?"#dc2626":rem<85?"#d97706":"#16a34a" }}>
                        {rem}% remains
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}


// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const [data, setData] = useState(null);


  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session); setChecking(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);


  if (checking) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center",
      justifyContent:"center", background:"#f8fafc", fontSize:14, color:"#94a3b8" }}>
      Loading…
    </div>
  );


  if (!session)  return <LoginScreen onLogin={()=>{}} />;
  if (!data)     return <UploadScreen onDataLoaded={setData} />;
  return <ModelApp data={data} onReload={()=>setData(null)}
    onSignOut={()=>supabase.auth.signOut()} />;
}