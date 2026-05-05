JD_ANALYSIS_PROMPT = """You are an expert recruitment analyst.

Extract structured hiring criteria from the Job Description below.

-------------------------------------
KEYWORD RULES — follow exactly
-------------------------------------
1. Every keyword MUST be 1–3 words. No phrases, no sentences.
   GOOD: "WASH", "M&E", "Budget Management", "Stakeholder Engagement", "SPSS", "NGO Sector"
   BAD:  "Experience in project management", "Ability to work with stakeholders", "Strong communication skills"

2. Strip lead-in words. Convert the underlying skill/domain noun only.
   "Experience in budget forecasting"  →  "Budget Forecasting"
   "Knowledge of WASH programming"     →  "WASH"
   "Strong leadership skills"          →  "Leadership"
   "Ability to manage teams"           →  "Team Management"

3. Drop generic keywords that apply to every office job:
   "MS Office", "communication", "teamwork", "proactive", "hard working", "email"

4. Return at most 25 keywords. Merge near-duplicates into the stronger term.

5. Extract ONLY keywords explicitly implied by the JD. Do not invent.

-------------------------------------
CATEGORIZE each keyword into exactly one:
  Domain | Capability | Leadership | Finance & Governance |
  Research & Innovation | Learning & Development | Tools / Systems | Soft Skills

For each keyword assign:
  - weight: 1–10 (importance in this JD)
  - type: "must-have" or "good-to-have"

Also extract:
  - role: job title from the JD
  - experience_required: e.g. "5–8 years"

-------------------------------------
OUTPUT — return ONLY the JSON below, no extra text:

{
  "role": "",
  "experience_required": "",
  "keywords": [
    {
      "keyword": "",
      "category": "",
      "weight": 0,
      "type": "must-have | good-to-have"
    }
  ],
  "category_weights": {
    "Domain": 0.30,
    "Capability": 0.25,
    "Leadership": 0.20,
    "Finance": 0.10,
    "Research": 0.10,
    "L&D": 0.03,
    "Tools": 0.01,
    "Soft": 0.01
  }
}

JOB DESCRIPTION:
---
{JD_TEXT}
---"""


BULK_RANKING_PROMPT = """You are an AI recruitment ranking engine.

Evaluate each candidate against the job model below and return a ranked list (highest to lowest).

-------------------------------------
SCORING RULES
-------------------------------------
1. For each keyword in the job model:
   - Exact keyword match in candidate profile → full keyword weight
   - Synonym / closely related match → 0.9 × weight
   - Semantically related match → 0.7 × weight
   - No match → 0

2. Apply penalties:
   - Missing must-have keyword → large penalty per keyword
   - Missing good-to-have keyword → small penalty per keyword

3. Consider experience alignment with the job's "experience_required" field:
   - Within range → no penalty
   - Below required → penalty
   - Above required → slight bonus

4. Compute a weighted sum across all categories using "category_weights".
   Normalize the final result to a 0–100 score.

-------------------------------------
JOB MODEL:
{JD_JSON}

CANDIDATES:
{CANDIDATES_BLOCK}

-------------------------------------
OUTPUT RULES:
- Return ONLY a JSON array. No extra text. No markdown fences.
- candidate_name: copy the name EXACTLY as it appears after the number in CANDIDATES above.
  Do NOT write "Full Name" or any placeholder — use the real name from the list.
- Every candidate in the list above must appear exactly once in your output.
- rank: 1 = highest score, increments by 1
- score: integer 0–100
- summary: one sentence, under 25 words

Example format (your output must follow this structure with the real names from CANDIDATES):
[
  {
    "rank": 1,
    "candidate_name": "Meera Krishnan",
    "score": 84,
    "summary": "Strong WASH and M&E background; lacks budget management experience required for this role."
  },
  {
    "rank": 2,
    "candidate_name": "Rahul Bose",
    "score": 67,
    "summary": "Good programme management skills; missing must-have domain expertise in disability sector."
  }
]"""


DEEP_EVAL_PROMPT = """You are an AI-powered recruitment evaluation engine.

You will evaluate candidate CVs against a structured Job Description (JD) keyword model.

You MUST follow the scoring logic strictly.

-------------------------------------
INPUTS
-------------------------------------

JOB MODEL:
{JD_JSON_OUTPUT_FROM_PROMPT_1}

CANDIDATE CV:
{CV_TEXT}

-------------------------------------
SCORING RULES
-------------------------------------

1. Matching Types:
- Exact match → score = 1.0
- Synonym / closely related → score = 0.9
- Semantically related → score = 0.7–0.85
- No match → 0

2. Keyword Score:
Keyword Score = Keyword Weight × Match Score

3. Category Score:
Sum of keyword scores within category × category weight

4. Gap Penalty:
- Missing must-have keyword → high penalty
- Missing good-to-have → moderate penalty

5. Experience Fit:
- Within required range → full score
- Below → penalty
- Above → slight bonus (optional)

6. Final Score:
Final Score = (Total Category Scores + Experience Score) − Gap Penalty
Normalize to 0–100

-------------------------------------
OUTPUT FORMAT (STRICT)
-------------------------------------

Return JSON:

{
  "candidate_name": "",
  "final_score": 0,
  "category_scores": {
    "Domain": 0,
    "Capability": 0,
    "Leadership": 0,
    "Finance": 0,
    "Research": 0,
    "L&D": 0,
    "Tools": 0,
    "Soft": 0
  },
  "matched_keywords": [
    {
      "keyword": "",
      "match_type": "exact | synonym | semantic",
      "score": 0
    }
  ],
  "missing_keywords": [
    {
      "keyword": "",
      "type": "must-have | good-to-have"
    }
  ],
  "experience_assessment": "",
  "explanation": ""
}

-------------------------------------
EXPLANATION RULES
-------------------------------------

Provide a concise explanation:
- Highlight strongest areas (top categories)
- Highlight critical missing skills
- Mention experience alignment
- Keep it under 120 words

-------------------------------------

Now evaluate the candidate."""
