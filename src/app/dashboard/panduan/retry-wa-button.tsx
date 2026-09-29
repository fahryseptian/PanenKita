"use client";

import { useState } from "react";
import { resendFailedWa } from "@/lib/actions/misc";

export function RetryWaButton({ id }: { id: string }) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onRetry() {
    setState("sending");
    setError(null);
    const fd = new FormData();
    fd.set("id", id);
    const res = await resendFailedWa(fd);
    if (res?.ok) {
      setState("done");
    } else {
      setState("error");
      setError(res?.error ?? "Gagal mengirim");
    }
  }

  if (state === "done") {
    return <span className="shrink-0 text-xs font-semibold text-brand-600">✔ Terkirim</span>;
  }

  return (
    <div className="shrink-0 text-right">
      <button
        type="button"
        onClick={onRetry}
        disabled={state === "sending"}
        className="text-xs font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-50"
      >
        {state === "sending" ? "Mengirim…" : state === "error" ? "Coba lagi" : "Kirim ulang"}
      </button>
      {error && <p className="max-w-40 text-[10px] text-red-500">{error}</p>}
    </div>
  );
}
