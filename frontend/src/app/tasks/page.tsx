"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import AppShell from "@/components/layout/AppShell";
import api from "@/lib/api";
import { toast } from "@/store/toastStore";
import { useAuthStore } from "@/store/authStore";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Task {
  id: string;
  title: string;
  description?: string;
  status: "TODO" | "IN_PROGRESS" | "ALMOST_DONE" | "DONE";
  repoUrl?: string;
  position: number;
  assignee?: { id: string; displayName: string; avatarUrl?: string | null } | null;
  createdBy: { id: string; displayName: string };
  createdAt: string;
}

interface BoardData {
  TODO: Task[];
  IN_PROGRESS: Task[];
  ALMOST_DONE: Task[];
  DONE: Task[];
}

interface UserOption {
  id: string;
  displayName: string;
}

const COLUMNS: { id: keyof BoardData; label: string; color: string; icon: string }[] = [
  { id: "TODO", label: "Chưa làm", color: "var(--color-todo)", icon: "⬜" },
  { id: "IN_PROGRESS", label: "Đang làm", color: "var(--color-in-progress)", icon: "🔄" },
  { id: "ALMOST_DONE", label: "Sắp xong", color: "var(--color-almost-done)", icon: "⚡" },
  { id: "DONE", label: "Hoàn thành", color: "var(--color-done)", icon: "✅" },
];

const INITIAL_FORM = {
  title: "",
  description: "",
  repoUrl: "",
  assigneeId: "",
  status: "TODO" as keyof BoardData,
};

