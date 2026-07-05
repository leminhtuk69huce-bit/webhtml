"use client";
import { useEffect } from "react";
import { useToastStore, Toast } from "@/store/toastStore";

const ICONS: Record<Toast["type"], string> = {
  success: "✅",
  error: "❌",
  warning: "⚠️",
  info: "ℹ️",
  reminder: "🔔",
};

const COLORS: Record<Toast["type"], string> = {
  success: "border-l-4 border-l-green-400",
  error: "border-l-4 border-l-red-400",
  warning: "border-l-4 border-l-yellow-400",
  info: "border-l-4 border-l-blue-400",
  reminder: "border-l-4 border-l-purple-400",
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  return (
    <div
      className={`glass toast-enter flex items-start gap-3 p-4 min-w-[300px] max-w-[380px] shadow-2xl ${COLORS[toast.type]}`}
      role="alert"
    >
      <span className="text-lg flex-shrink-0 mt-0.5">{ICONS[toast.type]}</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm leading-5 text-[var(--color-text-primary)]">
          {toast.title}
        </p>
        {toast.message && (
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 truncate">
            {toast.message}
          </p>
        )}
      </div>
      <button
        onClick={onRemove}
        className="flex-shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors text-sm ml-1"
        aria-label="Đóng thông báo"
      >
        ✕
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none"
      aria-live="polite"
      aria-label="Thông báo"
    >
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} onRemove={() => removeToast(t.id)} />
        </div>
      ))}
    </div>
  );
}
