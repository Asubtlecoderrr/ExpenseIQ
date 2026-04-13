import { useState, useRef, useEffect, useCallback } from "react";

const API = "http://localhost:8000";

// ── colour map ──────────────────────────────────────────────────────────────


const CAT = {
  "Salary/Income":           { bg: "#E8F5E9", bar: "#2E7D32", icon: "💰" },
  "Reversals and Refund":    { bg: "#FFF3E0", bar: "#FB8C00", icon: "🔄" },
  "Shopping":                { bg: "#F3E5F5", bar: "#AD1457", icon: "🛍️" },
  "Personal Care":           { bg: "#FCE4EC", bar: "#D81B60", icon: "🧴" },
  "Grocery":                 { bg: "#E8F5E9", bar: "#388E3C", icon: "🛒" },
  "Entertainment":           { bg: "#EDE7F6", bar: "#7B1FA2", icon: "🎬" },
  "Investment":              { bg: "#E0F2F1", bar: "#00695C", icon: "📈" },
  "Services":                { bg: "#E3F2FD", bar: "#1565C0", icon: "🛠️" },
  "Home expenses":           { bg: "#FFFDE7", bar: "#FBC02D", icon: "🏠" },
  "Family and Friends":      { bg: "#FCE4EC", bar: "#C2185B", icon: "👨‍👩‍👧" },
  "Food and Drinks":         { bg: "#FFF3E0", bar: "#F57C00", icon: "🍔" },
  "Transport":               { bg: "#FFF9C4", bar: "#F9A825", icon: "🚗" },
  "Interests & Dividends":   { bg: "#E8F5E9", bar: "#2E7D32", icon: "💸" },
  "Travel":                  { bg: "#E0F7FA", bar: "#00838F", icon: "✈️" },
  "Health and Wellness":     { bg: "#FCE4EC", bar: "#C62828", icon: "💊" },
  "Investment Proceeds":     { bg: "#E0F2F1", bar: "#00796B", icon: "💹" },
  "Self Transfer":           { bg: "#F1F8E9", bar: "#558B2F", icon: "🔁" },
  "Others (In)":             { bg: "#ECEFF1", bar: "#546E7A", icon: "⬇️" },
  "Cashback and Rewards":    { bg: "#E8F5E9", bar: "#43A047", icon: "🎁" },
  "Lifestyle and Travel":    { bg: "#E0F7FA", bar: "#00ACC1", icon: "🌴" },
};
const normalize = (cat) => {
  const map = {
    "Groceries": "Grocery",
    "Food & Dining": "Food and Drinks",
    "Digital Payments": "Shopping" 
  };
  return map[cat] || cat;
};
const c = (cat) => CAT[normalize(cat)] || {
  bg: "#FAFAFA",
  bar: "#757575",
  icon: "📦"
};
const fmt = (n) => "₹" + Math.round(n || 0).toLocaleString("en-IN");

// ── tiny hook ───────────────────────────────────────────────────────────────
function useApi(fn, deps = []) {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await fn()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, deps);
  useEffect(() => { load(); }, [load]);
  return { data, loading, error, reload: load };
}

