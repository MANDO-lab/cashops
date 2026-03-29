import { useState, useEffect, useRef } from "react";

// ─── Theme ────────────────────────────────────────────────────────────────────
const DARK = {
  bg: "#070b14", surface: "#0d1424", surface2: "#131d30", surface3: "#1a2640",
  border: "#1c2a40", border2: "#243348", green: "#00d68f", greenDim: "#00d68f22",
  amber: "#f0a500", amberDim: "#f0a50022", red: "#f04060", redDim: "#f0406022",
  blue: "#3d8ef0", blueDim: "#3d8ef022", purple: "#9b6fff", purpleDim: "#9b6fff22",
  text: "#dce8f5", text2: "#7a94b0", text3: "#3d5570",
  mono: "'Space Mono', monospace", sans: "'DM Sans', sans-serif",
};
const LIGHT = {
  bg: "#f0f4f8", surface: "#ffffff", surface2: "#f5f7fa", surface3: "#e8edf3",
  border: "#dde3ec", border2: "#c8d0dc", green: "#00a86b", greenDim: "#00a86b18",
  amber: "#d97706", amberDim: "#d9770618", red: "#dc2626", redDim: "#dc262618",
  blue: "#2563eb", blueDim: "#2563eb18", purple: "#7c3aed", purpleDim: "#7c3aed18",
  text: "#0f172a", text2: "#475569", text3: "#94a3b8",
  mono: "'Space Mono', monospace", sans: "'DM Sans', sans-serif",
};

// ─── Sample Demo Data ─────────────────────────────────────────────────────────
const DEMO_OBLIGATIONS = [
  { id: 1, name: "GST Payment", payee: "Government of India", amount: 180000, due: "2025-06-28", priority: "critical", flexibility: "none", penalty: "18% p.a. + notice", category: "statutory", relationship: "government", paid: false },
  { id: 2, name: "Staff Salaries", payee: "12 Employees", amount: 240000, due: "2025-06-30", priority: "critical", flexibility: "none", penalty: "Legal + morale risk", category: "payroll", relationship: "employees", paid: false },
  { id: 3, name: "Office Rent", payee: "Sunrise Properties", amount: 95000, due: "2025-07-03", priority: "high", flexibility: "7 days grace", penalty: "Late fee ₹2,000", category: "rent", relationship: "landlord", paid: false },
  { id: 4, name: "Vendor Invoice #V-214", payee: "Raju Traders", amount: 160000, due: "2025-07-07", priority: "medium", flexibility: "negotiable", penalty: "None in contract", category: "vendor", relationship: "supplier", paid: false },
  { id: 5, name: "Loan EMI", payee: "Kotak Bank", amount: 65000, due: "2025-07-12", priority: "high", flexibility: "none", penalty: "CIBIL impact + 2%", category: "loan", relationship: "bank", paid: false },
  { id: 6, name: "Software Subscriptions", payee: "Various SaaS", amount: 18000, due: "2025-07-15", priority: "low", flexibility: "cancellable", penalty: "Service disruption", category: "opex", relationship: "vendor", paid: false },
];
const DEMO_RECEIVABLES = [
  { id: 1, name: "Apex Logistics Invoice #INV-089", amount: 210000, expected: "2025-07-04", confidence: 78, client: "Apex Logistics", daysOverdue: 0 },
  { id: 2, name: "Kaveri Exports Invoice #INV-091", amount: 180000, expected: "2025-07-08", confidence: 92, client: "Kaveri Exports", daysOverdue: 0 },
  { id: 3, name: "Metro Retail Invoice #INV-085", amount: 220000, expected: "2025-07-15", confidence: 55, client: "Metro Retail", daysOverdue: 3 },
];
const DEMO_CASH = 520000;
const DEMO_USER = { name: "Priya Mehta", company: "Meridian Supplies Pvt Ltd", email: "demo@cashops.app", isDemo: true };

// ─── Default Data (empty for real new users) ──────────────────────────────────
const DEFAULT_OBLIGATIONS = [];
const DEFAULT_RECEIVABLES = [];
const DEFAULT_CASH = 0;

// ─── Utilities ────────────────────────────────────────────────────────────────
const fmt = (n) => "₹" + Number(n).toLocaleString("en-IN");
const fmtL = (n) => "₹" + (n / 100000).toFixed(1) + "L";
const priorityColor = (p, T) => ({ critical: T.red, high: T.amber, medium: T.blue, low: T.green }[p] || T.text2);
const priorityBg = (p, T) => ({ critical: T.redDim, high: T.amberDim, medium: T.blueDim, low: T.greenDim }[p] || "transparent");
const daysUntil = (due) => Math.ceil((new Date(due) - new Date()) / 86400000);

