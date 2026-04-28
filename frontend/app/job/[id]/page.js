"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import axios from "axios";

const API = "http://localhost:5000";

export default function JobPage() {
  const params = useParams();

  const [job, setJob] = useState(null);
  const [resumeCount, setResumeCount] = useState(0);
  const [candidates, setCandidates] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [evaluating, setEvaluating] = useState(false);
  const [uploading, setUploading] = useState(false);

  // ── Load job + persisted candidates on mount ──────────────────────────
  useEffect(() => {
    if (!params.id) return;

    const fetchAll = async () => {
      try {
        const [jobRes, resumeRes, candidateRes] = await Promise.all([
          axios.get(`${API}/job/${params.id}`),
          axios.get(`${API}/resumes/${params.id}`),
          axios.get(`${API}/candidates/${params.id}`),
        ]);

        setJob(jobRes.data);
        setResumeCount(resumeRes.data.length);

        // If candidates already exist in Firestore, show them immediately
        if (candidateRes.data.length > 0) {
          setCandidates(candidateRes.data);
        }
      } catch (err) {
        console.error("Error loading job data:", err);
      }
    };

    fetchAll();
  }, [params.id]);

  // ── Upload handler ────────────────────────────────────────────────────
  const handleUpload = async (files) => {
    if (!job || !files || files.length === 0) return;

    setUploading(true);
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("resumes", file));
      formData.append("jobId", job.id);

      await axios.post(`${API}/upload-resume`, formData);

      const res = await axios.get(`${API}/resumes/${params.id}`);
      setResumeCount(res.data.length);
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
    }
  };

  // ── Evaluate handler ──────────────────────────────────────────────────
  const handleEvaluate = async () => {
    if (!job || resumeCount === 0) return;

    setEvaluating(true);
    try {
      const res = await axios.post(`${API}/evaluate/${job.id}`);
      setCandidates(res.data);
      setSelectedCandidate(null);
    } catch (err) {
      console.error("Evaluation failed:", err);
    } finally {
      setEvaluating(false);
    }
  };

  // ── Status update handler ─────────────────────────────────────────────
  const handleStatusChange = async (candidateId, newStatus) => {
    try {
      await axios.patch(`${API}/candidate/status`, {
        jobId: job.id,
        candidateId,
        status: newStatus,
      });

      // Update locally so UI reflects immediately
      setCandidates((prev) =>
        prev.map((c) =>
          c.id === candidateId ? { ...c, status: newStatus } : c
        )
      );

      if (selectedCandidate?.id === candidateId) {
        setSelectedCandidate((prev) => ({ ...prev, status: newStatus }));
      }
    } catch (err) {
      console.error("Status update failed:", err);
    }
  };

  // Clear all resumes
  const handleClearResumes = async () => {
    if (!job || resumeCount === 0) return;
    if (!window.confirm("Delete all resumes for this job? This cannot be undone.")) return;
    try {
      await axios.delete(`${API}/resumes/${job.id}`);
      setResumeCount(0);
      setCandidates([]);
      setSelectedCandidate(null);
    } catch (err) {
      console.error("Clear resumes failed:", err);
    }
  };

  // ── Loading state ─────────────────────────────────────────────────────
  if (!job) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        Loading job...
      </div>
    );
  }

  const hasResults = candidates.length > 0;

  return (
    <div className="flex gap-6 h-full">

      {/* ── LEFT / MAIN ────────────────────────────────────────────────── */}
      <div className="flex-1 space-y-5 overflow-y-auto">

        {/* Job info card */}
        <div className="glass p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold">{job.title}</h2>
              <p className="text-sm text-gray-500 mt-1 leading-relaxed max-w-xl">
                {job.jd}
              </p>
            </div>
            <span
              className={`text-xs font-medium px-3 py-1 rounded-full ${
                job.status === "evaluated"
                  ? "bg-purple-100 text-purple-600"
                  : "bg-green-100 text-green-600"
              }`}
            >
              {job.status || "open"}
            </span>
          </div>

          {/* Skills */}
          <div className="flex flex-wrap gap-2">
            {job.skills?.map((skill, i) => (
              <span
                key={i}
                className="bg-white/70 px-3 py-1 rounded-full text-sm text-gray-700 border border-white/80"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>

        {/* Upload + Evaluate */}
        <div className="glass p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">
              {resumeCount} resume{resumeCount !== 1 ? "s" : ""} uploaded
            </p>
            <div className="flex items-center gap-2">
              <label className="cursor-pointer px-4 py-2 bg-white/80 rounded-full text-sm font-medium border border-white/90 hover:bg-white transition">
                {uploading ? "Uploading..." : "+ Upload Resumes"}
                <input
                  type="file"
                  multiple
                  hidden
                  accept=".pdf,.docx"
                  onChange={(e) => handleUpload([...e.target.files])}
                />
              </label>
              {resumeCount > 0 && (
                <button
                  onClick={handleClearResumes}
                  className="px-4 py-2 rounded-full text-sm font-medium text-red-500 bg-red-50 border border-red-100 hover:bg-red-100 transition"
                >
                  Clear All
                </button>
              )}
            </div>
          </div>

          <button
            onClick={handleEvaluate}
            disabled={evaluating || resumeCount === 0}
            className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {evaluating ? "Evaluating..." : "Run Evaluation"}
          </button>
        </div>

        {/* Results */}
        {hasResults && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">
                Ranked Candidates
              </h3>
              <span className="text-xs text-gray-400">
                {candidates.length} total
              </span>
            </div>

            {candidates.map((candidate, index) => (
              <div
                key={candidate.id}
                onClick={() => setSelectedCandidate(candidate)}
                className={`glass p-4 cursor-pointer transition-all flex items-center justify-between gap-4 ${
                  selectedCandidate?.id === candidate.id
                    ? "ring-2 ring-white/80 bg-white/70"
                    : "hover:bg-white/60"
                }`}
              >
                {/* Left: rank + name */}
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs font-bold text-gray-400 w-5 text-center flex-shrink-0">
                    {index + 1}
                  </span>
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                    style={{
                      background: index === 0
                        ? "linear-gradient(135deg,#818cf8,#4f46e5)"
                        : index < 3
                        ? "linear-gradient(135deg,#34d399,#059669)"
                        : "linear-gradient(135deg,#9ca3af,#6b7280)",
                    }}
                  >
                    {candidate.name?.charAt(0) || "?"}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {candidate.name}
                    </p>
                    <p className="text-xs text-gray-400">{candidate.fileName}</p>
                  </div>
                </div>

                {/* Right: score + status + actions */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span
                    className={`text-sm font-bold ${
                      candidate.score >= 70
                        ? "text-green-600"
                        : candidate.score >= 50
                        ? "text-amber-500"
                        : "text-red-400"
                    }`}
                  >
                    {candidate.score}
                  </span>

                  <StatusBadge status={candidate.status} />

                  {/* Action buttons */}
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    {candidate.status !== "shortlisted" && (
                      <ActionButton
                        label="✓"
                        title="Shortlist"
                        color="green"
                        onClick={() => handleStatusChange(candidate.id, "shortlisted")}
                      />
                    )}
                    {candidate.status !== "rejected" && (
                      <ActionButton
                        label="✕"
                        title="Reject"
                        color="red"
                        onClick={() => handleStatusChange(candidate.id, "rejected")}
                      />
                    )}
                    {candidate.status !== "pending" && (
                      <ActionButton
                        label="↺"
                        title="Reset to pending"
                        color="gray"
                        onClick={() => handleStatusChange(candidate.id, "pending")}
                      />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── RIGHT PANEL ────────────────────────────────────────────────── */}
      <div className="w-[300px] flex-shrink-0">
        {selectedCandidate ? (
          <CandidateDetail
            candidate={selectedCandidate}
            onStatusChange={handleStatusChange}
          />
        ) : (
          <div className="glass p-6 text-sm text-gray-400 text-center">
            {hasResults
              ? "Click a candidate to see details"
              : "Run evaluation to see candidates"}
          </div>
        )}
      </div>

    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const config = {
    shortlisted: "bg-green-100 text-green-600",
    rejected: "bg-red-100 text-red-500",
    pending: "bg-amber-100 text-amber-600",
    evaluated: "bg-purple-100 text-purple-500",
  };
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
        config[status] || config.pending
      }`}
    >
      {status || "pending"}
    </span>
  );
}

function ActionButton({ label, title, color, onClick }) {
  const colors = {
    green: "bg-green-100 text-green-600 hover:bg-green-200",
    red: "bg-red-100 text-red-500 hover:bg-red-200",
    gray: "bg-gray-100 text-gray-500 hover:bg-gray-200",
  };
  return (
    <button
      title={title}
      onClick={onClick}
      className={`w-7 h-7 rounded-full text-xs font-semibold transition ${colors[color]}`}
    >
      {label}
    </button>
  );
}

function CandidateDetail({ candidate, onStatusChange }) {
  const breakdownItems = [
    { label: "Semantic", value: candidate.breakdown?.semantic, color: "#818cf8" },
    { label: "Skills", value: candidate.breakdown?.skill, color: "#34d399" },
    { label: "Experience", value: candidate.breakdown?.experience, color: "#f59e0b" },
    { label: "Education", value: candidate.breakdown?.education, color: "#e85d4a" },
  ];

  return (
    <div className="glass p-5 sticky top-6 space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
          style={{ background: "linear-gradient(135deg,#818cf8,#4f46e5)" }}
        >
          {candidate.name?.charAt(0) || "?"}
        </div>
        <div>
          <p className="font-semibold text-gray-800">{candidate.name}</p>
          <StatusBadge status={candidate.status} />
        </div>
      </div>

      {/* Final score */}
      <div>
        <p className="text-4xl font-bold text-gray-800"
          style={{ fontFamily: "Syne, sans-serif" }}>
          {candidate.score}
        </p>
        <p className="text-xs text-gray-400">/ 100 match score</p>
        <div className="mt-2 h-1.5 bg-black/10 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${candidate.score}%`,
              background: "linear-gradient(90deg,#e85d4a,#f4a58a)",
            }}
          />
        </div>
      </div>

      {/* Score breakdown */}
      {candidate.breakdown && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Breakdown
          </p>
          {breakdownItems.map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-20">{item.label}</span>
              <div className="flex-1 h-1.5 bg-black/8 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${item.value || 0}%`,
                    background: item.color,
                  }}
                />
              </div>
              <span className="text-xs font-medium text-gray-600 w-8 text-right">
                {item.value || 0}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Matched skills */}
      {candidate.matchedSkills?.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
            Matched Skills
          </p>
          <div className="flex flex-wrap gap-1.5">
            {candidate.matchedSkills.map((s, i) => (
              <span
                key={i}
                className="bg-green-100 text-green-700 text-xs px-2.5 py-1 rounded-full font-medium"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Missing skills */}
      {candidate.missingSkills?.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
            Missing Skills
          </p>
          <div className="flex flex-wrap gap-1.5">
            {candidate.missingSkills.map((s, i) => (
              <span
                key={i}
                className="bg-red-100 text-red-500 text-xs px-2.5 py-1 rounded-full font-medium"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* AI Summary */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
          AI Summary
        </p>
        <p className="text-xs text-gray-600 leading-relaxed">
          {candidate.summary}
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 pt-1">
        {candidate.status !== "shortlisted" && (
          <button
            onClick={() => onStatusChange(candidate.id, "shortlisted")}
            className="flex-1 py-2 rounded-full bg-green-100 text-green-700 text-xs font-semibold hover:bg-green-200 transition"
          >
            ✓ Shortlist
          </button>
        )}
        {candidate.status !== "rejected" && (
          <button
            onClick={() => onStatusChange(candidate.id, "rejected")}
            className="flex-1 py-2 rounded-full bg-red-100 text-red-500 text-xs font-semibold hover:bg-red-200 transition"
          >
            ✕ Reject
          </button>
        )}
        {candidate.status !== "pending" && (
          <button
            onClick={() => onStatusChange(candidate.id, "pending")}
            className="flex-1 py-2 rounded-full bg-gray-100 text-gray-500 text-xs font-semibold hover:bg-gray-200 transition"
          >
            ↺ Pending
          </button>
        )}
      </div>

    </div>
  );
}