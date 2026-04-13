# ExpenseIQ — Full Stack Setup Guide

## Stack
- **Frontend**: React (JSX) — runs in Claude artifact or any React app
- **Backend**: Python FastAPI — runs locally on port 8000
- **Database**: SQLite (auto-created as `expenseiq.db`)
- **AI**: Anthropic Claude (claude-sonnet) for insights
- **PDF**: ReportLab

---

## 1. Backend Setup

```bash
cd backend
pip install -r requirements.txt

# Set your Anthropic API key (required for AI insights)
export ANTHROPIC_API_KEY=sk-ant-...

# Start the server
uvicorn main:app --reload --port 8000
```

The server starts at http://localhost:8000
API docs at http://localhost:8000/docs

---

## 2. Frontend Setup

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

Option C — Upload to Claude.ai as an artifact and run directly.

---

## 3. CSV Format

Your CSV must have these exact columns:
```
date,merchant,amount,category
2026-04-01,Zomato,480,Food & Dining
2026-04-02,BigBasket,1240,Groceries
2026-04-03,Rapido,120,Transport
```

### Supported categories:
- Food & Dining
- Groceries
- Transport
- Entertainment
- Health
- Utilities
- Shopping
- Travel
- Education
- Other

---

## 4. API Endpoints

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

## 5. Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| ANTHROPIC_API_KEY | Yes (for AI) | Your Anthropic API key |

---

## Features

- Upload monthly transaction CSVs
- Persistent SQLite database
- Month selector to compare periods
- Category-wise spending breakdown with charts
- AI insights powered by Claude (warns about overspending, gives tips)
- Budget tracking with over-budget alerts (saved to DB)
- One-click PDF report download (styled with ReportLab)
- Full transaction search + filter table
- Analytics page with spark charts per category