// ─── Per-user localStorage helpers ───────────────────────────────────────────
function getUserData(email) {
  try {
    const raw = localStorage.getItem(`cashops_data_${email}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { obligations: DEFAULT_OBLIGATIONS, receivables: DEFAULT_RECEIVABLES, cashBalance: DEFAULT_CASH, ingestedDocs: [] };
}
function saveUserData(email, data) {
  localStorage.setItem(`cashops_data_${email}`, JSON.stringify(data));
}

// ─── Financial Health Score ───────────────────────────────────────────────────
function calcHealthScore(cashBalance, obligations, receivables, whatIfDelays = {}) {
  const active = obligations.filter(o => !o.paid);
  const totalObl = active.reduce((s, o) => s + o.amount, 0);
  const totalRec = receivables.reduce((s, r) => s + r.amount, 0);
  const shortfall = Math.max(0, totalObl - cashBalance);
  const runway = totalObl > 0 ? Math.floor(cashBalance / (totalObl / 30)) : 60;
  const liquidityRatio = totalObl > 0 ? Math.min(1, cashBalance / totalObl) : 1;
  const criticalCount = active.filter(o => o.priority === "critical" && !whatIfDelays[o.id]).length;
  const receivableStrength = totalRec > 0 ? receivables.reduce((s, r) => s + (r.amount * r.confidence / 100), 0) / totalRec : 0.5;
  let score = 0;
  score += Math.min(30, runway * 0.5);
  score += Math.min(25, liquidityRatio * 25);
  score += Math.min(20, receivableStrength * 20);
  score -= criticalCount * 5;
  score -= shortfall > 0 ? 15 : 0;
  score += Object.keys(whatIfDelays).length * 2;
  return Math.min(100, Math.max(0, Math.round(score)));
}
function scoreLabel(s, T) {
  if (s >= 75) return { label: "Healthy", color: T.green };
  if (s >= 50) return { label: "Caution", color: T.amber };
  if (s >= 25) return { label: "At Risk", color: T.amber };
  return { label: "Critical", color: T.red };
}

// ─── Gemini API Helper ────────────────────────────────────────────────────────
async function callGemini(systemPrompt, userMessage, onChunk) {
  const response = await fetch("/api/gemini/stream", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ systemPrompt, userMessage }),
  });
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let full = "", buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n"); buffer = lines.pop();
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const jsonStr = line.slice(6).trim();
      if (!jsonStr || jsonStr === "[DONE]") continue;
      try {
        const d = JSON.parse(jsonStr);
        const text = d.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (text) { full += text; onChunk(full); }
      } catch {}
    }
  }
  return full;
}

// ─── Toast Notification System ───────────────────────────────────────────────
function ToastContainer({ toasts, removeToast, T }) {
  return (
    <div style={{ position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", gap: 8, zIndex: 2000, pointerEvents: "none" }}>
      {toasts.map(t => (
        <div key={t.id} style={{ background: t.type === "success" ? T.green : t.type === "error" ? T.red : T.surface, color: t.type === "success" ? "#06210f" : t.type === "error" ? "#fff" : T.text, padding: "12px 20px", borderRadius: 10, fontSize: 13, fontWeight: 500, boxShadow: "0 4px 20px rgba(0,0,0,.3)", display: "flex", alignItems: "center", gap: 10, animation: "slideUp .25s ease", pointerEvents: "auto", border: `1px solid ${t.type === "success" ? T.green : t.type === "error" ? T.red : T.border}` }}>
          <span>{t.type === "success" ? "✓" : t.type === "error" ? "✕" : "ℹ"}</span>
          {t.msg}
        </div>
      ))}
    </div>
  );
}
function useToast() {
  const [toasts, setToasts] = useState([]);
  const toast = (msg, type = "success") => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000);
  };
  return { toasts, toast };
}

// ─── Shared UI Components ─────────────────────────────────────────────────────
function Badge({ priority, label, T }) {
  const color = priorityColor(priority, T);
  const bg = priorityBg(priority, T);
  return <span style={{ background: bg, color, border: `1px solid ${color}33`, fontSize: 10, padding: "3px 8px", borderRadius: 4, fontFamily: T.mono, letterSpacing: 1, textTransform: "uppercase", whiteSpace: "nowrap" }}>{label || priority}</span>;
}
function MetricCard({ label, value, sub, valueColor, accent, children, T }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "18px 20px", borderTop: accent ? `2px solid ${accent}` : undefined }}>
      <div style={{ fontSize: 10, color: T.text3, fontFamily: T.mono, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 600, fontFamily: T.mono, color: valueColor || T.text, letterSpacing: -1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: T.text2, marginTop: 4 }}>{sub}</div>}
      {children}
    </div>
  );
}
function Spinner({ T }) {
  return <span style={{ display: "inline-block", width: 14, height: 14, border: `2px solid ${T.border2}`, borderTopColor: T.green, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />;
}
function InputField({ label, type = "text", value, onChange, placeholder, T }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 11, color: T.text2, fontFamily: T.mono, letterSpacing: 1 }}>{label}</label>
      <input type={type} value={value} onChange={onChange} placeholder={placeholder}
        style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.surface2, color: T.text, outline: "none", fontSize: 14, fontFamily: T.sans }} />
    </div>
  );
}
function SelectField({ label, value, onChange, options, T }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 11, color: T.text2, fontFamily: T.mono, letterSpacing: 1 }}>{label}</label>
      <select value={value} onChange={onChange} style={{ padding: "12px 14px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.surface2, color: T.text, fontSize: 14, fontFamily: T.sans }}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

// ─── Health Score Widget ──────────────────────────────────────────────────────
function HealthScoreWidget({ score, T }) {
  const { label, color } = scoreLabel(score, T);
  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "18px 20px", borderTop: `2px solid ${color}`, display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{ position: "relative", width: 80, height: 80, flexShrink: 0 }}>
        <svg width="80" height="80" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="40" cy="40" r="36" fill="none" stroke={T.border} strokeWidth="6" />
          <circle cx="40" cy="40" r="36" fill="none" stroke={color} strokeWidth="6" strokeDasharray={circumference} strokeDashoffset={offset} style={{ transition: "stroke-dashoffset 1s ease, stroke 0.5s" }} strokeLinecap="round" />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 20, fontWeight: 700, fontFamily: T.mono, color }}>{score}</span>
        </div>
      </div>
      <div>
        <div style={{ fontSize: 10, color: T.text3, fontFamily: T.mono, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>Financial Health</div>
        <div style={{ fontSize: 20, fontWeight: 600, color, marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 11, color: T.text2, lineHeight: 1.5 }}>
          {score >= 75 ? "Liquidity is stable. Keep monitoring." : score >= 50 ? "Short-term stress detected. Take action." : score >= 25 ? "Significant risk. Prioritise critical items." : "Crisis mode. Immediate intervention needed."}
        </div>
      </div>
    </div>
  );
}

// ─── What-If Simulator ────────────────────────────────────────────────────────
function WhatIfSimulator({ obligations, cashBalance, receivables, onDelaysChange, T }) {
  const [delays, setDelays] = useState({});
  const [dayInputs, setDayInputs] = useState({});
  const activeObs = obligations.filter(o => !o.paid);
  const flexibleObs = activeObs.filter(o => o.flexibility !== "none");
  const totalDeferred = Object.entries(delays).reduce((s, [id]) => {
    const ob = obligations.find(o => o.id === parseInt(id));
    return ob ? s + ob.amount : s;
  }, 0);
  const newRunway = (() => {
    const rem = activeObs.filter(o => !delays[o.id]).reduce((s, o) => s + o.amount, 0);
    return rem > 0 ? Math.floor(cashBalance / (rem / 30)) : 60;
  })();
  const originalRunway = (() => {
    const rem = activeObs.reduce((s, o) => s + o.amount, 0);
    return rem > 0 ? Math.floor(cashBalance / (rem / 30)) : 60;
  })();
  const newScore = calcHealthScore(cashBalance, obligations, receivables, delays);
  const applyDelay = (ob) => {
    const days = parseInt(dayInputs[ob.id] || 0);
    if (days <= 0) return;
    const nd = { ...delays, [ob.id]: days }; setDelays(nd); onDelaysChange(nd);
  };
  const removeDelay = (id) => {
    const nd = { ...delays }; delete nd[id]; setDelays(nd); onDelaysChange(nd);
  };
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: 18 }}>
      <div style={{ fontSize: 11, fontFamily: T.mono, color: T.text2, letterSpacing: 2, textTransform: "uppercase", marginBottom: 14 }}>⚡ What-If Scenario Simulator</div>
      {Object.keys(delays).length > 0 && (
        <div style={{ background: T.greenDim, border: `1px solid ${T.green}33`, borderRadius: 8, padding: 12, marginBottom: 14, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
          {[["RUNWAY CHANGE", `${originalRunway}d → ${newRunway}d`, T.green], ["DEFERRED", fmtL(totalDeferred), T.amber], ["NEW SCORE", `${newScore}/100`, scoreLabel(newScore, T).color]].map(([l, v, c]) => (
            <div key={l} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10, color: T.text2, fontFamily: T.mono, marginBottom: 4 }}>{l}</div>
              <div style={{ fontSize: 18, fontFamily: T.mono, color: c, fontWeight: 700 }}>{v}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {flexibleObs.map(ob => (
          <div key={ob.id} style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px 36px", gap: 8, alignItems: "center", padding: "10px 12px", background: delays[ob.id] ? T.greenDim : T.surface2, borderRadius: 8, border: `1px solid ${delays[ob.id] ? T.green + "44" : T.border}` }}>
            <div><div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{ob.name}</div><div style={{ fontSize: 11, color: T.text2 }}>{fmt(ob.amount)} · {ob.flexibility}</div></div>
            {delays[ob.id] ? (<>
              <span style={{ fontSize: 11, color: T.green, fontFamily: T.mono, textAlign: "center" }}>+{delays[ob.id]}d</span>
              <span style={{ fontSize: 11, color: T.green, fontFamily: T.mono, textAlign: "center" }}>Applied ✓</span>
              <button onClick={() => removeDelay(ob.id)} style={{ background: T.redDim, border: `1px solid ${T.red}44`, color: T.red, borderRadius: 6, cursor: "pointer", fontSize: 14, padding: "4px 0" }}>×</button>
            </>) : (<>
              <input type="number" min="1" max="90" placeholder="days" value={dayInputs[ob.id] || ""} onChange={e => setDayInputs({ ...dayInputs, [ob.id]: e.target.value })}
                style={{ padding: "6px 8px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.surface, color: T.text, fontSize: 12, fontFamily: T.mono, width: "100%" }} />
              <button onClick={() => applyDelay(ob)} style={{ padding: "6px 0", borderRadius: 6, border: `1px solid ${T.green}44`, background: T.greenDim, color: T.green, cursor: "pointer", fontSize: 11, fontFamily: T.mono }}>Apply</button>
              <div />
            </>)}
          </div>
        ))}
      </div>
      {flexibleObs.length === 0 && <div style={{ textAlign: "center", color: T.text3, fontSize: 13, padding: "20px 0" }}>No flexible obligations to simulate.</div>}
    </div>
  );
}

// ─── AI Chatbot ───────────────────────────────────────────────────────────────
function AIChatbot({ user, obligations, receivables, cashBalance, healthScore, whatIfDelays, T }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([{ role: "assistant", text: `Hi ${user.name.split(" ")[0]}! I'm your CashOps AI. Ask me anything about your finances.` }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const activeObs = obligations.filter(o => !o.paid);
  const totalObl = activeObs.reduce((s, o) => s + o.amount, 0);
  const totalRec = receivables.reduce((s, r) => s + r.amount, 0);
  const shortfall = Math.max(0, totalObl - cashBalance);
  const runway = totalObl > 0 ? Math.floor(cashBalance / (totalObl / 30)) : 60;
  const systemPrompt = `You are CashOps AI, a financial advisor for ${user.company}. Cash: ${fmt(cashBalance)}, Obligations: ${fmt(totalObl)}, Receivables: ${fmt(totalRec)}, Shortfall: ${fmt(shortfall)}, Runway: ${runway}d, Health: ${healthScore}/100. Obligations: ${activeObs.map(o => `${o.name}(${fmt(o.amount)},due ${o.due},${o.priority})`).join(";")}.  Receivables: ${receivables.map(r => `${r.client}(${fmt(r.amount)},${r.confidence}%)`).join(";")}. Be concise and actionable. Max 3 sentences unless a list is needed.`;
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim(); setInput("");
    setMessages(m => [...m, { role: "user", text: userMsg }, { role: "assistant", text: "" }]);
    setLoading(true);
    await callGemini(systemPrompt, userMsg, (t) => setMessages(m => [...m.slice(0, -1), { role: "assistant", text: t }]));
    setLoading(false);
  };
  return (<>
    <button onClick={() => setOpen(o => !o)} style={{ position: "fixed", bottom: 24, right: 24, width: 52, height: 52, borderRadius: "50%", background: T.purple, border: "none", cursor: "pointer", fontSize: 22, boxShadow: `0 4px 20px ${T.purple}55`, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {open ? "✕" : "💬"}
    </button>
    {open && (
      <div style={{ position: "fixed", bottom: 88, right: 24, width: 360, height: 500, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, display: "flex", flexDirection: "column", zIndex: 999, boxShadow: "0 20px 60px rgba(0,0,0,.4)" }}>
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.purple, animation: "blink 1.4s infinite", display: "inline-block" }} />
          <span style={{ fontFamily: T.mono, fontSize: 12, color: T.purple, letterSpacing: 1 }}>CASHOPS AI</span>
          <span style={{ marginLeft: "auto", fontSize: 10, color: T.text3, fontFamily: T.mono }}>Health: {healthScore}/100</span>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
              <div style={{ maxWidth: "85%", padding: "10px 14px", borderRadius: m.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px", background: m.role === "user" ? T.purple + "33" : T.surface2, border: `1px solid ${m.role === "user" ? T.purple + "44" : T.border}`, fontSize: 13, lineHeight: 1.6, color: T.text, whiteSpace: "pre-wrap" }}>
                {m.text || (loading && i === messages.length - 1 ? <Spinner T={T} /> : "")}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        {messages.length <= 1 && (
          <div style={{ padding: "0 14px 10px", display: "flex", flexWrap: "wrap", gap: 6 }}>
            {["Why am I running low?", "What should I pay first?", "How do I improve my score?", "When do I run out of cash?"].map(q => (
              <button key={q} onClick={() => setInput(q)} style={{ fontSize: 11, padding: "5px 10px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.surface2, color: T.text2, cursor: "pointer", fontFamily: T.sans }}>{q}</button>
            ))}
          </div>
        )}
        <div style={{ padding: "10px 14px", borderTop: `1px solid ${T.border}`, display: "flex", gap: 8 }}>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Ask anything..."
            style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.surface2, color: T.text, fontSize: 13, fontFamily: T.sans, outline: "none" }} />
          <button onClick={send} disabled={loading || !input.trim()} style={{ padding: "10px 14px", borderRadius: 8, border: "none", background: loading ? T.surface2 : T.purple, color: "#fff", cursor: loading ? "not-allowed" : "pointer", fontSize: 13 }}>↑</button>
        </div>
      </div>
    )}
  </>);
}

// ─── Auth Page ────────────────────────────────────────────────────────────────
function AuthPage({ onLogin, T }) {
  const [mode, setMode] = useState("login");
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [signupData, setSignupData] = useState({ name: "", company: "", email: "", password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const handleLogin = (e) => {
    e.preventDefault(); setError("");
    if (!loginData.email || !loginData.password) { setError("Please enter email and password."); return; }
    const storedUser = JSON.parse(localStorage.getItem("cashops_user_" + loginData.email) || "null");
    if (storedUser && storedUser.password === loginData.password) { localStorage.setItem("cashops_session", loginData.email); onLogin(storedUser); }
    else setError("Invalid credentials.");
  };
  const handleSignup = (e) => {
    e.preventDefault(); setError("");
    if (!signupData.name || !signupData.company || !signupData.email || !signupData.password || !signupData.confirmPassword) { setError("Please fill all fields."); return; }
    if (signupData.password !== signupData.confirmPassword) { setError("Passwords do not match."); return; }
    const u = { name: signupData.name, company: signupData.company, email: signupData.email, password: signupData.password };
    localStorage.setItem("cashops_user_" + signupData.email, JSON.stringify(u));
    localStorage.setItem("cashops_session", signupData.email);
    onLogin(u);
  };
  const handleDemo = () => onLogin(DEMO_USER);
  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(135deg, ${T.bg} 0%, #0b1322 100%)`, color: T.text, fontFamily: T.sans, display: "grid", gridTemplateColumns: "1.1fr 0.9fr" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap'); * { box-sizing: border-box; margin: 0; padding: 0; } body { background: ${T.bg}; } @keyframes spin { to { transform: rotate(360deg); } } @keyframes blink { 0%,100%{opacity:1}50%{opacity:.2} } @keyframes slideUp { from { opacity:0; transform: translateY(10px); } to { opacity:1; transform: translateY(0); } }`}</style>
      <div style={{ padding: "56px 64px", display: "flex", flexDirection: "column", justifyContent: "space-between", borderRight: `1px solid ${T.border}`, background: `radial-gradient(circle at top left, ${T.greenDim}, transparent 28%), ${T.bg}` }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: T.green, display: "inline-block" }} />
            <span style={{ fontFamily: T.mono, color: T.green, letterSpacing: 2, fontSize: 14 }}>CASHOPS // WAR ROOM</span>
          </div>
          <h1 style={{ fontSize: 44, lineHeight: 1.1, marginBottom: 18 }}>Smarter short-term<br />cash decisions.</h1>
          <p style={{ color: T.text2, fontSize: 15, lineHeight: 1.8, maxWidth: 520 }}>Monitor obligations, forecast runway, ingest financial documents, and generate AI-backed actions before liquidity risk turns into a crisis.</p>
          {/* Demo CTA */}
          <div style={{ marginTop: 32, background: T.purpleDim, border: `1px solid ${T.purple}44`, borderRadius: 12, padding: "18px 20px" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.purple, marginBottom: 6 }}>👀 Want to see it in action first?</div>
            <div style={{ fontSize: 13, color: T.text2, marginBottom: 12 }}>Try the demo with pre-filled sample data — no signup needed.</div>
            <button onClick={handleDemo} style={{ padding: "10px 20px", borderRadius: 8, border: `1px solid ${T.purple}`, background: T.purpleDim, color: T.purple, fontWeight: 700, cursor: "pointer", fontSize: 13, fontFamily: T.mono }}>Try Demo Mode →</button>
          </div>
        </div>
        <div style={{ display: "grid", gap: 12 }}>
          {[["Liquidity Radar", "See upcoming obligations before they hit"], ["AI Actions", "Generate negotiation and payment strategies"], ["What-If Simulator", "Defer obligations and see runway impact instantly"]].map(([title, desc]) => (
            <div key={title} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>{title}</div>
              <div style={{ color: T.text2, fontSize: 13 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
        <div style={{ width: "100%", maxWidth: 420, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 28, boxShadow: "0 20px 60px rgba(0,0,0,.25)" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
            {[["login", "Login", T.green], ["signup", "Sign Up", T.blue]].map(([m, label, color]) => (
              <button key={m} onClick={() => { setMode(m); setError(""); }} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: `1px solid ${mode === m ? color : T.border}`, background: mode === m ? color + "22" : "transparent", color: mode === m ? color : T.text2, cursor: "pointer", fontFamily: T.mono, fontSize: 12 }}>{label}</button>
            ))}
          </div>
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 26, fontWeight: 600, marginBottom: 6 }}>{mode === "login" ? "Welcome back" : "Create your account"}</div>
            <div style={{ color: T.text2, fontSize: 13 }}>{mode === "login" ? "Login to access your dashboard." : "Set up your business workspace."}</div>
          </div>
          {error && <div style={{ marginBottom: 16, background: T.redDim, border: `1px solid ${T.red}44`, color: T.red, padding: "10px 12px", borderRadius: 8, fontSize: 13 }}>{error}</div>}
          {mode === "login" ? (
            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <InputField T={T} label="Email" type="email" placeholder="founder@company.com" value={loginData.email} onChange={e => setLoginData({ ...loginData, email: e.target.value })} />
              <InputField T={T} label="Password" type="password" placeholder="Enter password" value={loginData.password} onChange={e => setLoginData({ ...loginData, password: e.target.value })} />
              <button type="submit" style={{ marginTop: 6, padding: "12px 16px", border: "none", borderRadius: 8, background: T.green, color: "#06210f", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>Login →</button>
            </form>
          ) : (
            <form onSubmit={handleSignup} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <InputField T={T} label="Full Name" placeholder="Priya Mehta" value={signupData.name} onChange={e => setSignupData({ ...signupData, name: e.target.value })} />
              <InputField T={T} label="Company" placeholder="Meridian Supplies Pvt Ltd" value={signupData.company} onChange={e => setSignupData({ ...signupData, company: e.target.value })} />
              <InputField T={T} label="Email" type="email" placeholder="founder@company.com" value={signupData.email} onChange={e => setSignupData({ ...signupData, email: e.target.value })} />
              <InputField T={T} label="Password" type="password" placeholder="Create password" value={signupData.password} onChange={e => setSignupData({ ...signupData, password: e.target.value })} />
              <InputField T={T} label="Confirm Password" type="password" placeholder="Re-enter password" value={signupData.confirmPassword} onChange={e => setSignupData({ ...signupData, confirmPassword: e.target.value })} />
              <button type="submit" style={{ marginTop: 6, padding: "12px 16px", border: "none", borderRadius: 8, background: T.blue, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>Create Account →</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ setPage, setSelectedObligation, userData, healthScore, whatIfDelays, onDelaysChange, onDataChange, user, T, toast }) {
  const { obligations, receivables, cashBalance } = userData;
  const [editingCash, setEditingCash] = useState(false);
  const [cashInput, setCashInput] = useState("");
  const [aiInsight, setAiInsight] = useState("");
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightLoaded, setInsightLoaded] = useState(false);

  const activeObs = obligations.filter(o => !o.paid);
  const totalObl = activeObs.reduce((s, o) => s + o.amount, 0);
  const totalRec = receivables.reduce((s, r) => s + r.amount, 0);
  const shortfall = Math.max(0, totalObl - cashBalance);
  const daysToZero = totalObl > 0 ? Math.floor(cashBalance / (totalObl / 30)) : 60;
  const dtzColor = daysToZero < 10 ? T.red : daysToZero < 20 ? T.amber : T.green;

  // Due date warnings
  const urgentObs = activeObs.filter(o => { const d = daysUntil(o.due); return d >= 0 && d <= 3; });

  const saveCash = () => {
    const val = parseFloat(cashInput.replace(/[^0-9.]/g, ""));
    if (!isNaN(val) && val >= 0) { onDataChange({ ...userData, cashBalance: val }); toast("Cash balance updated"); }
    setEditingCash(false); setCashInput("");
  };

  const generateInsight = async () => {
    setInsightLoading(true); setAiInsight("");
    const sys = `You are a sharp financial advisor. Give a 3-sentence executive summary of this business's cash situation, ending with the single most important action they should take today. Be direct and specific. No fluff.`;
    const prompt = `Company: ${user.company}. Cash: ${fmt(cashBalance)}. Active obligations: ${fmt(totalObl)} (${activeObs.length} items). Receivables: ${fmt(totalRec)}. Shortfall: ${fmt(shortfall)}. Runway: ${daysToZero} days. Health score: ${healthScore}/100. Most urgent obligation: ${urgentObs[0]?.name || "none"} due in ${urgentObs[0] ? daysUntil(urgentObs[0].due) : "N/A"} days.`;
    await callGemini(sys, prompt, t => setAiInsight(t));
    setInsightLoading(false); setInsightLoaded(true);
  };

  const isEmpty = obligations.length === 0 && receivables.length === 0 && cashBalance === 0;
  if (isEmpty) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 400, gap: 24, textAlign: "center" }}>
      <div style={{ fontSize: 48 }}>🚀</div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 600, marginBottom: 8, color: T.text }}>Welcome, {user?.name?.split(" ")[0]}!</div>
        <div style={{ fontSize: 14, color: T.text2, maxWidth: 420, lineHeight: 1.7 }}>Your dashboard is empty. Start by setting your cash balance, then add obligations or upload documents.</div>
      </div>
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 24, width: "100%", maxWidth: 400 }}>
        <div style={{ fontSize: 11, fontFamily: T.mono, color: T.text2, letterSpacing: 2, marginBottom: 12 }}>STEP 1 — SET YOUR CASH BALANCE</div>
        <div style={{ display: "flex", gap: 10 }}>
          <input value={cashInput} onChange={e => setCashInput(e.target.value)} placeholder="e.g. 500000" onKeyDown={e => e.key === "Enter" && saveCash()}
            style={{ flex: 1, padding: "12px 14px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.surface2, color: T.text, fontSize: 14, fontFamily: T.sans }} />
          <button onClick={saveCash} style={{ padding: "12px 18px", borderRadius: 8, border: "none", background: T.green, color: "#06210f", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>Set ₹</button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, width: "100%", maxWidth: 400 }}>
        <button onClick={() => setPage("obligations")} style={{ padding: "14px 0", borderRadius: 10, border: `1px solid ${T.border}`, background: T.surface, color: T.text, cursor: "pointer", fontSize: 13 }}>
          <div style={{ fontSize: 24, marginBottom: 6 }}>◈</div>Add Obligations
        </button>
        <button onClick={() => setPage("ingest")} style={{ padding: "14px 0", borderRadius: 10, border: `1px solid ${T.border}`, background: T.surface, color: T.text, cursor: "pointer", fontSize: 13 }}>
          <div style={{ fontSize: 24, marginBottom: 6 }}>↑</div>Upload Documents
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Due soon warning */}
      {urgentObs.length > 0 && (
        <div style={{ background: T.amberDim, border: `1px solid ${T.amber}44`, borderRadius: 10, padding: "12px 18px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 16 }}>⏰</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: T.amber }}>Due within 3 days:</span>
          {urgentObs.map(o => (
            <span key={o.id} style={{ fontSize: 12, background: T.amber + "22", color: T.amber, padding: "3px 10px", borderRadius: 6, fontFamily: T.mono }}>
              {o.name} — {daysUntil(o.due) === 0 ? "TODAY" : `${daysUntil(o.due)}d`}
            </span>
          ))}
        </div>
      )}

      {shortfall > 0 && (
        <div style={{ background: T.redDim, border: `1px solid ${T.red}44`, borderRadius: 10, padding: "14px 18px", display: "flex", gap: 14, alignItems: "flex-start" }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>⚠</span>
          <div>
            <div style={{ fontWeight: 600, color: T.red, marginBottom: 4, fontSize: 14 }}>Liquidity Shortfall Detected</div>
            <div style={{ fontSize: 13, color: T.text2, lineHeight: 1.6 }}>Obligations of <strong style={{ color: T.text }}>{fmtL(totalObl)}</strong> exceed cash of <strong style={{ color: T.text }}>{fmtL(cashBalance)}</strong>. Shortfall: <strong style={{ color: T.red }}>{fmtL(shortfall)}</strong>.</div>
          </div>
          <button onClick={() => setPage("decisions")} style={{ marginLeft: "auto", flexShrink: 0, background: T.red, color: "#fff", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 12, fontFamily: T.mono, cursor: "pointer", whiteSpace: "nowrap" }}>View Actions →</button>
        </div>
      )}

      {/* AI Weekly Insight */}
      <div style={{ background: T.surface, border: `1px solid ${T.purple}44`, borderRadius: 10, padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: insightLoaded || insightLoading ? 12 : 0 }}>
          <span style={{ fontSize: 11, fontFamily: T.mono, color: T.purple, letterSpacing: 2, textTransform: "uppercase" }}>🤖 AI Situation Briefing</span>
          <button onClick={generateInsight} disabled={insightLoading} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontFamily: T.mono, padding: "6px 12px", borderRadius: 6, border: `1px solid ${T.purple}55`, background: insightLoading ? T.surface2 : T.purpleDim, color: T.purple, cursor: insightLoading ? "not-allowed" : "pointer" }}>
            {insightLoading ? <><Spinner T={T} /> Analysing…</> : insightLoaded ? "Refresh ↺" : "Generate Briefing ↗"}
          </button>
        </div>
        {aiInsight && <div style={{ fontSize: 13, color: T.text2, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{aiInsight}</div>}
        {!aiInsight && !insightLoading && <div style={{ fontSize: 12, color: T.text3 }}>Click "Generate Briefing" for an AI summary of your current financial position and top recommended action.</div>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 300px", gap: 12 }}>
        {/* Editable cash balance */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "18px 20px", borderTop: `2px solid ${T.amber}` }}>
          <div style={{ fontSize: 10, color: T.text3, fontFamily: T.mono, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            Cash Balance
            <button onClick={() => { setEditingCash(true); setCashInput(String(cashBalance)); }} style={{ fontSize: 10, color: T.amber, background: "none", border: "none", cursor: "pointer", fontFamily: T.mono }}>edit</button>
          </div>
          {editingCash ? (
            <div style={{ display: "flex", gap: 6 }}>
              <input autoFocus value={cashInput} onChange={e => setCashInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") saveCash(); if (e.key === "Escape") setEditingCash(false); }}
                style={{ flex: 1, padding: "6px 8px", borderRadius: 6, border: `1px solid ${T.amber}`, background: T.surface2, color: T.text, fontSize: 13, fontFamily: T.mono, width: 0 }} />
              <button onClick={saveCash} style={{ padding: "6px 10px", borderRadius: 6, border: "none", background: T.amber, color: "#000", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>✓</button>
            </div>
          ) : (
            <div style={{ fontSize: 28, fontWeight: 600, fontFamily: T.mono, color: T.amber, letterSpacing: -1 }}>{fmtL(cashBalance)}</div>
          )}
          <div style={{ fontSize: 11, color: T.text2, marginTop: 4 }}>click edit to update</div>
        </div>
        <MetricCard T={T} label="Days to Zero" value={daysToZero + "d"} sub="at current burn" valueColor={dtzColor} accent={dtzColor} />
        <MetricCard T={T} label="Active Obligations" value={fmtL(totalObl)} sub={`${activeObs.length} unpaid · ${obligations.filter(o=>o.paid).length} paid`} valueColor={T.red} accent={T.red} />
        <MetricCard T={T} label="Receivables" value={fmtL(totalRec)} sub={`${receivables.length} invoices pending`} valueColor={T.green} accent={T.green} />
        <HealthScoreWidget score={healthScore} T={T} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <span style={{ fontSize: 11, fontFamily: T.mono, color: T.text2, letterSpacing: 2, textTransform: "uppercase" }}>Obligation Radar</span>
            <button onClick={() => setPage("obligations")} style={{ fontSize: 11, color: T.green, background: "none", border: "none", cursor: "pointer", fontFamily: T.mono }}>View All →</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {activeObs.slice(0, 4).map(ob => {
              const days = daysUntil(ob.due);
              const urgent = days >= 0 && days <= 3;
              return (
                <div key={ob.id} onClick={() => { setSelectedObligation(ob); setPage("decisions"); }}
                  style={{ display: "grid", gridTemplateColumns: "80px 1fr 100px 90px", alignItems: "center", gap: 10, padding: "10px 12px", background: urgent ? T.amberDim : T.surface2, borderRadius: 7, borderLeft: `3px solid ${urgent ? T.amber : priorityColor(ob.priority, T)}`, cursor: "pointer" }}
                  onMouseEnter={e => e.currentTarget.style.background = T.surface3}
                  onMouseLeave={e => e.currentTarget.style.background = urgent ? T.amberDim : T.surface2}>
                  <span style={{ fontSize: 11, color: urgent ? T.amber : T.text2, fontFamily: T.mono, fontWeight: urgent ? 700 : 400 }}>
                    {days === 0 ? "TODAY" : days < 0 ? "OVERDUE" : `${days}d`}
                  </span>
                  <div><div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{ob.name}</div><div style={{ fontSize: 11, color: T.text2 }}>{ob.payee}</div></div>
                  <span style={{ fontSize: 13, fontFamily: T.mono, fontWeight: 700, color: priorityColor(ob.priority, T), textAlign: "right" }}>{fmtL(ob.amount)}</span>
                  <Badge priority={ob.priority} T={T} />
                </div>
              );
            })}
            {activeObs.length === 0 && <div style={{ color: T.text3, fontSize: 13, textAlign: "center", padding: 20 }}>All obligations paid! 🎉</div>}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 11, fontFamily: T.mono, color: T.text2, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>Risk Radar</div>
            {[
              ["Penalty Risk", Math.min(100, activeObs.filter(o => o.priority === "critical").length * 30), T.red],
              ["Solvency", totalObl > 0 ? Math.min(100, Math.floor(cashBalance / totalObl * 100)) : 100, T.green],
              ["Receivable Quality", Math.round(receivables.reduce((s,r)=>s+(r.confidence/100*r.amount),0) / Math.max(1,totalRec) * 100), T.blue],
              ["Urgency", Math.min(100, urgentObs.length * 33), T.amber],
            ].map(([label, pct, color]) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: T.text2, fontFamily: T.mono, width: 110, flexShrink: 0 }}>{label}</span>
                <div style={{ flex: 1, height: 5, background: T.border, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 11, fontFamily: T.mono, color, width: 30, textAlign: "right" }}>{pct}%</span>
              </div>
            ))}
          </div>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 11, fontFamily: T.mono, color: T.text2, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>Paid History</div>
            {obligations.filter(o => o.paid).length === 0 ? (
              <div style={{ fontSize: 12, color: T.text3 }}>No paid obligations yet.</div>
            ) : obligations.filter(o => o.paid).slice(-3).map(o => (
              <div key={o.id} style={{ fontSize: 12, color: T.text2, padding: "5px 0", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between" }}>
                <span>{o.name}</span><span style={{ color: T.green, fontFamily: T.mono }}>✓ {fmtL(o.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <WhatIfSimulator obligations={obligations} cashBalance={cashBalance} receivables={receivables} onDelaysChange={onDelaysChange} T={T} />

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
          <span style={{ fontSize: 11, fontFamily: T.mono, color: T.text2, letterSpacing: 2, textTransform: "uppercase" }}>Expected Receivables</span>
          <span style={{ fontSize: 11, color: T.text2, fontFamily: T.mono }}>Total: {fmtL(totalRec)}</span>
        </div>
        {receivables.length === 0 ? (
          <div style={{ textAlign: "center", color: T.text3, fontSize: 13, padding: "20px 0" }}>No receivables added yet.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
            {receivables.map(r => (
              <div key={r.id} style={{ background: T.surface2, borderRadius: 8, padding: 14, border: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, color: T.text }}>{r.client}</div>
                <div style={{ fontSize: 22, fontFamily: T.mono, color: T.green, marginBottom: 6 }}>{fmtL(r.amount)}</div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.text2 }}>
                  <span>Expected: {r.expected?.slice(5)}</span>
                  <span style={{ color: r.confidence > 75 ? T.green : r.confidence > 50 ? T.amber : T.red }}>{r.confidence}%</span>
                </div>
                <div style={{ background: T.border, borderRadius: 3, height: 3, marginTop: 8 }}>
                  <div style={{ width: `${r.confidence}%`, height: "100%", background: r.confidence > 75 ? T.green : T.amber, borderRadius: 3 }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Obligations Page ─────────────────────────────────────────────────────────
function ObligationsPage({ setPage, setSelectedObligation, userData, onDataChange, T, toast }) {
  const { obligations } = userData;
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("due");
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState(null);
  const blank = { name: "", payee: "", amount: "", due: "", priority: "medium", flexibility: "negotiable", penalty: "", category: "vendor", relationship: "supplier" };
  const [form, setForm] = useState(blank);

  const filtered = obligations
    .filter(o => filter === "paid" ? o.paid : filter === "all" ? !o.paid : (!o.paid && o.priority === filter))
    .sort((a, b) => sort === "amount" ? b.amount - a.amount : a.due.localeCompare(b.due));

  const saveObligation = () => {
    if (!form.name || !form.amount || !form.due) return;
    let updated;
    if (editId) {
      updated = obligations.map(o => o.id === editId ? { ...o, ...form, amount: parseFloat(form.amount) } : o);
      toast("Obligation updated");
    } else {
      updated = [...obligations, { ...form, id: Date.now(), amount: parseFloat(form.amount), paid: false }];
      toast("Obligation added");
    }
    onDataChange({ ...userData, obligations: updated });
    setShowAdd(false); setEditId(null); setForm(blank);
  };

  const startEdit = (ob) => {
    setForm({ name: ob.name, payee: ob.payee, amount: String(ob.amount), due: ob.due, priority: ob.priority, flexibility: ob.flexibility, penalty: ob.penalty || "", category: ob.category, relationship: ob.relationship });
    setEditId(ob.id); setShowAdd(true);
  };

  const deleteObligation = (id) => { onDataChange({ ...userData, obligations: obligations.filter(o => o.id !== id) }); toast("Obligation deleted", "error"); };

  const markPaid = (id) => {
    const updated = obligations.map(o => o.id === id ? { ...o, paid: true } : o);
    onDataChange({ ...userData, obligations: updated }); toast("Marked as paid ✓");
  };

  const markUnpaid = (id) => {
    const updated = obligations.map(o => o.id === id ? { ...o, paid: false } : o);
    onDataChange({ ...userData, obligations: updated });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 11, fontFamily: T.mono, color: T.text2, letterSpacing: 2, textTransform: "uppercase" }}>Obligations · {obligations.length} total · {obligations.filter(o=>o.paid).length} paid</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {["all", "critical", "high", "medium", "low", "paid"].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ fontSize: 11, fontFamily: T.mono, padding: "5px 12px", borderRadius: 5, border: `1px solid ${filter === f ? (f === "paid" ? T.green : priorityColor(f === "all" ? "medium" : f, T)) : T.border}`, background: filter === f ? (f === "paid" ? T.greenDim : priorityBg(f === "all" ? "medium" : f, T)) : "none", color: filter === f ? (f === "paid" ? T.green : priorityColor(f === "all" ? "medium" : f, T)) : T.text2, cursor: "pointer", textTransform: "uppercase", letterSpacing: 1 }}>{f}</button>
          ))}
          <button onClick={() => setSort(s => s === "due" ? "amount" : "due")} style={{ fontSize: 11, fontFamily: T.mono, padding: "5px 12px", borderRadius: 5, border: `1px solid ${T.border}`, background: "none", color: T.text2, cursor: "pointer" }}>Sort: {sort === "due" ? "Date" : "Amount"}</button>
          <button onClick={() => { setShowAdd(s => !s); setEditId(null); setForm(blank); }} style={{ fontSize: 11, fontFamily: T.mono, padding: "5px 14px", borderRadius: 5, border: `1px solid ${T.green}55`, background: T.greenDim, color: T.green, cursor: "pointer" }}>+ Add</button>
        </div>
      </div>

      {showAdd && (
        <div style={{ background: T.surface, border: `1px solid ${T.green}44`, borderRadius: 10, padding: 18 }}>
          <div style={{ fontSize: 11, fontFamily: T.mono, color: T.green, letterSpacing: 2, marginBottom: 14 }}>{editId ? "EDIT OBLIGATION" : "NEW OBLIGATION"}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 12 }}>
            <InputField T={T} label="Name" placeholder="e.g. Rent Payment" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <InputField T={T} label="Payee" placeholder="e.g. Landlord Name" value={form.payee} onChange={e => setForm({ ...form, payee: e.target.value })} />
            <InputField T={T} label="Amount (₹)" type="number" placeholder="100000" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
            <InputField T={T} label="Due Date" type="date" value={form.due} onChange={e => setForm({ ...form, due: e.target.value })} />
            <SelectField T={T} label="Priority" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} options={["critical", "high", "medium", "low"]} />
            <InputField T={T} label="Flexibility" placeholder="e.g. 7 days grace" value={form.flexibility} onChange={e => setForm({ ...form, flexibility: e.target.value })} />
            <InputField T={T} label="Penalty" placeholder="e.g. Late fee ₹2,000" value={form.penalty} onChange={e => setForm({ ...form, penalty: e.target.value })} />
            <SelectField T={T} label="Relationship" value={form.relationship} onChange={e => setForm({ ...form, relationship: e.target.value })} options={["government", "employees", "landlord", "supplier", "bank", "vendor"]} />
            <SelectField T={T} label="Category" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} options={["statutory", "payroll", "rent", "vendor", "loan", "opex", "other"]} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={saveObligation} style={{ padding: "10px 20px", borderRadius: 7, border: "none", background: T.green, color: "#06210f", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>{editId ? "Save Changes" : "Add Obligation"}</button>
            <button onClick={() => { setShowAdd(false); setEditId(null); setForm(blank); }} style={{ padding: "10px 20px", borderRadius: 7, border: `1px solid ${T.border}`, background: "none", color: T.text2, cursor: "pointer", fontSize: 13 }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "90px 1fr 110px 90px 100px 100px 36px", gap: 10, padding: "10px 16px", borderBottom: `1px solid ${T.border}`, fontSize: 10, color: T.text3, fontFamily: T.mono, letterSpacing: 1, textTransform: "uppercase" }}>
          <span>Due</span><span>Obligation</span><span style={{ textAlign: "right" }}>Amount</span><span>Priority</span><span>Status</span><span>Actions</span><span></span>
        </div>
        {filtered.length === 0 && <div style={{ textAlign: "center", padding: "30px 0", color: T.text3, fontSize: 13 }}>No obligations in this category.</div>}
        {filtered.map((ob, i) => {
          const days = daysUntil(ob.due);
          const urgent = !ob.paid && days >= 0 && days <= 3;
          return (
            <div key={ob.id} style={{ display: "grid", gridTemplateColumns: "90px 1fr 110px 90px 100px 100px 36px", gap: 10, padding: "13px 16px", borderBottom: i < filtered.length - 1 ? `1px solid ${T.border}` : "none", alignItems: "center", borderLeft: `3px solid ${ob.paid ? T.green : priorityColor(ob.priority, T)}`, background: ob.paid ? T.greenDim : urgent ? T.amberDim : i % 2 === 0 ? "transparent" : T.surface2 + "44", opacity: ob.paid ? 0.7 : 1 }}>
              <span style={{ fontSize: 11, color: urgent ? T.amber : T.text2, fontFamily: T.mono, fontWeight: urgent ? 700 : 400 }}>
                {ob.paid ? "PAID" : days < 0 ? "OVERDUE" : days === 0 ? "TODAY" : ob.due.slice(5)}
              </span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: T.text, textDecoration: ob.paid ? "line-through" : "none" }}>{ob.name}</div>
                <div style={{ fontSize: 11, color: T.text2 }}>{ob.payee}</div>
              </div>
              <span style={{ fontSize: 14, fontFamily: T.mono, fontWeight: 700, color: ob.paid ? T.green : priorityColor(ob.priority, T), textAlign: "right" }}>{fmt(ob.amount)}</span>
              <Badge priority={ob.priority} T={T} />
              <span style={{ fontSize: 11, color: T.text2 }}>{ob.flexibility}</span>
              <div style={{ display: "flex", gap: 4 }}>
                {!ob.paid ? (
                  <>
                    <button onClick={() => markPaid(ob.id)} title="Mark as paid" style={{ padding: "5px 8px", borderRadius: 5, border: `1px solid ${T.green}44`, background: T.greenDim, color: T.green, cursor: "pointer", fontSize: 11, fontFamily: T.mono }}>✓ Paid</button>
                    <button onClick={() => startEdit(ob)} title="Edit" style={{ padding: "5px 8px", borderRadius: 5, border: `1px solid ${T.border}`, background: "none", color: T.text2, cursor: "pointer", fontSize: 11 }}>✎</button>
                  </>
                ) : (
                  <button onClick={() => markUnpaid(ob.id)} style={{ padding: "5px 8px", borderRadius: 5, border: `1px solid ${T.border}`, background: "none", color: T.text2, cursor: "pointer", fontSize: 10, fontFamily: T.mono }}>Undo</button>
                )}
              </div>
              <button onClick={() => deleteObligation(ob.id)} style={{ background: T.redDim, border: `1px solid ${T.red}33`, color: T.red, borderRadius: 5, cursor: "pointer", fontSize: 13, padding: "4px 0", width: 28 }}>×</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Decisions Page ───────────────────────────────────────────────────────────
function DecisionsPage({ selectedObligation, setSelectedObligation, userData, T }) {
  const { obligations, cashBalance, receivables } = userData;
  const activeObs = obligations.filter(o => !o.paid);
  const totalObl = activeObs.reduce((s, o) => s + o.amount, 0);
  const totalRec = receivables.reduce((s, r) => s + r.amount, 0);
  const shortfall = Math.max(0, totalObl - cashBalance);
  const [activeOb, setActiveOb] = useState(selectedObligation || activeObs[0]);
  const [emailText, setEmailText] = useState("");
  const [cotText, setCotText] = useState("");
  const [loading, setLoading] = useState(false);
  const [cotLoading, setCotLoading] = useState(false);
  const [generated, setGenerated] = useState(false);
  const emailRef = useRef(null);
  useEffect(() => { if (selectedObligation) setActiveOb(selectedObligation); }, [selectedObligation]);
  useEffect(() => { if (!activeOb && activeObs.length) setActiveOb(activeObs[0]); }, [obligations]);

  const generateEmail = async () => {
    if (!activeOb) return;
    setLoading(true); setEmailText(""); setGenerated(false);
    const toneMap = { government: "formal, no-negotiation, urgent", employees: "transparent and caring", landlord: "respectful, professional", supplier: "friendly, long-term relationship", bank: "formal and regulatory" };
    const sys = `You are a financial communication expert. Write professional emails for payment deferral. Be concise and relationship-preserving. Output only the email body.`;
    const prompt = `Write a ${toneMap[activeOb.relationship] || "professional"} email for: ${activeOb.name} (${fmt(activeOb.amount)}) due ${activeOb.due} to ${activeOb.payee}. Flexibility: ${activeOb.flexibility}. Context: ${userData.company} faces a ${fmtL(shortfall)} liquidity gap; ${fmtL(totalRec)} receivables expected in 2 weeks. Under 180 words. Sign off as ${userData.name}.`;
    await callGemini(sys, prompt, (t) => { setEmailText(t); if (emailRef.current) emailRef.current.scrollTop = emailRef.current.scrollHeight; });
    setLoading(false); setGenerated(true);
  };

  const generateCOT = async () => {
    if (!activeOb) return;
    setCotLoading(true); setCotText("");
    const sys = `Explain cash decisions in 5 clear numbered steps. No markdown headers.`;
    const prompt = `Why should ${activeOb.name} (${fmt(activeOb.amount)}, priority: ${activeOb.priority}, flexibility: ${activeOb.flexibility}) be handled as recommended? Cash: ${fmtL(cashBalance)}, obligations: ${fmtL(totalObl)}, shortfall: ${fmtL(shortfall)}, receivables: ${fmtL(totalRec)} due in 2 weeks. 1-2 sentences per step.`;
    await callGemini(sys, prompt, t => setCotText(t));
    setCotLoading(false);
  };

  if (!activeOb) return <div style={{ color: T.text2, textAlign: "center", padding: 40 }}>No active obligations. Mark some as unpaid or add new ones.</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 11, fontFamily: T.mono, color: T.text2, letterSpacing: 2, textTransform: "uppercase" }}>AI Decision Engine · Select obligation</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {activeObs.map(ob => (
          <button key={ob.id} onClick={() => { setActiveOb(ob); setEmailText(""); setCotText(""); setGenerated(false); }}
            style={{ padding: "8px 14px", borderRadius: 7, border: `1px solid ${activeOb?.id === ob.id ? priorityColor(ob.priority, T) : T.border}`, background: activeOb?.id === ob.id ? priorityBg(ob.priority, T) : "none", color: activeOb?.id === ob.id ? priorityColor(ob.priority, T) : T.text2, fontSize: 12, cursor: "pointer" }}>{ob.name}</button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: 18, borderLeft: `3px solid ${priorityColor(activeOb.priority, T)}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <div><div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4, color: T.text }}>{activeOb.name}</div><div style={{ fontSize: 12, color: T.text2 }}>{activeOb.payee} · Due {activeOb.due}</div></div>
              <Badge priority={activeOb.priority} T={T} />
            </div>
            {[["Amount", fmt(activeOb.amount)], ["Category", activeOb.category], ["Flexibility", activeOb.flexibility], ["Penalty", activeOb.penalty], ["Relationship", activeOb.relationship]].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "7px 0", borderBottom: `1px solid ${T.border}` }}>
                <span style={{ color: T.text2 }}>{k}</span><span style={{ fontFamily: T.mono, fontSize: 11, color: T.text }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: 18, flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <span style={{ fontSize: 11, fontFamily: T.mono, color: T.text2, letterSpacing: 2, textTransform: "uppercase" }}>Chain-of-Thought Reasoning</span>
              <button onClick={generateCOT} disabled={cotLoading} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontFamily: T.mono, padding: "6px 12px", borderRadius: 6, border: `1px solid ${T.purple}55`, background: cotLoading ? T.surface2 : T.purpleDim, color: T.purple, cursor: cotLoading ? "not-allowed" : "pointer" }}>
                {cotLoading ? <><Spinner T={T} /> Analyzing…</> : "Generate COT ↗"}
              </button>
            </div>
            {cotText ? <div style={{ fontSize: 13, color: T.text2, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{cotText}</div> : <div style={{ textAlign: "center", padding: "30px 0", color: T.text3, fontSize: 13 }}>Click "Generate COT" to see AI reasoning</div>}
          </div>
        </div>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: 18, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontSize: 11, fontFamily: T.mono, color: T.text2, letterSpacing: 2, textTransform: "uppercase" }}>AI-Drafted Email</span>
            <button onClick={generateEmail} disabled={loading} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontFamily: T.mono, padding: "6px 14px", borderRadius: 6, border: `1px solid ${T.green}55`, background: loading ? T.surface2 : T.greenDim, color: T.green, cursor: loading ? "not-allowed" : "pointer" }}>
              {loading ? <><Spinner T={T} /> Writing…</> : generated ? "Regenerate ↗" : "Generate Email ↗"}
            </button>
          </div>
          <div style={{ background: T.surface2, borderRadius: 6, padding: "10px 14px", fontSize: 12, color: T.text2, marginBottom: 12 }}>
            {[["To", activeOb.payee], ["From", `${userData.name}, ${userData.company}`], ["Re", activeOb.name + " — Payment Arrangement"]].map(([k, v]) => (
              <div key={k} style={{ display: "flex", gap: 10, padding: "3px 0" }}>
                <span style={{ color: T.text3, width: 36, flexShrink: 0, fontFamily: T.mono, fontSize: 10 }}>{k}</span>
                <span style={{ color: T.text }}>{v}</span>
              </div>
            ))}
          </div>
          <div ref={emailRef} style={{ flex: 1, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 7, padding: 16, fontSize: 13, lineHeight: 1.9, color: T.text, whiteSpace: "pre-wrap", minHeight: 220, overflowY: "auto", fontFamily: T.sans }}>
            {loading && !emailText ? <div style={{ display: "flex", alignItems: "center", gap: 10, color: T.text2 }}><Spinner T={T} /> Writing…</div> : emailText || <span style={{ color: T.text3 }}>Email will appear here. Tone calibrated for: <strong style={{ color: T.text2 }}>{activeOb.relationship}</strong>.</span>}
          </div>
          {generated && (
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={() => navigator.clipboard.writeText(emailText)} style={{ flex: 1, padding: "9px 0", borderRadius: 6, border: `1px solid ${T.border}`, background: "none", color: T.text2, fontSize: 12, fontFamily: T.mono, cursor: "pointer" }}>📋 Copy</button>
              <button onClick={() => { const s = encodeURIComponent(activeOb.name + " — Payment Arrangement"); const b = encodeURIComponent(emailText); window.open(`mailto:${encodeURIComponent(activeOb.payee)}?subject=${s}&body=${b}`); }} style={{ flex: 1, padding: "9px 0", borderRadius: 6, border: `1px solid ${T.blue}55`, background: T.blueDim, color: T.blue, fontSize: 12, fontFamily: T.mono, cursor: "pointer" }}>✉ Open in Mail</button>
              <button onClick={generateEmail} style={{ flex: 1, padding: "9px 0", borderRadius: 6, border: `1px solid ${T.border}`, background: "none", color: T.text2, fontSize: 12, fontFamily: T.mono, cursor: "pointer" }}>↺ Rephrase</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Forecast Page ────────────────────────────────────────────────────────────
function ForecastPage({ userData, T }) {
  const { obligations, receivables, cashBalance } = userData;
  const activeObs = obligations.filter(o => !o.paid);
  const totalObl = activeObs.reduce((s, o) => s + o.amount, 0);
  const [scenario, setScenario] = useState("base");
  const burnRate = totalObl / 30;
  const scenarios = {
    base: { label: "Base Case", color: T.blue, days: Array.from({ length: 30 }, (_, i) => ({ day: i + 1, balance: Math.max(0, cashBalance - i * burnRate + (i === 10 ? receivables[0]?.amount || 0 : 0) + (i === 15 ? receivables[1]?.amount || 0 : 0)) })) },
    optimistic: { label: "Optimistic", color: T.green, days: Array.from({ length: 30 }, (_, i) => ({ day: i + 1, balance: Math.max(0, cashBalance - i * burnRate * 0.8 + (i === 8 ? receivables[0]?.amount || 0 : 0) + (i === 12 ? receivables[1]?.amount || 0 : 0)) })) },
    pessimistic: { label: "Pessimistic", color: T.red, days: Array.from({ length: 30 }, (_, i) => ({ day: i + 1, balance: Math.max(0, cashBalance - i * burnRate * 1.2 + (i === 18 ? receivables[0]?.amount || 0 : 0)) })) },
  };
  const active = scenarios[scenario];
  const maxBal = Math.max(...active.days.map(d => d.balance), 1);
  const minBal = Math.min(...active.days.map(d => d.balance));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 11, fontFamily: T.mono, color: T.text2, letterSpacing: 2, textTransform: "uppercase" }}>30-Day Cash Forecast</div>
        <div style={{ display: "flex", gap: 8 }}>
          {Object.entries(scenarios).map(([key, s]) => (
            <button key={key} onClick={() => setScenario(key)} style={{ fontSize: 11, fontFamily: T.mono, padding: "5px 12px", borderRadius: 5, border: `1px solid ${scenario === key ? s.color : T.border}`, background: scenario === key ? s.color + "22" : "none", color: scenario === key ? s.color : T.text2, cursor: "pointer" }}>{s.label}</button>
          ))}
        </div>
      </div>
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 160, position: "relative" }}>
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, borderTop: `1px dashed ${T.red}44` }} />
          {active.days.map((d, i) => {
            const pct = (d.balance / maxBal) * 100;
            return <div key={i} title={`Day ${d.day}: ${fmt(d.balance)}`} style={{ flex: 1, height: `${Math.max(2, pct)}%`, background: d.balance < 100000 ? T.red + "88" : active.color + "66", borderRadius: "2px 2px 0 0", transition: ".3s" }} />;
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: T.text3, fontFamily: T.mono, marginTop: 6 }}>
          <span>Day 1</span><span>Day 10</span><span>Day 20</span><span>Day 30</span>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        <MetricCard T={T} label="Peak Balance" value={fmtL(maxBal)} valueColor={active.color} />
        <MetricCard T={T} label="Minimum Balance" value={fmtL(minBal)} valueColor={minBal < 50000 ? T.red : T.amber} />
        <MetricCard T={T} label="End of Period" value={fmtL(active.days[29].balance)} valueColor={active.color} />
      </div>
    </div>
  );
}

// ─── Ingest Page ──────────────────────────────────────────────────────────────
function IngestPage({ userData, onDataChange, T, toast }) {
  const [stage, setStage] = useState("idle");
  const [result, setResult] = useState(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);

  const processFile = async (file) => {
    setStage("reading");
    const reader = new FileReader();
    reader.onload = async (e) => {
      setStage("analyzing");
      const isImage = file.type.startsWith("image/");
      const isPdf = file.type === "application/pdf";
      let content = "";
      const sys = `You are a financial document parser. Extract all financial data and return ONLY a valid JSON object with exactly these fields: type, vendor, amount, date, category, description, paymentStatus. Use actual values, never return null. No markdown, no code fences.`;
      if (isImage || isPdf) {
        const base64 = e.target.result.split(",")[1];
        const res = await fetch("/api/gemini/vision", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ system: sys, base64, mimeType: file.type }) });
        const d = await res.json(); content = d.text || "{}";
      } else {
        const text = e.target.result;
        const res = await fetch("/api/gemini/text", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ system: sys, text: text.slice(0, 3000) }) });
        const d = await res.json(); content = d.text || "{}";
      }
      try {
        const clean = content.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(clean);
        Object.keys(parsed).forEach(k => { if (parsed[k] === null || parsed[k] === undefined) parsed[k] = "—"; });
        setResult(parsed);
      } catch {
        setResult({ type: "invoice", vendor: file.name, amount: "—", date: new Date().toISOString().slice(0, 10), category: "unknown", description: "Could not parse. Review manually.", paymentStatus: "unknown" });
      }
      setStage("done");
    };
    if (file.type.startsWith("image/") || file.type === "application/pdf") reader.readAsDataURL(file);
    else reader.readAsText(file);
  };

  const addToModel = () => {
    if (!result) return;
    const amount = parseFloat(String(result.amount).replace(/[^0-9.]/g, "")) || 0;
    if (amount > 0) {
      const newOb = { id: Date.now(), name: result.description || result.vendor, payee: result.vendor, amount, due: result.date || new Date().toISOString().slice(0, 10), priority: "medium", flexibility: "negotiable", penalty: "—", category: result.category || "vendor", relationship: "supplier", paid: false };
      onDataChange({ ...userData, obligations: [...userData.obligations, newOb], ingestedDocs: [...(userData.ingestedDocs || []), result] });
      setResult(null); setStage("idle");
      toast("Added to your cash model!");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 11, fontFamily: T.mono, color: T.text2, letterSpacing: 2, textTransform: "uppercase" }}>Document Ingestion · AI Extraction</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) processFile(f); }}
            onClick={() => fileRef.current.click()}
            style={{ border: `2px dashed ${dragging ? T.green : T.border}`, borderRadius: 12, padding: "40px 20px", textAlign: "center", cursor: "pointer", background: dragging ? T.greenDim : T.surface }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📄</div>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6, color: T.text }}>Drop document here</div>
            <div style={{ fontSize: 12, color: T.text2, marginBottom: 16 }}>or click to browse files</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
              {["Bank Statement", "Invoice PDF", "Receipt Photo", "CSV Export"].map(t => (
                <span key={t} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 4, border: `1px solid ${T.border}`, color: T.text2, fontFamily: T.mono }}>{t}</span>
              ))}
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*,.pdf,.csv,.txt" style={{ display: "none" }} onChange={e => e.target.files[0] && processFile(e.target.files[0])} />
          {stage !== "idle" && (
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16 }}>
              {[["reading", "Reading file…", T.blue], ["analyzing", "AI extracting financial data…", T.purple], ["done", "Extraction complete", T.green]].map(([s, label, color]) => (
                <div key={s} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", opacity: stage === s ? 1 : stage === "done" ? 0.5 : 0.3 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: stage === s ? color : T.text3, flexShrink: 0, ...(stage === s && s !== "done" ? { animation: "blink 1s infinite" } : {}) }} />
                  <span style={{ fontSize: 12, color: stage === s ? color : T.text3 }}>{label}</span>
                </div>
              ))}
            </div>
          )}
          {userData.ingestedDocs?.length > 0 && (
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 10, color: T.text3, fontFamily: T.mono, letterSpacing: 2, marginBottom: 10 }}>PREVIOUSLY INGESTED ({userData.ingestedDocs.length})</div>
              {userData.ingestedDocs.slice(-3).map((d, i) => (
                <div key={i} style={{ fontSize: 12, color: T.text2, padding: "5px 0", borderBottom: `1px solid ${T.border}` }}>{d.vendor} · {d.amount} · {d.date}</div>
              ))}
            </div>
          )}
        </div>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: 18 }}>
          <div style={{ fontSize: 11, fontFamily: T.mono, color: T.text2, letterSpacing: 2, textTransform: "uppercase", marginBottom: 14 }}>Extracted Data</div>
          {result ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {Object.entries(result).map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "9px 0", borderBottom: `1px solid ${T.border}` }}>
                  <span style={{ color: T.text2, textTransform: "capitalize" }}>{k.replace(/([A-Z])/g, " $1")}</span>
                  <span style={{ fontFamily: T.mono, fontSize: 12, color: T.text, maxWidth: "60%", textAlign: "right" }}>{String(v)}</span>
                </div>
              ))}
              <button onClick={addToModel} style={{ marginTop: 16, padding: "10px 0", borderRadius: 7, border: `1px solid ${T.green}55`, background: T.greenDim, color: T.green, fontSize: 12, fontFamily: T.mono, cursor: "pointer" }}>+ Add to Cash Model</button>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "50px 0", color: T.text3, fontSize: 13 }}>Upload a document to see AI-extracted data here</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [darkMode, setDarkMode] = useState(true);
  const T = darkMode ? DARK : LIGHT;
  const [page, setPage] = useState("dashboard");
  const [selectedObligation, setSelectedObligation] = useState(null);
  const [whatIfDelays, setWhatIfDelays] = useState({});
  const { toasts, toast } = useToast();
  const [user, setUser] = useState(() => {
    const email = localStorage.getItem("cashops_session");
    if (!email) return null;
    if (email === "demo") return DEMO_USER;
    return JSON.parse(localStorage.getItem("cashops_user_" + email) || "null");
  });
  const [userData, setUserData] = useState(() => {
    const email = localStorage.getItem("cashops_session");
    if (!email) return null;
    if (email === "demo") return { obligations: DEMO_OBLIGATIONS, receivables: DEMO_RECEIVABLES, cashBalance: DEMO_CASH, ingestedDocs: [] };
    return getUserData(email);
  });

  const handleLogin = (u) => {
    if (u.isDemo) {
      localStorage.setItem("cashops_session", "demo");
      setUser(u);
      setUserData({ obligations: DEMO_OBLIGATIONS, receivables: DEMO_RECEIVABLES, cashBalance: DEMO_CASH, ingestedDocs: [] });
    } else {
      setUser(u);
      setUserData(getUserData(u.email));
    }
  };

  const handleLogout = () => { localStorage.removeItem("cashops_session"); setUser(null); setUserData(null); };

  const handleDataChange = (newData) => {
    setUserData(newData);
    if (!user?.email || user.isDemo) return;
    saveUserData(user.email, newData);
  };

  if (!user || !userData) return <AuthPage onLogin={handleLogin} T={T} />;

  const healthScore = calcHealthScore(userData.cashBalance, userData.obligations, userData.receivables, whatIfDelays);
  const activeObs = userData.obligations.filter(o => !o.paid);
  const totalObl = activeObs.reduce((s, o) => s + o.amount, 0);
  const runway = totalObl > 0 ? Math.floor(userData.cashBalance / (totalObl / 30)) : 60;
  const runwayColor = runway < 10 ? T.red : runway < 20 ? T.amber : T.green;

  const nav = [
    { id: "dashboard", label: "War Room", icon: "⬛" },
    { id: "obligations", label: "Obligations", icon: "◈" },
    { id: "decisions", label: "AI Actions", icon: "◉" },
    { id: "forecast", label: "Forecast", icon: "◇" },
    { id: "ingest", label: "Ingest Docs", icon: "↑" },
  ];

  const pageComponents = {
    dashboard: <Dashboard setPage={setPage} setSelectedObligation={setSelectedObligation} userData={userData} healthScore={healthScore} whatIfDelays={whatIfDelays} onDelaysChange={setWhatIfDelays} onDataChange={handleDataChange} user={user} T={T} toast={toast} />,
    obligations: <ObligationsPage setPage={setPage} setSelectedObligation={setSelectedObligation} userData={userData} onDataChange={handleDataChange} T={T} toast={toast} />,
    decisions: <DecisionsPage selectedObligation={selectedObligation} setSelectedObligation={setSelectedObligation} userData={{ ...userData, name: user?.name || "", company: user?.company || "" }} T={T} />,
    forecast: <ForecastPage userData={userData} T={T} />,
    ingest: <IngestPage userData={userData} onDataChange={handleDataChange} T={T} toast={toast} />,
  };

  return (
    <div style={{ background: T.bg, minHeight: "100vh", color: T.text, fontFamily: T.sans, display: "grid", gridTemplateColumns: "200px 1fr", gridTemplateRows: "52px 1fr" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${T.bg}; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes blink { 0%,100%{opacity:1}50%{opacity:.2} }
        @keyframes slideUp { from { opacity:0; transform: translateY(10px); } to { opacity:1; transform: translateY(0); } }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: ${T.border2}; border-radius: 2px; }
        input[type=number]::-webkit-outer-spin-button, input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
      `}</style>

      {/* Top bar */}
      <div style={{ gridColumn: "1/-1", background: T.surface, borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.green, animation: "blink 1.4s infinite", display: "inline-block" }} />
          <span style={{ fontFamily: T.mono, fontSize: 13, color: T.green, letterSpacing: 2 }}>CASHOPS // WAR ROOM</span>
          {user.isDemo && <span style={{ fontSize: 10, background: T.purpleDim, color: T.purple, border: `1px solid ${T.purple}44`, padding: "2px 8px", borderRadius: 4, fontFamily: T.mono }}>DEMO MODE</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 11, color: T.text2, fontFamily: T.mono }}>
          <span>USER: {user.name}</span>
          <span>|</span>
          <span>ENTITY: {user.company}</span>
          <span>|</span>
          <span style={{ color: scoreLabel(healthScore, T).color }}>HEALTH: {healthScore}/100</span>
          <span>|</span>
          {Math.max(0, totalObl - userData.cashBalance) > 0 && <span style={{ background: T.redDim, color: T.red, border: `1px solid ${T.red}44`, padding: "3px 10px", borderRadius: 4, letterSpacing: 1 }}>LIQUIDITY ALERT</span>}
          <button onClick={() => setDarkMode(d => !d)} style={{ padding: "6px 12px", borderRadius: 6, border: `1px solid ${T.border}`, background: "transparent", color: T.text2, cursor: "pointer", fontFamily: T.mono, fontSize: 11 }}>{darkMode ? "☀ Light" : "🌙 Dark"}</button>
          <button onClick={handleLogout} style={{ padding: "6px 12px", borderRadius: 6, border: `1px solid ${T.border}`, background: "transparent", color: T.text2, cursor: "pointer", fontFamily: T.mono, fontSize: 11 }}>Logout</button>
        </div>
      </div>

      {/* Sidebar */}
      <div style={{ background: T.surface, borderRight: `1px solid ${T.border}`, padding: "20px 0", display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 9, fontFamily: T.mono, color: T.text3, letterSpacing: 2, padding: "0 20px 10px", textTransform: "uppercase" }}>Command</div>
        {nav.map(n => (
          <button key={n.id} onClick={() => setPage(n.id)}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 20px", fontSize: 13, color: page === n.id ? T.text : T.text2, background: page === n.id ? T.surface2 : "none", borderLeft: page === n.id ? `2px solid ${T.green}` : "2px solid transparent", border: "none", cursor: "pointer", textAlign: "left", width: "100%", transition: ".15s" }}
            onMouseEnter={e => e.currentTarget.style.background = T.surface2}
            onMouseLeave={e => { if (page !== n.id) e.currentTarget.style.background = "none"; }}>
            <span style={{ fontSize: 12 }}>{n.icon}</span>{n.label}
          </button>
        ))}
        <div style={{ marginTop: "auto", padding: "16px 20px", borderTop: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 9, fontFamily: T.mono, color: T.text3, letterSpacing: 2, marginBottom: 8, textTransform: "uppercase" }}>Solvency Runway</div>
          <div style={{ fontSize: 24, fontFamily: T.mono, fontWeight: 700, color: runwayColor }}>{runway}d</div>
          <div style={{ background: T.border, borderRadius: 3, height: 4, marginTop: 8 }}>
            <div style={{ width: `${Math.min(100, (runway / 60) * 100)}%`, height: "100%", background: runwayColor, borderRadius: 3 }} />
          </div>
          <div style={{ fontSize: 10, color: T.text3, marginTop: 6 }}>to zero at current burn</div>
        </div>
      </div>

      {/* Main content */}
      <div style={{ padding: 24, overflowY: "auto" }}>
        {pageComponents[page]}
      </div>

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} T={T} />

      {/* AI Chatbot */}
      <AIChatbot user={user} obligations={userData.obligations} receivables={userData.receivables} cashBalance={userData.cashBalance} healthScore={healthScore} whatIfDelays={whatIfDelays} T={T} />
    </div>
  );
}
