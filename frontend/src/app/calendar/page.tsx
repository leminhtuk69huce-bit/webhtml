"use client";
import { useEffect, useState, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import api from "@/lib/api";
import { toast } from "@/store/toastStore";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { vi } from "date-fns/locale";

interface CalEvent {
  id: string;
  title: string;
  description?: string;
  eventDate: string;
  deadlineAt?: string;
  color: string;
  createdBy: { id: string; displayName: string };
}

const COLOR_OPTIONS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#06b6d4",
];

const INITIAL_FORM = {
  title: "",
  description: "",
  eventDate: "",
  deadlineAt: "",
  color: "#6366f1",
};

const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalEvent | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const month = currentDate.getMonth() + 1;
      const year = currentDate.getFullYear();
      const { data } = await api.get(`/events?month=${month}&year=${year}`);
      setEvents(data.data.events);
    } catch {
      toast.error("Không thể tải sự kiện");
    } finally {
      setLoading(false);
    }
  }, [currentDate]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Tạo grid lịch (bao gồm ngày đầu/cuối tháng lân cận)
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const calDays = eachDayOfInterval({ start: calStart, end: calEnd });

  const getEventsForDay = (day: Date) =>
    events.filter((e) => isSameDay(new Date(e.eventDate), day));

  const openCreateModal = (day: Date) => {
    setEditingEvent(null);
    setForm({
      ...INITIAL_FORM,
      eventDate: format(day, "yyyy-MM-dd"),
    });
    setSelectedDate(day);
    setShowModal(true);
  };

  const openEditModal = (event: CalEvent) => {
    setEditingEvent(event);
    setForm({
      title: event.title,
      description: event.description || "",
      eventDate: event.eventDate.slice(0, 10),
      deadlineAt: event.deadlineAt ? event.deadlineAt.slice(0, 16) : "",
      color: event.color,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingEvent) {
        await api.put(`/events/${editingEvent.id}`, form);
        toast.success("Đã cập nhật sự kiện");
      } else {
        await api.post("/events", form);
        toast.success("Đã thêm sự kiện mới");
      }
      setShowModal(false);
      fetchEvents();
    } catch {
      toast.error("Không thể lưu sự kiện");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (eventId: string) => {
    if (!confirm("Xác nhận xóa sự kiện này?")) return;
    try {
      await api.delete(`/events/${eventId}`);
      toast.success("Đã xóa sự kiện");
      fetchEvents();
    } catch {
      toast.error("Không thể xóa sự kiện");
    }
    setShowModal(false);
  };

  return (
    <AppShell requiredModule="CALENDAR">
      <div className="max-w-5xl mx-auto space-y-4">
        {/* Calendar header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-[var(--color-text-primary)] capitalize">
            {format(currentDate, "MMMM yyyy", { locale: vi })}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentDate(subMonths(currentDate, 1))}
              className="btn-ghost w-9 h-9 flex items-center justify-center text-lg"
              aria-label="Tháng trước"
            >
              ‹
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="btn-ghost px-4 py-2 text-xs"
            >
              Hôm nay
            </button>
            <button
              onClick={() => setCurrentDate(addMonths(currentDate, 1))}
              className="btn-ghost w-9 h-9 flex items-center justify-center text-lg"
              aria-label="Tháng sau"
            >
              ›
            </button>
          </div>
        </div>

        {/* Calendar grid */}
        <div className="glass overflow-hidden">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-[var(--color-glass-border)]">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="py-3 text-center text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Days grid */}
          {loading ? (
            <div className="h-80 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-[var(--color-brand-500)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-7">
              {calDays.map((day, idx) => {
                const dayEvents = getEventsForDay(day);
                const isToday = isSameDay(day, new Date());
                const isCurrentMonth = isSameMonth(day, currentDate);

                return (
                  <div
                    key={idx}
                    onClick={() => openCreateModal(day)}
                    className={`min-h-[96px] p-2 cursor-pointer transition-colors ${
                      isCurrentMonth ? "hover:bg-[var(--color-glass-1)]" : "opacity-40"
                    }`}
                    style={{
                      borderRight: (idx + 1) % 7 !== 0 ? "1px solid var(--color-glass-border)" : "none",
                      borderBottom: idx < calDays.length - 7 ? "1px solid var(--color-glass-border)" : "none",
                    }}
                    role="button"
                    aria-label={`${format(day, "d MMMM yyyy", { locale: vi })}, ${dayEvents.length} sự kiện. Click để thêm sự kiện.`}
                  >
                    <div
                      className={`w-7 h-7 flex items-center justify-center text-sm font-medium rounded-full mb-1 transition-colors ${
                        isToday
                          ? "btn-brand text-white"
                          : "text-[var(--color-text-secondary)]"
                      }`}
                    >
                      {format(day, "d")}
                    </div>

                    {/* Events for this day */}
                    <div className="space-y-1">
                      {dayEvents.slice(0, 3).map((event) => (
                        <div
                          key={event.id}
                          onClick={(e) => { e.stopPropagation(); openEditModal(event); }}
                          className="text-xs px-2 py-0.5 rounded-md truncate font-medium cursor-pointer hover:opacity-80 transition-opacity"
                          style={{
                            background: event.color + "25",
                            borderLeft: `3px solid ${event.color}`,
                            color: event.color,
                          }}
                          title={event.title}
                        >
                          {event.title}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="text-xs text-[var(--color-text-muted)] px-1">
                          +{dayEvents.length - 3} sự kiện
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Event Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "oklch(0 0 0 / 0.7)", backdropFilter: "blur(4px)" }}
          role="dialog"
          aria-modal
          aria-label={editingEvent ? "Chỉnh sửa sự kiện" : "Thêm sự kiện mới"}
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <div className="glass w-full max-w-md p-6 animate-slide-in">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
                {editingEvent ? "Chỉnh sửa sự kiện" : "Thêm sự kiện"}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-xl">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">Tiêu đề *</label>
                <input
                  id="event-title"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Ví dụ: Họp nhóm tuần 3"
                  className="input-glass py-2.5 px-4 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">Mô tả</label>
                <textarea
                  id="event-description"
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Chi tiết sự kiện..."
                  className="input-glass py-2.5 px-4 text-sm h-20 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">Ngày *</label>
                  <input
                    id="event-date"
                    type="date"
                    value={form.eventDate}
                    onChange={(e) => setForm((p) => ({ ...p, eventDate: e.target.value }))}
                    className="input-glass py-2.5 px-4 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">Deadline</label>
                  <input
                    id="event-deadline"
                    type="datetime-local"
                    value={form.deadlineAt}
                    onChange={(e) => setForm((p) => ({ ...p, deadlineAt: e.target.value }))}
                    className="input-glass py-2.5 px-4 text-sm"
                  />
                </div>
              </div>

              {/* Color picker */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Màu sắc</label>
                <div className="flex gap-2 flex-wrap">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, color: c }))}
                      className="w-7 h-7 rounded-full transition-transform"
                      style={{
                        background: c,
                        transform: form.color === c ? "scale(1.25)" : "scale(1)",
                        outline: form.color === c ? `2px solid ${c}` : "none",
                        outlineOffset: "2px",
                      }}
                      aria-label={`Chọn màu ${c}`}
                      aria-pressed={form.color === c}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                {editingEvent && (
                  <button
                    type="button"
                    onClick={() => handleDelete(editingEvent.id)}
                    className="btn-danger px-4 py-2.5 text-sm"
                  >
                    🗑️ Xóa
                  </button>
                )}
                <div className="flex gap-2 flex-1">
                  <button type="button" onClick={() => setShowModal(false)} className="btn-ghost flex-1 py-2.5 text-sm">
                    Hủy
                  </button>
                  <button type="submit" className="btn-brand flex-1 py-2.5 text-sm" disabled={submitting}>
                    {submitting ? "Đang lưu..." : editingEvent ? "Cập nhật" : "Thêm sự kiện"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
