"use client";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

const PAGE_TITLES: Record<string, { title: string; desc: string }> = {
  "/dashboard": { title: "Admin Dashboard", desc: "Quản lý người dùng và phân quyền" },
  "/calendar": { title: "Lịch & Sự kiện", desc: "Lịch làm việc và nhắc nhở deadline" },
  "/nas": { title: "NAS — Lưu trữ", desc: "Không gian chia sẻ file nhóm" },
  "/tasks": { title: "Kanban Board", desc: "Quản lý công việc theo trạng thái" },
};

export default function Header() {
  const pathname = usePathname();
  const { user } = useAuthStore();

  const page = PAGE_TITLES[pathname] || { title: "Student Workspace", desc: "" };
  const now = new Date();
  const dateStr = now.toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <header
      className="h-16 flex items-center justify-between px-6 flex-shrink-0"
      style={{
        background: "var(--color-surface-1)",
        borderBottom: "1px solid var(--color-glass-border)",
      }}
    >
      {/* Page title */}
      <div>
        <h1 className="text-lg font-bold text-[var(--color-text-primary)] leading-tight">
          {page.title}
        </h1>
        {page.desc && (
          <p className="text-xs text-[var(--color-text-muted)]">{page.desc}</p>
        )}
      </div>

      {/* Right section: date + user */}
      <div className="flex items-center gap-4">
        <span className="text-xs text-[var(--color-text-muted)] hidden md:block capitalize">
          {dateStr}
        </span>

        {user && (
          <div
            className="flex items-center gap-2 glass-sm px-3 py-2"
            aria-label="Thông tin người dùng"
          >
            <div className="avatar w-7 h-7 text-xs">
              {user.displayName
                .split(" ")
                .map((w) => w[0])
                .slice(-2)
                .join("")
                .toUpperCase()}
            </div>
            <span className="text-sm font-medium text-[var(--color-text-secondary)] hidden sm:block">
              {user.displayName}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}