// ── API helpers ─────────────────────────────────────────────────────────────
const api = {
  months:       () => fetch(`${API}/api/months`).then(r => r.json()),
  summary:      (m) => fetch(`${API}/api/summary${m ? `?month=${m}` : ""}`).then(r => r.json()),
  transactions: (m, cat) => {
    let url = `${API}/api/transactions?`;
    if (m) url += `month=${m}&`;
    if (cat && cat !== "All") url += `category=${encodeURIComponent(cat)}`;
    return fetch(url).then(r => r.json());
  },
  budgets:   () => fetch(`${API}/api/budgets`).then(r => r.json()),
  saveBudget:(cat, amt) => fetch(`${API}/api/budgets`, {
    method: "POST", headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ category: cat, amount: amt })
  }).then(r => r.json()),
  deleteBudget:(cat) => fetch(`${API}/api/budgets/${encodeURIComponent(cat)}`, { method: "DELETE" }).then(r => r.json()),
  insights:  (m) => fetch(`${API}/api/insights${m ? `?month=${m}` : ""}`).then(r => r.json()),
  upload:    (file, replace) => {
    const fd = new FormData(); fd.append("file", file);
    return fetch(`${API}/api/upload?replace_month=${replace}`, { method: "POST", body: fd }).then(r => r.json());
  },
  deleteMonth:(mk) => fetch(`${API}/api/transactions/${mk}`, { method: "DELETE" }).then(r => r.json()),
  pdfUrl:    (m) => `${API}/api/report/pdf${m ? `?month=${m}` : ""}`,
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function MiniBar({ pct, color }) {
  return (
    <div style={{ height: 6, background: "#F0F0F0", borderRadius: 4, overflow: "hidden", marginTop: 5 }}>
      <div style={{ height: "100%", width: `${Math.min(100, pct || 0)}%`, background: color, borderRadius: 4, transition: "width .6s ease" }} />
    </div>
  );
}

