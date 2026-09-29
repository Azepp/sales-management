"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Package, ShoppingCart, FileText, DollarSign, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Produk & Stok", href: "/produk", icon: Package },
  { name: "Penjualan", href: "/penjualan", icon: ShoppingCart },
  { name: "Keuangan", href: "/keuangan", icon: DollarSign },
  { name: "Laporan", href: "/laporan", icon: FileText },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Gagal mengakhiri sesi");
      router.replace("/login");
      router.refresh();
    } catch {
      toast.error("Gagal keluar", { description: "Periksa koneksi lalu coba lagi." });
    }
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 hidden lg:block">
      <div className="flex h-16 items-center px-6 border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-900">Binwich</h1>
      </div>
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors", isActive ? "bg-gray-100 text-gray-900" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900")}
            >
              <item.icon className="h-5 w-5" aria-hidden="true" />
              {item.name}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-gray-200">
        <Button variant="outline" className="w-full justify-start gap-3 text-red-500" onClick={handleLogout}>
          <LogOut className="h-5 w-5" aria-hidden="true" />
          Keluar
        </Button>
      </div>
    </aside>
  );
}
