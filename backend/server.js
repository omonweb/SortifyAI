const express = require("express");
const cors = require("cors");
require("dotenv").config();

const db = require("./config/firebase");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Test route
app.get("/", (req, res) => {
  res.send("SortifyAI Backend Running ");
});

// Test Firestore route
app.get("/test-db", async (req, res) => {
  try {
    const docRef = db.collection("test").doc("sample");
    await docRef.set({
      message: "Firestore connected successfully!",
      timestamp: new Date(),
    });

    res.send("Data written to Firestore ");
  } catch (error) {
    console.error(error);
    res.status(500).send("Error connecting to Firestore ");
  }
});

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

const PORT = 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});