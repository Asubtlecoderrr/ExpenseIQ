# ExpenseIQ — Full Stack Setup Guide

<img width="1125" height="861" alt="Screenshot 2026-04-13 at 8 22 53 PM" src="https://github.com/user-attachments/assets/d106edd6-2a0b-41ed-a4a5-abfa9958a02d" />


## Stack
- **Frontend**: React (JSX) — runs in Claude artifact or any React app
- **Backend**: Python FastAPI — runs locally on port 8000
- **Database**: SQLite (auto-created as `expenseiq.db`)
- **AI**: 🦙 Ollama (Llama3 - local, no API key needed)
- **PDF**: ReportLab

---

## 1. Backend Setup

```bash
pip install -r requirements.txt

# Start the server
uvicorn main:app --reload --port 8000
```

The server starts at http://localhost:8000
API docs at http://localhost:8000/docs

---

## 2. AI Setup (Ollama — REQUIRED for insights)

```bash
# Install ollama (if not installed)
brew install ollama   # Mac
# or download from https://ollama.com

# Run model
ollama run llama3
```

⚠️ Keep Ollama running in background
Backend uses: http://localhost:11434

---

## 3. Frontend Setup

Option A — Use the .jsx file in a React project:
```bash
npx create-react-app expenseiq
cd expenseiq
# Replace src/App.js with ExpenseIQ_App.jsx contents
npm start
```

Option B — Use in Vite:
```bash
npm create vite@latest expenseiq -- --template react
cd expenseiq
npm install
# Replace src/App.jsx with ExpenseIQ_App.jsx contents
npm run dev
```

---

## 4. CSV Format

Your CSV must have these exact columns:
```
Date,Category,Amount,Flow
13-Apr-26,Grocery,551,outward
13-Apr-26,Salary/Income,1414.82,inward
09-Apr-26,Investment,34000,outward
```

### 🔁 Flow Meaning (VERY IMPORTANT)
| Flow | Meaning |
|--------|----------|
| outward	| Expense (money spent) |
| inward |	Income / refund / cashback |

### Supported categories:
- Food & Drinks
- Grocery
- Transport
- Entertainment
- Health
- Utilities
- Shopping
- Travel
- Education
- Others

---

## 5. API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/upload | Upload CSV file |
| GET | /api/months | List all months with data |
| GET | /api/transactions | Get transactions (filter by month/category) |
| GET | /api/summary | Get spending summary + category breakdown |
| GET | /api/insights | Get AI-powered insights (needs API key) |
| GET | /api/budgets | Get all budgets |
| POST | /api/budgets | Set/update a budget |
| DELETE | /api/budgets/{category} | Delete a budget |
| GET | /api/report/pdf | Download PDF report |
| DELETE | /api/transactions/{month} | Delete a month's data |

---

## 6. Metrics Explained

| Metric	| Meaning |
|----------|----------|
| Total Spend	| Only outward expenses (excludes investments) |
| Income	| All inward cash |
| Investment	| Money invested (tracked separately) |
| Net	| Income - Spend |
| Daily Avg	| Avg spend per active day |
---

## Features

- Upload CSV (bank statements → clean format)
- Smart classification (Flow-based)
- Spend vs Income vs Investment tracking
- Clean dashboard (no misleading totals)
- Category breakdown (top categories only)
- Transaction search + filters
- AI Insights (local LLM via Ollama)
- PDF reports (ReportLab)
- Persistent SQLite storage
