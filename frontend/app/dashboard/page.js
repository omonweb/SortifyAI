"use client";

import { useState } from "react";
import axios from "axios";
import { auth } from "@/lib/firebase";

export default function Dashboard() {
  const [title, setTitle] = useState("");
  const [jd, setJd] = useState("");
  const [skills, setSkills] = useState("");

  const handleCreateJob = async () => {
    try {
      const user = auth.currentUser;

      await axios.post("http://localhost:5000/jobs", {
        title,
        jd,
        skills: skills.split(","),
        userId: user.uid,
      });

      alert("Job created!");

      setTitle("");
      setJd("");
      setSkills("");
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      <div className="glass p-6">
        <h2 className="text-lg font-semibold">
          Welcome back, {auth.currentUser?.email}
        </h2>
      </div>

      <div className="glass p-6 space-y-4">

        <h2 className="text-lg font-semibold">Create Job</h2>

        <input
          placeholder="Job Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full p-3 rounded-lg bg-white/70"
        />

        <textarea
          placeholder="Job Description"
          value={jd}
          onChange={(e) => setJd(e.target.value)}
          className="w-full p-3 rounded-lg bg-white/70"
        />

        <input
          placeholder="Skills (comma separated)"
          value={skills}
          onChange={(e) => setSkills(e.target.value)}
          className="w-full p-3 rounded-lg bg-white/70"
        />

        <button onClick={handleCreateJob} className="btn-primary">
          Create Job
        </button>

      </div>

    </div>
  );
}