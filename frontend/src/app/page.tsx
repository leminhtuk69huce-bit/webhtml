"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, user, loadUser, isLoading } = useAuthStore();

  useEffect(() => {
    loadUser().then(() => {
      const { isAuthenticated, user } = useAuthStore.getState();
      if (isAuthenticated && user) {
        router.replace(user.role === "ADMIN" ? "/dashboard" : "/calendar");
      } else {
        router.replace("/login");
      }
    });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface-base)]">
      <div
        className="w-10 h-10 rounded-full border-2 border-[var(--color-brand-500)] border-t-transparent animate-spin"
        role="status"
        aria-label="Đang tải..."
      />
    </div>
  );
}
