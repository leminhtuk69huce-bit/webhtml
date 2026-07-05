"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import AppShell from "@/components/layout/AppShell";
import api from "@/lib/api";
import { toast } from "@/store/toastStore";
import { useAuthStore } from "@/store/authStore";

interface NASFile {
  id: string;
  originalName: string;
  sizeBytes: string;
  mimeType: string | null;
  uploadedBy: { id: string; displayName: string } | null;
  uploadedAt: string;
  expiresAt: string;
  downloadCount: number;
  isExpired: boolean;
}

function formatBytes(bytes: string | number): string {
  const n = Number(bytes);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function getFileIcon(mimeType: string | null, name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) return "🖼️";
  if (["mp4", "mov", "avi", "mkv"].includes(ext)) return "🎬";
  if (["mp3", "wav", "flac"].includes(ext)) return "🎵";
  if (["pdf"].includes(ext)) return "📄";
  if (["doc", "docx"].includes(ext)) return "📝";
  if (["xls", "xlsx"].includes(ext)) return "📊";
  if (["ppt", "pptx"].includes(ext)) return "📊";
  if (["zip", "rar", "7z", "tar"].includes(ext)) return "📦";
  if (["js", "ts", "jsx", "tsx", "py", "java", "cpp", "cs"].includes(ext)) return "💻";
  return "📁";
}