function Badge({ label, bg, color }) {
  return <span style={{ background: bg, color, padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{label}</span>;
}

function MetricCard({ label, value, sub, subColor }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #F0F0F0", padding: "16px 18px" }}>
      <div style={{ fontSize: 11, color: "#AAA", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.5px" }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: subColor || "#888", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function InsightCard({ type, title, text, category }) {
  const colors = {
    warning: { bg: "#FFF8E1", border: "#F9A825", head: "#5D4037" },
    good:    { bg: "#E8F5E9", border: "#388E3C", head: "#1B5E20" },
    info:    { bg: "#E3F2FD", border: "#1565C0", head: "#0D47A1" },
    tip:     { bg: "#F3E5F5", border: "#7B1FA2", head: "#4A148C" },
  };
  const icons = { warning: "⚠️", good: "✅", info: "💡", tip: "🔍" };
  const cl = colors[type] || colors.info;
  return (
    <div style={{ background: cl.bg, borderLeft: `3px solid ${cl.border}`, borderRadius: 8, padding: "10px 14px", marginBottom: 10 }}>
      <div style={{ fontWeight: 600, fontSize: 13, color: cl.head, marginBottom: 3 }}>{icons[type]} {title}</div>
      <div style={{ fontSize: 12, color: "#555", lineHeight: 1.5 }}>{text}</div>
      {category && <div style={{ fontSize: 11, color: "#AAA", marginTop: 4 }}>#{category}</div>}
    </div>
  );
}

function DonutChart({ cats, total }) {
  const size = 160, cx = 80, cy = 80, r = 60, ir = 38;
  let angle = -Math.PI / 2;
  const slices = (cats || []).slice(0, 7).map(cat => {
    const sweep = (cat.total / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle);
    angle += sweep;
    const x2 = cx + r * Math.cos(angle), y2 = cy + r * Math.sin(angle);
    const xi1 = cx + ir * Math.cos(angle), yi1 = cy + ir * Math.sin(angle);
    const xi2 = cx + ir * Math.cos(angle - sweep), yi2 = cy + ir * Math.sin(angle - sweep);
    const lg = sweep > Math.PI ? 1 : 0;
    return { cat, path: `M${x1} ${y1}A${r} ${r} 0 ${lg} 1 ${x2} ${y2}L${xi1} ${yi1}A${ir} ${ir} 0 ${lg} 0 ${xi2} ${yi2}Z` };
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {slices.map((s, i) => <path key={i} d={s.path} fill={c(s.cat.category).bar} opacity=".85" />)}
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize="11" fill="#888">total</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize="13" fontWeight="600" fill="#222">{fmt(total)}</text>
    </svg>
  );
}

function SparkBars({ txns, color }) {
  if (!txns?.length) return null;
  const day = {};
  txns.forEach(t => { day[t.date] = (day[t.date] || 0) + t.amount; });
  const bars = Object.values(day);
  const max = Math.max(...bars);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 40 }}>
      {bars.map((v, i) => (
        <div key={i} style={{ flex: 1, height: `${Math.max(10, (v / max) * 100)}%`, background: color, borderRadius: "2px 2px 0 0", opacity: .7 }} />
      ))}
    </div>
  );
}

function Loader({ text = "Loading…" }) {
  return <div style={{ padding: 60, textAlign: "center", color: "#AAA", fontSize: 14 }}>{text}</div>;
}

function ErrBox({ msg }) {
  return (
    <div style={{ margin: 20, padding: "14px 18px", background: "#FFEBEE", border: "1px solid #FFCDD2", borderRadius: 10, color: "#B71C1C", fontSize: 13 }}>
      ⚠️ {msg}
      <div style={{ marginTop: 6, fontSize: 12, color: "#888" }}>Make sure the Python backend is running on port 8000.</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGES
// ═══════════════════════════════════════════════════════════════════════════

function Dashboard({ month }) {
  const { data: sum, loading: sl, error: se } = useApi(() => api.summary(month), [month]);
  const { data: ins, loading: il }             = useApi(() => api.insights(month),  [month]);
  const { data: txnRes }                       = useApi(() => api.transactions(month), [month]);

  if (se) return <ErrBox msg={se} />;
  if (sl) return <Loader />;
  const txns = txnRes?.transactions || [];
  const cats = sum?.categories || [];
  const insights = ins?.insights || [];

  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: "-0.5px" }}>Dashboard</h1>
          <p style={{ color: "#888", fontSize: 13, margin: "4px 0 0" }}>{month || "All time"} · {sum?.count || 0} transactions</p>
        </div>
        <a href={api.pdfUrl(month)} target="_blank" rel="noreferrer" style={{ background: "#1A1A2E", color: "#E8C84A", textDecoration: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 600, fontSize: 13 }}>⬇ Download PDF</a>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 24 }}>
        <MetricCard label="Total spent" value={fmt(sum?.total_spend)} sub={`${sum?.count || 0} transactions`} />
        <MetricCard label="Income" value={fmt(sum?.total_income)} sub="money received" />
        <MetricCard label="Investment" value={fmt(sum?.total_investment)} sub="wealth building" />
        <MetricCard 
          label="Net savings" 
          value={fmt(sum?.net)} 
          sub={sum?.net >= 0 ? "you're saving 👍" : "overspending ⚠️"} 
          subColor={sum?.net >= 0 ? "#2E7D32" : "#C62828"} 
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 24 }}>
        <MetricCard label="Daily average" value={fmt(sum?.daily_avg)} sub={`${sum?.daily?.length || 0} active days`} />
        <MetricCard label="Top category" value={sum?.top_category || "—"} sub={cats.length ? fmt(cats[0].total) : "—"} />
        <MetricCard 
          label="Total inward" 
          value={fmt(sum?.total_inward)} 
          sub="all incoming cash" 
        />      
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 20, marginBottom: 20 }}>
        {/* Category bars */}
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #F0F0F0", padding: "20px 22px" }}>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 18 }}>Spending by category</div>
          {cats.map(cat => (
            <div key={cat.category} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: c(cat.category).bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>{c(cat.category).icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 13, color: "#333" }}>{cat.category}</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{fmt(cat.total)}</span>
                </div>
                <MiniBar pct={cat.pct} color={c(cat.category).bar} />
              </div>
              <div style={{ fontSize: 12, color: "#AAA", minWidth: 32, textAlign: "right" }}>{cat.pct}%</div>
            </div>
          ))}
          {!cats.length && <div style={{ color: "#AAA", fontSize: 14, paddingTop: 20, textAlign: "center" }}>No data yet — upload a CSV first.</div>}
        </div>

        {/* Donut + AI insights */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #F0F0F0", padding: "20px 22px", display: "flex", alignItems: "center", gap: 20 }}>
            <DonutChart cats={cats} total={sum?.total_spend || 1} />
            <div style={{ flex: 1 }}>
              {cats.slice(0, 5).map(cat => (
                <div key={cat.category} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: c(cat.category).bar, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: "#555", flex: 1 }}>{cat.category}</span>
                  <span style={{ fontSize: 11, fontWeight: 600 }}>{cat.pct}%</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #F0F0F0", padding: "18px 20px", flex: 1, overflowY: "auto" }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 14 }}>
              AI insights {il && <span style={{ fontSize: 12, color: "#AAA", fontWeight: 400 }}>loading…</span>}
            </div>
            {!insights.length && !il && (
              <div style={{ color: "#AAA", fontSize: 13 }}>
                No AI insights available. Start Ollama (llama3) to enable.
              </div>
            )}
            {insights.map((ins, i) => (
              <InsightCard key={i} {...ins} />
            ))}
          </div>
        </div>
      </div>

      {/* Recent txns */}
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #F0F0F0", padding: "20px 22px" }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>Recent transactions</div>
        {txns.slice(0, 8).map((t, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < 7 ? "1px solid #F7F7F7" : "none" }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: c(normalize(t.category)).bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{c(t.category).icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: "#AAA" }}>{t.category} · {t.date}</div>
            </div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#C62828" }}>{fmt(t.amount)}</div>
          </div>
        ))}
        {!txns.length && <div style={{ color: "#AAA", fontSize: 14, textAlign: "center", padding: "20px 0" }}>No transactions yet.</div>}
      </div>
    </div>
  );
}

