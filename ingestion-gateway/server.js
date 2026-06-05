const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const FormData = require("form-data");
const axios = require("axios");
require("dotenv").config();

const { db, bucket } = require("./config/firebase");
const { sendCandidateEmail } = require("./emailService");

const app = express();
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://127.0.0.1:8000";
const UPLOADS_DIR = path.join(__dirname, "uploads");

// ─── MIDDLEWARE (must be before all routes) ────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── MULTER CONFIG ─────────────────────────────────────────────────────────
const upload = multer({ storage: multer.memoryStorage() });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

function buildStoragePath(jobId, fileName) {
  const safeName = fileName.replace(/[^\w.-]+/g, "_");
  return `resumes/${jobId}/${Date.now()}-${safeName}`;
}

async function appendResumeToFormData(formData, data) {
  if (data.storagePath) {
    const [fileBuffer] = await bucket.file(data.storagePath).download();
    formData.append("files", fileBuffer, {
      filename: data.fileName,
      contentType: data.mimeType || "application/octet-stream",
    });
    return;
  }

  // Backwards compatibility for resumes uploaded before Storage migration.
  if (data.filePath && fs.existsSync(data.filePath)) {
    formData.append("files", fs.createReadStream(data.filePath), {
      filename: data.fileName,
    });
  }
}

async function saveResumeFile(jobId, file) {
  const storagePath = buildStoragePath(jobId, file.originalname);

  try {
    await bucket.file(storagePath).save(file.buffer, {
      contentType: file.mimetype,
      resumable: false,
    });

    return {
      storagePath,
      fileName: file.originalname,
      mimeType: file.mimetype,
    };
  } catch (storageError) {
    // Local/dev environments should still work before Firebase Storage is wired up.
    console.warn(
      "Storage upload failed, falling back to local disk:",
      storageError.message
    );

    const localFileName = `${Date.now()}-${file.originalname.replace(/[^\w.-]+/g, "_")}`;
    const localFilePath = path.join(UPLOADS_DIR, localFileName);
    await fs.promises.writeFile(localFilePath, file.buffer);

    return {
      filePath: localFilePath,
      fileName: file.originalname,
      mimeType: file.mimetype,
    };
  }
}

// ─── JOBS ──────────────────────────────────────────────────────────────────

// Create a new job
app.post("/jobs", async (req, res) => {
  try {
    const {
      title,
      jd,
      skills = [],
      prioritySkills = [],
      requiredExperience = 0,
      requiredEducation = "unknown",
      userId,
    } = req.body;

    const docRef = await db.collection("jobs").add({
      title,
      jd,
      skills,
      prioritySkills,
      requiredExperience: Number(requiredExperience) || 0,
      requiredEducation,
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

    if (!jobId || !files || files.length === 0) {
      return res.status(400).send("jobId and at least one resume are required");
    }

    for (const file of files) {
      const savedFile = await saveResumeFile(jobId, file);
      const docRef = await db.collection("resumes").add({
        jobId,
        ...savedFile,
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

// Delete all resumes for a job (also removes legacy local files when present)
app.delete("/resumes/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;

    const resumeSnapshot = await db
      .collection("resumes")
      .where("jobId", "==", jobId)
      .get();
    const candidateSnapshot = await db
      .collection("jobs")
      .doc(jobId)
      .collection("candidates")
      .get();

    const batch = db.batch();

    const deleteTasks = [];

    resumeSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (data.storagePath) {
        deleteTasks.push(
          bucket.file(data.storagePath).delete({ ignoreNotFound: true })
        );
      }
      if (data.filePath && fs.existsSync(data.filePath)) {
        fs.unlinkSync(data.filePath);
      }
      batch.delete(doc.ref);
    });

    // Clear persisted candidates too so the job page does not resurrect stale rankings.
    candidateSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    batch.update(db.collection("jobs").doc(jobId), { status: "open" });

    await Promise.all(deleteTasks);
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

    // Pass structured requirements explicitly so scoring uses recruiter intent.
    formData.append("skills", JSON.stringify(job.skills || []));
    formData.append(
      "priority_skills",
      JSON.stringify(job.prioritySkills || [])
    );
    formData.append(
      "required_experience",
      String(job.requiredExperience || 0)
    );
    formData.append(
      "required_education",
      job.requiredEducation || "unknown"
    );

    // Attach each file
    const resumeDocs = snapshot.docs;
    for (const doc of resumeDocs) {
      const data = doc.data();
      await appendResumeToFormData(formData, data);
    }

    // 4. Send to ML service
    const mlResponse = await axios.post(
      `${ML_SERVICE_URL}/evaluate`,
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
        email: result.email || null,
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

    if (axios.isAxiosError(err)) {
      if (
        err.code === "ECONNREFUSED" ||
        err.cause?.code === "ECONNREFUSED"
      ) {
        return res
          .status(503)
          .send(
            `ML service unavailable at ${ML_SERVICE_URL}. Start the FastAPI service and try again.`
          );
      }

      if (err.response?.data) {
        return res.status(502).send(
          typeof err.response.data === "string"
            ? err.response.data
            : "ML service error"
        );
      }
    }

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

app.post("/send-email", async (req, res) => {
  try {
    const { candidateId, jobId, type } = req.body;

    if (!candidateId || !jobId || !type) {
      return res
        .status(400)
        .send("candidateId, jobId, and type are required");
    }

    const allowed = ["shortlist", "rejection"];
    if (!allowed.includes(type)) {
      return res.status(400).send("Invalid type. Use shortlist or rejection");
    }

    const [jobDoc, candidateDoc] = await Promise.all([
      db.collection("jobs").doc(jobId).get(),
      db
        .collection("jobs")
        .doc(jobId)
        .collection("candidates")
        .doc(candidateId)
        .get(),
    ]);

    if (!jobDoc.exists) {
      return res.status(404).send("Job not found");
    }

    if (!candidateDoc.exists) {
      return res.status(404).send("Candidate not found");
    }

    const candidate = { id: candidateDoc.id, ...candidateDoc.data() };
    const job = { id: jobDoc.id, ...jobDoc.data() };

    if (!candidate.email) {
      return res.status(400).send("Candidate email not available");
    }

    await sendCandidateEmail({ type, candidate, job });

    res.json({ success: true, candidateId, type });
  } catch (err) {
    console.error(err);
    res.status(500).send("Email sending failed");
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`SortifyAI backend running on port ${PORT}`);
});
