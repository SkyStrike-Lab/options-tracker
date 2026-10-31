# Options Tracker

A lightweight, local-first stock option tracker designed for manual entry of complex multi-leg trades and automated lifecycle accounting. Optimized for IBKR-style data entry with spread grouping, rollover campaigns, dual P&L reporting, and a comprehensive performance summary dashboard.

> [!WARNING]
> **Financial & Valuation Disclaimer**: This repository is provided **AS-IS** without any warranties of any kind. The author(s) and contributor(s) are not responsible or liable for any financial loss, transaction accounting discrepancies, incorrect portfolio valuations, trading errors, or damages resulting from bugs or errors in this project. Use at your own risk.

---

## Features & Capabilities

- **Multi-Leg Spread Support & Smart Entry**: Group multiple option legs (Verticals, Iron Condors, Put/Call Spreads) under a single trade. Features auto-contract naming, default Friday expirations, and intelligent pairing (e.g. auto-pairing STO/BTO legs).
- **Rollover Campaigns & Roll Matrix**: Roll single positions or multi-leg groups forward in time or strike using the interactive Roll Matrix. Automatic campaign tracking (`campaign_id`, `rolled_from_id`, `roll_count`) and cumulative campaign P&L across roll cycles.
- **Unified Options Lifecycle Accounting**: Support for all resolution outcomes:
  - **TRADED**: Standard Buy-to-Close (BTC) or Sell-to-Close (STC).
  - **EXPIRED**: Expired worthless (100% max profit kept, auto $0 close transaction).
  - **ASSIGNED / CALLED AWAY**: Automatic calculation of **Effective Stock Basis** (`Strike - Net Premium` for puts, `Strike + Net Premium` for covered calls) with delivery memos for stock transition.
- **Dual P&L Reporting (API Integration)**:
  - `cash_flow_pnl_usd`: Raw options cashflow P&L.
  - `broker_adjusted_pnl_usd`: Broker-aligned accounting ($0 on assignment so stock lot can be entered at Effective Basis in external portfolio managers without double-counting).
- **Lifetime Performance Summary Dashboard**:
  - **KPI Cards**: Lifetime Net P&L (Cash Flow vs Broker-Adjusted), Win Rate % & Profit Factor, Premium Capture Rate % (retained credit vs initial net credit), Average Hold Time & Velocity.
  - **Lifecycle Outcome Distribution**: Visual bars for Closed Early, Managed Losses, Expired Worthless, and Assigned.
  - **Monthly Income Flow**: Month-by-month cashflow volume bars.
  - **Ticker Leaderboard**: Breakdown of win rate, net P&L, and trade count by underlying ticker.
- **Strategy Command Center (`details.html`)**: Dedicated deep-dive view with contract specs, IBKR market pricing, transaction history ledger, and lifecycle campaign timeline.
- **Undo Close / Reopen**: Safe one-click reopening of accidentally closed positions/groups.
- **Live Market Data Integration**: Reads `ib_data.json` to display live option quotes and unrealized profits.

---

## Tech Stack

- **Backend**: FastAPI (Python 3.11)
- **Database**: SQLite with SQLAlchemy ORM & Alembic migrations
- **Frontend**: Vanilla HTML5, CSS3, and ES6+ JavaScript
- **Containerization**: Docker & Docker Compose

---

## Quick Start

### Prerequisites
- Docker and Docker Compose installed.

### Run with Docker
1. Navigate to the project directory:
   ```bash
   cd services/options-tracker
   ```
2. Build and start the container:
   ```bash
   rtk docker compose up -d --build
   ```
3. Access the UI at `http://localhost:8000`.

---

## Configuration

The application can be configured via environment variables in `docker-compose.yml`:

- `ROOT_PATH`: Set this if hosting behind a reverse proxy on a non-root path (e.g., `/options`).
- `DATABASE_URL`: Path to the SQLite database file (default: `sqlite:///./data/options.db`).
- `IB_DATA_FILE`: Path to the IBKR portfolio/prices JSON file (default: `data/ib_data.json`).

---

