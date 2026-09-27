"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSignOut() {
    setLoading(true);
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={onSignOut}
      disabled={loading}
      className="mt-3 flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-red-600"
    >
      <LogOut className="h-3.5 w-3.5" />
      {loading ? "Keluar..." : "Keluar"}
    </button>
  );
}
