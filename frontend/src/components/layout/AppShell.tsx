"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useSocket } from "@/hooks/useSocket";
import ToastContainer from "@/components/ui/ToastContainer";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";

interface AppShellProps {
  children: React.ReactNode;
  requiredModule?: string;
}

export default function AppShell({ children, requiredModule }: AppShellProps) {
  const router = useRouter();
  const { user, isLoading, isAuthenticated, loadUser, hasPermission } = useAuthStore();

  // Khởi tạo socket connection
  useSocket();

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isLoading, isAuthenticated]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface-base)]">
        <div className="text-center animate-fade-in">
          <div
            className="w-12 h-12 rounded-full border-2 border-[var(--color-brand-500)] border-t-transparent animate-spin mx-auto mb-4"
            role="status"
            aria-label="Đang tải..."
          />
          <p className="text-[var(--color-text-muted)] text-sm">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) return null;

  // Kiểm tra quyền module
  if (requiredModule && !hasPermission(requiredModule)) {
    return (
      <div className="min-h-screen flex" style={{ background: "var(--color-surface-base)" }}>
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center glass p-10 max-w-md animate-slide-in">
            <div className="text-5xl mb-4">🔒</div>
            <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">
              Không có quyền truy cập
            </h2>
            <p className="text-[var(--color-text-secondary)] text-sm">
              Bạn chưa được cấp quyền sử dụng module này. Vui lòng liên hệ Admin.
            </p>
          </div>
        </div>
        <ToastContainer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex" style={{ background: "var(--color-surface-base)" }}>
      {/* Nền gradient orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div className="bg-orb bg-orb-1" style={{ opacity: 0.06 }} />
        <div className="bg-orb bg-orb-2" style={{ opacity: 0.05 }} />
      </div>

      {/* Sidebar */}
      <Sidebar />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <div className="animate-slide-in">{children}</div>
        </main>
      </div>

      <ToastContainer />
    </div>
  );
}