// ============================================================
// Task Card Component (Sortable)
// ============================================================
function TaskCard({ task, onClick }: { task: Task; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="glass-sm p-4 cursor-grab active:cursor-grabbing glass-hover"
      {...attributes}
      {...listeners}
      onClick={onClick}
      role="button"
      aria-label={`Task: ${task.title}. Click để chỉnh sửa.`}
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
    >
      <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1 leading-5">
        {task.title}
      </h4>

      {task.description && (
        <p className="text-xs text-[var(--color-text-muted)] mb-2 line-clamp-2">
          {task.description}
        </p>
      )}

      {task.repoUrl && (
        <a
          href={task.repoUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-xs text-[var(--color-brand-300)] hover:underline mb-2"
          aria-label={`Link GitHub/GitLab: ${task.repoUrl}`}
        >
          🔗 GitHub/GitLab
        </a>
      )}

      {task.assignee && (
        <div className="flex items-center gap-2 mt-2">
          <div className="avatar w-6 h-6 text-[10px]">
            {task.assignee.displayName.split(" ").map((w) => w[0]).slice(-2).join("").toUpperCase()}
          </div>
          <span className="text-xs text-[var(--color-text-secondary)]">
            {task.assignee.displayName}
          </span>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Column Component (Droppable)
// ============================================================
function KanbanColumn({
  column,
  tasks,
  onAddTask,
  onTaskClick,
}: {
  column: (typeof COLUMNS)[0];
  tasks: Task[];
  onAddTask: () => void;
  onTaskClick: (task: Task) => void;
}) {
  const { setNodeRef } = useDroppable({ id: column.id });

  return (
    <div className="flex flex-col min-w-[260px] max-w-[300px] flex-1">
      {/* Column header */}
      <div
        className="flex items-center justify-between px-4 py-3 rounded-t-xl mb-2"
        style={{
          background: column.color + "18",
          borderBottom: `2px solid ${column.color}`,
        }}
      >
        <div className="flex items-center gap-2">
          <span>{column.icon}</span>
          <span
            className="text-sm font-bold"
            style={{ color: column.color }}
          >
            {column.label}
          </span>
          <span
            className="badge text-xs font-bold"
            style={{
              background: column.color + "25",
              color: column.color,
              border: `1px solid ${column.color}40`,
            }}
          >
            {tasks.length}
          </span>
        </div>
        <button
          onClick={onAddTask}
          className="w-6 h-6 rounded-full flex items-center justify-center text-sm transition-colors hover:bg-[var(--color-glass-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          aria-label={`Thêm task vào cột ${column.label}`}
          title="Thêm task"
        >
          +
        </button>
      </div>

      {/* Tasks list */}
      <div
        ref={setNodeRef}
        className="flex-1 space-y-2 min-h-[120px] p-1 rounded-b-xl transition-colors"
        aria-label={`Cột ${column.label}`}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div
            className="h-20 flex items-center justify-center rounded-xl border-2 border-dashed text-xs text-[var(--color-text-disabled)]"
            style={{ borderColor: column.color + "30" }}
          >
            Kéo task vào đây
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Main Tasks Page
// ============================================================
export default function TasksPage() {
  const { user } = useAuthStore();
  const [board, setBoard] = useState<BoardData>({
    TODO: [], IN_PROGRESS: [], ALMOST_DONE: [], DONE: [],
  });
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/tasks");
      setBoard(data.data);
    } catch {
      toast.error("Không thể tải tasks");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const { data } = await api.get("/users?limit=100");
      setUsers(data.data.users.filter((u: { isActive: boolean }) => u.isActive));
    } catch {}
  }, []);

  useEffect(() => {
    fetchTasks();
    fetchUsers();
  }, [fetchTasks, fetchUsers]);

  const findTaskAndColumn = (taskId: string): { task: Task; column: keyof BoardData } | null => {
    for (const col of Object.keys(board) as (keyof BoardData)[]) {
      const task = board[col].find((t) => t.id === taskId);
      if (task) return { task, column: col };
    }
    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const found = findTaskAndColumn(event.active.id as string);
    setActiveTask(found?.task || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const fromResult = findTaskAndColumn(active.id as string);
    if (!fromResult) return;

    const overId = over.id as string;
    const toColumn = COLUMNS.find((c) => c.id === overId)?.id || findTaskAndColumn(overId)?.column;

    if (!toColumn) return;

    const fromColumn = fromResult.column;

    // Optimistic update
    setBoard((prev) => {
      const newBoard = { ...prev };

      if (fromColumn === toColumn) {
        const tasks = [...newBoard[fromColumn]];
        const oldIdx = tasks.findIndex((t) => t.id === active.id);
        const newIdx = tasks.findIndex((t) => t.id === overId);
        if (oldIdx !== -1 && newIdx !== -1) {
          newBoard[fromColumn] = arrayMove(tasks, oldIdx, newIdx);
        }
      } else {
        const fromTasks = [...newBoard[fromColumn]];
        const toTasks = [...newBoard[toColumn]];
        const taskIdx = fromTasks.findIndex((t) => t.id === active.id);
        const [movedTask] = fromTasks.splice(taskIdx, 1);
        movedTask.status = toColumn;
        toTasks.unshift(movedTask);
        newBoard[fromColumn] = fromTasks;
        newBoard[toColumn] = toTasks;
      }

      return newBoard;
    });

    // API call
    try {
      const toTasks = board[toColumn];
      const newPos = toColumn !== fromColumn ? 0 : toTasks.findIndex((t) => t.id === overId);
      await api.patch(`/tasks/${active.id}/move`, {
        newStatus: toColumn,
        newPosition: Math.max(0, newPos),
      });
    } catch {
      toast.error("Không thể di chuyển task");
      fetchTasks();
    }
  };

  const openCreateModal = (status: keyof BoardData = "TODO") => {
    setEditingTask(null);
    setForm({ ...INITIAL_FORM, status });
    setShowModal(true);
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setForm({
      title: task.title,
      description: task.description || "",
      repoUrl: task.repoUrl || "",
      assigneeId: task.assignee?.id || "",
      status: task.status,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingTask) {
        await api.put(`/tasks/${editingTask.id}`, form);
        toast.success("Đã cập nhật task");
      } else {
        await api.post("/tasks", form);
        toast.success("Đã tạo task mới");
      }
      setShowModal(false);
      fetchTasks();
    } catch {
      toast.error("Không thể lưu task");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm("Xóa task này?")) return;
    try {
      await api.delete(`/tasks/${taskId}`);
      toast.success("Đã xóa task");
      setShowModal(false);
      fetchTasks();
    } catch {
      toast.error("Không thể xóa task");
    }
  };

  return (
    <AppShell requiredModule="TASK_MANAGEMENT">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex gap-4 text-xs text-[var(--color-text-muted)]">
            {COLUMNS.map((col) => (
              <span key={col.id}>
                <span style={{ color: col.color }}>{col.icon}</span>{" "}
                {board[col.id].length} task
              </span>
            ))}
          </div>
          <button
            id="btn-add-task"
            onClick={() => openCreateModal("TODO")}
            className="btn-brand px-5 py-2.5 text-sm"
          >
            + Thêm task
          </button>
        </div>

        {/* Kanban Board */}
        {loading ? (
          <div className="flex gap-4">
            {COLUMNS.map((col) => (
              <div key={col.id} className="flex-1 h-48 glass shimmer rounded-xl" />
            ))}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-4 overflow-x-auto pb-4">
              {COLUMNS.map((column) => (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  tasks={board[column.id]}
                  onAddTask={() => openCreateModal(column.id)}
                  onTaskClick={openEditModal}
                />
              ))}
            </div>

            <DragOverlay>
              {activeTask && (
                <div className="glass-sm p-4 shadow-2xl rotate-2 opacity-90 w-64">
                  <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {activeTask.title}
                  </h4>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {/* Task Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "oklch(0 0 0 / 0.7)", backdropFilter: "blur(4px)" }}
          role="dialog"
          aria-modal
          aria-label={editingTask ? "Chỉnh sửa task" : "Thêm task mới"}
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <div className="glass w-full max-w-md p-6 animate-slide-in">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
                {editingTask ? "Chỉnh sửa task" : "Thêm task mới"}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-xl">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">Tên công việc *</label>
                <input
                  id="task-title"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Tên công việc..."
                  className="input-glass py-2.5 px-4 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">Mô tả ngắn</label>
                <textarea
                  id="task-description"
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Chi tiết công việc..."
                  className="input-glass py-2.5 px-4 text-sm h-20 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                  Link GitHub/GitLab
                </label>
                <input
                  id="task-repo-url"
                  type="url"
                  value={form.repoUrl}
                  onChange={(e) => setForm((p) => ({ ...p, repoUrl: e.target.value }))}
                  placeholder="https://github.com/..."
                  className="input-glass py-2.5 px-4 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">Người thực hiện</label>
                  <select
                    id="task-assignee"
                    value={form.assigneeId}
                    onChange={(e) => setForm((p) => ({ ...p, assigneeId: e.target.value }))}
                    className="input-glass py-2.5 px-4 text-sm"
                  >
                    <option value="">-- Chưa giao --</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.displayName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">Trạng thái</label>
                  <select
                    id="task-status"
                    value={form.status}
                    onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as keyof BoardData }))}
                    className="input-glass py-2.5 px-4 text-sm"
                  >
                    {COLUMNS.map((col) => (
                      <option key={col.id} value={col.id}>{col.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                {editingTask && (
                  <button
                    type="button"
                    onClick={() => handleDelete(editingTask.id)}
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
                    {submitting ? "Đang lưu..." : editingTask ? "Cập nhật" : "Tạo task"}
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
