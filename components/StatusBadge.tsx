import { Badge } from "@/components/ui/badge";

const statusStyles: Record<string, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-800",
  ready: "border-sky-200 bg-sky-50 text-sky-800",
  delivered: "border-emerald-200 bg-emerald-50 text-emerald-800",
  cancelled: "border-slate-200 bg-slate-100 text-slate-700",
  unpaid: "border-red-200 bg-red-50 text-red-800",
  dp: "border-orange-200 bg-orange-50 text-orange-800",
  paid_full: "border-emerald-200 bg-emerald-50 text-emerald-800",
  out_of_stock: "border-red-200 bg-red-50 text-red-800",
  low_stock: "border-amber-200 bg-amber-50 text-amber-800",
  in_stock: "border-emerald-200 bg-emerald-50 text-emerald-800",
};

const statusLabels: Record<string, string> = {
  pending: "Pending",
  ready: "Siap",
  delivered: "Diambil",
  cancelled: "Batal",
  unpaid: "Belum Bayar",
  dp: "DP",
  paid_full: "Lunas",
  out_of_stock: "Habis",
  low_stock: "Menipis",
  in_stock: "Aman",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return (
    <Badge variant="outline" className={statusStyles[status] ?? "border-border bg-muted text-foreground"}>
      {label ?? statusLabels[status] ?? status}
    </Badge>
  );
}
