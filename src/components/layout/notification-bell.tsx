"use client";

import { Bell } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=10");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {
      // silent fail
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}`, { method: "PATCH" });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // silent fail
    }
  };

  const markAllAsRead = async () => {
    for (const n of notifications.filter((n) => !n.isRead)) {
      await markAsRead(n.id);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          setOpen(!open);
          if (!open && unreadCount > 0) {
            setTimeout(() => markAllAsRead(), 2000);
          }
        }}
        className="p-2 text-owly-text-light hover:text-owly-text hover:bg-owly-primary-50 rounded-lg transition-colors relative"
        title="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-owly-danger rounded-full">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-owly-surface border border-owly-border rounded-lg shadow-lg z-50 animate-scale-in transition-theme max-h-96 overflow-y-auto">
          <div className="px-4 py-3 border-b border-owly-border flex items-center justify-between">
            <span className="text-sm font-semibold text-owly-text">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-owly-primary hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-owly-text-light">
              No notifications
            </div>
          ) : (
            <div className="divide-y divide-owly-border">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`px-4 py-3 hover:bg-owly-primary-50 transition-colors cursor-pointer ${
                    !n.isRead ? "bg-owly-primary-50/50" : ""
                  }`}
                  onClick={() => !n.isRead && markAsRead(n.id)}
                >
                  <div className="flex items-start gap-2">
                    {!n.isRead && (
                      <span className="mt-1.5 w-2 h-2 rounded-full bg-owly-primary flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-owly-text truncate">{n.title}</p>
                      <p className="text-xs text-owly-text-light mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-owly-text-lighter mt-1">
                        {new Date(n.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
