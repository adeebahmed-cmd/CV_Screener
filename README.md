# APD CV Ranker

A **100% local, privacy-first** web application that helps the HR Recruitment team at APD India
analyze Job Descriptions (JDs) and rank candidate CVs against them using a local open-source LLM.

No candidate data ever leaves your machine. After the initial setup, the app works **fully offline**.

---

## What it does

1. **Analyze a Job Description** – upload or paste a JD. The local LLM extracts a structured,
   weighted keyword model (Domain, Capability, Leadership, Finance, Research, L&D, Tools, Soft Skills).
   HR can tweak every weight and must-have/good-to-have flag before saving.
2. **Rank candidates** – upload up to 5 CVs against a saved job model. The LLM produces a ranked
   table of candidates with scores and one-line summaries.
3. **Deep-evaluate a candidate** – click "Deep Eval" on any ranked CV for a detailed report: radar
   chart of category scores, matched keywords, missing keywords (with must/good-to-have
   distinction), experience assessment, and a written explanation. Printable / exportable as PDF.

---

## One-time setup

You only need to do this **once** per machine.

### 1. Install prerequisites

- **Node.js** (version 18 or newer) — https://nodejs.org
- **Python 3.11** — https://www.python.org/downloads/
- **Ollama** (local LLM runtime) — https://ollama.com

> On Windows: install each and accept the defaults. Restart your computer after installing Ollama.

### 2. Pull the default model

Open a terminal and run:

```bash
ollama pull qwen2.5:7b-instruct
```

This downloads the LLM (~4.7 GB) and caches it locally. You can switch to any other Ollama model
later from the Settings page.

### 3. Start the app

- **Windows**: double-click `start.bat`
- **Mac / Linux**: open a terminal in this folder and run:

```bash
chmod +x start.sh
./start.sh
```

The first run will:
- create a Python virtual environment in `backend/.venv`
- install Python dependencies
- install frontend dependencies (`npm install`)
- start the FastAPI backend on `http://localhost:8000`
- start the Vite frontend on `http://localhost:5173`

---

## Opening the app

Once the start script prints that both servers are running, open your browser and visit:

**http://localhost:5173**

---

## Typical workflow

1. Click **Create New Job** on the dashboard.
2. Paste the JD text (or upload a PDF/DOCX/TXT) and click **Analyze JD**.
   - The first call to a freshly started model can take 30–60 seconds on CPU.
3. Review the extracted keyword model. Adjust weights with the sliders and switch must-have /
   good-to-have as needed. Click **Save Job Model**.
4. On the job page, drop up to 5 CV files into the upload zone and click **Upload**, then
   **Rank Candidates**.
5. In the ranking table, click **Deep Eval** on any candidate to see a full detailed report.
6. Use **Print / Export PDF** on the evaluation page to save or share a candidate report.

All jobs, CVs, rankings and evaluations persist locally in `backend/data/apd.db` (SQLite) and
survive restarts.

---

## Switching models

1. Go to **Settings** in the sidebar.
2. Enter any Ollama model name (e.g. `llama3.1:8b-instruct`, `mistral:7b-instruct`, `qwen2.5:14b-instruct`).
3. Make sure the model is pulled first: `ollama pull <model-name>`
4. Click **Test connection** to verify Ollama is running and the model is available.
5. Click **Save**.

---

## Troubleshooting

### "LLM call failed. Is Ollama running?"
- Make sure Ollama is installed and the background service is running.
  - Windows: check the system tray for the Ollama icon. Restart your machine if unsure.
  - Mac: the Ollama app must be open.
  - Linux: run `ollama serve` in a terminal.
- In the app, go to **Settings → Test connection** to verify.

### "Model not found"
- Open a terminal and run `ollama list` to see installed models.
- Pull the model you selected in Settings: `ollama pull qwen2.5:7b-instruct`
- Return to Settings and click **Test connection**.

### Port already in use (8000 or 5173)
- Another program is using the port. Close other dev servers or change the port:
  - Backend: edit `start.sh` / `start.bat` and change `--port 8000` to another number.
  - Frontend: edit `frontend/vite.config.js`, change `server.port`, and also update the proxy
    target there and the backend port you chose.

### Everything is slow on first call
- Loading a 7B model from disk into memory on CPU takes 20–60 seconds the first time after a
  reboot. Subsequent calls are much faster. If you have a GPU, Ollama uses it automatically.

### I want to delete all data and start over
- Stop the app and delete `backend/data/apd.db`. The file will be recreated empty on next run.

---

## Project structure

```
apd-cv-ranker/
├── backend/            FastAPI + SQLAlchemy + Ollama integration
│   ├── main.py         App entry, routers, CORS
│   ├── models.py       SQLAlchemy ORM models
│   ├── schemas.py      Pydantic request/response schemas
│   ├── llm.py          Ollama HTTP client + retries
│   ├── parsers.py      PDF/DOCX/TXT text extraction
│   ├── prompts.py      The 3 LLM prompts (do not edit without care)
│   ├── routes/         jobs.py, cvs.py, settings.py
│   └── data/apd.db     SQLite database (created on first run)
├── frontend/           React 18 + Vite + Tailwind
│   └── src/
│       ├── pages/      Dashboard, NewJob, JobDetail, CVDetail, Settings
│       ├── components/ KeywordEditor, RankingTable, CategoryRadar, FileDropzone
│       └── api.js      Typed wrapper around the backend REST API
├── start.sh            One-shot launcher for Mac / Linux
├── start.bat           One-shot launcher for Windows
└── README.md
```

---

## Privacy

- No network calls are made to any cloud LLM service.
- All LLM inference happens locally via Ollama on `localhost:11434`.
- Uploaded JDs and CVs are stored only in the local SQLite database.
- The frontend only talks to the local backend on `localhost:8000`.
