"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import axios from "axios";
import { API_BASE_URL } from "@/lib/config";

const API = API_BASE_URL;

export default function JobPage() {
  const params = useParams();

  const [job, setJob] = useState(null);
  const [resumeCount, setResumeCount] = useState(0);
  const [candidates, setCandidates] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState([]);
  const [evaluating, setEvaluating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [uploadError, setUploadError] = useState("");

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
        setCandidates(candidateRes.data);
      } catch (err) {
        console.error("Error loading job data:", err);
      }
    };

    fetchAll();
  }, [params.id]);

  const selectedCandidateSet = useMemo(
    () => new Set(selectedCandidateIds),
    [selectedCandidateIds]
  );

  const selectedCandidates = useMemo(
    () => candidates.filter((candidate) => selectedCandidateSet.has(candidate.id)),
    [candidates, selectedCandidateSet]
  );

  const hasResults = candidates.length > 0;
  const allSelected = hasResults && selectedCandidateIds.length === candidates.length;
  const prioritySkillSet = new Set(job?.prioritySkills || []);

  const applyStatusesLocally = (candidateIds, status) => {
    const idSet = new Set(candidateIds);

    setCandidates((prev) =>
      prev.map((candidate) =>
        idSet.has(candidate.id) ? { ...candidate, status } : candidate
      )
    );

    setSelectedCandidate((prev) =>
      prev && idSet.has(prev.id) ? { ...prev, status } : prev
    );
  };

  const sendStatusEmail = async (candidate, nextStatus) => {
    if (
      !candidate?.email ||
      (nextStatus !== "shortlisted" && nextStatus !== "rejected")
    ) {
      return;
    }

    await axios.post(`${API}/send-email`, {
      jobId: job.id,
      candidateId: candidate.id,
      type: nextStatus === "shortlisted" ? "shortlist" : "rejection",
    });
  };

  const handleUpload = async (files) => {
    if (!job || !files || files.length === 0) return;

    setUploading(true);
    try {
      setUploadError("");
      const formData = new FormData();
      files.forEach((file) => formData.append("resumes", file));
      formData.append("jobId", job.id);

      await axios.post(`${API}/upload-resume`, formData);

      const res = await axios.get(`${API}/resumes/${params.id}`);
      setResumeCount(res.data.length);
    } catch (err) {
      console.error("Upload failed:", err);
      setUploadError(
        err.response?.data || "Resume upload failed. Please try again."
      );
    } finally {
      setUploading(false);
    }
  };

  const handleEvaluate = async () => {
    if (!job || resumeCount === 0) return;

    setEvaluating(true);
    try {
      const res = await axios.post(`${API}/evaluate/${job.id}`);
      setCandidates(res.data);
      setSelectedCandidate(null);
      setSelectedCandidateIds([]);
      setJob((prev) => (prev ? { ...prev, status: "evaluated" } : prev));
      window.dispatchEvent(new Event("jobs:refresh"));
    } catch (err) {
      console.error("Evaluation failed:", err);
    } finally {
      setEvaluating(false);
    }
  };

  const handleStatusChange = async (candidateId, nextStatus) => {
    const candidate = candidates.find((item) => item.id === candidateId);
    if (!candidate) return;

    try {
      await axios.patch(`${API}/candidate/status`, {
        jobId: job.id,
        candidateId,
        status: nextStatus,
      });

      applyStatusesLocally([candidateId], nextStatus);

      // Keep recruiter actions responsive even if email delivery fails afterward.
      try {
        await sendStatusEmail(candidate, nextStatus);
      } catch (emailErr) {
        console.error("Email send failed:", emailErr);
      }
    } catch (err) {
      console.error("Status update failed:", err);
    }
  };

  const handleBatchStatusChange = async (nextStatus) => {
    if (!job || selectedCandidates.length === 0) return;

    setBatchProcessing(true);
    try {
      await Promise.all(
        selectedCandidates.map((candidate) =>
          axios.patch(`${API}/candidate/status`, {
            jobId: job.id,
            candidateId: candidate.id,
            status: nextStatus,
          })
        )
      );

      const candidateIds = selectedCandidates.map((candidate) => candidate.id);
      applyStatusesLocally(candidateIds, nextStatus);
      setSelectedCandidateIds([]);

      await Promise.allSettled(
        selectedCandidates.map((candidate) =>
          sendStatusEmail(candidate, nextStatus)
        )
      );
    } catch (err) {
      console.error("Batch status update failed:", err);
    } finally {
      setBatchProcessing(false);
    }
  };

  const toggleCandidateSelection = (candidateId) => {
    setSelectedCandidateIds((prev) =>
      prev.includes(candidateId)
        ? prev.filter((id) => id !== candidateId)
        : [...prev, candidateId]
    );
  };

  const toggleSelectAll = () => {
    setSelectedCandidateIds(allSelected ? [] : candidates.map((candidate) => candidate.id));
  };

  const handleClearResumes = async () => {
    if (!job || resumeCount === 0) return;
    if (!window.confirm("Delete all resumes for this job? This cannot be undone.")) {
      return;
    }

    try {
      await axios.delete(`${API}/resumes/${job.id}`);
      setResumeCount(0);
      setCandidates([]);
      setSelectedCandidate(null);
      setSelectedCandidateIds([]);
      // Mirror the backend reset so the UI does not show an evaluated job with no data.
      setJob((prev) => (prev ? { ...prev, status: "open" } : prev));
      window.dispatchEvent(new Event("jobs:refresh"));
    } catch (err) {
      console.error("Clear resumes failed:", err);
    }
  };

  if (!job) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-gray-400">
        Loading job...
      </div>
    );
  }

  return (
    <>
      <div className={`flex h-full flex-col gap-6 ${selectedCandidate ? "md:flex-row" : ""}`}>
        <div className="min-w-0 flex-1 space-y-5 overflow-y-auto">
          <div className="glass space-y-4 p-5 md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <h2 className="text-xl font-semibold text-gray-900 md:text-2xl">
                  {job.title}
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-500">
                  {job.jd}
                </p>
              </div>
              <span
                className={`self-start rounded-full px-3 py-1 text-xs font-medium ${
                  job.status === "evaluated"
                    ? "bg-purple-100 text-purple-600"
                    : "bg-green-100 text-green-600"
                }`}
              >
                {job.status || "open"}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {job.skills?.map((skill) => (
                <span
                  key={skill}
                  className={`rounded-full border px-3 py-1 text-sm ${
                    prioritySkillSet.has(skill)
                      ? "border-[#f4b6a8] bg-[#fff1ed] text-[#c2410c]"
                      : "border-white/80 bg-white/70 text-gray-700"
                  }`}
                >
                  {prioritySkillSet.has(skill) ? "Priority: " : ""}
                  {skill}
                </span>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 text-sm text-gray-600">
              <span className="rounded-full border border-white/80 bg-white/70 px-3 py-1">
                Experience: {job.requiredExperience || 0} years
              </span>
              <span className="rounded-full border border-white/80 bg-white/70 px-3 py-1">
                Education: {formatEducation(job.requiredEducation)}
              </span>
            </div>
          </div>

          <div className="glass space-y-4 p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p className="text-sm font-medium text-gray-700">
                {resumeCount} resume{resumeCount !== 1 ? "s" : ""} uploaded
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <label className="cursor-pointer rounded-full border border-white/90 bg-white/80 px-4 py-2 text-center text-sm font-medium hover:bg-white transition">
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
                    className="rounded-full border border-red-100 bg-red-50 px-4 py-2 text-sm font-medium text-red-500 transition hover:bg-red-100"
                  >
                    Clear All
                  </button>
                )}
              </div>
            </div>

            {uploadError && (
              <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-500">
                {uploadError}
              </p>
            )}

            <button
              onClick={handleEvaluate}
              disabled={evaluating || resumeCount === 0}
              className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-40"
            >
              {evaluating ? "Evaluating..." : "Run Evaluation"}
            </button>
          </div>

          {hasResults && (
            <div className="space-y-3">
              <div className="flex flex-col gap-3 rounded-3xl border border-white/70 bg-white/30 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="font-semibold text-gray-800">Ranked Candidates</h3>
                  <p className="text-xs text-gray-400">
                    {candidates.length} total
                    {!selectedCandidate ? " • Select a candidate to inspect the full breakdown" : ""}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-white/80"
                  />
                  Select all
                </label>
              </div>

              {candidates.map((candidate, index) => {
                const isSelected = selectedCandidateSet.has(candidate.id);

                return (
                  <div
                    key={candidate.id}
                    onClick={() => setSelectedCandidate(candidate)}
                    className={`glass flex cursor-pointer flex-col gap-4 p-4 transition-all sm:flex-row sm:items-center sm:justify-between ${
                      selectedCandidate?.id === candidate.id
                        ? "bg-white/70 ring-2 ring-white/80"
                        : "hover:bg-white/60"
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className="flex items-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleCandidateSelection(candidate.id)}
                          className="h-4 w-4 rounded border-white/80"
                        />
                      </div>

                      <span className="w-5 flex-shrink-0 text-center text-xs font-bold text-gray-400">
                        {index + 1}
                      </span>

                      <div
                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                        style={{
                          background:
                            index === 0
                              ? "linear-gradient(135deg,#818cf8,#4f46e5)"
                              : index < 3
                                ? "linear-gradient(135deg,#34d399,#059669)"
                                : "linear-gradient(135deg,#9ca3af,#6b7280)",
                        }}
                      >
                        {candidate.name?.charAt(0) || "?"}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-800">
                          {candidate.name}
                        </p>
                        <p className="truncate text-xs text-gray-400">
                          {candidate.fileName}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
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

                      <div
                        className="flex gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {candidate.status !== "shortlisted" && (
                          <ActionButton
                            label="Shortlist"
                            color="green"
                            onClick={() =>
                              handleStatusChange(candidate.id, "shortlisted")
                            }
                          />
                        )}
                        {candidate.status !== "rejected" && (
                          <ActionButton
                            label="Reject"
                            color="red"
                            onClick={() =>
                              handleStatusChange(candidate.id, "rejected")
                            }
                          />
                        )}
                        {candidate.status !== "pending" && (
                          <ActionButton
                            label="Reset"
                            color="gray"
                            onClick={() =>
                              handleStatusChange(candidate.id, "pending")
                            }
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {selectedCandidate && (
          <div className="hidden w-[320px] flex-shrink-0 md:block">
            <CandidateDetail
              candidate={selectedCandidate}
              onStatusChange={handleStatusChange}
            />
          </div>
        )}
      </div>

      {selectedCandidateIds.length > 0 && (
        <div className="fixed inset-x-4 bottom-20 z-30 mx-auto max-w-3xl rounded-[28px] border border-white/70 bg-[#1b2438]/92 p-4 text-white shadow-2xl backdrop-blur-xl md:bottom-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-sm font-medium">
              {selectedCandidateIds.length} selected
            </p>
            <div className="flex flex-wrap gap-2">
              <BatchButton
                label={batchProcessing ? "Working..." : "Shortlist All"}
                disabled={batchProcessing}
                tone="green"
                onClick={() => handleBatchStatusChange("shortlisted")}
              />
              <BatchButton
                label={batchProcessing ? "Working..." : "Reject All"}
                disabled={batchProcessing}
                tone="red"
                onClick={() => handleBatchStatusChange("rejected")}
              />
              <BatchButton
                label={batchProcessing ? "Working..." : "Reset All"}
                disabled={batchProcessing}
                tone="gray"
                onClick={() => handleBatchStatusChange("pending")}
              />
              <BatchButton
                label="Clear"
                disabled={batchProcessing}
                tone="clear"
                onClick={() => setSelectedCandidateIds([])}
              />
            </div>
          </div>
        </div>
      )}

      {selectedCandidate && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/20 md:hidden">
          <div className="max-h-[85vh] w-full overflow-y-auto rounded-t-[28px] bg-white/92 p-4 shadow-2xl backdrop-blur-xl">
            <CandidateDetail
              candidate={selectedCandidate}
              onStatusChange={handleStatusChange}
              mobile
              onClose={() => setSelectedCandidate(null)}
            />
          </div>
        </div>
      )}
    </>
  );
}

function StatusBadge({ status }) {
  const config = {
    shortlisted: "bg-green-100 text-green-600",
    rejected: "bg-red-100 text-red-500",
    pending: "bg-amber-100 text-amber-600",
    evaluated: "bg-purple-100 text-purple-500",
  };

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        config[status] || config.pending
      }`}
    >
      {status || "pending"}
    </span>
  );
}

function ActionButton({ label, color, onClick }) {
  const colors = {
    green: "bg-green-100 text-green-700 hover:bg-green-200",
    red: "bg-red-100 text-red-500 hover:bg-red-200",
    gray: "bg-gray-100 text-gray-500 hover:bg-gray-200",
  };

  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${colors[color]}`}
    >
      {label}
    </button>
  );
}

function BatchButton({ label, disabled, tone, onClick }) {
  const tones = {
    green: "bg-green-100 text-green-800 hover:bg-green-200",
    red: "bg-red-100 text-red-700 hover:bg-red-200",
    gray: "bg-white/15 text-white hover:bg-white/25",
    clear: "bg-transparent text-white/80 hover:bg-white/10",
  };

  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${tones[tone]}`}
    >
      {label}
    </button>
  );
}

function CandidateDetail({ candidate, onStatusChange, mobile = false, onClose }) {
  const breakdownItems = [
    { label: "Semantic", value: candidate.breakdown?.semantic, color: "#818cf8" },
    { label: "Skills", value: candidate.breakdown?.skill, color: "#34d399" },
    { label: "Experience", value: candidate.breakdown?.experience, color: "#f59e0b" },
    { label: "Education", value: candidate.breakdown?.education, color: "#e85d4a" },
  ];

  return (
    <div className={`glass space-y-5 p-5 ${mobile ? "" : "sticky top-6"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg,#818cf8,#4f46e5)" }}
          >
            {candidate.name?.charAt(0) || "?"}
          </div>
          <div>
            <p className="font-semibold text-gray-800">{candidate.name}</p>
            {candidate.email && (
              <p className="text-xs text-gray-400">{candidate.email}</p>
            )}
            <StatusBadge status={candidate.status} />
          </div>
        </div>
        {mobile && (
          <button
            onClick={onClose}
            className="rounded-full bg-black/5 px-3 py-1 text-xs font-medium text-gray-500"
          >
            Close
          </button>
        )}
      </div>

      <div>
        <p
          className="text-4xl font-bold text-gray-800"
          style={{ fontFamily: "var(--font-syne)" }}
        >
          {candidate.score}
        </p>
        <p className="text-xs text-gray-400">/ 100 match score</p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/10">
          <div
            className="h-full rounded-full"
            style={{
              width: `${candidate.score}%`,
              background: "linear-gradient(90deg,#e85d4a,#f4a58a)",
            }}
          />
        </div>
      </div>

      {candidate.breakdown && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Breakdown
          </p>
          {breakdownItems.map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <span className="w-20 text-xs text-gray-500">{item.label}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/8">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${item.value || 0}%`,
                    background: item.color,
                  }}
                />
              </div>
              <span className="w-8 text-right text-xs font-medium text-gray-600">
                {item.value || 0}
              </span>
            </div>
          ))}
        </div>
      )}

      {candidate.matchedSkills?.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Matched Skills
          </p>
          <div className="flex flex-wrap gap-1.5">
            {candidate.matchedSkills.map((skill) => (
              <span
                key={skill}
                className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {candidate.missingSkills?.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Missing Skills
          </p>
          <div className="flex flex-wrap gap-1.5">
            {candidate.missingSkills.map((skill) => (
              <span
                key={skill}
                className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-500"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
          AI Summary
        </p>
        <p className="text-xs leading-relaxed text-gray-600">{candidate.summary}</p>
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        {candidate.status !== "shortlisted" && (
          <button
            onClick={() => onStatusChange(candidate.id, "shortlisted")}
            className="flex-1 rounded-full bg-green-100 py-2 text-xs font-semibold text-green-700 transition hover:bg-green-200"
          >
            Shortlist
          </button>
        )}
        {candidate.status !== "rejected" && (
          <button
            onClick={() => onStatusChange(candidate.id, "rejected")}
            className="flex-1 rounded-full bg-red-100 py-2 text-xs font-semibold text-red-500 transition hover:bg-red-200"
          >
            Reject
          </button>
        )}
        {candidate.status !== "pending" && (
          <button
            onClick={() => onStatusChange(candidate.id, "pending")}
            className="flex-1 rounded-full bg-gray-100 py-2 text-xs font-semibold text-gray-500 transition hover:bg-gray-200"
          >
            Pending
          </button>
        )}
      </div>
    </div>
  );
}

function formatEducation(value) {
  const labels = {
    unknown: "None",
    bachelor: "Bachelor's",
    master: "Master's",
    phd: "PhD",
  };

  return labels[value] || "None";
}
