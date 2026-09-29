import {
  BarChart3,
  BookOpen,
  Leaf,
  FileBarChart,
  Settings,
  ShoppingCart,
  Sprout,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: typeof Leaf;
  adminOnly?: boolean;
}

export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Ringkasan", icon: BarChart3 },
  { href: "/dashboard/panen", label: "Panen", icon: Sprout },
  { href: "/dashboard/pesanan", label: "Pesanan", icon: ShoppingCart },
  { href: "/dashboard/laporan", label: "Laporan", icon: FileBarChart, adminOnly: true },
  { href: "/dashboard/produk", label: "Produk", icon: Leaf, adminOnly: true },
  { href: "/dashboard/harga", label: "Harga", icon: TrendingUp, adminOnly: true },
  { href: "/dashboard/anggota", label: "Anggota", icon: Users, adminOnly: true },
  { href: "/dashboard/pengaturan", label: "Pengaturan", icon: Settings, adminOnly: true },
  { href: "/dashboard/profil", label: "Profil WA", icon: Wallet },
  { href: "/dashboard/panduan", label: "Panduan", icon: BookOpen },
];
