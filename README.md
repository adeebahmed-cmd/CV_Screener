# APD CV Ranker

A **100% local, privacy-first** CV screening and ranking tool for HR teams.

Upload a Job Description, let the local LLM extract a weighted keyword model, upload up to 100 candidate CVs, and get an instant ranked shortlist — all on your own machine. No candidate data ever leaves your device.

---

## Features

- **JD Analysis** — paste or upload a JD (PDF, DOCX, TXT). The LLM extracts concise 1–3 word keywords grouped by category (Domain, Capability, Leadership, Finance, Research, L&D, Tools, Soft Skills), each with a weight and must-have / good-to-have flag, plus education and experience requirements. Fully editable before saving.
- **Programmatic Ranking** — instant, no LLM required. Candidates are scored using a 4-tier keyword matching engine (exact → token → synonym → stem), with section-aware boosts, recency multipliers, role alignment bonus, education and experience scoring, and relative normalisation. Handles up to 100 CVs.
- **Deep Evaluation** — click "Run Deep Eval" on any candidate for a full LLM-generated report: matched keywords, missing keywords, experience assessment, and a written explanation. Printable as PDF.
- **Candidate Decisions** — mark each candidate as Shortlisted, Interview, Rejected, or On Hold directly in the ranking table, with optional notes.
- **Keyword Repository** — maintain a shared library of approved keywords that can be imported into any job model.
- **Analytics** — score distribution chart, top missing keywords, and LLM usage stats (calls, latency, failures).
- **OCR support** — scanned PDFs with no text layer are automatically processed via Tesseract OCR.
- **Auth** — optional password or Google SSO login to restrict access when sharing the app on a network.
- **Always-on deployment** — runs as a systemd service; no terminal needed after initial setup.
- **Fully offline after setup** — no cloud API keys, no subscriptions.

---

## Requirements

| Requirement | Version |
|---|---|
| Python | 3.11 or 3.12 |
| Node.js | 18 or newer |
| Ollama | latest |
| Tesseract (optional) | any | For scanned PDF support |

---

## One-time setup

### 1. Install prerequisites

- **Node.js** — https://nodejs.org
- **Python 3.11+** — https://www.python.org/downloads/
- **Ollama** — https://ollama.com

### 2. Pull models

```bash
ollama pull phi3:mini        # JD analysis and deep evaluation
ollama pull qwen2.5:1.5b     # Fast ranking (optional — falls back to phi3:mini)
```

`phi3:mini` (3.8B) is used for JD analysis and deep evaluation.
`qwen2.5:1.5b` is recommended as the ranking model — faster for bulk ops.

