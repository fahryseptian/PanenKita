"use client";

import { useState } from "react";
import { submitFeedback } from "@/lib/actions/misc";

export function FeedbackForm() {
  const [rating, setRating] = useState(5);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    fd.set("rating", String(rating));
    const res = await submitFeedback(fd);
    setSubmitting(false);
    setMsg(
      res?.ok
        ? { ok: true, text: "Terima kasih atas masukannya! 🌾" }
        : { ok: false, text: res?.error ?? "Gagal mengirim" },
    );
    if (res?.ok) e.currentTarget.reset();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            aria-label={`Beri ${n} bintang`}
            className={`text-2xl transition ${n <= rating ? "text-warn" : "text-slate-200"}`}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        name="message"
        required
        rows={3}
        placeholder="Bagikan pengalaman Anda memakai TaniKita..."
        className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      />
      {msg && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            msg.ok ? "bg-brand-50 text-brand-700" : "bg-red-50 text-red-600"
          }`}
        >
          {msg.text}
        </p>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {submitting ? "Mengirim..." : "Kirim umpan balik"}
      </button>
    </form>
  );
}