function Transactions({ month }) {
  const [search, setSearch]   = useState("");
  const [cat, setCat]         = useState("All");
  const { data, loading, error, reload } = useApi(() => api.transactions(month), [month]);

  if (error) return <ErrBox msg={error} />;

  const txns = data?.transactions || [];
  const cats = ["All", ...Array.from(new Set(txns.map(t => t.category)))];
  const filtered = txns.filter(t =>
    (cat === "All" || t.category === cat) &&
    (t.category.toLowerCase().includes(search.toLowerCase()))
  ).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div style={{ padding: 28 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px", letterSpacing: "-0.5px" }}>Transactions</h1>
      <p style={{ color: "#888", fontSize: 13, margin: "0 0 20px" }}>{filtered.length} of {txns.length} shown</p>
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search category…" style={{ flex: 1, padding: "10px 14px", border: "1px solid #E8E8E8", borderRadius: 8, fontSize: 13, outline: "none", background: "#fff", color: "#111" }} />
        <select value={cat} onChange={e => setCat(e.target.value)} style={{ padding: "10px 14px", border: "1px solid #E8E8E8", borderRadius: 8, fontSize: 13, background: "#fff", cursor: "pointer", color: "#111", minWidth: 160, appearance: "none", WebkitAppearance: "none", backgroundImage: "url(\"data:image/svg+xml;utf8,<svg fill='black' height='20' viewBox='0 0 20 20' width='20' xmlns='http://www.w3.org/2000/svg'><path d='M5 7l5 5 5-5H5z'/></svg>\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center", backgroundSize: "16px" }}>
          {cats.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>
      {loading ? <Loader /> : (
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #F0F0F0", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#FAFAFA", borderBottom: "1px solid #F0F0F0" }}>
                {["Date","Category","Amount"].map(h => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: h === "Amount" ? "right" : "left", fontSize: 12, fontWeight: 600, color: "#AAA", textTransform: "uppercase", letterSpacing: 1 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #F7F7F7" }}>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "#888" }}>{t.date}</td>
                  <td style={{ padding: "12px 16px", fontWeight: 500, fontSize: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 18 }}>{c(t.category).icon}</span>{t.category}
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <Badge label={t.category} bg={c(t.category).bg} color={c(t.category).bar} />
                  </td>
                  <td style={{ padding: "12px 16px", fontWeight: 700, fontSize: 14, color: "#C62828", textAlign: "right" }}>{fmt(t.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && <div style={{ padding: 40, textAlign: "center", color: "#AAA", fontSize: 14 }}>No transactions found.</div>}
        </div>
      )}
    </div>
  );
}

function Analytics({ month }) {
  const { data: sum, loading, error } = useApi(() => api.summary(month), [month]);
  const { data: txnRes }              = useApi(() => api.transactions(month), [month]);
  const { data: ins }                 = useApi(() => api.insights(month), [month]);

  if (error) return <ErrBox msg={error} />;
  if (loading) return <Loader />;

  const txns   = txnRes?.transactions || [];
  const cats   = sum?.categories || [];
  const total  = sum?.total_spend || 0;
  const insights = Array.isArray(ins?.insights) ? ins.insights : [];

  return (
    <div style={{ padding: 28 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px", letterSpacing: "-0.5px" }}>Analytics</h1>
      <p style={{ color: "#888", fontSize: 13, margin: "0 0 24px" }}>Spending patterns · {month || "All time"}</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 20 }}>
        {cats.map(cat => {
          const catTxns = txns.filter(t => t.category === cat.category);
          const avg = catTxns.length ? cat.total / catTxns.length : 0;
          const cl = c(cat.category);
          return (
            <div key={cat.category} style={{ background: "#fff", borderRadius: 14, border: "1px solid #F0F0F0", padding: "18px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: cl.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{cl.icon}</div>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{cat.category}</span>
                </div>
                <span style={{ fontWeight: 700, fontSize: 16 }}>{fmt(cat.total)}</span>
              </div>
              <SparkBars txns={catTxns} color={cl.bar} />
              <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
                <div><div style={{ fontSize: 10, color: "#AAA", textTransform: "uppercase", letterSpacing: 1 }}>Transactions</div><div style={{ fontWeight: 600, fontSize: 14 }}>{catTxns.length}</div></div>
                <div><div style={{ fontSize: 10, color: "#AAA", textTransform: "uppercase", letterSpacing: 1 }}>Avg/txn</div><div style={{ fontWeight: 600, fontSize: 14 }}>{fmt(avg)}</div></div>
                <div><div style={{ fontSize: 10, color: "#AAA", textTransform: "uppercase", letterSpacing: 1 }}>% total</div><div style={{ fontWeight: 600, fontSize: 14 }}>{cat.pct}%</div></div>
              </div>
            </div>
          );
        })}
      </div>

      {insights.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #F0F0F0", padding: "20px 22px" }}>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>All AI insights</div>
          {insights.map((ins, i) => <InsightCard key={i} {...ins} />)}
        </div>
      )}
    </div>
  );
}

function Budgets({ month }) {
  const { data: sum }           = useApi(() => api.summary(month), [month]);
  const { data: bRes, reload }  = useApi(() => api.budgets(), []);
  const [editing, setEditing]   = useState(null);
  const [val, setVal]           = useState("");
  const [saving, setSaving]     = useState(false);

  const cats   = sum?.categories || [];
  const budMap = Object.fromEntries((bRes?.budgets || []).map(b => [b.category, b.amount]));

  const save = async () => {
    if (!val || isNaN(val)) return;
    setSaving(true);
    await api.saveBudget(editing, parseFloat(val));
    await reload(); setSaving(false); setEditing(null);
  };
  const del = async (cat) => {
    await api.deleteBudget(cat); await reload();
  };

  return (
    <div style={{ padding: 28 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px", letterSpacing: "-0.5px" }}>Budgets</h1>
      <p style={{ color: "#888", fontSize: 13, margin: "0 0 24px" }}>Set monthly limits. Click a card to edit. Data is saved to the database.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
        {cats.map(cat => {
          const cl = c(cat.category);
          const budget = budMap[cat.category];
          const pct = budget ? Math.min(100, (cat.total / budget) * 100) : 0;
          const over = budget && cat.total > budget;
          return (
            <div key={cat.category} onClick={() => { setEditing(cat.category); setVal(budMap[cat.category] || ""); }} style={{ background: "#fff", borderRadius: 14, border: `1px solid ${over ? "#FFCDD2" : "#F0F0F0"}`, padding: "18px 20px", cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: cl.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{cl.icon}</div>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{cat.category}</span>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {over && <span style={{ fontSize: 10, background: "#FFCDD2", color: "#C62828", padding: "2px 8px", borderRadius: 20, fontWeight: 700 }}>OVER</span>}
                  {budget && <span onClick={e => { e.stopPropagation(); del(cat.category); }} style={{ fontSize: 18, cursor: "pointer", color: "#CCC", lineHeight: 1 }} title="Remove budget">×</span>}
                </div>
              </div>
              <div style={{ fontSize: 13, marginBottom: 6 }}>
                <span style={{ fontWeight: 700 }}>{fmt(cat.total)}</span>
                {budget ? <span style={{ color: "#AAA" }}> / {fmt(budget)}</span> : <span style={{ color: "#CCC" }}> · no limit set</span>}
              </div>
              {budget
                ? <div style={{ height: 6, background: "#F0F0F0", borderRadius: 4, overflow: "hidden" }}><div style={{ height: "100%", width: `${pct}%`, background: over ? "#C62828" : cl.bar, borderRadius: 4, transition: "width .6s" }} /></div>
                : <div style={{ fontSize: 12, color: "#C0C0C0", marginTop: 4 }}>Click to set budget →</div>}
            </div>
          );
        })}
      </div>

      {editing && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, minWidth: 320 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Budget for {editing}</div>
            <div style={{ fontSize: 13, color: "#888", marginBottom: 16 }}>Current: {fmt(cats.find(cat => cat.category === editing)?.total)}</div>
            <input type="number" value={val} onChange={e => setVal(e.target.value)} placeholder="Enter amount (₹)" style={{ width: "100%", padding: "10px 14px", border: "1px solid #E0E0E0", borderRadius: 8, fontSize: 14, marginBottom: 16, outline: "none" }} autoFocus onKeyDown={e => e.key === "Enter" && save()} />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={save} disabled={saving} style={{ flex: 1, background: "#1A1A2E", color: "#E8C84A", border: "none", borderRadius: 8, padding: 10, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>{saving ? "Saving…" : "Save"}</button>
              <button onClick={() => setEditing(null)} style={{ flex: 1, background: "#F5F5F5", color: "#555", border: "none", borderRadius: 8, padding: 10, fontSize: 14, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Reports({ month }) {
  const { data: sum } = useApi(() => api.summary(month), [month]);
  const { data: ins } = useApi(() => api.insights(month), [month]);
  const insights = ins?.insights || [];
  const cats = sum?.categories || [];

  return (
    <div style={{ padding: 28 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px", letterSpacing: "-0.5px" }}>Reports</h1>
      <p style={{ color: "#888", fontSize: 13, margin: "0 0 24px" }}>Download your full expense report as PDF.</p>

      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #F0F0F0", padding: "28px", maxWidth: 520, marginBottom: 24 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 6 }}>Monthly Expense Report</div>
        <div style={{ fontSize: 13, color: "#888", marginBottom: 20 }}>
          Period: <strong>{month || "All time"}</strong> · {sum?.count || 0} transactions · {fmt(sum?.total_spend)} total
        </div>
        <div style={{ fontSize: 13, color: "#555", marginBottom: 20, lineHeight: 1.6 }}>
          Includes: summary stats · category breakdown · all transactions · AI insights
        </div>
        <a href={api.pdfUrl(month)} target="_blank" rel="noreferrer" style={{ display: "inline-block", background: "#1A1A2E", color: "#E8C84A", textDecoration: "none", borderRadius: 8, padding: "11px 22px", fontWeight: 700, fontSize: 14 }}>⬇ Download PDF Report</a>
      </div>

      {insights.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #F0F0F0", padding: "20px 22px", maxWidth: 620 }}>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>AI summary for this period</div>
          {insights.map((ins, i) => <InsightCard key={i} {...ins} />)}
        </div>
      )}
    </div>
  );
}

function Upload({ onUploaded }) {
  const fileRef = useRef();
  const [dragOver, setDragOver]   = useState(false);
  const [replace, setReplace]     = useState(false);
  const [status, setStatus]       = useState(null);
  const [loading, setLoading]     = useState(false);
  const { data: months, reload }  = useApi(() => api.months(), []);
  const [deleting, setDeleting]   = useState(null);

  const handleFile = async (file) => {
    if (!file) return;
    setLoading(true); setStatus(null);
    try {
      const res = await api.upload(file, replace);
      setStatus({ ok: true, msg: res.message, errors: res.errors });
      reload(); onUploaded();
    } catch (e) {
      setStatus({ ok: false, msg: e.message });
    } finally { setLoading(false); }
  };

  const handleDrop = (e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); };
  const downloadTemplate = () => {
    const csv = "Date,Category,Amount\n13-Apr-26,Grocery,1500\n";
    const a = document.createElement("a"); a.href = "data:text/csv," + encodeURIComponent(csv); a.download = "expenseiq_template.csv"; a.click();
  };

  const deleteMon = async (mk) => {
    setDeleting(mk);
    await api.deleteMonth(mk); reload(); onUploaded();
    setDeleting(null);
  };

  return (
    <div style={{ padding: 28, maxWidth: 620 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px", letterSpacing: "-0.5px" }}>Upload transactions</h1>
      <p style={{ color: "#888", fontSize: 13, margin: "0 0 24px" }}>Upload a CSV to add transactions to the database.</p>

      <div onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop} onClick={() => fileRef.current.click()} style={{ border: `2px dashed ${dragOver ? "#1A1A2E" : "#DEDEDE"}`, borderRadius: 14, padding: "48px 24px", textAlign: "center", cursor: "pointer", background: dragOver ? "#F7F6F3" : "#fff", transition: "all .2s", marginBottom: 16 }}>
        {loading ? <div style={{ fontSize: 14, color: "#888" }}>Uploading…</div> : <>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>Drag & drop your CSV here</div>
          <div style={{ fontSize: 13, color: "#AAA" }}>or click to browse files</div>
        </>}
        <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, cursor: "pointer", fontSize: 13, color: "#555" }}>
        <input type="checkbox" checked={replace} onChange={e => setReplace(e.target.checked)} />
        Replace existing data for the same month
      </label>

      {status && (
        <div style={{ padding: "12px 16px", borderRadius: 10, background: status.ok ? "#E8F5E9" : "#FFEBEE", border: `1px solid ${status.ok ? "#C8E6C9" : "#FFCDD2"}`, color: status.ok ? "#1B5E20" : "#B71C1C", fontSize: 13, marginBottom: 20 }}>
          {status.ok ? "✅" : "❌"} {status.msg}
          {status.errors?.length > 0 && <div style={{ marginTop: 6, fontSize: 12, color: "#888" }}>{status.errors.slice(0, 5).join(" · ")}</div>}
        </div>
      )}

      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #F0F0F0", padding: "20px 22px", marginBottom: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>CSV format</div>
        <div style={{ background: "#F7F6F3", borderRadius: 8, padding: "12px 16px", fontFamily: "monospace", fontSize: 12, color: "#333", marginBottom: 14, lineHeight: 1.8 }}>
          Date, Category, Amount, Flow<br />
          13-Apr-26, Grocery, 1500, outward<br />
          15-Apr-26, Salary, 50000, inward<br />
        </div>
        <button onClick={downloadTemplate} style={{ background: "none", border: "1px solid #1A1A2E", color: "#1A1A2E", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>⬇ Download template</button>
      </div>

      {/* Uploaded months */}
      {(months?.months || []).length > 0 && (
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #F0F0F0", padding: "20px 22px" }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>Uploaded months</div>
          {months.months.map(mk => (
            <div key={mk} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #F7F7F7" }}>
              <span style={{ fontSize: 14, fontWeight: 500 }}>{mk}</span>
              <button onClick={() => deleteMon(mk)} disabled={deleting === mk} style={{ background: "#FFEBEE", color: "#C62828", border: "none", borderRadius: 6, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                {deleting === mk ? "Deleting…" : "Delete"}
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 20, background: "#fff", borderRadius: 14, border: "1px solid #F0F0F0", padding: "18px 20px" }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>Supported categories</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {Object.entries(CAT).map(([cat, cl]) => (
            <span key={cat} style={{ background: cl.bg, color: cl.bar, padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{cl.icon} {cat}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// APP SHELL
// ═══════════════════════════════════════════════════════════════════════════
export default function App() {
  const [page, setPage]     = useState("dashboard");
  const [month, setMonth]   = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const { data: months, reload: reloadMonths } = useApi(() => api.months(), [refreshKey]);

  const onUploaded = () => { setRefreshKey(k => k + 1); reloadMonths(); };

  const nav = [
    { id: "dashboard",    label: "Dashboard",    icon: "◈" },
    { id: "transactions", label: "Transactions", icon: "≡" },
    { id: "analytics",    label: "Analytics",    icon: "◎" },
    { id: "budgets",      label: "Budgets",      icon: "◷" },
    { id: "reports",      label: "Reports",      icon: "📄" },
    { id: "upload",       label: "Upload",       icon: "⊕" },
  ];

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "'DM Sans','Segoe UI',sans-serif", background: "#F7F6F3", color: "#1A1A1A" }}>
      {/* Sidebar */}
      <div style={{ width: 210, background: "#fff", borderRight: "1px solid #EBEBEB", display: "flex", flexDirection: "column", padding: "0 0 16px", flexShrink: 0 }}>
        <div style={{ padding: "22px 20px 18px", borderBottom: "1px solid #F0F0F0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, background: "linear-gradient(135deg,#1A1A2E,#16213E)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#E8C84A", fontSize: 16 }}>₹</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.3px" }}>ExpenseIQ</div>
              <div style={{ fontSize: 10, color: "#AAA", marginTop: 1 }}>Smart money tracking</div>
            </div>
          </div>
        </div>

        {/* Month selector */}
        <div style={{ padding: "12px 14px", borderBottom: "1px solid #F0F0F0" }}>
          <div style={{ fontSize: 10, color: "#AAA", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Period</div>
          <select value={month} onChange={e => setMonth(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid #EBEBEB", borderRadius: 8, fontSize: 12, background: "#FAFAFA", cursor: "pointer", color: "#333" }}>
            <option value="">All time</option>
            {(months?.months || []).map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div style={{ padding: "10px 10px", flex: 1 }}>
          {nav.map(n => (
            <div key={n.id} onClick={() => setPage(n.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, marginBottom: 2, cursor: "pointer", background: page === n.id ? "#1A1A2E" : "transparent", color: page === n.id ? "#fff" : "#555", fontWeight: page === n.id ? 600 : 400, fontSize: 14, transition: "all .15s" }}>
              <span style={{ fontSize: 16, opacity: page === n.id ? 1 : .6 }}>{n.icon}</span>{n.label}
            </div>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflow: "auto" }} key={`${page}-${month}-${refreshKey}`}>
        {page === "dashboard"    && <Dashboard    month={month} />}
        {page === "transactions" && <Transactions month={month} />}
        {page === "analytics"   && <Analytics    month={month} />}
        {page === "budgets"     && <Budgets       month={month} />}
        {page === "reports"     && <Reports       month={month} />}
        {page === "upload"      && <Upload        onUploaded={onUploaded} />}
      </div>
    </div>
  );
}
