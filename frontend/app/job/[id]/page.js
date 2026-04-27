"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import axios from "axios";

export default function JobPage() {
  const params = useParams();

  const [job, setJob] = useState(null);
  const [files, setFiles] = useState([]);
  const [resumeCount, setResumeCount] = useState(0);

  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);

  // 🔁 Fetch resumes count
  const fetchResumes = async () => {
    try {
      const res = await axios.get(
        `http://localhost:5000/resumes/${params.id}`
      );
      setResumeCount(res.data.length);
    } catch (err) {
      console.error(err);
    }
  };

  // 📤 Upload resumes (AUTO TRIGGERED)
  const handleUpload = async (selectedFiles) => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    setUploading(true);
    setSuccess(false);

    const formData = new FormData();

    selectedFiles.forEach((file) => {
      formData.append("resumes", file);
    });

    formData.append("jobId", job.id);

    try {
      await axios.post(
        "http://localhost:5000/upload-resume",
        formData
      );

      setFiles([]);
      fetchResumes();

      setSuccess(true);
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  // 🗑️ Clear all resumes
  const handleClearResumes = async () => {
    if (!confirm("Delete all resumes for this job?")) return;

    try {
      await axios.delete(
        `http://localhost:5000/resumes/${job.id}`
      );

      setResumeCount(0);
      setSuccess(false);
    } catch (err) {
      console.error(err);
    }
  };

  // 📦 Fetch job + resumes
  useEffect(() => {
    if (!params.id) return;

    const fetchJob = async () => {
      try {
        const res = await axios.get(
          `http://localhost:5000/job/${params.id}`
        );
        setJob(res.data);
      } catch (err) {
        console.error(err);
      }
    };

    fetchJob();
    fetchResumes();
  }, [params.id]);

  if (!job) return <p className="p-6">Loading...</p>;

  return (
    <div className="p-6 flex justify-center">
      <div className="glass p-10 w-full max-w-2xl space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold">{job.title}</h1>
          <p className="text-sm text-gray-500 mt-1">
            ID: {job.id}
          </p>
        </div>

        {/* Description */}
        <div>
          <h2 className="text-sm font-semibold text-gray-600 mb-1">
            Job Description
          </h2>
          <p className="text-gray-800">{job.jd}</p>
        </div>

        {/* Skills */}
        <div>
          <h2 className="text-sm font-semibold text-gray-600 mb-2">
            Skills
          </h2>

          <div className="flex flex-wrap gap-2">
            {job.skills.map((skill, index) => (
              <span
                key={index}
                className="px-3 py-1 text-sm rounded-full bg-white/70"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>

        {/* Upload Section */}
        <div className="pt-4 border-t border-white/40">
          <h2 className="text-lg font-semibold mb-3">
            Upload Resumes
          </h2>

          <div className="glass p-6 flex flex-col items-center gap-4 text-center">

            {/* Idle State */}
            {!uploading && !success && (
              <>
                <p className="text-gray-600 text-sm">
                  Upload multiple resumes at once
                </p>

                <label className="cursor-pointer px-5 py-2 rounded-full bg-white/80 text-sm font-medium hover:bg-white">
                  Choose Files
                  <input
                    type="file"
                    multiple
                    onChange={(e) => {
                      const selected = [...e.target.files];
                      setFiles(selected);

                      // 🚀 AUTO UPLOAD
                      setTimeout(() => {
                        handleUpload(selected);
                      }, 100);
                    }}
                    className="hidden"
                  />
                </label>
              </>
            )}

            {/* Uploading State */}
            {uploading && (
              <p className="text-sm text-gray-600">
                Uploading...
              </p>
            )}

            {/* Success State */}
            {success && (
              <p className="text-sm text-green-600">
                ✓ Upload successful
              </p>
            )}

            {/* Resume Count + Clear */}
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>{resumeCount} resumes uploaded</span>

              {resumeCount > 0 && (
                <button
                  onClick={handleClearResumes}
                  className="text-red-400 hover:text-red-500"
                >
                  Clear
                </button>
              )}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}