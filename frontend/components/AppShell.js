"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { API_BASE_URL } from "@/lib/config";

const API = API_BASE_URL;
const AUTH_ROUTES = ["/login", "/signup"];

export default function AppShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState(undefined);
  const [jobs, setJobs] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [jobsExpanded, setJobsExpanded] = useState(true);

  const isAuthRoute = AUTH_ROUTES.includes(pathname);

  useEffect(() => {
    let activeUserId = null;

    const loadJobs = async (userId) => {
      if (!userId) return;

      try {
        const res = await axios.get(`${API}/jobs/${userId}`);
        setJobs(res.data);
      } catch (err) {
        console.error("Failed to load jobs:", err);
      }
    };

    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      setUser(firebaseUser);
      activeUserId = firebaseUser?.uid || null;

      if (!firebaseUser && !isAuthRoute) {
        router.replace("/login");
        return;
      }

      if (firebaseUser && isAuthRoute) {
        router.replace("/dashboard");
        return;
      }

      if (firebaseUser) {
        await loadJobs(firebaseUser.uid);
      } else {
        setJobs([]);
      }
    });

    const handleRefresh = () => {
      if (activeUserId) {
        loadJobs(activeUserId);
      }
    };

    window.addEventListener("jobs:refresh", handleRefresh);

    return () => {
      window.removeEventListener("jobs:refresh", handleRefresh);
      unsubscribe();
    };
  }, [isAuthRoute, router]);

  const handleLogout = async () => {
    await signOut(auth);
    router.replace("/login");
  };

  if (isAuthRoute) {
    return <>{children}</>;
  }

  if (user === undefined) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#e85d4a] border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;

  const recruiterName = user.displayName || user.email?.split("@")[0] || "Recruiter";
  const recruiterEmail = user.email || "";
  const initials = getInitials(recruiterName, recruiterEmail);
  const reviewHref = pathname.startsWith("/job/") ? pathname : "/dashboard";

  const generalLinks = [
    { href: "/dashboard", label: "Dashboard", icon: <GridIcon /> },
    { href: "/dashboard", label: "All Jobs", icon: <ListIcon />, exact: false },
  ];

  const toolLinks = [
    { href: "/dashboard", label: "Create Job", icon: <PlusIcon /> },
    { href: reviewHref, label: "Review Queue", icon: <SparkIcon />, exact: pathname.startsWith("/job/") },
  ];

  return (
    <div className="flex min-h-screen flex-col text-[#1d2433]">
      <header className="sticky top-0 z-40 border-b border-white/60 bg-white/55 backdrop-blur-2xl">
        <div className="flex h-[72px] items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/70 bg-white/70 text-gray-600 md:hidden"
            >
              <MenuIcon />
            </button>
            <Link href="/dashboard" className="flex items-center gap-3 no-underline">
              <div className="orb-logo flex h-10 w-10 items-center justify-center rounded-full text-white shadow-lg">
                S
              </div>
              <div>
                <p
                  className="text-lg font-bold tracking-tight text-[#1c1c2e]"
                  style={{ fontFamily: "var(--font-syne)" }}
                >
                  SortifyAI
                </p>
                <p className="hidden text-xs text-gray-400 sm:block">
                  Bias-aware candidate screening
                </p>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-3 rounded-full border border-white/70 bg-white/65 px-3 py-2 shadow-sm">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-gray-700">{recruiterName}</p>
              <p className="text-xs text-gray-400">{recruiterEmail}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[linear-gradient(135deg,#e85d4a,#f4a58a)] text-sm font-semibold text-white shadow-md">
              {initials}
            </div>
            <button
              onClick={handleLogout}
              className="hidden rounded-full border border-white/80 bg-white/75 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-white hover:text-gray-900 md:block"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden w-[290px] flex-shrink-0 border-r border-white/60 bg-white/35 backdrop-blur-2xl md:flex">
          <SidebarContent
            pathname={pathname}
            jobs={jobs}
            jobsExpanded={jobsExpanded}
            onToggleJobs={() => setJobsExpanded((prev) => !prev)}
            onLogout={handleLogout}
            generalLinks={generalLinks}
            toolLinks={toolLinks}
          />
        </aside>

        <main className="flex-1 overflow-y-auto px-4 pb-24 pt-5 md:px-6 md:pb-6 md:pt-6">
          {children}
        </main>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="flex-1 bg-[#09111f]/35 backdrop-blur-sm"
          />
          <aside className="h-full w-[290px] border-l border-white/60 bg-[#fffaf8]/95 shadow-2xl backdrop-blur-2xl">
            <SidebarContent
              pathname={pathname}
              jobs={jobs}
              jobsExpanded={jobsExpanded}
              onToggleJobs={() => setJobsExpanded((prev) => !prev)}
              onLogout={handleLogout}
              generalLinks={generalLinks}
              toolLinks={toolLinks}
              onClose={() => setDrawerOpen(false)}
            />
          </aside>
        </div>
      )}

      <nav className="fixed inset-x-4 bottom-4 z-30 rounded-[28px] border border-white/70 bg-white/80 p-2 shadow-xl backdrop-blur-2xl md:hidden">
        <div className="grid grid-cols-4 gap-2">
          <BottomNavButton
            label="Home"
            active={pathname === "/dashboard"}
            onClick={() => router.push("/dashboard")}
          >
            <GridIcon />
          </BottomNavButton>
          <BottomNavButton
            label="Jobs"
            active={pathname.startsWith("/job/")}
            onClick={() => setDrawerOpen(true)}
          >
            <FolderIcon />
          </BottomNavButton>
          <BottomNavButton
            label="New"
            active={false}
            onClick={() => router.push("/dashboard")}
          >
            <PlusIcon />
          </BottomNavButton>
          <BottomNavButton
            label="Exit"
            active={false}
            onClick={handleLogout}
          >
            <LogoutIcon />
          </BottomNavButton>
        </div>
      </nav>
    </div>
  );
}

