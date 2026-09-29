"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { timeAgo } from "@/lib/format";

interface NotificationItem {
  id: string;
  kind: string;
  message: string;
  sent: boolean;
  readAt: string | null;
  createdAt: string;
}

const KIND_ICON: Record<string, string> = {
  harvest: "🌾",
  price_change: "💰",
  new_order: "🧺",
  order_created: "🧺",
  order_paid: "✅",
  stock_out: "🚨",
  order_expired: "⌛",
  broadcast: "📣",
  test: "👋",
  password_reset: "🔑",
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  async function fetchNotifications() {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        notifications: NotificationItem[];
        unread: number;
      };
      setItems(data.notifications);
      setUnread(data.unread);
    } catch {
      // Diamkan — lonceng tidak boleh mengganggu halaman.
    }
  }

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Tutup dropdown saat klik di luar.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function onToggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      await fetchNotifications();
      setLoading(false);
      // Tandai semua dibaca setelah dibuka (fire-and-forget).
      if (unread > 0) {
        fetch("/api/notifications", { method: "POST" })
          .then(() => setUnread(0))
          .catch(() => {});
      }
    }
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={onToggle}
        aria-label="Notifikasi"
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-brand-50 hover:text-brand-700"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <p className="text-sm font-semibold">Notifikasi</p>
            <span className="flex items-center gap-1 text-[11px] text-slate-400">
              <CheckCheck className="h-3.5 w-3.5" />
              dibaca otomatis
            </span>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading && items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">
                Memuat...
              </p>
            ) : items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">
                Belum ada notifikasi.
              </p>
            ) : (
              items.map((n) => (
                <div
                  key={n.id}
                  className={`flex gap-2.5 border-b border-slate-50 px-4 py-3 last:border-0 ${
                    n.readAt ? "" : "bg-brand-50/60"
                  }`}
                >
                  <span className="shrink-0 text-base">
                    {KIND_ICON[n.kind] ?? "🔔"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="whitespace-pre-line break-words text-xs leading-relaxed text-slate-700">
                      {n.message}
                    </p>
                    <p className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
                      <span>{timeAgo(n.createdAt)}</span>
                      <span
                        className={
                          n.sent
                            ? "text-emerald-600"
                            : "text-amber-600"
                        }
                      >
                        {n.sent ? "· WA terkirim" : "· WA belum terkirim"}
                      </span>
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
