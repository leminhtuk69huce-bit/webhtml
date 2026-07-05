"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { toast } from "@/store/toastStore";
import ToastContainer from "@/components/ui/ToastContainer";

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, loadUser, user } = useAuthStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [checking, setChecking] = useState(true);

  // Nếu đã login thì redirect
  useEffect(() => {
    loadUser().then(() => {
      setChecking(false);
    });
  }, []);

  useEffect(() => {
    if (!checking && isAuthenticated && user) {
      router.replace(user.role === "ADMIN" ? "/dashboard" : "/calendar");
    }
  }, [checking, isAuthenticated, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;

    setIsLoading(true);
    try {
      await login(username.trim(), password);
      const { user: loggedUser } = useAuthStore.getState();
      toast.success("Đăng nhập thành công!", `Chào mừng, ${loggedUser?.displayName}!`);
      router.replace(loggedUser?.role === "ADMIN" ? "/dashboard" : "/calendar");
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "Đăng nhập thất bại";
      toast.error("Lỗi đăng nhập", message);
    } finally {
      setIsLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface-base)]">
        <div
          className="w-10 h-10 rounded-full border-2 border-[var(--color-brand-500)] border-t-transparent animate-spin"
          role="status"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[var(--color-surface-base)]">
      {/* Animated background orbs */}
      <div aria-hidden className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="bg-orb bg-orb-1" />
        <div className="bg-orb bg-orb-2" />
        <div className="bg-orb bg-orb-3" />
      </div>

      {/* Grid overlay */}
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(oklch(1 0 0 / 0.025) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0 / 0.025) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md mx-auto p-6 animate-slide-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center text-white font-black text-2xl"
            style={{ background: "var(--gradient-brand)", boxShadow: "0 8px 32px oklch(0.50 0.27 270 / 0.4)" }}
          >
            SW
          </div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            Student Workspace
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Không gian làm việc nội bộ nhóm IT
          </p>
        </div>

        {/* Form Card */}
        <div className="glass p-8" style={{ boxShadow: "0 24px 64px oklch(0 0 0 / 0.4)" }}>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-6">
            Đăng nhập
          </h2>

          <form onSubmit={handleSubmit} id="login-form" noValidate>
            {/* Username */}
            <div className="mb-4">
              <label
                htmlFor="login-username"
                className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2"
              >
                Tên đăng nhập
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">
                  👤
                </span>
                <input
                  id="login-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="username hoặc email"
                  className="input-glass py-3 pl-10 pr-4 text-sm"
                  autoComplete="username"
                  autoFocus
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password */}
            <div className="mb-6">
              <label
                htmlFor="login-password"
                className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2"
              >
                Mật khẩu
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">
                  🔒
                </span>
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-glass py-3 pl-10 pr-12 text-sm"
                  autoComplete="current-password"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors text-xs"
                  aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              id="btn-login"
              className="btn-brand w-full py-3 text-sm"
              disabled={isLoading || !username || !password}
              aria-busy={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span
                    className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
                    aria-hidden
                  />
                  Đang đăng nhập...
                </span>
              ) : (
                "Đăng nhập →"
              )}
            </button>
          </form>

          <p className="text-center text-xs text-[var(--color-text-muted)] mt-6">
            🔐 Hệ thống private — Chỉ dành cho thành viên nhóm
          </p>
        </div>

        <p className="text-center text-xs text-[var(--color-text-disabled)] mt-4">
          Quên mật khẩu? Liên hệ Admin để được reset
        </p>
      </div>

      <ToastContainer />
    </div>
  );
}
