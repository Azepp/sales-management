"use client";

import { useEffect } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { id } from "date-fns/locale";

interface Sale {
  id: string;
  invoiceNumber: string;
  date: string;
  customerName: string;
  orderType: "regular" | "preorder";
  fulfillmentStatus: string;
  paymentStatus: string;
  estReadyDate: string | null;
  subtotal: number;
  discountType: string | null;
  discountValue: number | null;
  discountAmount: number;
  total: number;
  cancelReason: string | null;
  note: string | null;
  items: Array<{
    id: string;
    productId: string;
    qty: number;
    priceAtSale: number;
    subtotal: number;
    product: { name: string; sku: string | null; costPrice: number };
  }>;
  payments: Array<{
    id: string;
    date: string;
    amount: number;
    method: string;
    proofImageUrl: string | null;
    note: string | null;
  }>;
  returns: Array<{
    id: string;
    qty: number;
    reason: string;
    refundAmount: number;
    date: string;
    product: { name: string };
  }>;
  paidAmount: number;
}

interface InvoiceViewProps {
  sale: Sale;
}

export function InvoiceView({ sale }: InvoiceViewProps) {
  useEffect(() => {
    window.print();
  }, []);

  const formatCurrency = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(value);

  const formatDate = (dateStr: string) => format(new Date(dateStr), "dd MMMM yyyy", { locale: id });

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "Pending",
      ready: "Siap Diambil",
      delivered: "Sudah Diambil",
      cancelled: "Dibatalkan",
      unpaid: "Belum Bayar",
      dp: "DP / Cicilan",
      paid_full: "Lunas",
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      ready: "bg-blue-100 text-blue-800",
      delivered: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
      unpaid: "bg-red-100 text-red-800",
      dp: "bg-yellow-100 text-yellow-800",
      paid_full: "bg-green-100 text-green-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const remaining = sale.total - sale.paidAmount;

  return (
    <div className="min-h-screen bg-white p-4 sm:p-8 print:hidden">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Invoice / Struk</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Cetak / Simpan PDF
          </Button>
        </div>
      </div>

      <Card className="max-w-3xl mx-auto">
        <CardContent className="p-4 sm:p-8 print:p-0">
          <div className="text-center mb-8 border-b-2 border-gray-300 pb-6">
            <h2 className="text-3xl font-bold text-gray-900">BINWICH MANAGEMENT</h2>
            <p className="text-gray-500 mt-1">Invoice Penjualan</p>
          </div>

          <div className="mb-6 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div>
              <p className="font-medium text-gray-500">No. Invoice</p>
              <p className="font-mono text-lg font-bold">{sale.invoiceNumber}</p>
            </div>
            <div className="text-right">
              <p className="font-medium text-gray-500">Tanggal</p>
              <p>{formatDate(sale.date)}</p>
            </div>
            <div>
              <p className="font-medium text-gray-500">Customer</p>
              <p className="font-medium">{sale.customerName}</p>
            </div>
            <div className="text-right">
              <p className="font-medium text-gray-500">Tipe Order</p>
              <p>
                <Badge variant={sale.orderType === "preorder" ? "default" : "secondary"}>{sale.orderType === "preorder" ? "Pre-Order" : "Reguler"}</Badge>
              </p>
            </div>
            {sale.estReadyDate && (
              <div className="col-span-2">
                <p className="font-medium text-gray-500">Estimasi Siap</p>
                <p>{formatDate(sale.estReadyDate)}</p>
              </div>
            )}
          </div>

          <div className="mb-6 flex flex-wrap gap-2">
            <Badge className={getStatusColor(sale.fulfillmentStatus)}>Fulfillment: {getStatusLabel(sale.fulfillmentStatus)}</Badge>
            <Badge className={getStatusColor(sale.paymentStatus)}>Pembayaran: {getStatusLabel(sale.paymentStatus)}</Badge>
          </div>

          <div className="border-t border-b border-gray-300 py-4 mb-4">
            <div className="overflow-x-auto">
              <table className="w-full min-w-130 text-sm">
                <thead>
                  <tr className="border-b border-gray-300">
                    <th className="text-left pb-2 font-medium">Produk</th>
                    <th className="text-center pb-2 font-medium w-16">Qty</th>
                    <th className="text-right pb-2 font-medium w-32">Harga</th>
                    <th className="text-right pb-2 font-medium w-32">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {sale.items.map((item) => (
                    <tr key={item.id} className="border-b border-gray-100">
                      <td className="py-2">{item.product.name}</td>
                      <td className="py-2 text-center">{item.qty}</td>
                      <td className="py-2 text-right font-mono">{formatCurrency(item.priceAtSale)}</td>
                      <td className="py-2 text-right font-mono">{formatCurrency(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-2 text-sm mb-6">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-mono">{formatCurrency(sale.subtotal)}</span>
            </div>
            {sale.discountAmount > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Diskon ({sale.discountType === "percent" ? sale.discountValue + "%" : formatCurrency(sale.discountValue!)})</span>
                <span className="font-mono">-{formatCurrency(sale.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-gray-300 pt-2 font-bold text-lg">
              <span>Total</span>
              <span className="font-mono">{formatCurrency(sale.total)}</span>
            </div>
          </div>

          {sale.payments.length > 0 && (
            <div className="border-t border-b border-gray-300 py-4 mb-4">
              <h4 className="font-medium mb-3">Riwayat Pembayaran</h4>
              <div className="space-y-2 text-sm">
                {sale.payments.map((p) => (
                  <div key={p.id} className="flex justify-between items-center py-1 border-b border-gray-100 last:border-0">
                    <div>
                      <p className="font-mono">{formatCurrency(p.amount)}</p>
                      <p className="text-xs text-gray-500">
                        {formatDate(p.date)} - {p.method} {p.note && `(${p.note})`}
                      </p>
                    </div>
                    {p.proofImageUrl && (
                      <a href={p.proofImageUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-xs hover:underline">
                        Lihat Bukti
                      </a>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
                <div className="text-center p-2 bg-gray-50 rounded">
                  <p className="text-gray-500">Total</p>
                  <p className="font-bold">{formatCurrency(sale.total)}</p>
                </div>
                <div className="text-center p-2 bg-green-50 rounded">
                  <p className="text-gray-500">Dibayar</p>
                  <p className="font-bold text-green-600">{formatCurrency(sale.paidAmount)}</p>
                </div>
                <div className="text-center p-2 bg-red-50 rounded">
                  <p className="text-gray-500">Sisa</p>
                  <p className="font-bold text-red-600">{formatCurrency(remaining)}</p>
                </div>
              </div>
            </div>
          )}

          {sale.returns.length > 0 && (
            <div className="border-t border-b border-gray-300 py-4 mb-4">
              <h4 className="font-medium mb-3">Riwayat Retur</h4>
              <div className="space-y-2 text-sm">
                {sale.returns.map((r) => (
                  <div key={r.id} className="flex justify-between items-center py-1 border-b border-gray-100 last:border-0">
                    <div>
                      <p>
                        {r.product.name} x{r.qty}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(r.date)} - {r.reason}
                      </p>
                    </div>
                    <span className="font-mono text-red-600">-{formatCurrency(r.refundAmount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {sale.note && (
            <div className="bg-gray-50 p-4 rounded mb-4">
              <p className="font-medium text-gray-500">Catatan</p>
              <p className="text-sm mt-1">{sale.note}</p>
            </div>
          )}

          {sale.cancelReason && (
            <div className="bg-red-50 p-4 rounded mb-4 border border-red-200">
              <p className="font-medium text-red-700">Alasan Pembatalan</p>
              <p className="text-sm mt-1">{sale.cancelReason}</p>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-gray-300 text-center text-sm text-gray-500">
            <p>Terima kasih atas kepercayaan Anda</p>
            <p className="mt-1">Binwich Management - Sistem Manajemen Penjualan</p>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 text-center text-gray-500 text-sm print:hidden">Tekan Ctrl+P (Cmd+P di Mac) untuk mencetak atau simpan sebagai PDF</div>
    </div>
  );
}
