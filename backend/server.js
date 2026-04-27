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

// Middleware
app.use(cors());
app.post("/evaluate/:jobId", async (req,res) => {
  try {
    const {jobId} = req.params;

    //1. Get job
    const jobDoc = await db.collection("jobs").doc(jobId).get();
    const job = jobDoc.data();

    //2. Get resumes
    const snapshot = await db
      .collection("resumes")
      .where("jobId","==",jobId)
      .get();

      if(snapshot.empty) {
        return res.status(400).send("No resumes found!");
      }

      const formData = new FormData();

      //3. Append JD
      formData.append("jd",job.jd);

      //4. Append files
      snapshot.docs.forEach((doc) => {
        const data = doc.data();

        formData.append(
          "files",
          fs.createReadStream(data.filePath)
        );
      });

      //5. send to ML service
      const response = await axios.post(
        "http://localhost:8000/evaluate",
        formData,
        {
          headers: {
            ...formData.getHeaders(),
          },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        }
      );

      const results = response.data;

      //6. save scores
      const batch = db.batch();

      snapshot.docs.forEach((doc,index) => {
        const score = results[index]?.score || 0;

        batch.update(doc.ref, {
          score,
          status: "Evaluated!",
        });
      });

      await batch.commit();

      res.json(results);
  }
    catch(err) {
      console.error(err);
      res.status(500).send("Evaluation failed!");
    }
});

app.use(express.json());

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// Test route
// app.get("/", (req, res) => {
//   res.send("SortifyAI Backend Running ");
// });

// // Test Firestore route
// app.get("/test-db", async (req, res) => {
//   try {
//     const docRef = db.collection("test").doc("sample");
//     await docRef.set({
//       message: "Firestore connected successfully!",
//       timestamp: new Date(),
//     });

//     res.send("Data written to Firestore ");
//   } catch (error) {
//     console.error(error);
//     res.status(500).send("Error connecting to Firestore ");
//   }
// });

// upload files route
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

      uploaded.push({
        id: docRef.id,
        fileName: file.originalname,
      });
    }

    res.json(uploaded);
  } catch (err) {
    console.error(err);
    res.status(500).send("Upload failed");
  }
});

// create a new job posting
app.post("/jobs", async (req, res) => {
  try {
    const { title, jd, skills, userId } = req.body;

    const docRef = await db.collection("jobs").add({
      title,
      jd,
      skills,
      userId,
      createdAt: new Date(),
    });

    res.json({ id: docRef.id });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error creating job");
  }
});

// get all jobs for the user
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

// fetch the details of a job filtered by jobId
app.get("/job/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const doc = await db.collection("jobs").doc(id).get();

    if (!doc.exists) {
      return res.status(404).send("Job not found");
    }

    res.json({
      id: doc.id,
      ...doc.data(),
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching job");
  }
});


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


//clearing/deleting uploaded resumes for a particular job
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



const PORT = 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});