> See [Choosing a model](#choosing-a-model) below for hardware-specific guidance.

### 3. Start the app

**Mac / Linux:**
```bash
chmod +x start.sh
./start.sh
```

**Windows** — double-click `start.bat`

The first run installs all dependencies automatically, then starts:
- FastAPI backend + built React frontend on **http://localhost:8000**
- Vite dev server on **http://localhost:5173** (development only)

### 4. (Optional) Always-on via systemd (Linux)

```bash
sudo cp hr-screener.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now hr-screener
```

The app will start automatically on boot and restart on failure.

---

## Usage

1. Open **http://localhost:8000** in your browser.
2. Click **New Job** in the sidebar.
3. Paste or upload your JD and click **Analyze JD**. Wait for the LLM to extract the keyword model (~4–8 minutes on CPU).
4. Review and adjust keyword weights and must-have flags. Click **Save Job Model**.
5. On the job page, drop up to **100 CV files** and click **Upload & Rank Candidates**. Ranking is instant (no LLM call).
6. Use the decision dropdown on each candidate to shortlist, reject, or flag for interview.
7. Click any candidate name to run a **Deep Eval** for a detailed written breakdown.
8. Use **Print / Export PDF** on the evaluation page to save the report.

All jobs, CVs, rankings, and evaluations are saved locally in `backend/data/apd.db` (SQLite) and survive restarts.

---

## Configuration

Edit `backend/.env` to configure the app:

```env
OLLAMA_URL=http://localhost:11434    # Ollama server address
OLLAMA_MODEL=qwen2.5:1.5b           # Default / ranking model
RANKING_MODEL=phi3:mini             # Override for ranking (optional)
MAX_FILE_MB=10                      # Max upload size per CV

# Auth (leave blank for no login required)
ADMIN_PASSWORD=yourpassword         # Enable password login
# GOOGLE_CLIENT_ID=xxx              # Enable Google SSO instead

JWT_SECRET=change-me-in-production  # Set a long random string for persistent sessions
```

---

## Choosing a model

| Model | Size | Speed (CPU) | Best for |
|---|---|---|---|
| `phi3:mini` | 3.8B | ~4–8 min/JD | **Recommended for JD analysis** |
| `qwen2.5:1.5b` | 1.5B | ~2 min/deep eval | **Recommended for deep eval and ranking** |
| `qwen2.5:3b` | 3B | moderate | Better quality deep eval |
| `llama3.1:8b` | 8B | very slow | Not recommended on CPU-only |

Pull any model with `ollama pull <model>`, then set it in **Settings** inside the app.

---

## Project structure

```
HR_Screener/
├── backend/
│   ├── main.py               App entry point, static file serving, lifespan
│   ├── auth.py               JWT creation and Google token verification
│   ├── config.py             Environment config and auth type detection
│   ├── models.py             SQLAlchemy ORM (Job, CV, BulkRanking, DetailedEvaluation, LLMLog, ...)
│   ├── schemas.py            Pydantic request/response schemas
│   ├── llm.py                Ollama HTTP client with retry and warmup logic
│   ├── parsers.py            PDF/DOCX/TXT extraction, OCR fallback, candidate name detection
│   ├── prompts.py            LLM prompts — JD analysis, bulk ranking, deep eval
│   ├── db.py                 SQLAlchemy session setup
│   └── routes/
│       ├── jobs.py           Job CRUD, CV upload, programmatic ranking engine
│       ├── cvs.py            CV detail, deep evaluation, delete
│       ├── auth.py           Login endpoints (password, Google SSO)
│       ├── settings.py       Ollama model configuration
│       ├── analytics.py      Score distribution, LLM usage stats
│       ├── repository.py     Keyword repository CRUD and approval
│       └── users.py          User management (admin only)
├── frontend/
│   ├── index.html
│   ├── public/
│   │   └── favicon.svg
│   └── src/
│       ├── pages/
│       │   ├── Dashboard.jsx       Job list and stats
│       │   ├── NewJob.jsx          JD upload, analysis, and keyword editing
│       │   ├── JobDetail.jsx       CV upload, ranking table, decisions
│       │   ├── CVDetail.jsx        Deep evaluation report
│       │   ├── Analytics.jsx       Score charts and LLM stats
│       │   ├── Repository.jsx      Keyword repository management
│       │   ├── Users.jsx           User management (admin)
│       │   ├── Settings.jsx        Model config and LLM log
│       │   └── Login.jsx           Password / Google login
│       ├── components/
│       │   ├── KeywordEditor.jsx   Weight sliders, must-have flags, education fields
│       │   ├── RankingTable.jsx    Sortable ranked table with decision dropdowns
│       │   ├── FileDropzone.jsx    Drag-and-drop file upload
│       │   ├── ProtectedRoute.jsx  Auth guard wrapper
│       │   ├── ConfirmDialog.jsx   Delete confirmation modal
│       │   └── LoadingOverlay.jsx  Full-screen loading with elapsed timer
│       ├── contexts/
│       │   └── AuthContext.jsx     Auth state provider
│       └── api.js                  REST API client
├── hr-screener.service       systemd service unit file
├── start.sh                  Launcher for Mac / Linux
├── start.bat                 Launcher for Windows
└── README.md
```

---

## Troubleshooting

**JD analysis is slow (~4–8 minutes)**
- This is normal for CPU-only inference with phi3:mini. The elapsed timer confirms the app is working.
- The model stays loaded in memory for 30 minutes after last use — subsequent analyses are faster.
- A GPU will reduce this to under 30 seconds.

**"LLM call failed. Is Ollama running?"**
- Linux: run `ollama serve` or check `systemctl status ollama`.
- Windows/Mac: make sure the Ollama app is running.
- In the app go to **Settings → Test connection**.

**"Model not found"**
- Run `ollama list` to see installed models.
- Pull the model: `ollama pull phi3:mini`
- Go to Settings, enter the model name, and save.

**Scanned PDF returns no text / zero score**
- Install Tesseract: `sudo apt install tesseract-ocr` (Linux) or from https://github.com/UB-Mannheim/tesseract/wiki (Windows).
- The app automatically falls back to OCR when a PDF has no text layer.

**Port already in use**
- Backend: edit `start.sh` / `start.bat` and change `--port 8000`.
- Frontend (dev): edit `frontend/vite.config.js` and update `server.port`.

**Delete all data and start fresh**
- Stop the app, delete `backend/data/apd.db`. It is recreated empty on next run.

---

## Privacy

- No network calls to any external LLM service.
- All inference runs locally on `localhost:11434` via Ollama.
- JDs and CVs are stored only in the local SQLite database on your machine.
- The frontend communicates only with the local backend on `localhost:8000`.
