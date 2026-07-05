"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import clsx from "clsx";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "⊞", module: null, adminOnly: true },
  { href: "/calendar", label: "Lịch & Sự kiện", icon: "📅", module: "CALENDAR" },
  { href: "/nas", label: "NAS — Lưu trữ", icon: "📁", module: "NAS" },
  { href: "/tasks", label: "Kanban Board", icon: "🗂️", module: "TASK_MANAGEMENT" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, hasPermission, logout } = useAuthStore();

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.adminOnly) return user?.role === "ADMIN";
    if (!item.module) return true;
    return hasPermission(item.module);
  });

  const initials = user?.displayName
    ? user.displayName.split(" ").map((w) => w[0]).slice(-2).join("").toUpperCase()
    : "??";

  return (
    <aside
      className="w-64 flex-shrink-0 flex flex-col h-screen sticky top-0 z-20"
      style={{
        background: "var(--color-surface-1)",
        borderRight: "1px solid var(--color-glass-border)",
      }}
    >
      {/* Logo */}
      <div className="p-5 flex items-center gap-3 mb-2">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm"
          style={{ background: "var(--gradient-brand)" }}
        >
          SW
        </div>
        <div>
          <p className="font-bold text-sm text-[var(--color-text-primary)] leading-tight">
            Student Workspace
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">IT Team Portal</p>
        </div>
      </div>

      <hr className="divider mx-4 mb-3" />

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1" aria-label="Main navigation">
        {visibleItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={clsx("nav-item", { active: pathname === item.href })}
            aria-current={pathname === item.href ? "page" : undefined}
          >
            <span className="text-base w-5 text-center">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      <hr className="divider mx-4 my-3" />

      {/* User info + logout */}
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="avatar w-9 h-9 text-sm"
            aria-label={`Avatar của ${user?.displayName}`}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
              {user?.displayName}
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">
              {user?.role === "ADMIN" ? "👑 Admin" : "👤 Member"}
            </p>
          </div>
        </div>
        <button
          id="btn-logout"
          onClick={() => logout().then(() => (window.location.href = "/login"))}
          className="btn-ghost w-full py-2 text-sm"
          aria-label="Đăng xuất"
        >
          🚪 Đăng xuất
        </button>
      </div>
    </aside>
  );
}
