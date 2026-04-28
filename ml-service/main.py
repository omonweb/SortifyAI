from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from sentence_transformers import SentenceTransformer, util
import PyPDF2
import docx
import io
import re
import json

app = FastAPI()

# Allow requests from Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load model once at startup (heavy — do not move inside the endpoint)
model = SentenceTransformer("all-MiniLM-L6-v2")


# ─── TEXT EXTRACTION ────────────────────────────────────────────────────────

def extract_pdf(file_bytes: bytes) -> str:
    reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
    text = ""
    for page in reader.pages:
        text += page.extract_text() or ""
    return text


def extract_docx(file_bytes: bytes) -> str:
    doc = docx.Document(io.BytesIO(file_bytes))
    return "\n".join([p.text for p in doc.paragraphs])


def extract_text(file: UploadFile) -> str:
    content = file.file.read()
    if file.filename.lower().endswith(".pdf"):
        return extract_pdf(content)
    elif file.filename.lower().endswith(".docx"):
        return extract_docx(content)
    return ""


# ─── FEATURE EXTRACTION ─────────────────────────────────────────────────────

def extract_name_from_filename(filename: str) -> str | None:
    """
    Tries to extract a human name from the filename.
    Handles patterns like:
      - Aarav_Arora_17.pdf   → "Aarav Arora"
      - John_Doe_Resume.pdf  → "John Doe"
      - resume_john_doe.pdf  → "John Doe"
    Returns None if the filename looks generic (e.g. resume.pdf, cv_final.pdf).
    """
    # Remove extension
    stem = re.sub(r"\.[^.]+$", "", filename)

    # Split on underscores, hyphens, or spaces
    parts = re.split(r"[_\-\s]+", stem)

    # Filter out purely numeric parts and known generic words
    generic = {"resume", "cv", "final", "new", "updated", "copy", "draft", "doc", "file", "application"}
    name_parts = [
        p for p in parts
        if p and not p.isdigit() and p.lower() not in generic and re.match(r"^[A-Za-z]+$", p)
    ]

    # Need at least 2 parts that look like name words
    if len(name_parts) >= 2:
        return " ".join(p.capitalize() for p in name_parts[:3])

    return None


def extract_name_from_text(text: str) -> str:
    """
    Fallback: scan first 5 lines for a short alphabetic name,
    then regex scan for two capitalised words.
    """
    lines = text.strip().split("\n")
    for line in lines[:5]:
        line = line.strip()
        if len(line.split()) <= 4 and len(line) < 40:
            if re.match(r"^[A-Za-z\s]+$", line):
                return line.title()

    match = re.search(r"\b[A-Z][a-z]+ [A-Z][a-z]+\b", text)
    if match:
        return match.group(0)

    return "Unknown Candidate"


def extract_name(filename: str, text: str) -> str:
    """
    Priority order:
    1. Parse name from filename (most reliable when filename is structured)
    2. Extract from resume text (fallback)
    """
    name = extract_name_from_filename(filename)
    if name:
        return name
    return extract_name_from_text(text)


def extract_experience(text: str) -> float:
    """
    Finds all occurrences of patterns like '3 years', '5+ yrs', '2.5 years'.
    Returns the maximum value found, or 0 if none.
    """
    text_lower = text.lower()
    matches = re.findall(r"(\d+\.?\d*)\+?\s*(?:years?|yrs?)", text_lower)
    if matches:
        return max(float(m) for m in matches)
    return 0.0


def extract_education(text: str) -> str:
    """
    Returns the highest detected education level: phd > master > bachelor > unknown.
    """
    text_lower = text.lower()
    if any(kw in text_lower for kw in ["phd", "ph.d", "doctor"]):
        return "phd"
    if any(kw in text_lower for kw in ["master", "m.tech", "msc", "m.sc", "mba"]):
        return "master"
    if any(kw in text_lower for kw in ["bachelor", "b.tech", "bsc", "b.sc", "b.e", "undergraduate"]):
        return "bachelor"
    return "unknown"


def match_skills(resume_text: str, jd_skills: list[str]) -> tuple[list[str], list[str]]:
    """
    Case-insensitive substring match.
    Handles aliases: 'react.js' matches 'react', 'node.js' matches 'node'.
    Returns (matched_skills, missing_skills).
    """
    text_lower = resume_text.lower()
    matched = []
    missing = []

    for skill in jd_skills:
        skill_clean = skill.strip().lower()
        # Strip common suffixes for partial matching
        skill_base = re.sub(r"\.js$|\.py$", "", skill_clean)

        if skill_base in text_lower or skill_clean in text_lower:
            matched.append(skill)
        else:
            missing.append(skill)

    return matched, missing


# ─── SCORING ────────────────────────────────────────────────────────────────

