"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MultiSeriesBarChart, type ChartPoint } from "@/components/MultiSeriesBarChart";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, ArrowRight, Plus, Truck } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format-rupiah";

interface DashboardClientProps {
  todayRevenue: number | null;
  monthExpenseTotal: number | null;
  monthCapitalTotal: number | null;
  netProfit: number;
  lowStockProducts: Array<{ id: string; name: string; stockQty: number; minStock: number }>;
  readyOrders: Array<{ id: string; invoiceNumber: string; customerName: string; total: number }>;
  recentSales: Array<{ id: string; invoiceNumber: string; date: string; customerName: string; total: number; paymentStatus: string; fulfillmentStatus: string }>;
}

export function DashboardClient({ todayRevenue, monthExpenseTotal, monthCapitalTotal, netProfit, lowStockProducts, readyOrders, recentSales }: DashboardClientProps) {
  const [chartPeriod, setChartPeriod] = useState("7d");
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [chartLoading, setChartLoading] = useState(true);

  useEffect(() => {
    let isCurrent = true;
    fetch(`/api/reports?type=dashboard-trend&period=${chartPeriod}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Gagal memuat grafik");
        return response.json();
      })
      .then((data: ChartPoint[]) => {
        if (isCurrent) setChartData(data);
      })
      .catch(() => {
        if (isCurrent) toast.error("Grafik belum dapat dimuat");
      })
      .finally(() => {
        if (isCurrent) setChartLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [chartPeriod]);

  const formatDate = (dateStr: string) => format(new Date(dateStr), "dd MMM yyyy", { locale: id });

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">Ringkasan operasional dan penjualan</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/penjualan">
              <ArrowRight className="h-4 w-4" /> Lihat penjualan
            </Link>
          </Button>
          <Button asChild>
            <Link href="/penjualan?action=new">
              <Plus className="h-4 w-4" /> Penjualan baru
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="">
            <h3 className="text-sm font-medium text-gray-500">Omzet Hari Ini</h3>
            <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(todayRevenue || 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="">
            <h3 className="text-sm font-medium text-gray-500">Modal + Pengeluaran Bulan Ini</h3>
            <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency((monthCapitalTotal || 0) + (monthExpenseTotal || 0))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="">
            <h3 className="text-sm font-medium text-gray-500">Estimasi Laba Bersih Bulan Berjalan</h3>
            <p className={`text-2xl font-bold mt-1 ${netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>{formatCurrency(netProfit)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Tren omzet dan pengeluaran</CardTitle>
          <div className="flex items-center gap-3">
            <label htmlFor="dashboard-chart-period" className="text-sm font-medium text-gray-600">
              Periode grafik
            </label>
            <Select
              value={chartPeriod}
              onValueChange={(value: string | null) => {
                setChartLoading(true);
                setChartPeriod(value || "7d");
              }}
            >
              <SelectTrigger id="dashboard-chart-period" className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">7 hari</SelectItem>
                <SelectItem value="30d">30 hari</SelectItem>
                <SelectItem value="12m">12 bulan</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {chartLoading ? (
            <Skeleton className="h-52 w-full" />
          ) : (
            <MultiSeriesBarChart
              data={chartData}
              ariaLabel="Grafik perbandingan omzet dan pengeluaran"
              series={[
                { label: "Omzet", colorClassName: "bg-emerald-500" },
                { label: "Pengeluaran", colorClassName: "bg-orange-400" },
              ]}
              formatValue={formatCurrency}
            />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" /> Stok menipis
            </CardTitle>
            <Button asChild variant="outline" size="sm">
              <Link href="/produk">Buka produk</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {lowStockProducts.length === 0 ? (
              <p className="py-4 text-sm text-gray-500">Stok semua aman</p>
            ) : (
              <div className="divide-y divide-border">
                {lowStockProducts.map((product) => (
                  <div key={product.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <span className="min-w-0 truncate font-medium">{product.name}</span>
                    <div className="flex shrink-0 items-center gap-2 text-sm tabular-nums">
                      <span>
                        {product.stockQty} / {product.minStock}
                      </span>
                      <StatusBadge status={product.stockQty <= 0 ? "out_of_stock" : "low_stock"} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-sky-700" /> Siap diambil
            </CardTitle>
            <Button asChild variant="outline" size="sm">
              <Link href="/penjualan">Buka penjualan</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {readyOrders.length === 0 ? (
              <p className="py-4 text-sm text-gray-500">Tidak ada order siap diambil</p>
            ) : (
              <div className="divide-y divide-border">
                {readyOrders.map((order) => (
                  <Link key={order.id} href={`/penjualan?saleId=${order.id}`} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 hover:text-primary">
                    <span className="min-w-0">
                      <span className="block truncate font-mono text-sm font-medium">{order.invoiceNumber}</span>
                      <span className="block truncate text-xs text-gray-500">{order.customerName}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-medium tabular-nums">{formatCurrency(order.total)}</span>
                      <StatusBadge status="ready" />
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Penjualan terbaru</CardTitle>
          <Button asChild variant="outline" size="sm">
            <Link href="/penjualan">Semua transaksi</Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0 sm:px-6 sm:pb-6">
          <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentSales.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-gray-500">
                      Belum ada transaksi
                    </TableCell>
                  </TableRow>
                ) : (
                  recentSales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="font-mono font-medium">
                        <Link href={`/penjualan?saleId=${sale.id}`} className="hover:text-primary">
                          {sale.invoiceNumber}
                        </Link>
                      </TableCell>
                      <TableCell>{formatDate(sale.date)}</TableCell>
                      <TableCell>{sale.customerName}</TableCell>
                      <TableCell>
                        <StatusBadge status={sale.paymentStatus} />
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{formatCurrency(sale.total)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="divide-y md:hidden">
            {recentSales.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-500">Belum ada transaksi</p>
            ) : (
              recentSales.map((sale) => (
                <Link key={`mobile-${sale.id}`} href={`/penjualan?saleId=${sale.id}`} className="flex items-start justify-between gap-3 px-4 py-4">
                  <span className="min-w-0">
                    <span className="block truncate font-mono text-sm font-medium">{sale.invoiceNumber}</span>
                    <span className="mt-1 block truncate text-xs text-muted-foreground">
                      {sale.customerName} · {formatDate(sale.date)}
                    </span>
                    <span className="mt-2 block">
                      <StatusBadge status={sale.paymentStatus} />
                    </span>
                  </span>
                  <span className="shrink-0 text-right font-medium tabular-nums">{formatCurrency(sale.total)}</span>
                </Link>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
