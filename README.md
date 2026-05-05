# HR Screener

A **100% local, privacy-first** CV screening and ranking tool for HR teams.

Upload a Job Description, let the local LLM extract a weighted keyword model, then upload up to 20 candidate CVs and get a ranked shortlist — all on your own machine. No candidate data ever leaves your device.

---

## Features

- **JD Analysis** — paste or upload a JD (PDF, DOCX, TXT). The LLM extracts concise 1–3 word keywords grouped by category (Domain, Capability, Leadership, Finance, Research, L&D, Tools, Soft Skills), each with a weight and must-have / good-to-have flag. Fully editable before saving.
- **Bulk Ranking** — upload up to 20 CVs. Candidates are ranked in batches of 5 (keeping each prompt within the model's context window), scores are merged into one sorted table with summaries.
- **Deep Evaluation** — click "Deep Eval" on any candidate for a detailed report: radar chart of category scores, matched keywords, missing keywords, experience assessment, and a written explanation. Printable as PDF.
- **Export** — download the ranking table as a CSV with one click.
- **Fully offline after setup** — no cloud API keys, no subscriptions.

---

## Requirements

| Requirement | Version |
|---|---|
| Python | 3.11 or 3.12 |
| Node.js | 18 or newer |
| Ollama | latest |

---

## One-time setup

### 1. Install prerequisites

- **Node.js** — https://nodejs.org
- **Python 3.11** — https://www.python.org/downloads/
- **Ollama** — https://ollama.com

> On Windows: accept defaults for each installer. Restart after installing Ollama.

### 2. Pull a model

```bash
ollama pull phi3.5
```

`phi3.5` (3.8B) is the recommended default — good reasoning, fast on CPU, works well within context limits.

> See [Choosing a model](#choosing-a-model) below for hardware-specific guidance.

### 3. Start the app

**Windows** — double-click `start.bat`

**Mac / Linux:**
```bash
chmod +x start.sh
./start.sh
```

The first run installs all dependencies automatically, then starts:
- FastAPI backend on `http://localhost:8000`
- Vite frontend on `http://localhost:5173`

---

## Usage

1. Open **http://localhost:5173** in your browser.
2. Click **Create New Job** on the dashboard.
3. Paste or upload your JD and click **Analyze JD**.
4. Review the extracted keyword model. Adjust weights and must-have / good-to-have flags. Click **Save Job Model**.
5. On the job page, drop up to **20 CV files** and click **Upload & Rank Candidates**.
   - CVs are ranked in batches of 5 and merged into one list. Expect ~90 seconds per batch on CPU.
6. Click **Deep Eval** on any candidate to see a full breakdown.
7. Use **Export CSV** to download the ranking table, or **Print / Export PDF** on the evaluation page.

All jobs, CVs, rankings, and evaluations are saved locally in `backend/data/apd.db` (SQLite) and survive restarts.

---

## Choosing a model

This app runs entirely on CPU via Ollama. Model size directly affects speed.

| Model | Size | Speed (CPU) | Notes |
|---|---|---|---|
| `phi3.5` | 3.8B | ~6–8 tok/s | **Recommended default** — fast, good JSON accuracy |
| `llama3.2:3b` | 3B | ~6–8 tok/s | Good alternative |
| `qwen2.5:3b` | 3B | ~6–8 tok/s | Excellent structured output |
| `llama3.1:8b` | 8B | ~2–3 tok/s | Better reasoning, but slow on CPU — may timeout |
| 13B+ models | — | <1 tok/s | Not recommended for CPU-only machines |

Pull any model with `ollama pull <model-name>`, then set it in **Settings** inside the app.

You can also set a separate (faster) model for bulk ranking and a smarter model for deep evaluation — both are configurable in Settings.

---

## Project structure

```
HR_Screener/
├── backend/
│   ├── main.py           App entry point, CORS, lifespan
│   ├── models.py         SQLAlchemy ORM (Job, CV, BulkRanking, DetailedEvaluation)
│   ├── schemas.py        Pydantic request/response schemas
│   ├── llm.py            Ollama HTTP client with retry logic
│   ├── parsers.py        PDF / DOCX / TXT extraction and profile building
│   ├── prompts.py        The 3 LLM prompts — JD analysis, bulk ranking, deep eval
│   ├── config.py         Environment config
│   ├── db.py             SQLAlchemy session setup
│   ├── routes/
│   │   ├── jobs.py       Job CRUD, CV upload, batch ranking
│   │   ├── cvs.py        CV detail and deep evaluation
│   │   └── settings.py   Ollama model configuration
│   └── data/apd.db       SQLite database (created on first run, gitignored)
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── Dashboard.jsx    Job list, stats
│       │   ├── NewJob.jsx       JD upload and analysis
│       │   ├── JobDetail.jsx    CV upload and ranking
│       │   ├── CVDetail.jsx     Deep evaluation report
│       │   └── Settings.jsx     Model configuration
│       ├── components/
│       │   ├── KeywordEditor.jsx   Weight sliders and must-have toggles
│       │   ├── RankingTable.jsx    Sortable ranked table with CSV export
│       │   ├── CategoryRadar.jsx   Recharts radar chart
│       │   ├── FileDropzone.jsx    Drag-and-drop file upload
│       │   ├── ConfirmDialog.jsx   Delete confirmation modal
│       │   └── LoadingOverlay.jsx  Full-screen loading with elapsed timer
│       └── api.js                  REST API client
├── start.sh              Launcher for Mac / Linux
├── start.bat             Launcher for Windows
└── README.md
```

---

## Troubleshooting

**"LLM call failed. Is Ollama running?"**
- Windows: check for the Ollama icon in the system tray.
- Mac: the Ollama app must be open.
- Linux: run `ollama serve` in a terminal.
- In the app go to **Settings → Test connection**.

**"Model not found"**
- Run `ollama list` to see installed models.
- Pull the model: `ollama pull phi3.5`
- Go to Settings, enter the model name, and click **Save**.

**Ranking is slow**
- Expected: ~90 seconds per batch of 5 CVs on a CPU-only machine.
- The elapsed timer in the loading screen confirms the app is working.
- For faster results, use a smaller model (`phi3.5`, `llama3.2:3b`) or a machine with a GPU.

**Port already in use (8000 or 5173)**
- Backend: edit `start.bat` / `start.sh` and change `--port 8000`.
- Frontend: edit `frontend/vite.config.js` and update `server.port`.

**Delete all data and start fresh**
- Stop the app, delete `backend/data/apd.db`. It is recreated empty on next run.

---

## Privacy

- No network calls to any external LLM service.
- All inference runs locally on `localhost:11434` via Ollama.
- JDs and CVs are stored only in the local SQLite database on your machine.
- The frontend only communicates with the local backend on `localhost:8000`.
