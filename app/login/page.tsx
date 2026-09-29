"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Tidak dapat terhubung. Periksa koneksi lalu coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-100 px-4 py-8 sm:px-8">
      <Card className="grid w-full max-w-4xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5 md:grid-cols-[0.9fr_1.1fr]">
        <aside className="relative flex min-h-36 flex-col justify-between overflow-hidden bg-slate-900 p-6 text-white sm:p-8 md:min-h-136">
          <div className="absolute inset-y-0 right-0 w-1/3 border-l border-white/10" aria-hidden="true" />
          <div className="relative flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-lg bg-white/10">
              <Store className="size-5" />
            </span>
            <span className="text-sm font-semibold">BINWICH</span>
          </div>
          <div className="relative mt-8 md:mt-0">
            <p className="text-xs font-medium uppercase text-slate-300">Management</p>
            <h1 className="mt-2 max-w-xs text-3xl font-semibold leading-tight sm:text-4xl">Selamat datang kembali</h1>
            <p className="mt-3 text-sm text-slate-300">Masuk untuk melanjutkan ke ruang kerja Anda.</p>
          </div>
          <p className="relative mt-8 text-xs text-slate-400">Binwich Management</p>
        </aside>
        <section className="flex items-center p-6 sm:p-10 md:p-12">
          <div className="mx-auto w-full max-w-sm">
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-slate-900">Masuk</h2>
              <p className="mt-1 text-sm text-slate-500">Gunakan email dan password akun Anda.</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                  Email
                </label>
                <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@domain.com" required disabled={loading} aria-invalid={Boolean(error)} />
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                  Password
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan password"
                    required
                    disabled={loading}
                    className="pr-11"
                    aria-invalid={Boolean(error)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="absolute inset-y-0 right-0 grid w-11 place-items-center text-slate-500 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Memproses..." : "Masuk"}
              </Button>
            </form>
          </div>
        </section>
      </Card>
    </div>
  );
}
