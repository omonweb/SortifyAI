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
  const router = useRouter();

  const handleCreateJob = async () => {
  try {
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
    alert("Error creating job");
    console.error(err);
  }
};

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push("/login");
      } else {
        setUser(currentUser);
      }
    });

    return () => unsub();
  }, []);

  if (!user) return <p className="text-center mt-10">Loading...</p>;

    return (
  <div className="p-6 max-w-xl mx-auto">
    <h1 className="text-2xl font-bold mb-4">
      Welcome, {user.email}
    </h1>

    <h2 className="text-xl mb-2">Create Job</h2>

    <input
      className="border p-2 w-full mb-2"
      placeholder="Job Title"
      value={title}
      onChange={(e) => setTitle(e.target.value)}
    />

    <textarea
      className="border p-2 w-full mb-2"
      placeholder="Job Description"
      value={jd}
      onChange={(e) => setJd(e.target.value)}
    />

    <input
      className="border p-2 w-full mb-2"
      placeholder="Skills (comma separated)"
      value={skills}
      onChange={(e) => setSkills(e.target.value)}
    />

    <button
      onClick={handleCreateJob}
      className="bg-blue-500 text-white px-4 py-2"
    >
      Create Job
    </button>
  </div>
);
}