import Link from "next/link";
import { MapPin, Sprout, Users } from "lucide-react";
import type { DirectoryRow } from "@/lib/queries-directory";
import { provinceSlug } from "@/lib/provinces";

/** Kartu KWT untuk direktori publik (index & halaman per-provinsi). */
export function GroupCard({ group }: { group: DirectoryRow }) {
  return (
    <Link
      href={`/katalog/${group.slug}`}
      className="card card-pad card-hover block"
    >
      <h2 className="font-semibold">{group.name}</h2>
      <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
        <MapPin className="h-3.5 w-3.5 shrink-0" />
        {[group.regency, group.province].filter(Boolean).join(", ") || "Indonesia"}
      </p>
      {group.address && (
        <p className="mt-0.5 text-xs text-slate-400">{group.address}</p>
      )}
      <div className="mt-3 flex gap-3 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1">
          <Sprout className="h-3.5 w-3.5 text-brand-500" /> {group.productCount} produk
        </span>
        <span className="inline-flex items-center gap-1">
          <Users className="h-3.5 w-3.5 text-brand-500" /> {group.memberCount} anggota
        </span>
      </div>
      <p className="mt-3 text-sm font-medium text-brand-600">Lihat katalog →</p>
    </Link>
  );
}

/** Link chip provinsi menuju halaman SEO /katalog/provinsi/[slug]. */
export function ProvinceChip({
  province,
  kwtCount,
  active,
}: {
  province: string;
  kwtCount?: number;
  active?: boolean;
}) {
  return (
    <Link
      href={`/katalog/provinsi/${provinceSlug(province)}`}
      className={`chip ${active ? "chip-active" : ""}`}
    >
      {province}
      {typeof kwtCount === "number" ? ` (${kwtCount})` : ""}
    </Link>
  );
}
