# Campus Customs — Yale Bulldog Blue (AI Foundations, Homework 4)

A storefront for **Campus Customs**, the officially licensed Yale shop at 57 Broadway, New Haven. It has a React frontend and a FastAPI backend, and **Dan**, a PydanticAI shopping assistant, answers from the live SQLite catalogue:
- stock and prices;
- search results that update the page;
- saved customer memory for logged-in shoppers;
- safety rules;
- an append-only audit trail.

## Repository layout

```
hw4/
├── AI_prompts.md            # prompt log for every problem
├── requirements.txt         # Python dependencies (backend)
├── .env.example             # copy to .env and add your Portkey key
├── .gitignore
├── README.md
├── frontend/                # Vite + React + TypeScript app
├── backend/
│   ├── main.py              # FastAPI app — run with: uvicorn main:app --reload --port 8000
│   ├── agent.py             # ┐
│   ├── models.py            # │ the agent: wiring, structured types,
│   ├── tools.py             # │ tools, and system prompt
│   └── prompts/prompt.md    # ┘
└── output/
    ├── harness.md           # full system reference (start here) + build log
    ├── design.md            # Problem 10 design refresh
    ├── usability.md         # Problem 9 improvements, with measurements
    ├── app_check.html       # Problem 11 live-site test report (double-click to open)
    ├── app_check_images/    # screenshots linked from app_check.html
    └── audit_trail.json     # append-only log of agent-loop activity
```

The agent is the four files under `backend/`: `prompts/prompt.md`, `agent.py`, `tools.py`, and `models.py`. `main.py` is the API that serves the site and calls the agent.

## 1. Place the data pack (not in git)

The database and product photos are distributed separately. Unzip the course data pack (`data-3`) so that this folder exists **inside `hw4/`**:

```
hw4/data/
├── campus_customs.db        # SQLite: catalogue, inventory, users, chat_messages
└── products/                # product images referenced by catalogue.image_file_path
```

`image_file_path` values look like `products/basic-hoodie-big-yale.jpg`, relative to `data/`. The backend serves them at `/media/products/…`.

## 2. Configure

```bash
cd hw4
cp .env.example .env         # then edit .env and set PORTKEY_API_KEY
```

`PORTKEY_API_KEY` is required for the chat; the rest of the site works without it. The backend reads the nearest `.env` it finds: in `backend/`, in `hw4/`, or up to two folders above `hw4/`. The model defaults to `gpt-5.6-luna` (`AGENT_MODEL`).

## 3. Run the backend (terminal 1)

Requires **Python 3.12+** (developed on 3.14).

```bash
cd hw4
python3 -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cd backend
uvicorn main:app --reload --reload-include "*.md" --port 8000
```

- Check it at http://localhost:8000/api/health, which should return `{"status":"ok"}`.
- `--reload-include "*.md"` restarts the server when `prompts/prompt.md` changes. The agent and its prompt are built once and cached, so otherwise prompt edits need a manual restart.

## 4. Run the frontend (terminal 2)

Requires **Node 20.19+** (developed on Node 24).

```bash
cd hw4/frontend
npm install
npm run dev                          # http://localhost:5173
```

Open **http://localhost:5173**. The Vite dev server proxies `/api` and `/media` to the backend on port 8000, so start the backend first. To use a different backend, set `API_TARGET=http://127.0.0.1:<port> npm run dev`.

Other scripts: `npm run build` (type-check and production build) and `npm run lint`.

## 5. Try it

- **Shop:** search "hoodies", filter Navy + Size M, and sort by price.
- **Product page:** click any product, pick a size, then **Ask Dan about this**.
- **Chat with Dan** (bottom right):
  - "What hoodies do you have?" updates the Products page.
  - On a product page, "Do you have this in pink?" or "How many are left in XL?" answer about that product.
- **Accounts:** log in with the seed user **`test@campuscustoms.yale.edu`** / **`password`**, or create an account. Logged-in chats are saved and reloaded; guest chats are not.
- **Audit trail:** each chat turn appends entries to `output/audit_trail.json`.

## Documentation

- [`output/harness.md`](output/harness.md) is the system reference: architecture, specs (models, loop limits, result caps), tools, model fields, safety rules, the audit trail, and routes.
- [`output/usability.md`](output/usability.md), [`output/design.md`](output/design.md), and [`output/app_check.html`](output/app_check.html) cover the Problem 9–11 write-ups.
