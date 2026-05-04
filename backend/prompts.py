JD_ANALYSIS_PROMPT = """You are an expert recruitment analyst and talent intelligence system.

Your task is to extract structured hiring criteria from the given Job Description (JD).

Follow these rules strictly:
1. Extract only relevant, role-specific keywords (avoid generic fluff).
1a. Return at most 25 keywords total. Keep only the most important and non-overlapping items.
2. Categorize all keywords into the following buckets:
   - Domain
   - Capability (functional skills)
   - Leadership
   - Finance & Governance
   - Research & Innovation
   - Learning & Development
   - Tools / Systems
   - Soft Skills
3. For each keyword:
   - Assign a weight (1–10) based on importance in the JD
   - Classify as:
     - "must-have"
     - "good-to-have"
4. Identify:
   - Required experience range
   - Role seniority
5. Do NOT invent keywords not implied by the JD.
6. Keep the JSON concise. Do not repeat similar keywords with minor wording changes.

Output strictly in JSON format as follows:

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

Here is the Job Description:
---
{JD_TEXT}
---"""


BULK_RANKING_PROMPT = """You are an AI recruitment ranking engine.

Evaluate multiple candidates against the given Job Model.

Return a ranked list (highest to lowest).

INPUT:

JOB MODEL:
{JD_JSON}

CANDIDATES:
{CANDIDATES_BLOCK}

-------------------------------------

OUTPUT:

[
  {
    "rank": 1,
    "candidate_name": "",
    "score": 0,
    "summary": ""
  },
  {
    "rank": 2,
    ...
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