export default function NASPage() {
  const { user } = useAuthStore();
  const [files, setFiles] = useState<NASFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingFileName, setUploadingFileName] = useState("");
  const [recentlyDownloaded, setRecentlyDownloaded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/files?search=${search}`);
      setFiles(data.data.files);
    } catch {
      toast.error("Không thể tải danh sách file");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handleUpload(file);
    e.target.value = "";
  };

  const handleUpload = async (file: File) => {
    if (file.size > 1073741824) {
      toast.error("File quá lớn", "Kích thước tối đa là 1GB");
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadingFileName(file.name);

    const formData = new FormData();
    formData.append("file", file);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const token = localStorage.getItem("accessToken");
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          setUploadProgress(Math.round((e.loaded / e.total) * 100));
        }
      });

      await new Promise<void>((resolve, reject) => {
        xhr.open("POST", `${process.env.NEXT_PUBLIC_API_URL}/files/upload`);
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);

        xhr.onload = () => {
          if (xhr.status === 201) resolve();
          else reject(new Error(JSON.parse(xhr.responseText)?.error || "Lỗi upload"));
        };
        xhr.onerror = () => reject(new Error("Lỗi kết nối"));

        xhr.send(formData);
        controller.signal.addEventListener("abort", () => xhr.abort());
      });

      toast.success("Upload thành công!", file.name);
      fetchFiles();
    } catch (err: unknown) {
      if ((err as Error).name !== "AbortError") {
        toast.error("Upload thất bại", (err as Error).message);
      }
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setUploadingFileName("");
      abortControllerRef.current = null;
    }
  };

  const handleDownload = async (file: NASFile) => {
    try {
      const token = localStorage.getItem("accessToken");
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/files/${file.id}/download`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.originalName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Hiện nút Xóa sau khi download
      setRecentlyDownloaded((prev) => new Set([...prev, file.id]));
      setFiles((prev) =>
        prev.map((f) => f.id === file.id ? { ...f, downloadCount: f.downloadCount + 1 } : f)
      );
      toast.info("Đang tải xuống...", file.originalName);
    } catch (err: unknown) {
      toast.error("Tải xuống thất bại", (err as Error).message);
    }
  };

  const handleDelete = async (file: NASFile) => {
    if (!confirm(`Xóa file "${file.originalName}"?`)) return;
    try {
      await api.delete(`/files/${file.id}`);
      toast.success(`Đã xóa "${file.originalName}"`);
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
      setRecentlyDownloaded((prev) => {
        const next = new Set(prev);
        next.delete(file.id);
        return next;
      });
    } catch {
      toast.error("Không thể xóa file");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  };

  return (
    <AppShell requiredModule="NAS">
      <div className="max-w-5xl mx-auto space-y-5">
        {/* Upload area */}
        <div
          className="glass p-8 text-center border-2 border-dashed border-[var(--color-glass-border)] hover:border-[var(--color-brand-400)] transition-colors cursor-pointer"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => !uploading && fileInputRef.current?.click()}
          role="button"
          aria-label="Khu vực kéo thả để upload file"
        >
          {uploading ? (
            <div className="space-y-3">
              <div className="text-3xl">⏳</div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                Đang tải lên: {uploadingFileName}
              </p>
              <div className="max-w-sm mx-auto">
                <div className="flex justify-between text-xs text-[var(--color-text-muted)] mb-1">
                  <span>Tiến trình</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-2 rounded-full bg-[var(--color-glass-2)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${uploadProgress}%`,
                      background: "linear-gradient(90deg, var(--color-brand-500), var(--color-brand-400))",
                    }}
                    role="progressbar"
                    aria-valuenow={uploadProgress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); abortControllerRef.current?.abort(); }}
                className="btn-ghost px-4 py-1.5 text-xs"
              >
                Hủy upload
              </button>
            </div>
          ) : (
            <>
              <div className="text-4xl mb-3">📤</div>
              <p className="text-base font-semibold text-[var(--color-text-primary)] mb-1">
                Kéo & thả file vào đây
              </p>
              <p className="text-sm text-[var(--color-text-muted)]">
                hoặc click để chọn file — Tối đa 1GB/file — Hết hạn sau 48 giờ
              </p>
            </>
          )}
          <input
            ref={fileInputRef}
            id="file-upload-input"
            type="file"
            className="sr-only"
            onChange={handleFileSelect}
            disabled={uploading}
            aria-label="Chọn file để upload"
          />
        </div>

        {/* Search + count */}
        <div className="flex items-center gap-3">
          <input
            id="search-files"
            type="text"
            placeholder="🔍 Tìm file..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-glass py-2.5 px-4 text-sm flex-1 max-w-xs"
          />
          <span className="text-sm text-[var(--color-text-muted)]">
            {files.length} file
          </span>
        </div>

        {/* Files list */}
        <div className="glass overflow-hidden">
          {loading ? (
            <div className="p-10 text-center">
              <div className="w-8 h-8 border-2 border-[var(--color-brand-500)] border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : files.length === 0 ? (
            <div className="p-12 text-center text-[var(--color-text-muted)]">
              <div className="text-4xl mb-3">📭</div>
              <p>Chưa có file nào. Upload file đầu tiên để bắt đầu!</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-glass-border)]">
              {files.map((file) => {
                const canDelete =
                  user?.role === "ADMIN" || user?.id === file.uploadedBy?.id;
                const showDeleteBtn = recentlyDownloaded.has(file.id) || canDelete;
                const expiresIn = Math.max(
                  0,
                  Math.ceil((new Date(file.expiresAt).getTime() - Date.now()) / 3600000)
                );

                return (
                  <div
                    key={file.id}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-[var(--color-glass-1)] transition-colors"
                  >
                    {/* Icon */}
                    <div className="text-2xl flex-shrink-0">
                      {getFileIcon(file.mimeType, file.originalName)}
                    </div>

                    {/* File info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-[var(--color-text-primary)] truncate">
                        {file.originalName}
                      </p>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-[var(--color-text-muted)] flex-wrap">
                        <span>{formatBytes(file.sizeBytes)}</span>
                        <span>·</span>
                        <span>{file.uploadedBy?.displayName || "Ẩn danh"}</span>
                        <span>·</span>
                        <span>{formatDate(file.uploadedAt)}</span>
                        <span>·</span>
                        <span
                          className={expiresIn <= 6 ? "text-[var(--color-warning)]" : ""}
                          title={`Hết hạn: ${formatDate(file.expiresAt)}`}
                        >
                          ⏱ còn {expiresIn}h
                        </span>
                        {file.downloadCount > 0 && (
                          <>
                            <span>·</span>
                            <span>📥 {file.downloadCount}x</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleDownload(file)}
                        className="btn-brand px-4 py-2 text-xs"
                        aria-label={`Tải xuống ${file.originalName}`}
                      >
                        ⬇️ Tải về
                      </button>
                      {(showDeleteBtn || canDelete) && (
                        <button
                          onClick={() => handleDelete(file)}
                          className="btn-danger px-3 py-2 text-xs"
                          aria-label={`Xóa ${file.originalName}`}
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
