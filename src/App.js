// ── Auth Screen (Login + Signup + Magic Link) ───────────────────────────────
function AuthScreen() {
  const [mode, setMode] = useState("login"); // "login", "signup", or "magic"
  const [email,setEmail]=useState(""), [pw,setPw]=useState(""), [confirmPw,setConfirmPw]=useState("");
  const [err,setErr]=useState(""), [msg,setMsg]=useState(""), [loading,setLoading]=useState(false);

  const handleLogin = async () => {
    setLoading(true); setErr(""); setMsg("");
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    if (error) { setErr(error.message); setLoading(false); }
  };

  const handleSignup = async () => {
    if (pw !== confirmPw) { setErr("Passwords don't match"); return; }
    if (pw.length < 6) { setErr("Password must be at least 6 characters"); return; }
    setLoading(true); setErr(""); setMsg("");
    const { error } = await supabase.auth.signUp({ email, password: pw });
    if (error) { setErr(error.message); setLoading(false); }
    else { setMsg("Check your email to confirm your account, then sign in."); setLoading(false); setMode("login"); }
  };

  const handleMagicLink = async () => {
    if (!email) { setErr("Enter your email address"); return; }
    setLoading(true); setErr(""); setMsg("");
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) { setErr(error.message); setLoading(false); }
    else { setMsg("Magic link sent! Check your email and click the link to sign in."); setLoading(false); }
  };

  const switchMode = (newMode) => { setMode(newMode); setErr(""); setMsg(""); };

  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f8fafc"}}>
      <div style={{width:380,...S.card,padding:"2rem"}}>
        <h2 style={{margin:"0 0 4px",fontSize:22,fontWeight:700}}>Transcription Forecasting Tool</h2>
        <p style={{margin:"0 0 1.5rem",fontSize:14,color:"#64748b"}}>
          {mode === "login" ? "Sign in to continue" : mode === "signup" ? "Create your account" : "Sign in with magic link"}
        </p>
        
        {err && <div style={{padding:"10px 14px",background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,fontSize:13,color:"#dc2626",marginBottom:16}}>{err}</div>}
        {msg && <div style={{padding:"10px 14px",background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,fontSize:13,color:"#166534",marginBottom:16}}>{msg}</div>}
        
        <div style={{marginBottom:14}}>
          <label style={{display:"block",fontSize:13,fontWeight:500,marginBottom:6}}>Email</label>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} 
            onKeyDown={e=>e.key==="Enter"&&(mode==="login"?handleLogin():mode==="signup"?handleSignup():handleMagicLink())}
            style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:14,boxSizing:"border-box"}} />
        </div>
        
        {(mode === "login" || mode === "signup") && (
          <div style={{marginBottom:14}}>
            <label style={{display:"block",fontSize:13,fontWeight:500,marginBottom:6}}>Password</label>
            <input type="password" value={pw} onChange={e=>setPw(e.target.value)} 
              onKeyDown={e=>e.key==="Enter"&&(mode==="login"?handleLogin():handleSignup())}
              style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:14,boxSizing:"border-box"}} />
          </div>
        )}
        
        {mode === "signup" && (
          <div style={{marginBottom:14}}>
            <label style={{display:"block",fontSize:13,fontWeight:500,marginBottom:6}}>Confirm Password</label>
            <input type="password" value={confirmPw} onChange={e=>setConfirmPw(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSignup()}
              style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:14,boxSizing:"border-box"}} />
          </div>
        )}
        
        <button 
          onClick={mode==="login"?handleLogin:mode==="signup"?handleSignup:handleMagicLink} 
          disabled={loading} 
          style={{width:"100%",padding:"10px",background:"#1e293b",color:"white",border:"none",borderRadius:8,fontSize:14,fontWeight:600,cursor:"pointer",opacity:loading?.6:1,marginBottom:12}}>
          {loading 
            ? (mode==="login"?"Signing in…":mode==="signup"?"Creating account…":"Sending link…") 
            : (mode==="login"?"Sign in":mode==="signup"?"Create account":"Send magic link")}
        </button>
        
        {mode === "login" && (
          <button onClick={handleMagicLink} disabled={loading}
            style={{width:"100%",padding:"10px",background:"white",color:"#64748b",border:"1px solid #e2e8f0",borderRadius:8,fontSize:14,fontWeight:500,cursor:"pointer",marginBottom:16}}>
            Send magic link instead
          </button>
        )}
        
        <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}}>
          {mode !== "login" && (
            <button onClick={()=>switchMode("login")} style={{background:"none",border:"none",color:"#378ADD",cursor:"pointer",fontWeight:600,fontSize:13}}>
              Sign in with password
            </button>
          )}
          {mode !== "signup" && (
            <button onClick={()=>switchMode("signup")} style={{background:"none",border:"none",color:"#378ADD",cursor:"pointer",fontWeight:600,fontSize:13}}>
              Create account
            </button>
          )}
          {mode !== "magic" && mode !== "login" && (
            <button onClick={()=>switchMode("magic")} style={{background:"none",border:"none",color:"#378ADD",cursor:"pointer",fontWeight:600,fontSize:13}}>
              Use magic link
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
// ── Upload ───────────────────────────────────────────────────────────────────
function UploadScreen({onDataLoaded,defaultMode=null}) {
  const [mode,setMode]=useState(defaultMode);
  const [tFile,setTFile]=useState(null),[rFile,setRFile]=useState(null),[erFile,setErFile]=useState(null);
  const [days,setDays]=useState(29),[err,setErr]=useState(""),[loading,setLoading]=useState(false);
  const [manual,setManual]=useState({tCount:30,tOutput:50,rCount:23,rOutput:10,erCount:6,erOutput:4,days:29});
  const upM=(k,v)=>setManual(p=>({...p,[k]:v}));

  const handleCSVLoad=async()=>{
    if(!tFile||!rFile){setErr("Upload transcriber and reviewer files first.");return;}
    setLoading(true);setErr("");
    try{
      const res=await Promise.all([parseCSV(tFile),parseCSV(rFile),...(erFile?[parseCSV(erFile)]:[])]); 
      const transcribers=parseTranscribers(res[0]);
      const{reviewers,erReviewWork}=parseReviewers(res[1]);
      const ers=erFile?parseERWork(res[2]):erReviewWork;
      if(!transcribers.length)throw new Error("No transcriber rows found — check column names.");
      if(!reviewers.length)throw new Error("No reviewer rows found — check column names.");
      onDataLoaded({transcribers,reviewers,erReviewWork,ers,days});
    }catch(e){setErr(e.message||"Parse error — check CSV format.");}
    setLoading(false);
  };

  const handleManualLoad=()=>{
    const make=(n,tot,pfx)=>Array.from({length:n},(_,i)=>({name:`${pfx} ${i+1}`,output:Math.round(tot/n),wer:null}));
    onDataLoaded({transcribers:make(manual.tCount,manual.tOutput*manual.days,"Transcriber"),reviewers:make(manual.rCount,manual.rOutput*manual.days,"Reviewer"),erReviewWork:[],ers:make(manual.erCount,manual.erOutput*manual.days,"ER"),days:manual.days});
  };

  const Zone=({label,hint,file,onFile,optional=false})=>(
    <label style={{display:"block",border:`2px dashed ${file?"#86efac":optional?"#fde68a":"#e2e8f0"}`,borderRadius:10,padding:"1.25rem",textAlign:"center",cursor:"pointer",background:file?"#f0fdf4":optional?"#fffbeb":"#fafafa",marginBottom:16}}>
      <input type="file" accept=".csv" style={{display:"none"}} onChange={e=>onFile(e.target.files[0])} />
      <p style={{margin:"0 0 4px",fontSize:14,fontWeight:600,color:file?"#16a34a":optional?"#92400e":"#374151"}}>
        {file?`✓  ${file.name}`:label}{optional&&!file&&<span style={{fontSize:11,fontWeight:400,marginLeft:6,color:"#92400e"}}>(optional)</span>}
      </p>
      <p style={{margin:0,fontSize:12,color:"#94a3b8"}}>{hint}</p>
    </label>
  );

  if(!mode) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f8fafc"}}>
      <div style={{width:520,...S.card,padding:"2rem"}}>
        <h2 style={{margin:"0 0 4px",fontSize:20,fontWeight:700}}>Transcription Forecasting Tool</h2>
        <p style={{margin:"0 0 1.5rem",fontSize:14,color:"#64748b"}}>How would you like to load data?</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          {[{id:"csv",title:"Upload CSVs",desc:"Load real worker data from your Metabase exports",icon:"↑"},{id:"manual",title:"Manual input",desc:"Enter worker counts and output to run hypotheticals",icon:"✎"}].map(o=>(
            <button key={o.id} onClick={()=>setMode(o.id)} style={{padding:"1.25rem",borderRadius:12,border:"1px solid #e2e8f0",background:"white",cursor:"pointer",textAlign:"left"}}
              onMouseEnter={e=>e.currentTarget.style.borderColor="#378ADD"}
              onMouseLeave={e=>e.currentTarget.style.borderColor="#e2e8f0"}>
              <p style={{margin:"0 0 6px",fontSize:24}}>{o.icon}</p>
              <p style={{margin:"0 0 4px",fontSize:14,fontWeight:700}}>{o.title}</p>
              <p style={{margin:0,fontSize:12,color:"#64748b"}}>{o.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  if(mode==="csv") return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f8fafc"}}>
      <div style={{width:520,...S.card,padding:"2rem"}}>
        <button onClick={()=>setMode(null)} style={{fontSize:13,color:"#64748b",background:"none",border:"none",cursor:"pointer",marginBottom:16,padding:0}}>← Back</button>
        <h2 style={{margin:"0 0 4px",fontSize:20,fontWeight:700}}>Upload CSV exports</h2>
        <p style={{margin:"0 0 1.5rem",fontSize:14,color:"#64748b"}}>Download from Metabase and upload here</p>
        {err&&<div style={{padding:"10px 14px",background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,fontSize:13,color:"#dc2626",marginBottom:16}}>{err}</div>}
        <Zone label="Transcriber export" file={tFile} onFile={setTFile} hint="transcriber_name · subtasks_completed · last_active_date · avg_wer_pct" />
        <Zone label="Reviewer / ER export" file={rFile} onFile={setRFile} hint="reviewer_name · role · reviews_completed · last_active_date · avg_wer_pct" />
        <Zone label="ER executive review export" file={erFile} onFile={setErFile} optional hint="reviewer_name · reviews_completed · last_active_date — ER-stage work only" />
        <div style={{marginBottom:20,display:"flex",alignItems:"center",gap:12}}>
          <label style={{fontSize:13,fontWeight:500}}>Days in this period</label>
          <input type="number" value={days} min={1} max={365} onChange={e=>setDays(+e.target.value)}
            style={{width:70,padding:"6px 10px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:14}} />
        </div>
        <button onClick={handleCSVLoad} disabled={loading}
          style={{width:"100%",padding:"10px",background:"#1e293b",color:"white",border:"none",borderRadius:8,fontSize:14,fontWeight:600,cursor:"pointer"}}>
          {loading?"Loading…":"Run model →"}
        </button>
      </div>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f8fafc"}}>
      <div style={{width:520,...S.card,padding:"2rem"}}>
        <button onClick={()=>setMode(null)} style={{fontSize:13,color:"#64748b",background:"none",border:"none",cursor:"pointer",marginBottom:16,padding:0}}>← Back</button>
        <h2 style={{margin:"0 0 4px",fontSize:20,fontWeight:700}}>Manual input</h2>
        <p style={{margin:"0 0 1.5rem",fontSize:14,color:"#64748b"}}>Enter hypothetical workforce numbers</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16,marginBottom:16}}>
          {[{label:"Transcribers",k1:"tCount",k2:"tOutput",color:"#378ADD",unit:"subtasks/day"},{label:"Reviewers",k1:"rCount",k2:"rOutput",color:"#1D9E75",unit:"reviews/day"},{label:"Exec reviewers",k1:"erCount",k2:"erOutput",color:"#7F77DD",unit:"ER reviews/day"}].map(({label,k1,k2,color,unit})=>(
            <div key={label} style={{padding:"12px",borderRadius:10,border:"1px solid #e2e8f0",background:"#fafafa"}}>
              <p style={{margin:"0 0 10px",fontSize:12,fontWeight:700,color}}>{label}</p>
              <div style={{marginBottom:10}}>
                <label style={{fontSize:11,color:"#94a3b8",display:"block",marginBottom:4}}>Workers</label>
                <input type="number" value={manual[k1]} min={0} onChange={e=>upM(k1,+e.target.value)}
                  style={{width:"100%",padding:"6px 8px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:13,boxSizing:"border-box"}} />
              </div>
              <div>
                <label style={{fontSize:11,color:"#94a3b8",display:"block",marginBottom:4}}>{unit}</label>
                <input type="number" value={manual[k2]} min={0} onChange={e=>upM(k2,+e.target.value)}
                  style={{width:"100%",padding:"6px 8px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:13,boxSizing:"border-box"}} />
              </div>
            </div>
          ))}
        </div>
        <div style={{marginBottom:20,display:"flex",alignItems:"center",gap:12}}>
          <label style={{fontSize:13,fontWeight:500}}>Days in period</label>
          <input type="number" value={manual.days} min={1} max={365} onChange={e=>upM("days",+e.target.value)}
            style={{width:70,padding:"6px 10px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:14}} />
        </div>
        <button onClick={handleManualLoad}
          style={{width:"100%",padding:"10px",background:"#1e293b",color:"white",border:"none",borderRadius:8,fontSize:14,fontWeight:600,cursor:"pointer"}}>
          Run model →
        </button>
      </div>
    </div>
  );
}


// ── Model app ────────────────────────────────────────────────────────────────
function ModelApp({data,onReload,onManual,onSignOut}) {
  const {transcribers,reviewers,ers}=data;
  const [tab,setTab]=useState("results");
  const [vol,setVol]=useState({monthlyTranscripts:196,monthlyAudioMin:9800,days:data.days||29});
  const dailyTranscripts = vol.monthlyTranscripts/vol.days;
  const dailyAudioMin = vol.monthlyAudioMin/vol.days;
  const avgAudioMin = vol.monthlyTranscripts>0 ? vol.monthlyAudioMin/vol.monthlyTranscripts : 50;
  const [tierPct, setTierPct] = useState({surge:7.7, three:5.6, seven:86.7});
  const dem = useMemo(() => ({
    surge: +(dailyTranscripts * tierPct.surge / 100).toFixed(1),
    three: +(dailyTranscripts * tierPct.three / 100).toFixed(1),
    seven: +(dailyTranscripts * tierPct.seven / 100).toFixed(1),
  }), [dailyTranscripts, tierPct]);
  const [spd,setSpd]=useState({t:1,r:20,er:35});
  const [wer,setWer]=useState({great:1.5,bad:3.5});

  const tOut=transcribers.map(w=>w.output);
  const rOut=reviewers.map(w=>w.output);
  const erOut=ers.map(w=>w.output);

  const lp = useMemo(()=>computeLP(dem,tOut,rOut,erOut,spd,vol.days,avgAudioMin),[dem,spd,tOut,rOut,erOut,vol.days,avgAudioMin]);
  const sens = useMemo(()=>
    [50,60,70,75,80,85,90,95,100,110,120,130,150,175,200].map(p=>({
      vol:`${p}%`,T:Math.round(lp.util.t*p),R:Math.round(lp.util.r*p),ER:Math.round(lp.util.er*p)
    })),[lp.util]);

  const upS=(k,v)=>setSpd(p=>({...p,[k]:v}));
  const upV=(k,v)=>setVol(p=>({...p,[k]:v}));
  const upTier=(k,v)=>setTierPct(p=>({...p,[k]:v}));
  const bn=ROLE_META.find(r=>r.id===lp.bnId);

  const workerMap={t:transcribers,r:reviewers,er:ers};
  const rec={t:staffingRec(lp,workerMap,"t"),r:staffingRec(lp,workerMap,"r"),er:staffingRec(lp,workerMap,"er")};

  const TABS=[["results","Results"],["whatif","What-if"],["configure","Configure"],["sensitivity","Sensitivity"],["concentration","Concentration"]];

  return (
    <div style={{maxWidth:940,margin:"0 auto",...S.page}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"1.25rem"}}>
        <div>
          <h1 style={{margin:"0 0 2px",fontSize:20,fontWeight:700}}>Transcription Forecasting Tool</h1>
          <p style={{margin:0,fontSize:13,color:"#64748b"}}>{transcribers.length}T · {reviewers.length}R · {ers.length}ER · {vol.days}-day period</p>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={onManual} style={{padding:"6px 14px",fontSize:13,borderRadius:8,border:"1px solid #e2e8f0",background:"white",cursor:"pointer"}}>✎ Manual input</button>
          <button onClick={onReload} style={{padding:"6px 14px",fontSize:13,borderRadius:8,border:"1px solid #e2e8f0",background:"white",cursor:"pointer"}}>↑ New data</button>
          <button onClick={onSignOut} style={{padding:"6px 14px",fontSize:13,borderRadius:8,border:"1px solid #e2e8f0",background:"white",cursor:"pointer",color:"#64748b"}}>Sign out</button>
        </div>
      </div>

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 16px",borderRadius:10,marginBottom:"1.25rem",background:lp.feasible?"#dcfce7":"#fee2e2",border:`1px solid ${lp.feasible?"#bbf7d0":"#fecaca"}`}}>
        <span style={{fontSize:14,fontWeight:600,color:lp.feasible?"#166534":"#dc2626"}}>{lp.feasible?"LP feasible — solution exists":"LP infeasible — capacity deficit"}</span>
        <span style={{fontSize:12,color:"#475569"}}>Bottleneck: <b style={{color:bn?.hex}}>{bn?.label}</b> at {pct(lp.util[lp.bnId])}{lp.feasible&&` · +${Math.max(0,Math.round((lp.headroom-1)*100))}% demand headroom`}</span>
      </div>

      <div style={{display:"flex",gap:4,marginBottom:"1.25rem",background:"#f1f5f9",borderRadius:10,padding:4}}>
        {TABS.map(([id,lbl])=><Tab key={id} active={tab===id} onClick={()=>setTab(id)}>{lbl}</Tab>)}
      </div>

      {tab==="results"&&<ResultsTab lp={lp} rec={rec} avgAudioMin={avgAudioMin} dailyTranscripts={dailyTranscripts} dailyAudioMin={dailyAudioMin} vol={vol}/>}
      {tab==="whatif"&&<WhatIfTab data={data} spd={spd} dem={dem} werThresholds={wer} avgAudioMin={avgAudioMin} days={vol.days}/>}
      {tab==="configure"&&<ConfigureTab dem={dem} spd={spd} wer={wer} vol={vol} tierPct={tierPct} lp={lp} totalDem={dem.surge+dem.three+dem.seven} upS={upS} upV={upV} upTier={upTier} setWer={setWer} data={data} avgAudioMin={avgAudioMin} dailyTranscripts={dailyTranscripts} dailyAudioMin={dailyAudioMin}/>}
      {tab==="sensitivity"&&<SensitivityTab sens={sens}/>}
      {tab==="concentration"&&<ConcentrationTab data={data} werThresholds={wer}/>}
    </div>
  );
}


// ── Results ──────────────────────────────────────────────────────────────────
function ResultsTab({lp,rec,avgAudioMin,dailyTranscripts,dailyAudioMin,vol}) {
  const capData=ROLE_META.map(r=>({name:r.label.split(" ")[0],Supply:r1(lp.supH[r.id]),Demand:r1(lp.demH[r.id])}));
  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
        {ROLE_META.map(role=>{
          const u=lp.util[role.id],pv=Math.round(u*100);
          const [bg,tc,bc]=u<.70?["#dcfce7","#166534","#bbf7d0"]:u<.85?["#fef9c3","#854d0e","#fde68a"]:["#fee2e2","#dc2626","#fecaca"];
          return (
            <div key={role.id} style={{padding:"16px 14px",borderRadius:12,background:bg,border:`1px solid ${bc}`,textAlign:"center"}}>
              <p style={{margin:"0 0 6px",fontSize:11,fontWeight:700,color:tc,textTransform:"uppercase",letterSpacing:".06em"}}>{role.label}</p>
              <p style={{margin:"0 0 2px",fontSize:40,fontWeight:700,lineHeight:1,color:tc}}>{pv}%</p>
              <p style={{margin:"0 0 10px",fontSize:11,color:tc}}>utilization</p>
              <div style={{height:6,borderRadius:999,background:"rgba(0,0,0,.1)",overflow:"hidden"}}><div style={{width:`${Math.min(pv,100)}%`,height:"100%",background:role.hex,borderRadius:999}}/></div>
              <p style={{margin:"8px 0 0",fontSize:11,color:tc}}>{fmt(lp.demH[role.id])}h needed · {fmt(lp.supH[role.id])}h available</p>
            </div>
          );
        })}
      </div>
      <Card>
        <Lbl>IC recommendations</Lbl>
        <p style={{margin:"-4px 0 14px",fontSize:12,color:"#64748b"}}>Based on current demand and average hours per IC in your pool.</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
          {ROLE_META.map(role=>{
            const r=rec[role.id];if(!r)return null;const ok=r.gap<=0;
            return (
              <div key={role.id} style={{padding:"14px",borderRadius:10,background:ok?"#f0fdf4":"#fef2f2",border:`1px solid ${ok?"#bbf7d0":"#fecaca"}`}}>
                <p style={{margin:"0 0 8px",fontSize:11,fontWeight:700,color:role.hex,textTransform:"uppercase",letterSpacing:".06em"}}>{role.label}</p>
                <div style={{display:"flex",alignItems:"baseline",gap:6,marginBottom:4}}><span style={{fontSize:28,fontWeight:700,color:ok?"#166534":"#dc2626"}}>{r.needed??"—"}</span><span style={{fontSize:13,color:"#64748b"}}>workers needed</span></div>
                <p style={{margin:"0 0 6px",fontSize:12,color:"#64748b"}}>currently have <b style={{fontWeight:600}}>{r.current}</b></p>
                <div style={{padding:"6px 10px",borderRadius:8,background:ok?"#dcfce7":"#fee2e2",fontSize:12,fontWeight:600,color:ok?"#166534":"#dc2626",textAlign:"center"}}>{ok?`✓ ${Math.abs(r.gap)} surplus`:`+${r.gap} needed`}</div>
                <p style={{margin:"8px 0 0",fontSize:11,color:"#94a3b8"}}>avg {fmt(r.avgHrsPerWorker)}h/IC/day</p>
              </div>
            );
          })}
        </div>
      </Card>
      <Card>
        <Lbl>Supply vs. demand (worker-hours/day)</Lbl>
        <div style={{height:200}}><ResponsiveContainer width="100%" height="100%"><BarChart data={capData} barGap={6}><CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/><XAxis dataKey="name" tick={{fontSize:12,fill:"#64748b"}}/><YAxis tick={{fontSize:11,fill:"#94a3b8"}}/><Tooltip formatter={v=>`${v}h`}/><Legend wrapperStyle={{fontSize:12}}/><Bar dataKey="Supply" fill="#378ADD" radius={[4,4,0,0]}/><Bar dataKey="Demand" fill="#E24B4A" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div>
      </Card>
      <Card>
        <Lbl>Volume summary</Lbl>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
          {[{label:"Daily transcripts",val:`${dailyTranscripts.toFixed(1)}/day`,sub:`${vol.monthlyTranscripts} monthly`,hex:"#378ADD"},{label:"Daily audio minutes",val:`${Math.round(dailyAudioMin)} min`,sub:`${vol.monthlyAudioMin.toLocaleString()} monthly`,hex:"#1D9E75"},{label:"Avg per transcript",val:`${Math.round(avgAudioMin)} min`,sub:"audio minutes",hex:"#7F77DD"}].map(({label,val,sub,hex})=>(
            <div key={label} style={{padding:"12px",borderRadius:10,background:"#f8fafc",border:"1px solid #e2e8f0"}}><p style={{margin:"0 0 4px",fontSize:11,color:"#94a3b8",fontWeight:600,textTransform:"uppercase",letterSpacing:".05em"}}>{label}</p><p style={{margin:"0 0 2px",fontSize:20,fontWeight:700,color:hex}}>{val}</p><p style={{margin:0,fontSize:11,color:"#94a3b8"}}>{sub}</p></div>
          ))}
        </div>
      </Card>
      <Card>
        <Lbl>TAT estimate by tier</Lbl>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {lp.tat.map(t=>(
            <div key={t.id} style={{padding:"12px 14px",borderRadius:10,background:t.ok?"#f0fdf4":"#fef2f2",border:`1px solid ${t.ok?"#bbf7d0":"#fecaca"}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><div><b style={{fontSize:14}}>{t.label}</b><span style={{fontSize:12,color:"#94a3b8",marginLeft:8}}>{t.D.toFixed(1)}/day · target {t.tatTgt}h</span></div><Badge ok={t.ok}>{t.ok?`✓ ${fmt(t.tot)}h`:`✗ ${fmt(t.tot)}h`}</Badge></div>
              <div style={{height:8,borderRadius:4,overflow:"hidden",display:"flex"}}>{[{v:t.tau,c:"#378ADD"},{v:t.wT,c:"#bfdbfe"},{v:t.rho,c:"#1D9E75"},{v:t.wR,c:"#bbf7d0"},{v:t.eps,c:"#7F77DD"},{v:t.wE,c:"#ddd6fe"}].map(({v,c},i)=>(<div key={i} style={{width:`${v/t.tot*100}%`,background:c,minWidth:v>.001?2:0}}/>))}</div>
              <div style={{display:"flex",gap:12,marginTop:6,flexWrap:"wrap"}}>{[["#378ADD","Transcription",t.tau],["#bfdbfe","T-queue",t.wT],["#1D9E75","Review",t.rho],["#bbf7d0","R-queue",t.wR],["#7F77DD","ER",t.eps],["#ddd6fe","ER-queue",t.wE]].map(([c,l,v])=>(<span key={l} style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:"#64748b"}}><span style={{width:8,height:8,borderRadius:2,background:c,display:"inline-block"}}/>{l}: {fmt(v)}h</span>))}</div>
            </div>
          ))}
        </div>
      </Card>
      {lp.util.er>1&&<div style={{padding:"12px 16px",borderRadius:10,background:"#fef9c3",border:"1px solid #fde68a",fontSize:13,color:"#92400e"}}><b>ER coverage gap:</b> At current volume, only {Math.round(1/lp.util.er*100)}% of transcripts can receive executive review.</div>}
    </div>
  );
}


// ── Configure ────────────────────────────────────────────────────────────────
function ConfigureTab({dem,spd,wer,vol,tierPct,lp,totalDem,upS,upV,upTier,setWer,data,avgAudioMin,dailyTranscripts,dailyAudioMin}) {
  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <Card>
        <h3 style={S.h3}>Volume & audio mix</h3>
        <p style={{margin:"-6px 0 14px",fontSize:12,color:"#64748b"}}>Update monthly from your TAT dashboard. Changes here automatically update demand calculations across all tabs.</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16,marginBottom:16}}>
          <NumInput label="Monthly transcripts ordered" value={vol.monthlyTranscripts} min={1} onChange={v=>upV("monthlyTranscripts",v)} unit="transcripts"/>
          <NumInput label="Monthly audio minutes ordered" value={vol.monthlyAudioMin} min={1} onChange={v=>upV("monthlyAudioMin",v)} unit="audio min"/>
          <NumInput label="Days in period" value={vol.days} min={1} max={365} onChange={v=>upV("days",v)} unit="days"/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
          {[{label:"Daily transcripts",val:`${dailyTranscripts.toFixed(1)}/day`,hex:"#378ADD"},{label:"Daily audio minutes",val:`${Math.round(dailyAudioMin)} min/day`,hex:"#1D9E75"},{label:"Avg audio min / transcript",val:`${Math.round(avgAudioMin)} min`,hex:"#7F77DD"},{label:"Subtasks per transcript",val:`${(avgAudioMin/15).toFixed(1)} subtasks`,hex:"#378ADD"}].map(({label,val,hex})=>(
            <div key={label} style={{padding:"10px 12px",borderRadius:8,background:"#f8fafc",border:"1px solid #e2e8f0"}}><p style={{margin:"0 0 4px",fontSize:11,color:"#94a3b8",fontWeight:600,textTransform:"uppercase",letterSpacing:".05em"}}>{label}</p><p style={{margin:0,fontSize:18,fontWeight:700,color:hex}}>{val}</p></div>
          ))}
        </div>
      </Card>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <Card>
          <h3 style={S.h3}>TAT tier distribution</h3>
          <p style={{margin:"-6px 0 12px",fontSize:12,color:"#64748b"}}>How daily volume splits across turnaround tiers (should sum to 100%)</p>
          <Slider label="Surge 24hr" value={tierPct.surge} min={0} max={50} step={.1} onChange={v=>upTier("surge",v)} disp={`${tierPct.surge.toFixed(1)}% → ${dem.surge.toFixed(1)}/day`}/>
          <Slider label="Three-day" value={tierPct.three} min={0} max={50} step={.1} onChange={v=>upTier("three",v)} disp={`${tierPct.three.toFixed(1)}% → ${dem.three.toFixed(1)}/day`}/>
          <Slider label="Seven-day" value={tierPct.seven} min={0} max={100} step={.1} onChange={v=>upTier("seven",v)} disp={`${tierPct.seven.toFixed(1)}% → ${dem.seven.toFixed(1)}/day`}/>
          <div style={{marginTop:8,padding:"8px 12px",borderRadius:8,background:Math.abs(tierPct.surge+tierPct.three+tierPct.seven-100)<0.5?"#f0fdf4":"#fef9c3",border:`1px solid ${Math.abs(tierPct.surge+tierPct.three+tierPct.seven-100)<0.5?"#bbf7d0":"#fde68a"}`}}><p style={{margin:0,fontSize:12,color:Math.abs(tierPct.surge+tierPct.three+tierPct.seven-100)<0.5?"#166534":"#92400e"}}>Total: <b>{(tierPct.surge+tierPct.three+tierPct.seven).toFixed(1)}%</b> · {totalDem.toFixed(1)} transcripts/day</p></div>
        </Card>
        <Card>
          <h3 style={S.h3}>Processing speeds</h3>
          <Slider label="Transcriber speed" value={spd.t} min={1} max={25} onChange={v=>upS("t",v)} disp={`${spd.t} subtasks/hr`}/>
          <p style={{margin:"-10px 0 12px",fontSize:11,color:"#94a3b8"}}>≈ {Math.round(60/spd.t)} min/subtask</p>
          <Slider label="Reviewer speed" value={spd.r} min={10} max={120} step={5} onChange={v=>upS("r",v)} disp={`${spd.r} audio-min/hr`}/>
          <Slider label="Exec reviewer speed" value={spd.er} min={10} max={100} step={5} onChange={v=>upS("er",v)} disp={`${spd.er} audio-min/hr`}/>
        </Card>
        <Card>
          <h3 style={S.h3}>WER quality thresholds</h3>
          <p style={{margin:"-6px 0 12px",fontSize:12,color:"#64748b"}}>Classifies workers and calculates ER rework burden</p>
          <div style={{display:"flex",gap:12,marginBottom:14}}>
            <div style={{flex:1}}><label style={{fontSize:13,color:"#64748b",display:"block",marginBottom:6}}>Great — below (%)</label><input type="number" value={wer.great} min={0} max={10} step={.1} onChange={e=>setWer(p=>({...p,great:+e.target.value}))} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:14,boxSizing:"border-box"}}/></div>
            <div style={{flex:1}}><label style={{fontSize:13,color:"#64748b",display:"block",marginBottom:6}}>Bad — above (%)</label><input type="number" value={wer.bad} min={0} max={20} step={.1} onChange={e=>setWer(p=>({...p,bad:+e.target.value}))} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:14,boxSizing:"border-box"}}/></div>
          </div>
          <div style={{display:"flex",gap:8}}>{[["great","< "+wer.great+"%","#dcfce7","#16a34a"],["ok",wer.great+"–"+wer.bad+"%","#fef9c3","#d97706"],["bad","> "+wer.bad+"%","#fee2e2","#dc2626"]].map(([t,l,bg,c])=>(<div key={t} style={{flex:1,padding:"6px 10px",borderRadius:8,background:bg,textAlign:"center",fontSize:12,fontWeight:600,color:c}}>{l}</div>))}</div>
        </Card>
        {ROLE_META.map(role=>{
          const workers=role.id==="t"?data.transcribers:role.id==="r"?data.reviewers:data.ers;
          const total=workers.reduce((s,w)=>s+w.output,0);
          return (<Card key={role.id}><h3 style={{...S.h3,color:role.hex}}>{role.label}</h3><p style={{margin:"0 0 10px",fontSize:13,color:"#64748b"}}><b style={{fontWeight:600}}>{workers.length} active workers</b> · {total} total output in period</p><div style={{padding:"10px 12px",borderRadius:8,background:role.bg,fontSize:12,color:role.tx}}>Utilization: <b>{pct(lp.util[role.id])}</b> · {lp.util[role.id]<=1?`${Math.round((1-lp.util[role.id])*100)}% headroom`:`${Math.round((lp.util[role.id]-1)*100)}% over capacity`}</div></Card>);
        })}
      </div>
    </div>
  );
}


// ── What-if ──────────────────────────────────────────────────────────────────
function WhatIfTab({data,spd,dem,werThresholds,avgAudioMin,days}) {
  const {transcribers,reviewers,ers}=data;
  const [removed,setRemoved]=useState({t:[],r:[],er:[]});
  const toggle=(role,idx)=>setRemoved(prev=>{const s=new Set(prev[role]);s.has(idx)?s.delete(idx):s.add(idx);return{...prev,[role]:[...s]};});
  const reset=()=>setRemoved({t:[],r:[],er:[]});
  const effWorkers=(role,workers)=>workers.filter((_,i)=>!removed[role].includes(i));
  const effOut=(role,workers)=>effWorkers(role,workers).map(w=>w.output);
  const tOut=effOut("t",transcribers),rOut=effOut("r",reviewers),erOut=effOut("er",ers);
  const simLP=useMemo(()=>computeLP(dem,tOut,rOut,erOut,spd,days,avgAudioMin),[removed,dem,spd,days,avgAudioMin]);
  const baseLP=useMemo(()=>computeLP(dem,transcribers.map(w=>w.output),reviewers.map(w=>w.output),ers.map(w=>w.output),spd,days,avgAudioMin),[dem,spd,days,avgAudioMin]);
  const totalRemoved=removed.t.length+removed.r.length+removed.er.length;
  const activeT=effWorkers("t",transcribers),activeR=effWorkers("r",reviewers);
  const avgWerT_a=avgWer(activeT),avgWerR_a=avgWer(activeR);
  const avgWerT_b=avgWer(transcribers),avgWerR_b=avgWer(reviewers);
  const mTA=avgWerT_a!=null?werMult(avgWerT_a,werThresholds):1;
  const mRA=avgWerR_a!=null?werMult(avgWerR_a,werThresholds):1;
  const mTB=avgWerT_b!=null?werMult(avgWerT_b,werThresholds):1;
  const mRB=avgWerR_b!=null?werMult(avgWerR_b,werThresholds):1;
  const reworkA=mTA*mRA,reworkB=mTB*mRB;
  const erBase=baseLP.demH.er;
  const erHoursA=erBase*reworkA,erSaved=erBase*reworkB-erHoursA;

  const WorkerList=({role,workers})=>{
    const total=workers.reduce((s,w)=>s+w.output,0);
    const rm=ROLE_META.find(r=>r.id===role);
    return (
      <Card>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><Lbl color={rm.hex}>{rm.label}</Lbl>{removed[role].length>0&&<span style={{fontSize:11,padding:"2px 8px",borderRadius:999,background:"#fee2e2",color:"#dc2626",border:"1px solid #fecaca"}}>{removed[role].length} off</span>}</div>
        <div style={{display:"flex",flexDirection:"column",gap:5,maxHeight:240,overflowY:"auto"}}>
          {workers.map((w,i)=>{
            const isOff=removed[role].includes(i);
            const share=Math.round(w.output/total*100);
            return (<button key={i} onClick={()=>toggle(role,i)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 10px",borderRadius:8,cursor:"pointer",textAlign:"left",border:`1px solid ${isOff?"#fecaca":"#e2e8f0"}`,background:isOff?"#fef2f2":"#f8fafc"}}><div style={{display:"flex",alignItems:"center",gap:6}}><span style={{width:10,height:10,borderRadius:2,flexShrink:0,background:isOff?"#dc2626":rm.hex,display:"inline-block"}}/><span style={{fontSize:13,color:isOff?"#dc2626":"#1e293b",textDecoration:isOff?"line-through":"none"}}>{w.name}</span>{w.wer!=null&&<WerDot wer={w.wer} thresholds={werThresholds}/>}</div><div style={{display:"flex",gap:8,alignItems:"center"}}><div style={{width:40,height:4,borderRadius:2,background:"#e2e8f0",overflow:"hidden"}}><div style={{width:`${Math.min(share*3,100)}%`,height:"100%",background:isOff?"#dc2626":rm.hex}}/></div><span style={{fontSize:11,color:"#94a3b8",minWidth:28,textAlign:"right"}}>{share}%</span></div></button>);
          })}
        </div>
      </Card>
    );
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 16px",borderRadius:10,background:simLP.feasible?"#dcfce7":"#fee2e2",border:`1px solid ${simLP.feasible?"#bbf7d0":"#fecaca"}`}}><span style={{fontSize:14,fontWeight:600,color:simLP.feasible?"#166534":"#dc2626"}}>{simLP.feasible?"Scenario feasible":"Scenario infeasible — capacity deficit"}</span><div style={{display:"flex",gap:8,alignItems:"center"}}>{totalRemoved>0&&<span style={{fontSize:12,color:"#64748b"}}>{totalRemoved} worker{totalRemoved>1?"s":""} removed</span>}{totalRemoved>0&&<button onClick={reset} style={{padding:"4px 12px",fontSize:12,borderRadius:8,cursor:"pointer",border:"1px solid #e2e8f0",background:"white"}}>Reset</button>}</div></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>{ROLE_META.map(role=>{const u=simLP.util[role.id];const[bg,tc]=u>.99?["#fee2e2","#dc2626"]:u>.85?["#fef9c3","#854d0e"]:["#f1f5f9","#475569"];return(<div key={role.id} style={{padding:"14px",borderRadius:12,background:bg,border:"1px solid #e2e8f0",textAlign:"center"}}><p style={{margin:"0 0 4px",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",color:role.hex}}>{role.label}</p><p style={{margin:"0 0 4px",fontSize:30,fontWeight:700,color:tc}}>{Math.round(u*100)}%</p><p style={{margin:0,fontSize:11,color:tc}}>utilization</p></div>);})}</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}><WorkerList role="t" workers={transcribers}/><WorkerList role="r" workers={reviewers}/><WorkerList role="er" workers={ers}/></div>
      <Card>
        <Lbl>TAT impact — baseline vs. scenario</Lbl>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {simLP.tat.map((t,i)=>{const base=baseLP.tat[i],delta=t.tot-base.tot;return(<div key={t.id} style={{padding:"12px 14px",borderRadius:10,background:t.ok?"#f0fdf4":"#fef2f2",border:`1px solid ${t.ok?"#bbf7d0":"#fecaca"}`}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><b style={{fontSize:14}}>{t.label}</b><div style={{display:"flex",gap:10,alignItems:"center"}}><span style={{fontSize:12,color:"#94a3b8"}}>baseline: {fmt(base.tot)}h</span><Badge ok={t.ok}>{t.ok?"✓":"✗"} {fmt(t.tot)}h</Badge>{delta>.05&&<span style={{fontSize:12,fontWeight:600,color:"#dc2626"}}>+{fmt(delta)}h</span>}</div></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>{[["Baseline",base.tot,"#94a3b8"],["Scenario",t.tot,t.ok?"#22c55e":"#ef4444"]].map(([lbl,val,col])=>(<div key={lbl}><p style={{margin:"0 0 4px",fontSize:10,color:"#94a3b8",textTransform:"uppercase",letterSpacing:".05em"}}>{lbl}</p><div style={{height:6,borderRadius:3,background:"#f1f5f9",overflow:"hidden"}}><div style={{width:`${Math.min(val/t.tatTgt*100,100)}%`,height:"100%",background:col,borderRadius:3}}/></div><p style={{margin:"3px 0 0",fontSize:11,color:"#64748b"}}>{fmt(val)}h / {t.tatTgt}h target</p></div>))}</div></div>);})}
        </div>
      </Card>
      <Card>
        <Lbl>Quality impact — ER rework burden</Lbl>
        <p style={{margin:"-4px 0 14px",fontSize:12,color:"#64748b"}}>Based on WER of active transcribers and reviewers.</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:14}}>{[{label:"Avg transcriber WER",base:avgWerT_b,active:avgWerT_a,hex:"#378ADD"},{label:"Avg reviewer WER",base:avgWerR_b,active:avgWerR_a,hex:"#1D9E75"},{label:"Combined ER rework multiplier",base:reworkB,active:reworkA,hex:"#7F77DD",isMult:true}].map(({label,base,active,hex,isMult})=>{const changed=active!=null&&base!=null&&Math.abs(active-base)>.01;const better=active!=null&&base!=null&&active<base;return(<div key={label} style={{padding:"12px",borderRadius:10,background:"#f8fafc",border:"1px solid #e2e8f0"}}><p style={{margin:"0 0 6px",fontSize:11,color:"#94a3b8",fontWeight:600,textTransform:"uppercase",letterSpacing:".05em"}}>{label}</p><p style={{margin:"0 0 2px",fontSize:22,fontWeight:700,color:hex}}>{active!=null?(isMult?`${active.toFixed(2)}×`:`${active.toFixed(2)}%`):"—"}</p>{changed&&<p style={{margin:0,fontSize:11,fontWeight:600,color:better?"#16a34a":"#dc2626"}}>{better?"↓":"↑"} from {isMult?`${base.toFixed(2)}×`:`${base.toFixed(2)}%`} baseline</p>}{!changed&&base!=null&&<p style={{margin:0,fontSize:11,color:"#94a3b8"}}>same as baseline</p>}</div>);})}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><div style={{padding:"12px",borderRadius:10,background:"#f5f3ff",border:"1px solid #ddd6fe"}}><p style={{margin:"0 0 4px",fontSize:11,color:"#7F77DD",fontWeight:600,textTransform:"uppercase",letterSpacing:".05em"}}>Estimated ER hours/day</p><p style={{margin:"0 0 2px",fontSize:22,fontWeight:700,color:"#7F77DD"}}>{fmt(erHoursA)}h</p><p style={{margin:0,fontSize:11,color:"#94a3b8"}}>base {fmt(erBase)}h × {reworkA.toFixed(2)}× rework</p></div><div style={{padding:"12px",borderRadius:10,background:erSaved>0?"#f0fdf4":"#fef2f2",border:`1px solid ${erSaved>0?"#bbf7d0":"#fecaca"}`}}><p style={{margin:"0 0 4px",fontSize:11,color:erSaved>0?"#16a34a":"#dc2626",fontWeight:600,textTransform:"uppercase",letterSpacing:".05em"}}>ER hours {erSaved>0?"saved":"added"} vs. baseline</p><p style={{margin:"0 0 2px",fontSize:22,fontWeight:700,color:erSaved>0?"#16a34a":"#dc2626"}}>{erSaved>0?"-":"+"}{fmt(Math.abs(erSaved))}h/day</p><p style={{margin:0,fontSize:11,color:"#94a3b8"}}>from removing {totalRemoved} worker{totalRemoved!==1?"s":""}</p></div></div>
      </Card>
    </div>
  );
}


// ── Sensitivity ──────────────────────────────────────────────────────────────
function SensitivityTab({sens}) {
  const cc=v=>v>100?"#dc2626":v>85?"#d97706":"#1e293b";
  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <Card><Lbl>Utilization vs. demand volume</Lbl><p style={{margin:"-4px 0 12px",fontSize:12,color:"#94a3b8"}}>Red = 100% capacity. Amber = 85% recommended ceiling.</p><div style={{height:250}}><ResponsiveContainer width="100%" height="100%"><LineChart data={sens}><CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/><XAxis dataKey="vol" tick={{fontSize:11,fill:"#94a3b8"}} interval={2}/><YAxis tick={{fontSize:11,fill:"#94a3b8"}} unit="%" domain={[0,220]}/><Tooltip formatter={v=>`${v}%`}/><Legend wrapperStyle={{fontSize:12}}/><ReferenceLine y={100} stroke="#ef4444" strokeDasharray="5 3"/><ReferenceLine y={85} stroke="#f59e0b" strokeDasharray="5 3"/><Line type="monotone" dataKey="T" stroke="#378ADD" strokeWidth={2} dot={false} name="Transcribers"/><Line type="monotone" dataKey="R" stroke="#1D9E75" strokeWidth={2} dot={false} name="Reviewers"/><Line type="monotone" dataKey="ER" stroke="#7F77DD" strokeWidth={2} dot={false} name="Exec reviewers"/></LineChart></ResponsiveContainer></div></Card>
      <Card><Lbl>Volume feasibility table</Lbl><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}><thead><tr>{["Volume","Transcribers","Reviewers","Exec reviewers","Status"].map(h=>(<th key={h} style={{padding:"8px 12px",textAlign:"center",fontSize:11,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",borderBottom:"1px solid #f1f5f9",letterSpacing:".06em"}}>{h}</th>))}</tr></thead><tbody>{sens.map((row,i)=>{const bad=row.T>100||row.R>100||row.ER>100,warn=!bad&&(row.T>85||row.R>85||row.ER>85),cur=row.vol==="100%";return(<tr key={i} style={{borderBottom:"1px solid #f8fafc",background:cur?"#eff6ff":"transparent"}}><td style={{padding:"8px 12px",textAlign:"center",fontWeight:cur?700:400,color:cur?"#1d4ed8":"#1e293b"}}>{row.vol}</td>{[row.T,row.R,row.ER].map((v,j)=>(<td key={j} style={{padding:"8px 12px",textAlign:"center",color:cc(v),fontWeight:v>85?700:400}}>{v}%</td>))}<td style={{padding:"8px 12px",textAlign:"center"}}><Badge ok={!bad&&!warn}>{bad?"Infeasible":warn?"Near limit":"Feasible"}</Badge></td></tr>);})}</tbody></table></div></Card>
    </div>
  );
}


// ── Concentration ────────────────────────────────────────────────────────────
const hhi=arr=>{const tot=arr.reduce((s,v)=>s+v,0);return Math.round(arr.reduce((s,v)=>s+(v/tot*100)**2,0));};
const hhiLabel=h=>h>2500?"Highly concentrated":h>1500?"Moderately concentrated":"Competitive";
const hhiColor=h=>h>2500?"#dc2626":h>1500?"#d97706":"#16a34a";
const concDrop=(arr,n)=>{const s=[...arr].sort((a,b)=>b-a),tot=s.reduce((x,v)=>x+v,0);return Math.round(s.slice(n).reduce((x,v)=>x+v,0)/tot*100);};

function ConcentrationTab({data,werThresholds}) {
  const {transcribers,reviewers,ers}=data;
  const groups=[{label:"Transcribers",hex:"#378ADD",workers:transcribers},{label:"Reviewers",hex:"#1D9E75",workers:reviewers},{label:"Exec reviewers",hex:"#7F77DD",workers:ers}];
  const concChart=Array.from({length:11},(_,n)=>({n,T:concDrop(transcribers.map(w=>w.output),n),R:concDrop(reviewers.map(w=>w.output),n),ER:concDrop(ers.map(w=>w.output),Math.min(n,ers.length))}));
  const lorenz=workers=>{const s=[...workers].sort((a,b)=>b.output-a.output),tot=s.reduce((x,w)=>x+w.output,0);let cum=0;return s.map((w,i)=>{cum+=w.output;return{worker:i+1,share:Math.round(cum/tot*100)};});};
  const scatterT=transcribers.filter(w=>w.wer!=null).map(w=>({x:w.output,y:+w.wer.toFixed(2),name:w.name}));
  const scatterR=reviewers.filter(w=>w.wer!=null).map(w=>({x:w.output,y:+w.wer.toFixed(2),name:w.name}));

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>{groups.map(({label,hex,workers})=>{const h=hhi(workers.map(w=>w.output));return(<div key={label} style={{padding:"14px",borderRadius:12,background:"white",border:"1px solid #e2e8f0",textAlign:"center"}}><p style={{margin:"0 0 2px",fontSize:11,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:".06em"}}>{label}</p><p style={{margin:"0 0 2px",fontSize:11,color:"#94a3b8"}}>Concentration score (HHI)</p><p style={{margin:"0 0 2px",fontSize:28,fontWeight:700,color:hex}}>{h} <span style={{fontSize:13,fontWeight:400,color:"#94a3b8"}}>/ 10,000</span></p><p style={{margin:"0 0 2px",fontSize:12,fontWeight:600,color:hhiColor(h)}}>{hhiLabel(h)}</p><p style={{margin:0,fontSize:11,color:"#94a3b8"}}>Higher = output concentrated in fewer workers</p></div>);})}</div>
      <Card><Lbl>Remaining capacity if top N workers go inactive</Lbl><div style={{height:220}}><ResponsiveContainer width="100%" height="100%"><LineChart data={concChart}><CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/><XAxis dataKey="n" tick={{fontSize:11,fill:"#94a3b8"}} label={{value:"Workers removed",position:"insideBottom",offset:-2,fontSize:11,fill:"#94a3b8"}}/><YAxis unit="%" domain={[0,105]} tick={{fontSize:11,fill:"#94a3b8"}}/><Tooltip formatter={v=>`${v}%`} labelFormatter={n=>`Remove top ${n}`}/><Legend wrapperStyle={{fontSize:12}}/><ReferenceLine y={70} stroke="#ef4444" strokeDasharray="5 3"/><ReferenceLine y={85} stroke="#f59e0b" strokeDasharray="5 3"/><Line type="monotone" dataKey="T" stroke="#378ADD" strokeWidth={2} dot name="Transcribers"/><Line type="monotone" dataKey="R" stroke="#1D9E75" strokeWidth={2} dot name="Reviewers"/><Line type="monotone" dataKey="ER" stroke="#7F77DD" strokeWidth={2} dot name="Exec reviewers"/></LineChart></ResponsiveContainer></div></Card>
      {(scatterT.length>0||scatterR.length>0)&&<Card><Lbl>Volume vs. WER — quality scatter</Lbl><p style={{margin:"-4px 0 6px",fontSize:12,color:"#64748b"}}>Bottom right = high volume, low WER — stars.</p><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>{[["Transcribers",scatterT,"#378ADD"],["Reviewers",scatterR,"#1D9E75"]].map(([lbl,sData,hex])=>sData.length>0&&(<div key={lbl}><p style={{margin:"0 0 8px",fontSize:12,fontWeight:600,color:hex}}>{lbl}</p><div style={{height:200}}><ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{top:10,right:10,bottom:20,left:10}}><CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/><XAxis dataKey="x" name="Output" tick={{fontSize:10,fill:"#94a3b8"}} label={{value:"Output",position:"insideBottom",offset:-10,fontSize:10,fill:"#94a3b8"}}/><YAxis dataKey="y" name="WER %" tick={{fontSize:10,fill:"#94a3b8"}} label={{value:"WER %",angle:-90,position:"insideLeft",fontSize:10,fill:"#94a3b8"}}/><ZAxis range={[40,40]}/><ReferenceLine y={werThresholds?.great??1.5} stroke="#16a34a" strokeDasharray="4 2"/><ReferenceLine y={werThresholds?.bad??3.5} stroke="#dc2626" strokeDasharray="4 2"/><Tooltip cursor={{strokeDasharray:"3 3"}} content={({payload})=>{if(!payload?.length)return null;const d=payload[0].payload;return<div style={{background:"white",border:"1px solid #e2e8f0",borderRadius:8,padding:"6px 10px",fontSize:12}}><b>{d.name}</b><br/>Output: {d.x}<br/>WER: {d.y}%</div>;}}/><Scatter data={sData} fill={hex} fillOpacity={0.8}/></ScatterChart></ResponsiveContainer></div></div>))}</div></Card>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>{groups.map(({label,hex,workers})=>{const tot=workers.reduce((s,w)=>s+w.output,0);const top3=Math.round(workers.slice(0,3).reduce((s,w)=>s+w.output,0)/tot*100);return(<Card key={label}><Lbl color={hex}>{label}</Lbl><p style={{margin:"0 0 10px",fontSize:12,color:"#64748b"}}>Top 3 = <b style={{color:top3>60?"#dc2626":"#d97706"}}>{top3}% of output</b></p><div style={{height:130}}><ResponsiveContainer width="100%" height="100%"><AreaChart data={lorenz(workers).slice(0,15)}><XAxis dataKey="worker" tick={{fontSize:10,fill:"#94a3b8"}}/><YAxis unit="%" domain={[0,100]} tick={{fontSize:10,fill:"#94a3b8"}}/><Tooltip formatter={v=>`${v}%`} labelFormatter={n=>`Top ${n}`}/><ReferenceLine y={80} stroke="#f59e0b" strokeDasharray="4 2"/><Area type="monotone" dataKey="share" stroke={hex} fill={hex} fillOpacity={.12} strokeWidth={2} dot={false} name="Cumulative share"/></AreaChart></ResponsiveContainer></div><div style={{marginTop:10,display:"flex",flexDirection:"column",gap:5}}>{[1,2,3,5].map(n=>{const rem=concDrop(workers.map(w=>w.output),n);return(<div key={n} style={{display:"flex",justifyContent:"space-between",fontSize:12}}><span style={{color:"#64748b"}}>Remove top {n}</span><span style={{fontWeight:600,color:rem<70?"#dc2626":rem<85?"#d97706":"#16a34a"}}>{rem}% remains</span></div>);})}</div></Card>);})}</div>
    </div>
  );
}


// ── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [session,setSession]=useState(null),[checking,setChecking]=useState(true);
  const [data,setData]=useState(null),[manualMode,setManualMode]=useState(false);

  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{setSession(session);setChecking(false);});
    const{data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s));
    return()=>subscription.unsubscribe();
  },[]);

  if(checking)return<div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f8fafc",fontSize:14,color:"#94a3b8"}}>Loading…</div>;
  if(!session)return<AuthScreen/>;
  if(!data||manualMode)return<UploadScreen defaultMode={manualMode?"manual":null} onDataLoaded={d=>{setData(d);setManualMode(false);}}/>;
  return<ModelApp data={data} onReload={()=>{setData(null);setManualMode(false);}} onManual={()=>setManualMode(true)} onSignOut={()=>supabase.auth.signOut()}/>;
}
