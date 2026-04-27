"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import axios from "axios";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [title, setTitle] = useState("");
  const [jd, setJd] = useState("");
  const [skills, setSkills] = useState("");
  const [jobs, setJobs] = useState([]);
  const [isOpen, setIsOpen] = useState(true);
  const router = useRouter();

const handleCreateJob = async () => {
  try {
    const res = await axios.post("http://localhost:5000/jobs", {
      title,
      jd,
      skills: skills.split(","),
      userId: user.uid,
    });

    const newJob = {
      id: res.data.id,
      title,
      jd,
      skills: skills.split(","),
    };

    setJobs((prev) => [...prev, newJob]);

    alert("Job created!");
    setTitle("");
    setJd("");
    setSkills("");
  } catch (err) {
    alert("Error creating job");
    console.error(err);
  }
};

useEffect(() => {
  const unsub = onAuthStateChanged(auth, async (currentUser) => {
    if (!currentUser) {
      router.push("/login");
    } else {
      setUser(currentUser);

      // fetch jobs
      const res = await axios.get(
        `http://localhost:5000/jobs/${currentUser.uid}`
      );
      setJobs(res.data);
    }
  });

  return () => unsub();
}, []);

  if (!user) return <p className="text-center mt-10">Loading...</p>;

return (
  <div className="flex h-screen p-4 gap-4">
    
    {/* Sidebar */}
    <div className="w-56 glass p-4">
      <h2 className="text-lg font-semibold mb-4">Jobs</h2>

      {jobs.map((job) => (
        <div
          key={job.id}
          className="p-2 rounded cursor-pointer hover:bg-white/40"
          onClick={() => router.push(`/job/${job.id}`)}
        >
          {job.title}
        </div>
      ))}
    </div>

    {/* Main */}
    <div className="flex-1 flex flex-col gap-4">

      {/* Header */}
      <div className="glass p-4 flex justify-between items-center">
        <h1 className="text-xl font-semibold">
          Welcome back, <span className="font-bold">{user.email}</span>
        </h1>
      </div>

      {/* Create Job Card */}
      <div className="glass p-6 max-w-xl glass-hover">
        <h2 className="text-lg font-semibold mb-4">Create Job</h2>

        <input
          className="input mb-3"
          placeholder="Job Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <textarea
          className="input mb-3"
          placeholder="Job Description"
          value={jd}
          onChange={(e) => setJd(e.target.value)}
        />

        <input
          className="input mb-4"
          placeholder="Skills (comma separated)"
          value={skills}
          onChange={(e) => setSkills(e.target.value)}
        />

        <button onClick={handleCreateJob} className="btn-primary">
          Create Job
        </button>
      </div>

    </div>
  </div>
);
}