def compute_skill_score(
    matched_skills: list[str],
    jd_skills: list[str],
    priority_skills: list[str]
) -> float:
    """
    Priority-weighted skill score.
    Priority skills contribute 2 points each, others 1 point each.
    Returns 0–100.
    """
    if not jd_skills:
        return 100.0  # No skills required = full marks

    max_score = sum(2 if s in priority_skills else 1 for s in jd_skills)
    if max_score == 0:
        return 100.0

    earned = sum(
        2 if s in priority_skills else 1
        for s in matched_skills
    )
    return round((earned / max_score) * 100, 2)


def compute_experience_score(extracted: float, required: float) -> float:
    """
    Returns 100 if extracted >= required, else proportional.
    """
    if required <= 0:
        return 100.0
    if extracted >= required:
        return 100.0
    return round((extracted / required) * 100, 2)


def compute_education_score(resume_edu: str, required_edu: str) -> float:
    """
    Hierarchy: phd > master > bachelor > unknown.
    Returns 100 if resume meets or exceeds requirement, 50 otherwise.
    """
    hierarchy = {"unknown": 0, "bachelor": 1, "master": 2, "phd": 3}
    resume_level = hierarchy.get(resume_edu, 0)
    required_level = hierarchy.get(required_edu.lower(), 1)

    if resume_level >= required_level:
        return 100.0
    return 50.0


def compute_hybrid_score(
    semantic: float,
    skill: float,
    experience: float,
    education: float
) -> float:
    """
    Weighted formula:
    45% semantic  + 30% skill  + 15% experience  + 10% education
    """
    return round(
        0.45 * semantic
        + 0.30 * skill
        + 0.15 * experience
        + 0.10 * education,
        2
    )


def generate_summary(
    name: str,
    matched_skills: list[str],
    missing_skills: list[str],
    experience: float,
    score: float
) -> str:
    """
    Template-based summary. Tells recruiter the key signals at a glance.
    """
    if score >= 75:
        strength = "Strong"
    elif score >= 50:
        strength = "Moderate"
    else:
        strength = "Weak"

    matched_str = ", ".join(matched_skills[:4]) if matched_skills else "none of the required skills"
    missing_str = ", ".join(missing_skills[:3]) if missing_skills else "none"
    exp_str = f"{experience:.0f} year(s)" if experience > 0 else "no declared experience"

    return (
        f"{strength} match. "
        f"Matched skills: {matched_str}. "
        f"Missing: {missing_str}. "
        f"Experience detected: {exp_str}."
    )


# ─── ENDPOINT ───────────────────────────────────────────────────────────────

@app.post("/evaluate")
async def evaluate(
    jd: str = Form(...),
    skills: str = Form(default="[]"),          # JSON array from backend
    priority_skills: str = Form(default="[]"), # optional priority list
    required_experience: float = Form(default=0),
    required_education: str = Form(default="bachelor"),
    files: list[UploadFile] = File(...),
):
    # Parse skill lists sent as JSON strings
    jd_skills = [s.strip().lower() for s in json.loads(skills) if s.strip()]
    p_skills = [s.strip().lower() for s in json.loads(priority_skills) if s.strip()]

    # Encode JD once
    jd_embedding = model.encode(jd, convert_to_tensor=True)

    results = []

    for file in files:
        text = extract_text(file)
        name = extract_name(file.filename, text)

        if not text.strip():
            # Unparseable resume — zero everything
            results.append({
                "file": file.filename,
                "name": name,
                "score": 0,
                "breakdown": {
                    "semantic": 0,
                    "skill": 0,
                    "experience": 0,
                    "education": 0,
                },
                "matchedSkills": [],
                "missingSkills": jd_skills,
                "summary": "Could not extract text from this resume.",
            })
            continue

        # ── Layer 1: Semantic score ──────────────────────────────────────
        resume_embedding = model.encode(text, convert_to_tensor=True)
        semantic_score = round(
            util.cos_sim(jd_embedding, resume_embedding).item() * 100, 2
        )

        # ── Layer 2: Skill score ─────────────────────────────────────────
        matched_skills, missing_skills = match_skills(text, jd_skills)
        skill_score = compute_skill_score(matched_skills, jd_skills, p_skills)

        # ── Layer 3: Experience score ────────────────────────────────────
        extracted_exp = extract_experience(text)
        experience_score = compute_experience_score(extracted_exp, required_experience)

        # ── Layer 4: Education score ─────────────────────────────────────
        resume_edu = extract_education(text)
        education_score = compute_education_score(resume_edu, required_education)

        # ── Layer 5: Hybrid final score ──────────────────────────────────
        final_score = compute_hybrid_score(
            semantic_score, skill_score, experience_score, education_score
        )

        summary = generate_summary(
            name, matched_skills, missing_skills, extracted_exp, final_score
        )

        results.append({
            "file": file.filename,
            "name": name,
            "score": final_score,
            "breakdown": {
                "semantic": semantic_score,
                "skill": skill_score,
                "experience": experience_score,
                "education": education_score,
            },
            "matchedSkills": matched_skills[:6],
            "missingSkills": missing_skills[:6],
            "summary": summary,
        })

    # Sort by final score before returning
    results.sort(key=lambda x: x["score"], reverse=True)
    return results