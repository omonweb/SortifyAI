import { Geist, Geist_Mono, DM_Sans } from "next/font/google";
import "./globals.css";
import JobSidebar from "@/components/JobSidebar";
import Link from "next/link";

const dmSans = DM_Sans({ subsets: ["latin"] });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "SortifyAI",
  description: "AI Recruitment Platform",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className={`${dmSans.className} min-h-full`}>

        <div className="flex flex-col h-screen">

          {/* NAVBAR */}
          <div className="glass h-[64px] flex items-center justify-between px-8 border-b border-white/30">

            <div className="flex items-center gap-8">
              <h1 className="text-lg font-semibold">
                SortifyAI
              </h1>

              <Link
                href="/"
                className="text-sm text-gray-500 hover:text-black transition"
              >
                Dashboard
              </Link>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">Recruiter</span>
              <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center">
                O
              </div>
            </div>

          </div>

          {/* MAIN */}
          <div className="flex flex-1">

            {/* SIDEBAR */}
            <div className="w-[220px] glass p-4 border-r border-white/30">
              <JobSidebar />
            </div>

            {/* CONTENT */}
            <div className="flex-1 overflow-y-auto p-6">
              {children}
            </div>

          </div>

        </div>

      </body>
    </html>
  );
}