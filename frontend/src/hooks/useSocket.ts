"use client";
import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useAuthStore } from "@/store/authStore";
import { toast } from "@/store/toastStore";

let socket: Socket | null = null;

export function useSocket() {
  const { user, isAuthenticated } = useAuthStore();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const accessToken = localStorage.getItem("accessToken");
    if (!accessToken) return;

    // Kết nối Socket.io
    const newSocket = io(process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3001", {
      auth: { token: accessToken },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 5,
    });

    newSocket.on("connect", () => {
      console.log("🔌 WebSocket connected:", newSocket.id);
    });

    newSocket.on("connect_error", (err) => {
      console.warn("WebSocket connect error:", err.message);
    });

    // Nhận reminder khi connect hoặc broadcast
    newSocket.on(
      "reminder:check",
      (payload: { reminders: Reminder[] }) => {
        payload.reminders.forEach((reminder) => {
          const label = reminder.isToday
            ? `⏰ Hôm nay — còn ${reminder.hoursLeft}h`
            : "📅 Ngày mai";
          toast.reminder(`${label}: ${reminder.title}`, reminder.deadlineAt
            ? new Date(reminder.deadlineAt).toLocaleString("vi-VN")
            : undefined
          );
        });
      }
    );

    // Thông báo file bị xóa tự động
    newSocket.on(
      "file:expired",
      (payload: { deletedFiles: { fileName: string }[] }) => {
        payload.deletedFiles.forEach((f) => {
          toast.warning("File đã hết hạn & bị xóa", f.fileName);
        });
      }
    );

    newSocket.on("disconnect", (reason) => {
      console.log("🔌 WebSocket disconnected:", reason);
    });

    socketRef.current = newSocket;
    socket = newSocket;

    return () => {
      newSocket.disconnect();
      socket = null;
    };
  }, [isAuthenticated, user]);

  return socketRef.current;
}

interface Reminder {
  id: string;
  title: string;
  deadlineAt: string;
  isToday: boolean;
  isTomorrow: boolean;
  hoursLeft: number;
}

// Export singleton để dùng ngoài hook nếu cần
export { socket };
