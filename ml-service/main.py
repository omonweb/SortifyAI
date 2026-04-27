from fastapi import FastAPI, UploadFile, File, Form
from sentence_transformers import SentenceTransformer, util
import PyPDF2
import docx
import io

app = FastAPI()

# Load model once
model = SentenceTransformer('all-MiniLM-L6-v2')


# 📄 Extract text from PDF
def extract_pdf(file):
    reader = PyPDF2.PdfReader(file)
    text = ""
    for page in reader.pages:
        text += page.extract_text() or ""
    return text


# 📄 Extract text from DOCX
def extract_docx(file):
    doc = docx.Document(file)
    return "\n".join([p.text for p in doc.paragraphs])


# 🔍 Extract text based on file type
def extract_text(file: UploadFile):
    content = file.file.read()

    if file.filename.endswith(".pdf"):
        return extract_pdf(io.BytesIO(content))
    elif file.filename.endswith(".docx"):
        return extract_docx(io.BytesIO(content))
    else:
        return ""


# 🚀 Evaluate endpoint
@app.post("/evaluate")
async def evaluate(jd: str = Form(...), files: list[UploadFile] = File(...)):

    jd_embedding = model.encode(jd, convert_to_tensor=True)

    results = []

    for file in files:
        text = extract_text(file)

        if not text.strip():
            score = 0
        else:
            resume_embedding = model.encode(text, convert_to_tensor=True)
            score = util.cos_sim(jd_embedding, resume_embedding).item()

        results.append({
            "file": file.filename,
            "score": round(score * 100, 2)
        })

    return results