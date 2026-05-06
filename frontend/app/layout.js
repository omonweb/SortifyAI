import { DM_Sans, Syne } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-dm-sans",
});

const syne = Syne({
  subsets: ["latin"],
  weight: ["500", "700", "800"],
  variable: "--font-syne",
});

export const metadata = {
  title: "SortifyAI",
  description: "AI Recruitment Platform",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className={`${dmSans.variable} ${syne.variable} ${dmSans.className} min-h-full`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
