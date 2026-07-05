"use client";
import { useEffect, useState, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import api from "@/lib/api";
import { toast } from "@/store/toastStore";

interface User {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: string;
  isActive: boolean;
  permissions: string[];
  createdAt: string;
}

const MODULES = [
  { id: "CALENDAR", label: "📅 Lịch & Sự kiện" },
  { id: "NAS", label: "📁 NAS — Lưu trữ" },
  { id: "TASK_MANAGEMENT", label: "🗂️ Kanban Board" },
];

const INITIAL_FORM = {
  username: "",
  email: "",
  displayName: "",
  password: "",
  permissions: [] as string[],
};

export default function DashboardPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [createForm, setCreateForm] = useState(INITIAL_FORM);
  const [resetPasswordResult, setResetPasswordResult] = useState<{
    userId: string;
    name: string;
    password: string;
  } | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const { data } = await api.get(`/users?search=${search}`);
      setUsers(data.data.users);
    } catch {
      toast.error("Không thể tải danh sách user");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Toggle quyền module cho user
  const handlePermissionToggle = async (userId: string, module: string, currentPerms: string[]) => {
    const newPerms = currentPerms.includes(module)
      ? currentPerms.filter((p) => p !== module)
      : [...currentPerms, module];

    setSavingId(`${userId}-${module}`);
    try {
      await api.patch(`/users/${userId}/permissions`, { permissions: newPerms });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, permissions: newPerms } : u))
      );
      toast.success("Đã cập nhật quyền");
    } catch {
      toast.error("Không thể cập nhật quyền");
    } finally {
      setSavingId(null);
    }
  };

  // Toggle active/inactive
  const handleToggleActive = async (user: User) => {
    try {
      await api.patch(`/users/${user.id}`, { isActive: !user.isActive });
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, isActive: !u.isActive } : u))
      );
      toast.success(user.isActive ? `Đã vô hiệu hóa ${user.displayName}` : `Đã kích hoạt ${user.displayName}`);
    } catch {
      toast.error("Không thể cập nhật trạng thái");
    }
  };

  // Reset password
  const handleResetPassword = async (user: User) => {
    if (!confirm(`Xác nhận reset mật khẩu của ${user.displayName}?`)) return;
    try {
      const { data } = await api.post(`/users/${user.id}/reset-password`);
      setResetPasswordResult({
        userId: user.id,
        name: user.displayName,
        password: data.data.temporaryPassword,
      });
    } catch {
      toast.error("Không thể reset mật khẩu");
    }
  };

  // Tạo user mới
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/users", createForm);
      toast.success(`Đã tạo tài khoản ${createForm.displayName}`);
      setShowCreateModal(false);
      setCreateForm(INITIAL_FORM);
      fetchUsers();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error("Lỗi tạo tài khoản", msg);
    } finally {
      setSubmitting(false);
    }
  };

  const members = users.filter((u) => u.role === "MEMBER");
  const adminCount = users.filter((u) => u.role === "ADMIN").length;

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Tổng thành viên", value: members.length, icon: "👥" },
            { label: "Đang hoạt động", value: members.filter((u) => u.isActive).length, icon: "✅" },
            { label: "Admin", value: adminCount, icon: "👑" },
          ].map((stat) => (
            <div key={stat.label} className="glass p-5 flex items-center gap-4">
              <div className="text-3xl">{stat.icon}</div>
              <div>
                <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                  {stat.value}
                </div>
                <div className="text-xs text-[var(--color-text-muted)]">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Header + Search + Create */}
        <div className="flex items-center gap-3 flex-wrap">
          <input
            id="search-users"
            type="text"
            placeholder="🔍 Tìm kiếm thành viên..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-glass py-2.5 px-4 text-sm flex-1 min-w-48"
          />
          <button
            id="btn-create-user"
            onClick={() => setShowCreateModal(true)}
            className="btn-brand px-5 py-2.5 text-sm whitespace-nowrap"
          >
            + Thêm thành viên
          </button>
        </div>

        {/* Users Table */}
        <div className="glass overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--color-glass-border)]">
            <h2 className="font-semibold text-[var(--color-text-primary)]">
              Danh sách thành viên ({members.length})
            </h2>
          </div>

          {loading ? (
            <div className="p-8 text-center text-[var(--color-text-muted)]">
              <div className="w-8 h-8 border-2 border-[var(--color-brand-500)] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Đang tải...
            </div>
          ) : members.length === 0 ? (
            <div className="p-12 text-center text-[var(--color-text-muted)]">
              <div className="text-4xl mb-3">👥</div>
              <p>Chưa có thành viên nào. Bấm "+ Thêm thành viên" để bắt đầu.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" aria-label="Danh sách thành viên">
                <thead>
                  <tr
                    className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider"
                    style={{ borderBottom: "1px solid var(--color-glass-border)" }}
                  >
                    <th className="text-left px-6 py-3 font-medium">Thành viên</th>
                    <th className="text-left px-6 py-3 font-medium">Quyền module</th>
                    <th className="text-left px-6 py-3 font-medium">Trạng thái</th>
                    <th className="text-left px-6 py-3 font-medium">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((user, idx) => (
                    <tr
                      key={user.id}
                      className="transition-colors hover:bg-[var(--color-glass-1)]"
                      style={{
                        borderBottom:
                          idx < members.length - 1
                            ? "1px solid var(--color-glass-border)"
                            : "none",
                      }}
                    >
                      {/* User info */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="avatar w-9 h-9 text-sm">
                            {user.displayName.split(" ").map((w) => w[0]).slice(-2).join("").toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-[var(--color-text-primary)]">
                              {user.displayName}
                            </div>
                            <div className="text-xs text-[var(--color-text-muted)]">
                              @{user.username}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Permissions checkboxes */}
                      <td className="px-6 py-4">
                        <div className="flex gap-2 flex-wrap">
                          {MODULES.map((mod) => {
                            const granted = user.permissions.includes(mod.id);
                            const saving = savingId === `${user.id}-${mod.id}`;
                            return (
                              <label
                                key={mod.id}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs cursor-pointer transition-all ${
                                  granted
                                    ? "bg-[oklch(0.50_0.27_270_/_0.2)] border border-[var(--color-brand-400)] text-[var(--color-brand-300)]"
                                    : "bg-[var(--color-glass-1)] border border-[var(--color-glass-border)] text-[var(--color-text-muted)]"
                                }`}
                                title={mod.label}
                              >
                                <input
                                  type="checkbox"
                                  checked={granted}
                                  disabled={saving}
                                  onChange={() => handlePermissionToggle(user.id, mod.id, user.permissions)}
                                  className="sr-only"
                                  aria-label={`${granted ? "Thu hồi" : "Cấp"} quyền ${mod.label} cho ${user.displayName}`}
                                />
                                <span>{saving ? "⏳" : granted ? "✓" : "○"}</span>
                                <span>{mod.label.split("—")[0].trim()}</span>
                              </label>
                            );
                          })}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <span
                          className={`badge ${
                            user.isActive
                              ? "bg-[oklch(0.72_0.18_145_/_0.15)] text-[var(--color-success)] border border-[oklch(0.72_0.18_145_/_0.3)]"
                              : "bg-[oklch(0.65_0.22_25_/_0.1)] text-[var(--color-error)] border border-[oklch(0.65_0.22_25_/_0.25)]"
                          }`}
                        >
                          {user.isActive ? "✅ Hoạt động" : "⛔ Bị khóa"}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleResetPassword(user)}
                            className="btn-ghost px-3 py-1.5 text-xs"
                            title="Reset mật khẩu"
                            aria-label={`Reset mật khẩu cho ${user.displayName}`}
                          >
                            🔑 Reset PW
                          </button>
                          <button
                            onClick={() => handleToggleActive(user)}
                            className="btn-ghost px-3 py-1.5 text-xs"
                            title={user.isActive ? "Khóa tài khoản" : "Mở khóa tài khoản"}
                          >
                            {user.isActive ? "🔒 Khóa" : "🔓 Mở"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "oklch(0 0 0 / 0.7)", backdropFilter: "blur(4px)" }}
          role="dialog"
          aria-modal
          aria-label="Thêm thành viên mới"
        >
          <div className="glass w-full max-w-md p-6 animate-slide-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
                Thêm thành viên mới
              </h3>
              <button
                onClick={() => { setShowCreateModal(false); setCreateForm(INITIAL_FORM); }}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors text-xl"
                aria-label="Đóng"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} id="form-create-user" className="space-y-4">
              {[
                { id: "new-display-name", label: "Họ và tên", key: "displayName", type: "text", placeholder: "Nguyễn Văn A" },
                { id: "new-username", label: "Username", key: "username", type: "text", placeholder: "nguyen_van_a" },
                { id: "new-email", label: "Email", key: "email", type: "email", placeholder: "a@student.edu.vn" },
                { id: "new-password", label: "Mật khẩu tạm thời", key: "password", type: "password", placeholder: "Tối thiểu 8 ký tự" },
              ].map((field) => (
                <div key={field.key}>
                  <label htmlFor={field.id} className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                    {field.label}
                  </label>
                  <input
                    id={field.id}
                    type={field.type}
                    value={createForm[field.key as keyof typeof createForm] as string}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    className="input-glass py-2.5 px-4 text-sm"
                    required
                  />
                </div>
              ))}

              {/* Permissions */}
              <div>
                <p className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                  Quyền truy cập
                </p>
                <div className="space-y-2">
                  {MODULES.map((mod) => (
                    <label key={mod.id} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={createForm.permissions.includes(mod.id)}
                        onChange={(e) => {
                          setCreateForm((prev) => ({
                            ...prev,
                            permissions: e.target.checked
                              ? [...prev.permissions, mod.id]
                              : prev.permissions.filter((p) => p !== mod.id),
                          }));
                        }}
                        className="w-4 h-4 rounded"
                        id={`perm-${mod.id}`}
                      />
                      <span className="text-sm text-[var(--color-text-secondary)]">{mod.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowCreateModal(false); setCreateForm(INITIAL_FORM); }} className="btn-ghost flex-1 py-2.5 text-sm">
                  Hủy
                </button>
                <button type="submit" className="btn-brand flex-1 py-2.5 text-sm" disabled={submitting}>
                  {submitting ? "Đang tạo..." : "Tạo tài khoản"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Result Modal */}
      {resetPasswordResult && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "oklch(0 0 0 / 0.7)", backdropFilter: "blur(4px)" }}
          role="dialog"
          aria-modal
          aria-label="Kết quả reset mật khẩu"
        >
          <div className="glass w-full max-w-sm p-6 animate-slide-in text-center">
            <div className="text-4xl mb-3">🔑</div>
            <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-1">
              Mật khẩu đã được reset
            </h3>
            <p className="text-sm text-[var(--color-text-muted)] mb-4">
              Thông báo mật khẩu tạm thời cho <strong>{resetPasswordResult.name}</strong>:
            </p>
            <div
              className="glass-sm px-6 py-4 mb-4 font-mono text-xl font-bold tracking-widest text-[var(--color-brand-300)] glow-brand"
              aria-label="Mật khẩu tạm thời"
            >
              {resetPasswordResult.password}
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mb-5">
              ⚠️ Chỉ hiển thị một lần. Yêu cầu thành viên đổi mật khẩu ngay sau khi đăng nhập.
            </p>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(resetPasswordResult.password);
                toast.success("Đã sao chép mật khẩu!");
              }}
              className="btn-ghost w-full py-2 text-sm mb-2"
            >
              📋 Sao chép
            </button>
            <button
              onClick={() => setResetPasswordResult(null)}
              className="btn-brand w-full py-2 text-sm"
            >
              Đã thông báo xong ✓
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