## UI & Workflow Guide

### 1. Action Column Icon Buttons
- **`[ℹ️]` Toggle Leg Details / Drawer**: Expand or collapse individual legs and transaction history within a position row.
- **`[🔄]` Roll Matrix**: Open the Roll Matrix modal to roll single positions or multi-leg groups forward in expiration or strike.
- **`[✅]` Close Position / Group**: Close a position or group with specified outcomes (`TRADED`, `EXPIRED`, or `ASSIGNED`/`CALLED AWAY`).
- **`[•••]` More Options**: Access dropdown actions including Edit, Strategy Details (`details.html`), Delete, and Reopen.

### 2. Closing with Outcomes
- **Traded**: Standard market close.
- **Expired**: Records expiration worthless (100% credit kept, $0 close transaction).
- **Assigned / Called Away**: Computes Effective Stock Basis (`Strike - Net Premium` / `Strike + Net Premium`) and logs stock delivery memos.

### 3. Rolling via Roll Matrix Modal
- Select legs to roll, specify new expiration dates and strikes, and generate roll transactions while linking campaign history (`campaign_id`, `roll_count`).

### 4. Strategy Details (`/details?group_id=...`)
- Deep-dive into specific position groups, inspecting contract specifications, transaction ledgers, IBKR market pricing, and cumulative campaign timelines.

### 5. Performance Summary Tab
- Review lifetime KPIs, outcome distributions, monthly cash flow charts, and ticker leaderboards.

---

## Project Structure

```text
services/options-tracker/
├── backend/            # FastAPI source code
│   ├── main.py         # Entry point & API routes
│   ├── models.py       # SQLAlchemy database models
│   ├── schemas.py      # Pydantic validation models
│   ├── migrations/     # Alembic database migrations
│   └── crud.py         # Database operations
├── frontend/           # Static assets
│   ├── index.html      # Main UI
│   ├── details.html    # Strategy Command Center UI
│   ├── style.css       # Custom styling & layout
│   ├── app.js          # Main UI logic & API integration
│   └── details.js      # Strategy Details logic
├── data/               # Persistent SQLite database & market data
├── Dockerfile          # Container definition
├── docker-compose.yml  # Deployment configuration
└── alembic.ini         # Alembic configuration
```

---

## Key API Endpoints Reference

| Endpoint | Method | Description |
| :--- | :---: | :--- |
| `/api/positions` | `GET` | Fetch open/closed positions with live IB quotes and dual P&L. |
| `/api/positions/batch` | `POST` | Add a new multi-leg spread or single position. |
| `/api/positions/{id}/close` | `POST` | Close an individual position with outcome & effective basis. |
| `/api/positions/group/{id}/close` | `POST` | Close an entire position group with outcome & effective basis. |
| `/api/positions/{id}/roll` | `POST` | Roll an individual position forward with campaign tracking. |
| `/api/positions/group/{id}/roll` | `POST` | Roll a position group forward with campaign tracking. |
| `/api/positions/{id}/reopen` | `POST` | Safely reopen a closed position (Undo Close). |
| `/api/groups/{id}/reopen` | `POST` | Safely reopen a closed position group (Undo Close). |
| `/api/campaigns/{id}` | `GET` | Fetch campaign timeline and cumulative P&L. |
| `/api/analytics/summary` | `GET` | Lifetime performance stats, outcomes, monthly flow, and ticker leaderboard. |
| `/api/deliveries` | `GET` | Fetch stock delivery memos (assignments, called away, exercises). |
| `/api/deliveries/{id}` | `GET` | Fetch a specific stock delivery memo by ID. |

---

## Database Migrations

This project uses **Alembic** to manage database schema updates.

### Running Migrations
To upgrade the database to the latest schema:
```bash
rtk alembic upgrade head
```

### Creating a New Migration
To generate a new database migration script after making changes to database models in `models.py`:
```bash
rtk alembic revision --autogenerate -m "migration_description" --rev-id "00X"
```
*(Always specify `--rev-id` using sequential running numbers like `002`, `003`, etc., for readable versioning)*
