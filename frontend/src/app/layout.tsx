import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Student Workspace — Không gian làm việc nhóm IT",
  description: "Hệ thống quản lý công việc nội bộ dành cho nhóm sinh viên IT. Calendar, NAS, Kanban Board.",
  keywords: ["student workspace", "task management", "kanban", "calendar", "file sharing"],
  authors: [{ name: "Student IT Team" }],
  robots: "noindex, nofollow", // Private app
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
