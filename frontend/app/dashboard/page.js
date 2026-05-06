"use client";

import { useState } from "react";
import axios from "axios";
import { auth } from "@/lib/firebase";
import { API_BASE_URL } from "@/lib/config";

const EDUCATION_OPTIONS = [
  { value: "unknown", label: "None" },
  { value: "bachelor", label: "Bachelor's" },
  { value: "master", label: "Master's" },
  { value: "phd", label: "PhD" },
];

function normalizeSkill(value) {
  return value.trim().toLowerCase();
}

export default function Dashboard() {
  const [title, setTitle] = useState("");
  const [jd, setJd] = useState("");
  const [skillInput, setSkillInput] = useState("");
  const [skills, setSkills] = useState([]);
  const [prioritySkills, setPrioritySkills] = useState([]);
  const [requiredExperience, setRequiredExperience] = useState("0");
  const [requiredEducation, setRequiredEducation] = useState("unknown");

  const addSkills = (rawValue) => {
    // Split pasted comma-separated input into individual skill tags.
    const nextSkills = rawValue
      .split(",")
      .map(normalizeSkill)
      .filter(Boolean);

    if (nextSkills.length === 0) {
      return;
    }

    setSkills((prev) => {
      const existing = new Set(prev);
      const additions = nextSkills.filter((skill) => !existing.has(skill));
      return additions.length > 0 ? [...prev, ...additions] : prev;
    });
  };

  const handleSkillKeyDown = (e) => {
    if (e.key !== "Enter" && e.key !== ",") {
      return;
    }

    e.preventDefault();
    addSkills(skillInput);
    setSkillInput("");
  };

  const handleSkillBlur = () => {
    if (!skillInput.trim()) {
      return;
    }

    addSkills(skillInput);
    setSkillInput("");
  };

  const removeSkill = (skillToRemove) => {
    setSkills((prev) => prev.filter((skill) => skill !== skillToRemove));
    setPrioritySkills((prev) =>
      prev.filter((skill) => skill !== skillToRemove)
    );
  };

  const togglePriority = (skillToToggle) => {
    setPrioritySkills((prev) =>
      prev.includes(skillToToggle)
        ? prev.filter((skill) => skill !== skillToToggle)
        : [...prev, skillToToggle]
    );
  };

  const handleCreateJob = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      await axios.post(`${API_BASE_URL}/jobs`, {
        title,
        jd,
        skills,
        prioritySkills,
        requiredExperience: Number(requiredExperience) || 0,
        requiredEducation,
        userId: user.uid,
      });

      window.dispatchEvent(new Event("jobs:refresh"));
      alert("Job created!");

      setTitle("");
      setJd("");
      setSkillInput("");
      setSkills([]);
      setPrioritySkills([]);
      setRequiredExperience("0");
      setRequiredEducation("unknown");
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
        <p className="text-sm text-gray-500">
          Add required skills as tags, then mark the must-have ones as priority.
        </p>

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
          placeholder="Type a skill and press Enter"
          value={skillInput}
          onChange={(e) => setSkillInput(e.target.value)}
          onKeyDown={handleSkillKeyDown}
          onBlur={handleSkillBlur}
          className="w-full p-3 rounded-lg bg-white/70"
        />

        {skills.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {skills.map((skill) => {
              const isPriority = prioritySkills.includes(skill);

              return (
                <div
                  key={skill}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${
                    isPriority
                      ? "border-[#e85d4a] bg-[#fff1ed] text-[#c2410c]"
                      : "border-white/80 bg-white/75 text-gray-700"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => togglePriority(skill)}
                    className="font-semibold"
                    title={isPriority ? "Remove priority" : "Mark as priority"}
                  >
                    {isPriority ? "★" : "☆"}
                  </button>
                  <span>{skill}</span>
                  <button
                    type="button"
                    onClick={() => removeSkill(skill)}
                    className="text-xs font-semibold text-gray-400 hover:text-gray-700"
                    title="Remove skill"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="block text-sm font-medium text-gray-700">
              Required Experience
            </span>
            <input
              type="number"
              min="0"
              max="10"
              step="0.5"
              value={requiredExperience}
              onChange={(e) => setRequiredExperience(e.target.value)}
              className="w-full rounded-lg bg-white/70 p-3"
            />
          </label>

          <label className="space-y-2">
            <span className="block text-sm font-medium text-gray-700">
              Minimum Education
            </span>
            <select
              value={requiredEducation}
              onChange={(e) => setRequiredEducation(e.target.value)}
              className="w-full rounded-lg bg-white/70 p-3"
            >
              {EDUCATION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button onClick={handleCreateJob} className="btn-primary">
          Create Job
        </button>

      </div>

    </div>
  );
}