function SidebarContent({
  pathname,
  jobs,
  jobsExpanded,
  onToggleJobs,
  onLogout,
  generalLinks,
  toolLinks,
  onClose,
}) {
  return (
    <div className="flex h-full flex-col px-4 py-5">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400">
            Workspace
          </p>
          <p className="mt-1 text-sm font-medium text-gray-600">
            Recruiter command center
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-black/5 px-3 py-1 text-xs font-medium text-gray-500"
          >
            Close
          </button>
        )}
      </div>

      <SidebarSection label="General">
        {generalLinks.map((item) => (
          <SidebarLink
            key={item.label}
            href={item.href}
            label={item.label}
            pathname={pathname}
            icon={item.icon}
            matchExact={item.exact !== false}
            onNavigate={onClose}
          />
        ))}
      </SidebarSection>

      <SidebarSection label="Tools">
        {toolLinks.map((item) => (
          <SidebarLink
            key={item.label}
            href={item.href}
            label={item.label}
            pathname={pathname}
            icon={item.icon}
            matchExact={item.exact !== false}
            onNavigate={onClose}
          />
        ))}
      </SidebarSection>

      <div className="mt-6 min-h-0 flex-1 rounded-[24px] border border-white/70 bg-white/55 p-3 shadow-sm">
        <button
          type="button"
          onClick={onToggleJobs}
          className="flex w-full items-center justify-between rounded-2xl px-2 py-2 text-left"
        >
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400">
              Jobs
            </p>
            <p className="text-sm text-gray-500">{jobs.length} tracked roles</p>
          </div>
          <span className="rounded-full bg-white/70 px-2 py-1 text-xs font-semibold text-gray-500">
            {jobsExpanded ? "Hide" : "Show"}
          </span>
        </button>

        {jobsExpanded && (
          <div className="mt-3 space-y-2 overflow-y-auto pr-1">
            {jobs.length === 0 && (
              <p className="rounded-2xl bg-white/65 px-3 py-3 text-sm text-gray-400">
                No jobs yet. Create one to start reviewing resumes.
              </p>
            )}

            {jobs.map((job) => {
              const isActive = pathname === `/job/${job.id}`;

              return (
                <Link
                  key={job.id}
                  href={`/job/${job.id}`}
                  onClick={onClose}
                  className={`block rounded-[20px] border px-3 py-3 no-underline transition ${
                    isActive
                      ? "border-[#f4b6a8] bg-[#fff3ef] shadow-sm"
                      : "border-transparent bg-white/65 hover:bg-white"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full ${
                        job.status === "evaluated"
                          ? "bg-purple-400"
                          : job.status === "open"
                            ? "bg-green-400"
                            : "bg-amber-400"
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-800">
                        {job.title}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">{job.status || "open"}</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-5 space-y-2">
        <Link
          href="/dashboard"
          onClick={onClose}
          className="flex items-center justify-center gap-2 rounded-full bg-[#e85d4a] px-4 py-3 text-sm font-medium text-white no-underline shadow-lg shadow-[#e85d4a]/25 transition hover:translate-y-[-1px]"
        >
          <span className="h-4 w-4 flex-shrink-0">
            <PlusIcon />
          </span>
          New Job
        </Link>
        <button
          onClick={onLogout}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-white/80 bg-white/70 px-4 py-3 text-sm font-medium text-gray-500 transition hover:bg-white hover:text-red-500"
        >
          <LogoutIcon />
          Logout
        </button>
      </div>
    </div>
  );
}

function SidebarSection({ label, children }) {
  return (
    <div className="mt-4">
      <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400">
        {label}
      </p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function SidebarLink({
  href,
  label,
  pathname,
  icon,
  matchExact = true,
  onNavigate,
}) {
  const isActive = matchExact ? pathname === href : pathname.startsWith("/dashboard");

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm no-underline transition ${
        isActive
          ? "bg-[#1b2438] text-white shadow-lg shadow-[#1b2438]/10"
          : "text-gray-500 hover:bg-white/70 hover:text-gray-800"
      }`}
    >
      <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center">
        {icon}
      </span>
      {label}
    </Link>
  );
}

function BottomNavButton({ label, active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 rounded-[20px] px-2 py-2 text-[11px] font-medium transition ${
        active
          ? "bg-[#1b2438] text-white"
          : "text-gray-500 hover:bg-white"
      }`}
    >
      <span className="h-4 w-4">{children}</span>
      {label}
    </button>
  );
}

function getInitials(name, fallbackEmail) {
  const source = name || fallbackEmail || "Recruiter";
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

function GridIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-full w-full">
      <rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" />
      <rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" />
      <rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" />
      <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-full w-full">
      <rect x="1" y="3" width="14" height="2" rx="1" fill="currentColor" />
      <rect x="1" y="7" width="10" height="2" rx="1" fill="currentColor" />
      <rect x="1" y="11" width="12" height="2" rx="1" fill="currentColor" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-full w-full">
      <path
        d="M8 3v10M3 8h10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-full w-full">
      <path
        d="M8 1.5l1.6 4.4L14 7.5l-4.4 1.6L8 13.5l-1.6-4.4L2 7.5l4.4-1.6L8 1.5z"
        fill="currentColor"
      />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-full w-full">
      <path
        d="M2.5 4.5a1 1 0 011-1H6l1 1h5.5a1 1 0 011 1v6a1 1 0 01-1 1h-9a1 1 0 01-1-1v-7z"
        fill="currentColor"
      />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
      <path
        d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
      <path
        d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M10 11l3-3-3-3M13 8H6"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
