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
