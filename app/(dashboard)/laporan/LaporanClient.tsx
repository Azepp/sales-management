"use client";

import { useState, useEffect, useCallback } from "react";
import { Download, FileText, Package, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { formatCurrency } from "@/lib/format-rupiah";
import { MultiSeriesBarChart, type ChartPoint } from "@/components/MultiSeriesBarChart";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

interface ProfitLossData {
  totalSales: number;
  totalCOGS: number;
  totalExpenses: number;
  totalReturns: number;
  netProfit: number;
  totalCapital: number;
  salesCount: number;
}

interface Sale {
  id: string;
  invoiceNumber: string;
  date: string;
  customerName: string;
  orderType: string;
  fulfillmentStatus: string;
  paymentStatus: string;
  subtotal: number;
  discountAmount: number;
  total: number;
  items: Array<{ product: { name: string; costPrice: number }; qty: number; priceAtSale: number; subtotal: number }>;
  payments: Array<{ amount: number }>;
  returns: Array<{ refundAmount: number }>;
}

interface Product {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  unit: string | null;
  costPrice: number;
  sellPrice: number;
  stockQty: number;
  minStock: number;
  isActive: boolean;
  stockMovements: Array<{ type: string; qty: number; date: string; note: string | null }>;
}

export function LaporanClient() {
  const [activeTab, setActiveTab] = useState<"profit" | "sales" | "stock">("profit");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [loading, setLoading] = useState(true);

  const [profitData, setProfitData] = useState<ProfitLossData | null>(null);
  const [salesData, setSalesData] = useState<Sale[]>([]);
  const [stockData, setStockData] = useState<Product[]>([]);

  const fetchReport = useCallback(
    async (type: string, exportFormat?: "excel") => {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("type", type);
      if (dateRange.start) params.set("startDate", dateRange.start);
      if (dateRange.end) params.set("endDate", dateRange.end);
      if (exportFormat) params.set("format", exportFormat);

      try {
        const res = await fetch(`/api/reports?${params}`);
        if (!res.ok) throw new Error("Gagal mengambil laporan");

        if (exportFormat) {
          const blob = await res.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          const filename = res.headers.get("Content-Disposition")?.split("filename=")[1]?.split('"').join("") || `laporan-${type}.xlsx`;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        } else {
          const data = await res.json();
          switch (type) {
            case "profit-loss":
              setProfitData(data);
              break;
            case "sales":
              setSalesData(data);
              break;
            case "stock":
              setStockData(data);
              break;
          }
        }
      } catch (err) {
        toast.error("Gagal memuat laporan", { description: err instanceof Error ? err.message : "Periksa koneksi lalu coba lagi." });
      } finally {
        setLoading(false);
      }
    },
    [dateRange],
  );

  const handleExport = (type: string) => fetchReport(type, "excel");

  const formatDate = (dateStr: string) => format(new Date(dateStr), "dd MMM yyyy", { locale: id });

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    fetchReport(activeTab === "profit" ? "profit-loss" : activeTab);
  }, [activeTab, fetchReport]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Laporan</h1>
          <p className="text-gray-500">Lihat dan unduh laporan keuangan & operasional</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filter Periode</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:max-w-2xl">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Mulai</label>
              <Input type="date" value={dateRange.start} onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Akhir</label>
              <Input type="date" value={dateRange.end} onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profit">
            <DollarSign className="h-4 w-4" /> Laba Rugi
          </TabsTrigger>
          <TabsTrigger value="sales">
            <FileText className="h-4 w-4" /> Penjualan
          </TabsTrigger>
          <TabsTrigger value="stock">
            <Package className="h-4 w-4" /> Stok
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profit" className="space-y-4">
          {profitData ? (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-500">Total Penjualan</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(profitData.totalSales)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-500">HPP (COGS)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">{formatCurrency(profitData.totalCOGS)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-500">Total Pengeluaran</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">{formatCurrency(profitData.totalExpenses)}</div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Perbandingan keuangan</CardTitle>
                  <p className="text-sm text-muted-foreground">Grafik mengikuti rentang tanggal yang dipilih.</p>
                </CardHeader>
                <CardContent>
                  <MultiSeriesBarChart
                    ariaLabel="Grafik perbandingan penjualan, HPP, pengeluaran, dan retur"
                    data={
                      [
                        { label: "Penjualan", values: [profitData.totalSales] },
                        { label: "HPP", values: [profitData.totalCOGS] },
                        { label: "Pengeluaran", values: [profitData.totalExpenses] },
                        { label: "Retur", values: [profitData.totalReturns] },
                      ] satisfies ChartPoint[]
                    }
                    series={[{ label: "Nilai", colorClassName: "bg-sky-600" }]}
                    formatValue={formatCurrency}
                  />
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                <Card className="border-green-500">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-500">Laba Bersih</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-600">{formatCurrency(profitData.netProfit)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-500">Total Modal</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-blue-600">{formatCurrency(profitData.totalCapital)}</div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => handleExport("profit-loss")} disabled={loading}>
                  <Download className="h-4 w-4" /> Export Excel
                </Button>
              </div>
            </>
          ) : loading ? (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }, (_, index) => (
                  <Card key={`profit-kpi-skeleton-${index}`}>
                    <CardHeader className="pb-2">
                      <Skeleton className="h-4 w-32" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-8 w-40" />
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Card>
                <CardHeader>
                  <Skeleton className="h-5 w-48" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-52 w-full" />
                </CardContent>
              </Card>
              <div className="grid gap-4 md:grid-cols-2">
                {Array.from({ length: 2 }, (_, index) => (
                  <Card key={`profit-total-skeleton-${index}`}>
                    <CardHeader className="pb-2">
                      <Skeleton className="h-4 w-32" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-9 w-44" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          ) : (
            <p className="py-10 text-center text-sm text-gray-500">Tidak ada data laba rugi pada periode ini.</p>
          )}
        </TabsContent>

        <TabsContent value="sales" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => handleExport("sales")} disabled={loading}>
              <Download className="h-4 w-4" /> Export Excel
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead>Invoice</TableHead>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead className="hidden md:table-cell">Tipe</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                      <TableHead className="text-right">Diskon</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-center">Status Bayar</TableHead>
                      <TableHead className="text-center">Status Fulfillment</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 6 }, (_, index) => (
                        <TableRow key={`report-sales-skeleton-${index}`}>
                          <TableCell colSpan={9}>
                            <Skeleton className="h-5 w-full" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : salesData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                          Tidak ada data
                        </TableCell>
                      </TableRow>
                    ) : (
                      salesData.map((sale) => (
                        <TableRow key={sale.id}>
                          <TableCell className="font-mono font-medium">{sale.invoiceNumber}</TableCell>
                          <TableCell>{formatDate(sale.date)}</TableCell>
                          <TableCell>{sale.customerName}</TableCell>
                          <TableCell className="hidden md:table-cell">
                            <Badge variant={sale.orderType === "preorder" ? "default" : "secondary"}>{sale.orderType}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(sale.subtotal)}</TableCell>
                          <TableCell className="text-right font-mono text-red-600">-{formatCurrency(sale.discountAmount)}</TableCell>
                          <TableCell className="text-right font-mono font-bold">{formatCurrency(sale.total)}</TableCell>
                          <TableCell className="text-center">
                            <StatusBadge status={sale.paymentStatus} />
                          </TableCell>
                          <TableCell className="text-center">
                            <StatusBadge status={sale.fulfillmentStatus} />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="divide-y md:hidden">
                {loading ? (
                  Array.from({ length: 4 }, (_, index) => (
                    <div key={`mobile-report-sale-${index}`} className="space-y-3 px-4 py-4">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  ))
                ) : salesData.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-gray-500">Tidak ada data</p>
                ) : (
                  salesData.map((sale) => (
                    <article key={`mobile-${sale.id}`} className="space-y-3 px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-mono text-sm font-semibold">{sale.invoiceNumber}</p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {sale.customerName} · {formatDate(sale.date)}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold tabular-nums">{formatCurrency(sale.total)}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <StatusBadge status={sale.paymentStatus} />
                        <StatusBadge status={sale.fulfillmentStatus} />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Subtotal {formatCurrency(sale.subtotal)}</span>
                        <span>Diskon {formatCurrency(sale.discountAmount)}</span>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stock" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => handleExport("stock")} disabled={loading}>
              <Download className="h-4 w-4" /> Export Excel
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead>Nama Produk</TableHead>
                      <TableHead className="hidden md:table-cell">SKU</TableHead>
                      <TableHead className="hidden md:table-cell">Kategori</TableHead>
                      <TableHead className="text-right">Harga Modal</TableHead>
                      <TableHead className="text-right">Harga Jual</TableHead>
                      <TableHead className="text-center">Stok</TableHead>
                      <TableHead className="text-center">Min Stok</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 6 }, (_, index) => (
                        <TableRow key={`report-stock-skeleton-${index}`}>
                          <TableCell colSpan={8}>
                            <Skeleton className="h-5 w-full" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : stockData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                          Tidak ada produk
                        </TableCell>
                      </TableRow>
                    ) : (
                      stockData
                        .filter((p) => p.isActive)
                        .map((product) => {
                          const status = product.stockQty <= 0 ? "Habis" : product.stockQty <= product.minStock ? "Menipis" : "Aman";
                          const statusCode = status === "Habis" ? "out_of_stock" : status === "Menipis" ? "low_stock" : "in_stock";
                          return (
                            <TableRow key={product.id}>
                              <TableCell className="font-medium">{product.name}</TableCell>
                              <TableCell className="hidden md:table-cell text-gray-500">{product.sku || "-"}</TableCell>
                              <TableCell className="hidden md:table-cell text-gray-500">{product.category || "-"}</TableCell>
                              <TableCell className="text-right text-gray-600">{formatCurrency(product.costPrice)}</TableCell>
                              <TableCell className="text-right text-gray-600">{formatCurrency(product.sellPrice)}</TableCell>
                              <TableCell className="text-center font-mono">
                                {product.stockQty} {product.unit}
                              </TableCell>
                              <TableCell className="text-center font-mono">{product.minStock}</TableCell>
                              <TableCell className="text-center">
                                <StatusBadge status={statusCode} />
                              </TableCell>
                            </TableRow>
                          );
                        })
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="divide-y md:hidden">
                {loading ? (
                  Array.from({ length: 4 }, (_, index) => (
                    <div key={`mobile-report-stock-${index}`} className="space-y-3 px-4 py-4">
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  ))
                ) : stockData.filter((product) => product.isActive).length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-gray-500">Tidak ada produk</p>
                ) : (
                  stockData
                    .filter((product) => product.isActive)
                    .map((product) => {
                      const status = product.stockQty <= 0 ? "out_of_stock" : product.stockQty <= product.minStock ? "low_stock" : "in_stock";
                      return (
                        <article key={`mobile-${product.id}`} className="space-y-3 px-4 py-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-medium">{product.name}</p>
                              <p className="mt-1 truncate text-xs text-muted-foreground">{product.sku || "Tanpa SKU"}</p>
                            </div>
                            <StatusBadge status={status} />
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-xs text-muted-foreground">Stok</p>
                              <p className="font-medium tabular-nums">
                                {product.stockQty} {product.unit}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Minimum</p>
                              <p className="font-medium tabular-nums">{product.minStock}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Harga modal</p>
                              <p className="font-medium tabular-nums">{formatCurrency(product.costPrice)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Harga jual</p>
                              <p className="font-medium tabular-nums">{formatCurrency(product.sellPrice)}</p>
                            </div>
                          </div>
                        </article>
                      );
                    })
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
