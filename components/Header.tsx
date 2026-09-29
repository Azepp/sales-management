"use client";

import { Menu, LogOut, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileMenuOpen]);

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
    <header className="sticky top-0 z-40 w-full bg-white border-b border-gray-200">
      <div className="flex h-16 items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileMenuOpen(true)} aria-label="Buka menu" aria-expanded={mobileMenuOpen}>
            <Menu className="h-6 w-6" />
          </Button>
        </div>

        <div className="flex items-center gap-4 ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger>
              <Avatar className="h-10 w-10 rounded-full cursor-pointer hover:ring-2 hover:ring-primary/50 transition-colors">
                <AvatarImage src="/avatar.png" alt="User" />
                <AvatarFallback>U</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem className="text-sm font-medium px-3 py-2">Owner</DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600 cursor-pointer px-3 py-2 flex items-center gap-2">
                <LogOut className="h-4 w-4" />
                Keluar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {mobileMenuOpen && <button type="button" className="fixed inset-0 z-50 bg-black/50 lg:hidden" onClick={() => setMobileMenuOpen(false)} aria-label="Tutup menu" />}
      {mobileMenuOpen && (
        <div role="dialog" aria-modal="true" aria-label="Menu navigasi" className="fixed inset-y-0 left-0 z-50 w-[min(18rem,85vw)] overflow-y-auto bg-white border-r border-gray-200 lg:hidden">
          <div className="flex h-16 items-center justify-between px-4 border-b border-gray-200">
            <h1 className="text-xl font-bold text-gray-900">Binwich</h1>
            <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)} aria-label="Tutup menu">
              <X className="h-5 w-5" />
            </Button>
          </div>
          <nav aria-label="Navigasi utama" className="space-y-1 p-4">
            {[
              { name: "Dashboard", href: "/" },
              { name: "Produk & Stok", href: "/produk" },
              { name: "Penjualan", href: "/penjualan" },
              { name: "Keuangan", href: "/keuangan" },
              { name: "Laporan", href: "/laporan" },
            ].map((item) => (
              <Link key={item.name} href={item.href} onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900">
                {item.name}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
