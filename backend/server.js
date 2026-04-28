const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const FormData = require("form-data");
const axios = require("axios");
require("dotenv").config();

const db = require("./config/firebase");

const app = express();

// ─── MIDDLEWARE (must be before all routes) ────────────────────────────────
app.use(cors());
app.use(express.json());

// Ensure uploads directory exists on startup
fs.mkdirSync("uploads/", { recursive: true });

// ─── MULTER CONFIG ─────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// ─── JOBS ──────────────────────────────────────────────────────────────────

// Create a new job
app.post("/jobs", async (req, res) => {
  try {
    const { title, jd, skills, userId } = req.body;

    const docRef = await db.collection("jobs").add({
      title,
      jd,
      skills,
      userId,
      status: "open",
      createdAt: new Date(),
    });

    res.json({ id: docRef.id });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error creating job");
  }
});

// Get all jobs for a user
app.get("/jobs/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const snapshot = await db
      .collection("jobs")
      .where("userId", "==", userId)
      .get();

    const jobs = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json(jobs);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching jobs");
  }
});

// Get a single job by ID
app.get("/job/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const doc = await db.collection("jobs").doc(id).get();

    if (!doc.exists) {
      return res.status(404).send("Job not found");
    }

    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching job");
  }
});

// ─── RESUMES ───────────────────────────────────────────────────────────────

// Upload resumes for a job
app.post("/upload-resume", upload.array("resumes", 10), async (req, res) => {
  try {
    const { jobId } = req.body;
    const files = req.files;
    const uploaded = [];

    for (let file of files) {
      const docRef = await db.collection("resumes").add({
        jobId,
        filePath: file.path,
        fileName: file.originalname,
        status: "pending",
        createdAt: new Date(),
      });

      uploaded.push({ id: docRef.id, fileName: file.originalname });
    }

    res.json(uploaded);
  } catch (err) {
    console.error(err);
    res.status(500).send("Upload failed");
  }
});

// Get all resumes for a job
app.get("/resumes/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;

    const snapshot = await db
      .collection("resumes")
      .where("jobId", "==", jobId)
      .get();

    const resumes = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json(resumes);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching resumes");
  }
});

// Delete all resumes for a job (also removes files from disk)
app.delete("/resumes/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;

    const snapshot = await db
      .collection("resumes")
      .where("jobId", "==", jobId)
      .get();

    const batch = db.batch();

    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (data.filePath && fs.existsSync(data.filePath)) {
        fs.unlinkSync(data.filePath);
      }
      batch.delete(doc.ref);
    });

    await batch.commit();
    res.send("All resumes deleted");
  } catch (err) {
    console.error(err);
    res.status(500).send("Delete failed");
  }
});

// ─── EVALUATION ────────────────────────────────────────────────────────────

app.post("/evaluate/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;

    // 1. Fetch job
    const jobDoc = await db.collection("jobs").doc(jobId).get();
    if (!jobDoc.exists) return res.status(404).send("Job not found");
    const job = jobDoc.data();

    // 2. Fetch resumes
    const snapshot = await db
      .collection("resumes")
      .where("jobId", "==", jobId)
      .get();

    if (snapshot.empty) {
      return res.status(400).send("No resumes found for this job");
    }

    // 3. Build FormData for ML service
    const formData = new FormData();
    formData.append("jd", job.jd);

    // Pass skills as a separate field so ML service doesn't guess them
    formData.append("skills", JSON.stringify(job.skills || []));

    // Attach each file
    const resumeDocs = snapshot.docs;
    resumeDocs.forEach((doc) => {
      const data = doc.data();
      if (data.filePath && fs.existsSync(data.filePath)) {
        formData.append("files", fs.createReadStream(data.filePath), {
          filename: data.fileName, // preserve original name for matching
        });
      }
    });

    // 4. Send to ML service
    const mlResponse = await axios.post(
      "http://localhost:8000/evaluate",
      formData,
      {
        headers: { ...formData.getHeaders() },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );

    const mlResults = mlResponse.data;

    // 5. Build a map of fileName → result for safe matching (not index-based)
    const resultMap = {};
    mlResults.forEach((r) => {
      resultMap[r.file] = r;
    });

    // 6. Persist each candidate + update resume doc
    const batch = db.batch();

    const savedCandidates = [];

    for (const doc of resumeDocs) {
      const data = doc.data();
      const result = resultMap[data.fileName];

      if (!result) continue;

      // Update resume doc with score + evaluated status
      batch.update(doc.ref, {
        score: result.score,
        status: "evaluated",
      });

      // Save full candidate record to candidates subcollection
      const candidateRef = db
        .collection("jobs")
        .doc(jobId)
        .collection("candidates")
        .doc(doc.id); // use resumeId as candidateId for easy cross-reference

      batch.set(candidateRef, {
        resumeId: doc.id,
        jobId,
        name: result.name,
        score: result.score,
        breakdown: result.breakdown || {},
        matchedSkills: result.matchedSkills || [],
        missingSkills: result.missingSkills || [],
        summary: result.summary || "",
        status: "pending", // pending | shortlisted | rejected
        fileName: data.fileName,
        createdAt: new Date(),
      });

      savedCandidates.push({
        id: doc.id,
        ...result,
        status: "pending",
      });
    }

    // Update job status to evaluated
    const jobRef = db.collection("jobs").doc(jobId);
    batch.update(jobRef, { status: "evaluated" });

    await batch.commit();

    // Return sorted results
    savedCandidates.sort((a, b) => b.score - a.score);
    res.json(savedCandidates);
  } catch (err) {
    console.error(err);
    res.status(500).send("Evaluation failed");
  }
});

// ─── CANDIDATES ────────────────────────────────────────────────────────────

// Get all candidates for a job (from Firestore — survives refresh)
app.get("/candidates/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;

    const snapshot = await db
      .collection("jobs")
      .doc(jobId)
      .collection("candidates")
      .get();

    const candidates = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);

    res.json(candidates);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching candidates");
  }
});

// Update candidate status — shortlist / reject / reset to pending
app.patch("/candidate/status", async (req, res) => {
  try {
    const { jobId, candidateId, status } = req.body;

    // Validate allowed statuses
    const allowed = ["pending", "shortlisted", "rejected"];
    if (!allowed.includes(status)) {
      return res.status(400).send("Invalid status. Use: pending | shortlisted | rejected");
    }

    const candidateRef = db
      .collection("jobs")
      .doc(jobId)
      .collection("candidates")
      .doc(candidateId);

    await candidateRef.update({ status });

    res.json({ success: true, candidateId, status });
  } catch (err) {
    console.error(err);
    res.status(500).send("Status update failed");
  }
});

// ─── SERVER ────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`SortifyAI backend running on port ${PORT}`);
});