"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { useRouter, usePathname } from "next/navigation";
import { auth } from "@/lib/firebase";

export default function JobSidebar() {
  const [jobs, setJobs] = useState([]);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) return;

      try {
        const res = await axios.get(
          `http://localhost:5000/jobs/${user.uid}`
        );
        setJobs(res.data);
      } catch (err) {
        console.error(err);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="h-full flex flex-col">

      <h2 className="font-semibold mb-4">Jobs</h2>

      <div className="flex-1 overflow-y-auto space-y-2">

        {jobs.length === 0 && (
          <p className="text-sm text-gray-400">
            No jobs yet
          </p>
        )}

        {jobs.map((job) => {
          const isActive = pathname === `/job/${job.id}`;

          return (
            <div
              key={job.id}
              onClick={() => router.push(`/job/${job.id}`)}
              className={`p-2 rounded-lg cursor-pointer ${
                isActive
                  ? "bg-white/80 font-medium"
                  : "hover:bg-white/50"
              }`}
            >
              {job.title}
            </div>
          );
        })}

      </div>

    </div>
  );
}