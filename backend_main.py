# ExpenseIQ Backend — FastAPI + SQLite + Anthropic + ReportLab
# Run: pip install fastapi uvicorn python-multipart anthropic reportlab
#      uvicorn main:app --reload --port 8000

import os, csv, io, json, sqlite3, traceback
from datetime import datetime
from typing import Optional
import requests
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
# import anthropic

# ── ReportLab ──────────────────────────────────────────────────────────────
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)

# ── App setup ──────────────────────────────────────────────────────────────
app = FastAPI(title="ExpenseIQ API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],        # tighten in production
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = "expenseiq.db"
ANTHROPIC_KEY = os.getenv("ANTHROPIC_API_KEY", "")   # set your key as env var

from datetime import datetime

def month_key_from_date(date_str: str) -> str:
    try:
        # Try standard format first
        return datetime.strptime(date_str.strip(), "%Y-%m-%d").strftime("%Y-%m")
    except:
        try:
            # Handle your format: 13-Apr-26
            dt = datetime.strptime(date_str.strip(), "%d-%b-%y")
            return dt.strftime("%Y-%m")
        except:
            return "unknown"

# ── DB init ────────────────────────────────────────────────────────────────
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS transactions (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                date      TEXT    NOT NULL,
                amount    REAL    NOT NULL,
                category  TEXT    NOT NULL,
                flow      TEXT NOT NULL,
                month_key TEXT    NOT NULL   -- e.g. "2026-04"
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS budgets (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                category  TEXT    UNIQUE NOT NULL,
                amount    REAL    NOT NULL
            )
        """)
        conn.commit()

init_db()


# ── Helpers ─────────────────────────────────────────────────────────────────
def fmt_inr(n: float) -> str:
    return f"Rs.{n:,.0f}"

def month_key_from_date(date_str: str) -> str:
    try:
        return datetime.strptime(date_str.strip(), "%Y-%m-%d").strftime("%Y-%m")
    except Exception:
        return "unknown"

def rows_to_list(rows) -> list[dict]:
    return [dict(r) for r in rows]


# ═══════════════════════════════════════════════════════════════════════════
# ROUTES
# ═══════════════════════════════════════════════════════════════════════════

# ── Health ─────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"status": "ok", "service": "ExpenseIQ API"}


# ── Upload CSV ─────────────────────────────────────────────────────────────
@app.post("/api/upload")
async def upload_csv(file: UploadFile = File(...), replace_month: bool = False):
    """
    Upload a CSV with columns: date, amount, category
    If replace_month=True, existing rows for that month are deleted first.
    """
    content = await file.read()
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    rows_inserted = 0
    errors = []

    with get_db() as conn:
        for i, row in enumerate(reader, start=2):   # row 1 = header
            try:
                date_raw = row.get("Date", "").strip()
                category = row.get("Category", "").strip()

                # clean amount
                amount_raw = row.get("Amount", "0").replace(",", "").replace("₹", "").strip()
                amount = float(amount_raw)

                # convert date
                try:
                    date = datetime.strptime(date_raw, "%d-%b-%y").strftime("%Y-%m-%d")
                except:
                    date = date_raw

                mk = month_key_from_date(date)
                flow = row.get("Flow", "").strip().lower()

                if flow not in {"inward", "outward", "neutral"}:
                    errors.append(f"Row {i}: invalid flow")
                    continue

                if not date or not category:
                    errors.append(f"Row {i}: missing date or category")
                    continue

                if replace_month:
                    conn.execute(
                        "DELETE FROM transactions WHERE month_key = ?", (mk,)
                    )

                conn.execute(
                    "INSERT INTO transactions (date, amount, category, flow, month_key) VALUES (?,?,?,?,?)",
                    (date, amount, category, flow, mk)
                )
                rows_inserted += 1
            except Exception as e:
                errors.append(f"Row {i}: {e}")

        conn.commit()

    return {
        "inserted": rows_inserted,
        "errors": errors,
        "message": f"Uploaded {rows_inserted} transactions successfully."
    }


# ── List months ────────────────────────────────────────────────────────────
@app.get("/api/months")
def list_months():
    with get_db() as conn:
        rows = conn.execute(
            "SELECT DISTINCT month_key FROM transactions ORDER BY month_key DESC"
        ).fetchall()
    return {"months": [r["month_key"] for r in rows]}


# ── Transactions ───────────────────────────────────────────────────────────
@app.get("/api/transactions")
def get_transactions(month: Optional[str] = None, category: Optional[str] = None):
    query = "SELECT * FROM transactions WHERE 1=1"
    params = []
    if month:
        query += " AND month_key = ?"
        params.append(month)
    if category:
        query += " AND category = ?"
        params.append(category)
    query += " ORDER BY date DESC"
    with get_db() as conn:
        rows = conn.execute(query, params).fetchall()
    return {"transactions": rows_to_list(rows)}

# # ── Category sets ───────────────────────────────────────────────────────────
# SPEND_CATEGORIES = {
#     "Shopping",
#     "Personal Care",
#     "Grocery",
#     "Entertainment",
#     "Services",
#     "Home expenses",
#     "Family and Friends",
#     "Food and Drinks",
#     "Transport",
#     "Travel",
#     "Health and Wellness",
#     "Lifestyle and Travel",
#     "Loan EMI",
#     "Taxes",
# }

# INFLOW_CATEGORIES = {
#     "Salary/Income",
#     "Reversals and Refund",
#     "Interests & Dividends",
#     "Cashback and Rewards",
#     "Others (In)",
# }

# TRANSFER_CATEGORIES = {
#     "Self Transfer",
# }

# INVESTMENT_CATEGORIES = {
#     "Investment",
#     "Investment Proceeds",
# }

# # ── Helper ─────────────────────────────────────────────
# def normalize_category(cat: str) -> str:
#     if cat == "Digital Payments":
#         return "Shopping"
#     return cat


# ── Summary ─────────────────────────────────────────────
@app.get("/api/summary")
def get_summary(month: Optional[str] = None):
    query = "SELECT * FROM transactions WHERE 1=1"
    params = []

    if month:
        query += " AND month_key = ?"
        params.append(month)

    with get_db() as conn:
        rows = rows_to_list(conn.execute(query, params).fetchall())

    if not rows:
        return {
            "total_spend": 0,
            "total_income": 0,
            "total_investment": 0,
            "total_inward": 0,
            "net": 0,
            "count": 0,
            "categories": [],
            "daily": []
        }

    total_spend = 0
    total_income = 0
    total_investment = 0

    cat_map = {}
    day_map = {}

    for r in rows:
        amt = r["amount"]
        cat = r["category"].strip()
        flow = r.get("flow", "").strip().lower()
        is_investment = cat.lower().startswith("investment")

        # ── FLOW BASED TOTALS ──
        if is_investment:
            total_investment += amt
            continue
        
        # ── SPEND ──
        if flow == "outward":
            total_spend += amt
            cat_map[cat] = cat_map.get(cat, 0) + amt
            day_map[r["date"]] = day_map.get(r["date"], 0) + amt

        # ── INCOME ──
        elif flow == "inward":
            total_income += amt

    net = total_income - total_spend

    # ── categories ──
    categories = sorted(
        [
            {
                "category": k,
                "total": v,
                "pct": round(v / total_spend * 100, 1) if total_spend else 0
            }
            for k, v in cat_map.items()
        ],
        key=lambda x: -x["total"]
    )

    # ── daily ──
    daily = sorted(
        [{"date": k, "total": v} for k, v in day_map.items()],
        key=lambda x: x["date"]
    )

    return {
        "total_spend": total_spend,
        "total_income": total_income,
        "total_investment": total_investment,
        "total_inward": total_income,
        "net": net,
        "count": len(rows),
        "categories": categories,
        "daily": daily,
        "top_category": categories[0]["category"] if categories else None,
        "daily_avg": round(total_spend / len(daily), 2) if daily else 0,
    }
# ── Budgets ────────────────────────────────────────────────────────────────
class BudgetIn(BaseModel):
    category: str
    amount: float

@app.get("/api/budgets")
def get_budgets():
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM budgets").fetchall()
    return {"budgets": rows_to_list(rows)}

@app.post("/api/budgets")
def upsert_budget(b: BudgetIn):
    with get_db() as conn:
        conn.execute(
            "INSERT INTO budgets (category, amount) VALUES (?,?) "
            "ON CONFLICT(category) DO UPDATE SET amount=excluded.amount",
            (b.category, b.amount)
        )
        conn.commit()
    return {"message": "Budget saved", "category": b.category, "amount": b.amount}

@app.delete("/api/budgets/{category}")
def delete_budget(category: str):
    with get_db() as conn:
        conn.execute("DELETE FROM budgets WHERE category = ?", (category,))
        conn.commit()
    return {"message": "Budget deleted"}


# ── AI Insights ────────────────────────────────────────────────────────────

############################# USING ANTHROPIC CLAUDE ###############################

# @app.get("/api/insights")
# def get_insights(month: Optional[str] = None):
#     """
#     Calls Claude to generate personalised spending insights.
#     Requires ANTHROPIC_API_KEY env var.
#     """
#     if not ANTHROPIC_KEY:
#         raise HTTPException(
#             status_code=500,
#             detail="ANTHROPIC_API_KEY not set. Add it as an environment variable."
#         )

#     summary = get_summary(month)
#     if summary["total"] == 0:
#         return {"insights": [], "summary_text": "No transactions found for this period."}

#     prompt = f"""
# You are a personal finance advisor. Analyse these spending data and return a JSON array of insight objects.

# Spending data:
# - Total spent: {fmt_inr(summary['total'])}
# - Total transactions: {summary['count']}
# - Period: {month or 'all time'}
# - Daily average: {fmt_inr(summary['daily_avg'])}
# - Category breakdown:
# {json.dumps(summary['categories'], indent=2)}

# Return ONLY a JSON array (no markdown, no explanation) with 4-6 insight objects. Each object must have:
#   "type": one of "warning" | "good" | "info" | "tip"
#   "title": short headline (max 8 words)
#   "text": 1-2 sentence explanation with specific numbers from the data
#   "category": the relevant category or "General"

# Focus on: overspending, unusual spikes, savings opportunities, budget suggestions, patterns.
# Use INR (Rs.) currency formatting.
# """.strip()

#     client = anthropic.Anthropic(api_key=ANTHROPIC_KEY)
#     message = client.messages.create(
#         model="claude-sonnet-4-20250514",
#         max_tokens=1500,
#         messages=[{"role": "user", "content": prompt}]
#     )
#     raw = message.content[0].text.strip()

#     # Strip markdown fences if present
#     if raw.startswith("```"):
#         raw = raw.split("```")[1]
#         if raw.startswith("json"):
#             raw = raw[4:]
#     raw = raw.strip()

#     try:
#         insights = json.loads(raw)
#     except Exception:
#         insights = [{"type": "info", "title": "AI analysis complete",
#                      "text": raw[:300], "category": "General"}]

#     return {"insights": insights, "period": month}

################## USING OLLAMA WITH LOCAL LLAMA 3 MODEL #####################

@app.get("/api/insights")
def get_insights(month: Optional[str] = None):
    summary = get_summary(month)

    if summary["total_spend"] == 0:
        return {"insights": [], "summary_text": "No transactions found."}

    prompt = f"""
You are a personal finance advisor.
"Net = Income - Spend (positive means savings)"
Return ONLY valid JSON.
Do NOT include text before or after JSON.
Do NOT use markdown.
The amount is in INR (Rs.)

Return STRICTLY this format:

[
  {{
    "type": "warning",
    "title": "Short title",
    "text": "1-2 sentence insight",
    "category": "Category name"
  }}
]

Data:
Total Spend: {summary['total_spend']}
Income: {summary['total_income']}
Investment: {summary['total_investment']}
Net: {summary['net']}

Categories:
{json.dumps(summary['categories'], indent=2)}
"""

    try:
        response = requests.post(
            "http://localhost:11434/api/generate",
            json={
                "model": "llama3",
                "prompt": prompt,
                "stream": False
            }
        )

        raw = response.json().get("response", "").strip()

        # 🔥 STEP 1: Remove markdown
        if "```" in raw:
            parts = raw.split("```")
            raw = parts[1] if len(parts) > 1 else raw
            if raw.startswith("json"):
                raw = raw[4:]

        # 🔥 STEP 2: Extract JSON array ONLY
        start = raw.find("[")
        end = raw.rfind("]")

        if start != -1 and end != -1:
            raw = raw[start:end+1]

        # 🔥 STEP 3: Parse safely
        try:
            insights = json.loads(raw)
            for i in insights:
                i["type"] = i.get("type", "").strip().lower()
        except Exception as e:
            print("JSON parse failed:", e)
            print("RAW:", raw)

            insights = [{
                "type": "info",
                "title": "AI response",
                "text": raw[:300],
                "category": "General"
            }]

        print(f"Insights generated successfully. {insights[0]}")
        return {"insights": insights}

    except Exception as e:
        return {"error": str(e)}

# ── PDF Report ─────────────────────────────────────────────────────────────
@app.get("/api/report/pdf")
def generate_pdf_report(month: Optional[str] = None):
    """
    Generates and streams a styled PDF expense report using ReportLab.
    """
    summary  = get_summary(month)
    txns_res = get_transactions(month=month)
    txns     = txns_res["transactions"]

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=20*mm, rightMargin=20*mm,
        topMargin=18*mm, bottomMargin=18*mm
    )

    styles = getSampleStyleSheet()
    DARK   = colors.HexColor("#1A1A2E")
    GOLD   = colors.HexColor("#E8C84A")
    GRAY   = colors.HexColor("#888888")
    RED    = colors.HexColor("#C62828")
    GREEN  = colors.HexColor("#2E7D32")
    LIGHT  = colors.HexColor("#F7F6F3")
    WHITE  = colors.white

    title_style = ParagraphStyle("title", parent=styles["Normal"],
        fontSize=26, textColor=DARK, fontName="Helvetica-Bold",
        spaceAfter=2)
    sub_style = ParagraphStyle("sub", parent=styles["Normal"],
        fontSize=11, textColor=GRAY, spaceAfter=12)
    h2_style = ParagraphStyle("h2", parent=styles["Normal"],
        fontSize=14, textColor=DARK, fontName="Helvetica-Bold",
        spaceBefore=14, spaceAfter=6)
    body_style = ParagraphStyle("body", parent=styles["Normal"],
        fontSize=10, textColor=DARK, leading=15)
    small_style = ParagraphStyle("small", parent=styles["Normal"],
        fontSize=9, textColor=GRAY)

    story = []

    # ── Header ────────────────────────────────────────────────────────────
    story.append(Paragraph("ExpenseIQ", title_style))
    period_label = month if month else "All time"
    story.append(Paragraph(f"Monthly Expense Report &bull; {period_label}", sub_style))
    story.append(HRFlowable(width="100%", thickness=1, color=DARK, spaceAfter=12))

    # ── Summary cards ─────────────────────────────────────────────────────
    card_data = [
        ["Total Spent",       "Transactions",     "Top Category",          "Daily Average"],
        [f"Rs.{summary['total']:,.0f}",
         str(summary["count"]),
         summary.get("top_category") or "—",
         f"Rs.{summary.get('daily_avg', 0):,.0f}"],
    ]
    card_table = Table(card_data, colWidths=["25%", "25%", "25%", "25%"])
    card_table.setStyle(TableStyle([
        ("BACKGROUND",  (0, 0), (-1, 0), DARK),
        ("TEXTCOLOR",   (0, 0), (-1, 0), GOLD),
        ("FONTNAME",    (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",    (0, 0), (-1, 0), 9),
        ("BACKGROUND",  (0, 1), (-1, 1), LIGHT),
        ("FONTNAME",    (0, 1), (-1, 1), "Helvetica-Bold"),
        ("FONTSIZE",    (0, 1), (-1, 1), 16),
        ("TEXTCOLOR",   (0, 1), (-1, 1), DARK),
        ("ALIGN",       (0, 0), (-1, -1), "CENTER"),
        ("VALIGN",      (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), None),
        ("TOPPADDING",  (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("GRID",        (0, 0), (-1, -1), 0.5, colors.HexColor("#EBEBEB")),
        ("ROUNDEDCORNERS", [4]),
    ]))
    story.append(card_table)
    story.append(Spacer(1, 14))

    # ── Category breakdown ─────────────────────────────────────────────────
    if summary["categories"]:
        story.append(Paragraph("Spending by Category", h2_style))
        cat_data = [["Category", "Amount (Rs.)", "% of Total", "Transactions"]]
        total = summary["total"]
        for cat in summary["categories"]:
            cat_txn_count = sum(1 for t in txns if t["category"] == cat["category"])
            cat_data.append([
                cat["category"],
                f"Rs.{cat['total']:,.0f}",
                f"{cat['pct']}%",
                str(cat_txn_count),
            ])
        cat_table = Table(cat_data, colWidths=["40%", "22%", "20%", "18%"])
        cat_table.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, 0), DARK),
            ("TEXTCOLOR",     (0, 0), (-1, 0), WHITE),
            ("FONTNAME",      (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE",      (0, 0), (-1, -1), 9),
            ("ALIGN",         (1, 0), (-1, -1), "RIGHT"),
            ("ALIGN",         (0, 0), (0, -1), "LEFT"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, LIGHT]),
            ("GRID",          (0, 0), (-1, -1), 0.3, colors.HexColor("#EBEBEB")),
            ("TOPPADDING",    (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING",   (0, 0), (-1, -1), 8),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
        ]))
        story.append(cat_table)
        story.append(Spacer(1, 14))

    # ── Transactions table ─────────────────────────────────────────────────
    if txns:
        story.append(Paragraph("All Transactions", h2_style))
        txn_data = [["Date", "Category", "Amount (Rs.)"]]
        for t in sorted(txns, key=lambda x: x["date"], reverse=True):
            txn_data.append([
                t["date"], t["category"],
                f"Rs.{t['amount']:,.0f}"
            ])
        # Totals row
        txn_data.append(["", "TOTAL", "", f"Rs.{summary['total']:,.0f}"])

        txn_table = Table(txn_data, colWidths=["20%", "40%", "40%"])
        total_row = len(txn_data) - 1
        txn_table.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, 0), DARK),
            ("TEXTCOLOR",     (0, 0), (-1, 0), WHITE),
            ("FONTNAME",      (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE",      (0, 0), (-1, -1), 8),
            ("ALIGN",         (3, 0), (3, -1), "RIGHT"),
            ("ROWBACKGROUNDS", (0, 1), (-1, total_row - 1), [WHITE, LIGHT]),
            ("BACKGROUND",    (0, total_row), (-1, total_row), colors.HexColor("#E8E8E8")),
            ("FONTNAME",      (0, total_row), (-1, total_row), "Helvetica-Bold"),
            ("TEXTCOLOR",     (3, total_row), (3, total_row), DARK),
            ("GRID",          (0, 0), (-1, -1), 0.3, colors.HexColor("#EBEBEB")),
            ("TOPPADDING",    (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING",   (0, 0), (-1, -1), 6),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 6),
        ]))
        story.append(txn_table)

    # ── Footer ─────────────────────────────────────────────────────────────
    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="100%", thickness=0.5, color=GRAY))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        f"Generated by ExpenseIQ &bull; {datetime.now().strftime('%d %b %Y, %H:%M')}",
        small_style
    ))

    doc.build(story)
    buf.seek(0)

    filename = f"expenseiq_report_{month or 'all'}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ── Delete month ────────────────────────────────────────────────────────────
@app.delete("/api/transactions/{month_key}")
def delete_month(month_key: str):
    with get_db() as conn:
        conn.execute("DELETE FROM transactions WHERE month_key = ?", (month_key,))
        conn.commit()
    return {"message": f"Deleted all transactions for {month_key}"}
