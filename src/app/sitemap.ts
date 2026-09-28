import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { kwts } from "@/lib/db/schema";
import { getDirectoryFacets } from "@/lib/queries-directory";
import { provinceSlug } from "@/lib/provinces";

export const dynamic = "force-dynamic";

/**
 * Sitemap dinamis: halaman publik + satu URL per provinsi + satu per KWT.
 * Jika DB tidak terjangkau saat build, tetap keluarkan route statis.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, priority: 1 },
    { url: `${base}/katalog`, priority: 0.9 },
    { url: `${base}/login`, priority: 0.2 },
    { url: `${base}/daftar-kwt`, priority: 0.6 },
  ];

  try {
    const [facets, groups] = await Promise.all([
      getDirectoryFacets(),
      db.select({ slug: kwts.slug }).from(kwts).orderBy(kwts.slug),
    ]);

    return [
      ...staticRoutes,
      ...facets.provinces.map((p) => ({
        url: `${base}/katalog/provinsi/${provinceSlug(p.province)}`,
        priority: 0.8,
      })),
      ...groups.flatMap((g) => [
        {
          url: `${base}/katalog/${g.slug}`,
          priority: 0.7,
        },
        {
          url: `${base}/katalog/${g.slug}/sertifikat`,
          priority: 0.5,
        },
      ]),
    ];
  } catch (e) {
    console.warn("[sitemap] database unreachable, emitting static routes only", e);
    return staticRoutes;
  }
}
