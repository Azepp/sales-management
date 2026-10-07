"use client";

import React from "react";
import { useState, useEffect, useCallback } from "react";
import { Plus, Search, X, Truck, CreditCard, Trash2, Check, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { toast } from "sonner";
import { formatCurrency, formatRupiahInput, parseRupiah } from "@/lib/format-rupiah";
import { StatusBadge } from "@/components/StatusBadge";
import { ProofLink } from "@/components/ProofLink";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { FilterPanel, FilterTrigger } from "@/components/FilterPanel";

interface Product {
  id: string;
  name: string;
  sku: string | null;
  sellPrice: number;
  stockQty: number;
}

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
  discountType: "percent" | "fixed" | null;
  discountValue: number | null;
  discountAmount: number;
  total: number;
  items: Array<{
    id: string;
    productId: string;
    qty: number;
    priceAtSale: number;
    subtotal: number;
    product: Product;
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
    product: Product;
  }>;
  paidAmount: number;
  note: string | null;
}

interface PenjualanClientProps {
  products: Product[];
  autoOpenCreate?: boolean;
  initialSaleId?: string | null;
}

const PAGE_SIZE = 15;

function getApiErrorMessage(data: { error?: unknown }, fallback: string): string {
  const error = data?.error;
  if (typeof error === "string" && error) return error;
  if (error && typeof error === "object") {
    const flattened = error as { formErrors?: unknown; fieldErrors?: Record<string, unknown>; _errors?: unknown };
    if (flattened.fieldErrors && typeof flattened.fieldErrors === "object") {
      for (const messages of Object.values(flattened.fieldErrors)) {
        if (Array.isArray(messages) && typeof messages[0] === "string") return messages[0];
      }
    }
    if (Array.isArray(flattened.formErrors) && typeof flattened.formErrors[0] === "string") return flattened.formErrors[0];
    if (Array.isArray(flattened._errors) && typeof flattened._errors[0] === "string") return flattened._errors[0];
  }
  return fallback;
}

export function PenjualanClient({ products, autoOpenCreate = false, initialSaleId = null }: PenjualanClientProps) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [orderTypeFilter, setOrderTypeFilter] = useState("all");
  const [fulfillmentFilter, setFulfillmentFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [activeTab, setActiveTab] = useState<"detail" | "payments">("detail");

  const [showCreateDialog, setShowCreateDialog] = useState(autoOpenCreate);
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);
  const [editSaleId, setEditSaleId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const [createForm, setCreateForm] = useState<{
    customerName: string;
    orderType: "regular" | "preorder";
    paymentStatus: "unpaid" | "dp" | "paid_full";
    fulfillmentStatus: "pending" | "ready" | "delivered" | "cancelled";
    items: { productId: string; qty: string; priceAtSale: string }[];
    discountType: "percent" | "fixed";
    discountValue: string;
    note: string;
    payment: { method: "cash" | "transfer" | "qris" | "lainnya"; proofFile: File | null; note: string };
  }>({
    customerName: "",
    orderType: "regular",
    paymentStatus: "unpaid",
    fulfillmentStatus: "pending",
    items: [{ productId: "", qty: "1", priceAtSale: "" }],
    discountType: "percent",
    discountValue: "",
    note: "",
    payment: { method: "cash", proofFile: null, note: "" },
  });
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const [paymentForm, setPaymentForm] = useState({ method: "cash" as "cash" | "transfer" | "qris" | "lainnya", proofFile: null as File | null, note: "" });
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [statusLoadingId, setStatusLoadingId] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  const fetchSales = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("customerName", search);
    if (orderTypeFilter !== "all") params.set("orderType", orderTypeFilter);
    if (fulfillmentFilter !== "all") params.set("fulfillmentStatus", fulfillmentFilter);
    if (paymentFilter !== "all") params.set("paymentStatus", paymentFilter);
    if (dateRange.start) params.set("startDate", dateRange.start);
    if (dateRange.end) params.set("endDate", dateRange.end);
    const res = await fetch(`/api/sales?${params}`);
    if (res.ok) {
      const data = await res.json();
      setSales(data);
    }
    setLoading(false);
  }, [search, orderTypeFilter, fulfillmentFilter, paymentFilter, dateRange]);

  useEffect(() => {
    const timer = setTimeout(fetchSales, 300);
    return () => clearTimeout(timer);
  }, [fetchSales]);

  const filterKey = `${search}|${orderTypeFilter}|${fulfillmentFilter}|${paymentFilter}|${dateRange.start}|${dateRange.end}`;
  const [lastFilterKey, setLastFilterKey] = useState(filterKey);
  if (filterKey !== lastFilterKey) {
    setLastFilterKey(filterKey);
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(sales.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageOffset = (currentPage - 1) * PAGE_SIZE;
  const paginatedSales = sales.slice(pageOffset, pageOffset + PAGE_SIZE);

  const calculateTotals = (items: typeof createForm.items, discountType?: string, discountValue?: number) => {
    const subtotal = items.reduce((sum, item) => sum + (item.priceAtSale ? parseRupiah(item.priceAtSale) * (item.qty ? parseRupiah(item.qty) : 1) : 0), 0);
    let discountAmount = 0;
    if (discountType && discountValue) {
      if (discountType === "percent") discountAmount = Math.round(subtotal * (discountValue / 100));
      else discountAmount = Math.min(discountValue, subtotal);
    }
    return { subtotal, discountAmount, total: subtotal - discountAmount };
  };

  const validateCreateForm = () => {
    const errors: Record<string, string> = {};

    if (!createForm.customerName.trim()) errors.customerName = "Nama customer wajib diisi";
    if (createForm.items.some((item) => !item.productId)) errors.items = "Pilih produk untuk semua item";
    if (createForm.items.some((item) => !item.qty || parseRupiah(item.qty) < 1)) errors.qty = "Qty minimal 1";
    if (createForm.items.some((item) => !item.priceAtSale || parseRupiah(item.priceAtSale) < 1)) errors.price = "Harga wajib diisi > 0";
    setCreateErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateCreateForm()) {
      toast.error("Mohon lengkapi data yang wajib diisi");
      return;
    }
    setCreateSubmitting(true);

    const items = createForm.items.map((item) => ({
      productId: item.productId,
      qty: parseRupiah(item.qty),
      priceAtSale: parseRupiah(item.priceAtSale),
    }));

    if (editSaleId) {
      const saleId = editSaleId;
      const res = await fetch(`/api/sales/${saleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: createForm.customerName,
          orderType: createForm.orderType,
          paymentStatus: createForm.paymentStatus,
          fulfillmentStatus: createForm.fulfillmentStatus,
          note: createForm.note,
          discountType: createForm.discountType,
          discountValue: parseRupiah(createForm.discountValue),
          items,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success("Transaksi diperbarui");
        setShowCreateDialog(false);
        setEditSaleId(null);
        fetchSales();
        if (selectedSale?.id === saleId) fetchSaleDetail(saleId);
      } else {
        toast.error(getApiErrorMessage(data, "Gagal memperbarui transaksi"));
      }
      setCreateSubmitting(false);
      return;
    }

    const res = await (async () => {
      const formData = new FormData();
      formData.append("customerName", createForm.customerName);
      formData.append("orderType", createForm.orderType);
      formData.append("note", createForm.note);
      formData.append("discountType", createForm.discountType);
      formData.append("discountValue", parseRupiah(createForm.discountValue).toString());
      formData.append("items", JSON.stringify(items));
      formData.append("paymentMethod", createForm.payment.method);
      formData.append("paymentNote", createForm.payment.note);
      if (createForm.payment.proofFile) {
        formData.append("proofFile", createForm.payment.proofFile);
      }
      const res = await fetch("/api/sales", {
        method: "POST",
        body: formData,
      });
      return res;
    })();
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      toast.success("Transaksi berhasil dibuat");
      setCreateForm({
        customerName: "",
        orderType: "regular",
        paymentStatus: "unpaid",
        fulfillmentStatus: "pending",
        items: [{ productId: "", qty: "1", priceAtSale: "" }],
        discountType: "percent",
        discountValue: "",
        note: "",
        payment: { method: "cash", proofFile: null, note: "" },
      });
      setCreateErrors({});
      setShowCreateDialog(false);
      fetchSales();
    } else {
      toast.error(getApiErrorMessage(data, "Gagal membuat transaksi"));
    }
    setCreateSubmitting(false);
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSale) return;
    const remainingAmount = selectedSale.total - selectedSale.paidAmount;
    if (remainingAmount <= 0) {
      toast.error("Transaksi sudah lunas");
      return;
    }
    setPaymentSubmitting(true);
    const formData = new FormData();
    formData.append("amount", remainingAmount.toString());
    formData.append("method", paymentForm.method);
    formData.append("note", paymentForm.note);
    if (paymentForm.proofFile) {
      formData.append("proofFile", paymentForm.proofFile);
    }
    const res = await fetch(`/api/sales/${selectedSale.id}?action=payment`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      toast.success("Pembayaran ditambahkan");
      setPaymentForm({ method: "cash", proofFile: null, note: "" });
      fetchSaleDetail(selectedSale.id);
      fetchSales();
    } else {
        toast.error(getApiErrorMessage(data, "Gagal menambah pembayaran"));
    }
    setPaymentSubmitting(false);
  };

  const handleUpdateStatus = async (saleId: string, fulfillmentStatus?: Sale["fulfillmentStatus"], paymentStatus?: Sale["paymentStatus"], cancelReason?: string) => {
    setStatusSubmitting(true);
    setStatusLoadingId(saleId);
    try {
      const res = await fetch(`/api/sales/${saleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fulfillmentStatus, paymentStatus, cancelReason }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success("Status diperbarui");
        if (selectedSale?.id === saleId) fetchSaleDetail(saleId);
        fetchSales();
      } else {
        toast.error(getApiErrorMessage(data, "Gagal update status"));
      }
    } finally {
      setStatusSubmitting(false);
      setStatusLoadingId(null);
    }
  };

  const handleDeleteSale = async (id: string): Promise<boolean> => {
    setStatusSubmitting(true);
    try {
      const res = await fetch(`/api/sales/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setShowDeleteDialog(null);
        toast.success("Transaksi dihapus");
        if (selectedSale?.id === id) setSelectedSale(null);
        fetchSales();
        return true;
      } else {
        toast.error(getApiErrorMessage(data, "Gagal menghapus transaksi"));
        return false;
      }
    } catch {
      toast.error("Gagal menghapus transaksi. Periksa koneksi lalu coba lagi.");
      return false;
    } finally {
      setStatusSubmitting(false);
    }
  };

  const fetchSaleDetail = async (id: string) => {
    const res = await fetch(`/api/sales/${id}`);
    if (res.ok) {
      const data = await res.json();
      setSelectedSale(data);
    }
  };

  const openEditDialog = async (saleId: string) => {
    if (editLoading) return;
    setEditLoading(true);
    try {
      const res = await fetch(`/api/sales/${saleId}`);
      if (!res.ok) {
        toast.error("Gagal memuat data transaksi");
        return;
      }
      const data: Sale = await res.json();
      setCreateForm({
        customerName: data.customerName,
        orderType: data.orderType,
        paymentStatus: (["unpaid", "dp", "paid_full"].includes(data.paymentStatus) ? data.paymentStatus : "unpaid") as "unpaid" | "dp" | "paid_full",
        fulfillmentStatus: (["pending", "ready", "delivered", "cancelled"].includes(data.fulfillmentStatus)
          ? data.fulfillmentStatus
          : "pending") as "pending" | "ready" | "delivered" | "cancelled",
        items: data.items.map((item) => ({
          productId: item.productId,
          qty: String(item.qty),
          priceAtSale: formatCurrency(Number(item.priceAtSale)),
        })),
        discountType: data.discountType ?? "percent",
        discountValue: data.discountValue
          ? data.discountType === "percent"
            ? String(Number(data.discountValue))
            : formatRupiahInput(String(Number(data.discountValue)))
          : "",
        note: data.note ?? "",
        payment: { method: "cash", proofFile: null, note: "" },
      });
      setCreateErrors({});
      setEditSaleId(saleId);
      setShowCreateDialog(true);
    } finally {
      setEditLoading(false);
    }
  };

  useEffect(() => {
    if (initialSaleId) fetchSaleDetail(initialSaleId);
    if (autoOpenCreate || initialSaleId) window.history.replaceState({}, "", window.location.pathname);
  }, [autoOpenCreate, initialSaleId]);

  const handleRowClick = (sale: Sale, tab: "detail" | "payments" = "detail") => {
    fetchSaleDetail(sale.id);
    setActiveTab(tab);
  };

  const formatDate = (dateStr: string) => format(new Date(dateStr), "dd MMM yyyy", { locale: id });

  const shortcutFilters = [
    { key: "ready_not_delivered", label: "Siap & Belum Diambil", fulfillment: "ready", payment: "" },
    { key: "unpaid", label: "Belum Lunas", fulfillment: "", payment: "unpaid" },
  ];
  const activeShortcutFilter = shortcutFilters.find((filter) => (filter.fulfillment || "all") === fulfillmentFilter && (filter.payment || "all") === paymentFilter)?.key;

  const { subtotal, discountAmount, total } = calculateTotals(createForm.items, createForm.discountType, createForm.discountValue ? parseRupiah(createForm.discountValue) : undefined);

  const handleCreateChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const target = e.target as HTMLInputElement;
    const { name, value, files } = target;
    if (name.startsWith("payment.")) {
      const paymentField = name.split(".")[1];
      if (paymentField === "amount") {
        setCreateForm((prev) => ({ ...prev, payment: { ...prev.payment, [paymentField]: formatRupiahInput(value) } }));
      } else if (paymentField === "proofFile" && files) {
        setCreateForm((prev) => ({ ...prev, payment: { ...prev.payment, [paymentField]: files[0] } }));
      } else {
        setCreateForm((prev) => ({ ...prev, payment: { ...prev.payment, [paymentField]: value } }));
      }
    } else if (name === "discountValue") {
      setCreateForm((prev) => ({ ...prev, [name]: formatRupiahInput(value) }));
    } else {
      setCreateForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleItemChange = (index: number, field: string, value: string) => {
    setCreateForm((prev) => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };

      return { ...prev, items: newItems };
    });
  };

  const handleProductSelect = (index: number, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      setCreateForm((prev) => {
        const newItems = [...prev.items];
        newItems[index] = { ...newItems[index], productId, priceAtSale: formatCurrency(product.sellPrice) };

        return { ...prev, items: newItems };
      });
    } else {
      handleItemChange(index, "productId", productId);
    }
  };

  const addItem = () => {
    setCreateForm((prev) => ({ ...prev, items: [...prev.items, { productId: "", qty: "1", priceAtSale: "" }] }));
  };

  const removeItem = (index: number) => {
    if (createForm.items.length <= 1) return;
    setCreateForm((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  };

  const handlePaymentChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const target = e.target as HTMLInputElement;
    const { name, value, files } = target;
    if (name === "proofFile" && files) {
      setPaymentForm((prev) => ({ ...prev, [name]: files[0] }));
    } else {
      setPaymentForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const discountPercentOptions = [5, 10, 15, 20];

  return (
    <div>
      <div className="space-y-6">
        <div className="flex flex-col items-end sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="w-full">
            <h1 className="text-2xl font-bold text-gray-900">Penjualan</h1>
            <p className="text-gray-500">Kelola transaksi penjualan, pre-order, pembayaran & retur</p>
          </div>
          <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
            <FilterTrigger onClick={() => setFilterOpen(true)} />
            <Dialog
              open={showCreateDialog}
              onOpenChange={(open) => {
                if (!open && createSubmitting) return;
                setShowCreateDialog(open);
                if (!open) setEditSaleId(null);
              }}
            >
              <Button
                type="button"
                onClick={() => {
                  setEditSaleId(null);
                  setCreateForm({
                    customerName: "",
                    orderType: "regular",
                    paymentStatus: "unpaid",
                    fulfillmentStatus: "pending",
                    items: [{ productId: "", qty: "1", priceAtSale: "" }],
                    discountType: "percent",
                    discountValue: "",
                    note: "",
                    payment: { method: "cash", proofFile: null, note: "" },
                  });
                  setCreateErrors({});
                  setShowCreateDialog(true);
                }}
              >
                <Plus className="h-4 w-4" />
                Transaksi Baru
              </Button>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editSaleId ? "Edit Transaksi" : "Transaksi Penjualan Baru"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateSubmit} className="space-y-4 py-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">Nama Customer *</label>
                      <Input placeholder="Nama customer" name="customerName" value={createForm.customerName} onChange={handleCreateChange} className={createErrors.customerName ? "border-red-500" : ""} />
                      {createErrors.customerName && <p className="text-sm text-red-500">{createErrors.customerName}</p>}
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">Tipe Order *</label>
                      <Select
                        value={createForm.orderType}
                        onValueChange={(v: string | null) =>
                          setCreateForm((prev) => {
                            const nextOrderType = (v || "regular") as "regular" | "preorder";
                            return {
                              ...prev,
                              orderType: nextOrderType,
                              fulfillmentStatus: nextOrderType === "regular" && prev.fulfillmentStatus === "pending" ? "ready" : prev.fulfillmentStatus,
                            };
                          })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Pilih tipe" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="regular">Reguler (Stok kurangi, langsung Siap)</SelectItem>
                          <SelectItem value="preorder">Pre-Order (Stok kurangi, status Pending)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {editSaleId && (
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">Status Bayar *</label>
                        <Select value={createForm.paymentStatus} onValueChange={(v: string | null) => setCreateForm((prev) => ({ ...prev, paymentStatus: (v || "unpaid") as "unpaid" | "dp" | "paid_full" }))}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Pilih status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unpaid">Belum Bayar</SelectItem>
                            <SelectItem value="dp">DP (Belum Lunas)</SelectItem>
                            <SelectItem value="paid_full">Lunas</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {editSaleId && (
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">Status Kirim *</label>
                        <Select
                          value={createForm.fulfillmentStatus}
                          onValueChange={(v: string | null) => setCreateForm((prev) => ({ ...prev, fulfillmentStatus: (v || "pending") as "pending" | "ready" | "delivered" | "cancelled" }))}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Pilih status" />
                          </SelectTrigger>
                          <SelectContent>
                            {(createForm.orderType === "preorder" || createForm.fulfillmentStatus === "pending") && <SelectItem value="pending">Pending</SelectItem>}
                            <SelectItem value="ready">Siap</SelectItem>
                            <SelectItem value="delivered">Diambil</SelectItem>
                            <SelectItem value="cancelled">Batal</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-medium text-gray-700">Item Produk</label>
                      <Button type="button" variant="outline" size="sm" onClick={addItem}>
                        <Plus className="h-4 w-4 mr-1" /> Tambah Item
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {createForm.items.map((item, index) => (
                        <div key={index} className="flex gap-2 items-end">
                          <div className="flex-1 min-w-0">
                            <label className="block text-sm font-medium text-gray-700">Produk *</label>
                            <Select value={item.productId} onValueChange={(v: string | null) => handleProductSelect(index, v || "")}>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Pilih produk">{item.productId && products.find((p) => p.id === item.productId)?.name}</SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {products.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.name} {p.sku && `(${p.sku})`} - {formatCurrency(p.sellPrice)} (Stok: {p.stockQty})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {createErrors.items && <p className="text-sm text-red-500">{createErrors.items}</p>}
                          </div>
                          <div className="w-20">
                            <label className="block text-sm font-medium text-gray-700">Qty *</label>
                            <Input type="text" min="1" value={item.qty} onChange={(e) => handleItemChange(index, "qty", e.target.value)} placeholder="1" inputMode="numeric" className={`w-full ${createErrors.qty ? "border-red-500" : ""}`} />
                            {createErrors.qty && <p className="text-sm text-red-500">{createErrors.qty}</p>}
                          </div>
                          <div className="w-36">
                            <label className="block text-sm font-medium text-gray-700">Harga *</label>
                            <Input
                              type="text"
                              min="1"
                              value={item.priceAtSale}
                              onChange={(e) => handleItemChange(index, "priceAtSale", formatRupiahInput(e.target.value))}
                              placeholder="Harga"
                              inputMode="numeric"
                              className={`w-full ${createErrors.price ? "border-red-500" : ""}`}
                              readOnly={!editSaleId}
                            />
                            {createErrors.price && <p className="text-sm text-red-500">{createErrors.price}</p>}
                          </div>
                          <div className="w-28 font-mono text-right text-gray-600 pt-5">{item.qty && item.priceAtSale ? formatCurrency(parseRupiah(item.qty) * parseRupiah(item.priceAtSale)) : "Rp 0"}</div>
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)} disabled={createForm.items.length === 1} className="text-red-600">
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3 border-t pt-4">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">Tipe Diskon</label>
                      <Select value={createForm.discountType} onValueChange={(v: string | null) => setCreateForm((prev) => ({ ...prev, discountType: (v || "percent") as "percent" | "fixed" }))}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Pilih tipe" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percent">Persen (%)</SelectItem>
                          <SelectItem value="fixed">Nominal (Rp)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">Nilai Diskon</label>
                      {createForm.discountType === "percent" ? (
                        <div className="flex flex-wrap gap-2">
                          {discountPercentOptions.map((p) => (
                            <Button key={p} type="button" variant={createForm.discountValue === String(p) ? "default" : "outline"} size="sm" className="w-17.5" onClick={() => setCreateForm((prev) => ({ ...prev, discountValue: String(p) }))}>
                              {p}%
                            </Button>
                          ))}
                        </div>
                      ) : (
                        <Input type="text" min="0" value={createForm.discountValue} onChange={(e) => setCreateForm((prev) => ({ ...prev, discountValue: formatRupiahInput(e.target.value) }))} placeholder="Rp 0" inputMode="numeric" />
                      )}
                    </div>
                    <div className="flex items-end">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Total Diskon</label>
                      <div className="w-full bg-gray-50 px-3 py-2 rounded-md text-right font-mono">{formatCurrency(discountAmount)}</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Catatan</label>
                    <Input placeholder="Catatan tambahan" name="note" value={createForm.note} onChange={handleCreateChange} />
                  </div>

                  {!editSaleId && createForm.orderType === "regular" && (
                    <div className="border-t pt-4">
                      <h3 className="text-lg font-semibold mb-4">Pembayaran</h3>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700">Metode *</label>
                          <Select value={createForm.payment.method} onValueChange={(v: string | null) => setCreateForm((prev) => ({ ...prev, payment: { ...prev.payment, method: (v || "cash") as "cash" | "transfer" | "qris" | "lainnya" } }))}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Pilih metode" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="cash">Tunai</SelectItem>
                              <SelectItem value="transfer">Transfer</SelectItem>
                              <SelectItem value="qris">QRIS</SelectItem>
                              <SelectItem value="lainnya">Lainnya</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700">Bukti Bayar (opsional)</label>
                          <Input
                            type="file"
                            accept="image/*,application/pdf"
                            name="payment.proofFile"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setCreateForm((prev) => ({ ...prev, payment: { ...prev.payment, proofFile: file } }));
                              }
                            }}
                          />
                          <p className="text-xs text-gray-500">Format: JPG, PNG, PDF (max 5MB)</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">Catatan Pembayaran</label>
                        <Input placeholder="Catatan" name="payment.note" value={createForm.payment.note} onChange={handleCreateChange} />
                      </div>
                    </div>
                  )}

                  <div className="border-t pt-4 flex justify-between items-center">
                    <div className="text-right">
                      <div className="text-sm text-gray-500">Subtotal</div>
                      <div className="text-xl font-bold font-mono">{formatCurrency(subtotal)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500">Total</div>
                      <div className="text-2xl font-bold font-mono text-green-600">{formatCurrency(total)}</div>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button type="submit" loading={createSubmitting} className="w-full sm:w-auto">
                      {editSaleId ? "Simpan Perubahan" : "Buat Transaksi"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Delete Dialog */}
        <ConfirmDialog
          open={showDeleteDialog !== null}
          onOpenChange={(open) => !open && setShowDeleteDialog(null)}
          title="Hapus transaksi?"
          description="Transaksi beserta data terkait (pembayaran, retur, item) akan dihapus permanen dan stok akan dikembalikan. Tindakan ini tidak dapat dibatalkan."
          isLoading={statusSubmitting}
          onConfirm={() => (showDeleteDialog ? handleDeleteSale(showDeleteDialog) : false)}
        />
      </div>

      <FilterPanel
        className="mt-6"
        title="Filter & Pencarian"
        open={filterOpen}
        onOpenChange={setFilterOpen}
        onClear={() => {
          setSearch("");
          setOrderTypeFilter("all");
          setFulfillmentFilter("all");
          setPaymentFilter("all");
          setDateRange({ start: "", end: "" });
        }}
      >
        <div className="space-y-4">
          <div className="grid items-end gap-4 md:grid-cols-2 xl:grid-cols-6">
            <div className="space-y-1 md:col-span-2 xl:col-span-2">
              <label className="text-xs font-medium text-gray-600">Cari customer</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input placeholder="Nama customer" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Tipe order</label>
              <Select value={orderTypeFilter} onValueChange={(v: string | null) => setOrderTypeFilter(v || "all")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  <SelectItem value="regular">Reguler</SelectItem>
                  <SelectItem value="preorder">Pre-Order</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Status fulfillment</label>
              <Select value={fulfillmentFilter} onValueChange={(v: string | null) => setFulfillmentFilter(v || "all")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="ready">Siap</SelectItem>
                  <SelectItem value="delivered">Diambil</SelectItem>
                  <SelectItem value="cancelled">Batal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Status pembayaran</label>
              <Select value={paymentFilter} onValueChange={(v: string | null) => setPaymentFilter(v || "all")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  <SelectItem value="unpaid">Belum Bayar</SelectItem>
                  <SelectItem value="dp">DP</SelectItem>
                  <SelectItem value="paid_full">Lunas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2 md:col-span-2 xl:col-span-2">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-500">Dari</label>
                <Input type="date" value={dateRange.start} onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })} className="w-full" />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-500">Sampai</label>
                <Input type="date" value={dateRange.end} onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })} className="w-full" />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-t pt-4">
            {shortcutFilters.map((filter) => {
              const isActive = activeShortcutFilter === filter.key;
              return (
                <Button
                  key={filter.key}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  aria-pressed={isActive}
                  className={!isActive ? "text-muted-foreground" : undefined}
                  onClick={() => {
                    setFulfillmentFilter(isActive ? "all" : filter.fulfillment || "all");
                    setPaymentFilter(isActive ? "all" : filter.payment || "all");
                  }}
                >
                  {isActive && <Check className="h-4 w-4" aria-hidden="true" />}
                  {filter.label}
                </Button>
              );
            })}
          </div>
        </div>
      </FilterPanel>

      <div className="mt-6 grid gap-6">
        <div className="">
          <Card>
            <CardContent className="p-0">
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="w-12 text-center">No</TableHead>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead className="hidden md:table-cell">Produk</TableHead>
                      <TableHead className="hidden md:table-cell">Tipe</TableHead>
                      <TableHead className="text-center">Status Kirim</TableHead>
                      <TableHead className="text-center">Status Bayar</TableHead>
                      <TableHead className="text-center">Bukti</TableHead>
                      <TableHead className="text-center">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 5 }, (_, index) => (
                        <TableRow key={`sales-skeleton-${index}`}>
                          <TableCell colSpan={9}>
                            <Skeleton className="h-5 w-full" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : sales.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                          Belum ada transaksi
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedSales.map((sale, saleIndex) => (
                        <TableRow key={sale.id} onClick={() => handleRowClick(sale)} className="cursor-pointer hover:bg-gray-50">
                          <TableCell className="text-center tabular-nums text-gray-500">{pageOffset + saleIndex + 1}</TableCell>
                          <TableCell>{formatDate(sale.date)}</TableCell>
                          <TableCell>{sale.customerName}</TableCell>
                          <TableCell className="hidden md:table-cell">
                            {sale.items.map((item, index) => (
                              <div key={index} className="text-sm">
                                {item.product.name} x{item.qty}
                              </div>
                            ))}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <Badge variant={sale.orderType === "preorder" ? "default" : "secondary"}>{sale.orderType === "preorder" ? "Pre-Order" : "Reguler"}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <StatusBadge status={sale.fulfillmentStatus} />
                          </TableCell>
                          <TableCell className="text-center">
                            <StatusBadge status={sale.paymentStatus} />
                          </TableCell>
                          <TableCell className="text-center">
                            <ProofLink payments={sale.payments} />
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              {sale.fulfillmentStatus === "pending" && sale.orderType === "preorder" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUpdateStatus(sale.id, "ready");
                                  }}
                                  disabled={statusSubmitting}
                                  loading={statusLoadingId === sale.id}
                                  className="h-8 w-auto px-2"
                                >
                                  <Truck className="h-3 w-3 mr-1" /> Siap
                                </Button>
                              )}
                              {sale.fulfillmentStatus === "ready" && (
                                <Button
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUpdateStatus(sale.id, "delivered");
                                  }}
                                  disabled={statusSubmitting}
                                  loading={statusLoadingId === sale.id}
                                  className="h-8 w-auto px-2"
                                >
                                  <Truck className="h-3 w-3 mr-1" /> Diambil
                                </Button>
                              )}
                              {sale.paymentStatus !== "paid_full" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRowClick(sale, "payments");
                                  }}
                                  className="h-8 w-auto px-2"
                                >
                                  <CreditCard className="h-3 w-3 mr-1" /> Bayar
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditDialog(sale.id);
                                }}
                                disabled={statusSubmitting || editLoading}
                                loading={editLoading}
                                className="h-8 w-auto px-2"
                              >
                                <Pencil className="h-3 w-3 mr-1" /> Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowDeleteDialog(sale.id);
                                }}
                                disabled={statusSubmitting}
                                className="h-8 w-auto px-2"
                              >
                                <Trash2 className="h-3 w-3 mr-1" /> Hapus
                              </Button>
                            </div>
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
                    <div key={`mobile-sale-skeleton-${index}`} className="space-y-3 px-4 py-4">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-48 max-w-full" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  ))
                ) : sales.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-gray-500">Belum ada transaksi</p>
                ) : (
                  paginatedSales.map((sale, saleIndex) => (
                    <article key={`mobile-${sale.id}`} className="space-y-3 px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-2">
                          <span className="mt-0.5 shrink-0 text-xs font-medium tabular-nums text-muted-foreground">{pageOffset + saleIndex + 1}.</span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{sale.customerName}</p>
                            <p className="mt-1 truncate text-xs text-muted-foreground">{formatDate(sale.date)}</p>
                          </div>
                        </div>
                        <StatusBadge status={sale.paymentStatus} />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold tabular-nums">{formatCurrency(sale.total)}</span>
                        <StatusBadge status={sale.fulfillmentStatus} />
                      </div>
                      {sale.payments.some((p) => p.proofImageUrl) && (
                        <div className="text-sm">
                          <span className="text-gray-500">Bukti bayar: </span>
                          <ProofLink payments={sale.payments} />
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleRowClick(sale)}>
                          Detail
                        </Button>
                        {sale.fulfillmentStatus === "pending" && sale.orderType === "preorder" && (
                          <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(sale.id, "ready")} disabled={statusSubmitting} loading={statusLoadingId === sale.id}>
                            Tandai siap
                          </Button>
                        )}
                        {sale.fulfillmentStatus === "ready" && (
                          <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(sale.id, "delivered")} disabled={statusSubmitting} loading={statusLoadingId === sale.id}>
                            Tandai diambil
                          </Button>
                        )}
                        {sale.paymentStatus !== "paid_full" && (
                          <Button size="sm" variant="outline" onClick={() => handleRowClick(sale, "payments")}>
                            Bayar
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => openEditDialog(sale.id)} disabled={statusSubmitting || editLoading} loading={editLoading}>
                          Edit
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => setShowDeleteDialog(sale.id)} disabled={statusSubmitting}>
                          Hapus
                        </Button>
                      </div>
                    </article>
                  ))
                )}
              </div>
              {!loading && sales.length > 0 && (
                <div className="flex flex-col items-center justify-between gap-3 border-t px-4 py-3 sm:flex-row">
                  <p className="text-sm text-muted-foreground">
                    Menampilkan {pageOffset + 1}–{Math.min(pageOffset + PAGE_SIZE, sales.length)} dari {sales.length} transaksi
                  </p>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => setPage(currentPage - 1)} disabled={currentPage <= 1}>
                      Sebelumnya
                    </Button>
                    <span className="text-sm tabular-nums text-muted-foreground">
                      Halaman {currentPage} / {totalPages}
                    </span>
                    <Button size="sm" variant="outline" onClick={() => setPage(currentPage + 1)} disabled={currentPage >= totalPages}>
                      Berikutnya
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          {selectedSale && (
            <Dialog
              open={true}
              onOpenChange={(open) => {
                if (!open && (paymentSubmitting || statusSubmitting || editLoading)) return;
                setSelectedSale(null);
              }}
            >
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{selectedSale.invoiceNumber}</DialogTitle>
                  <DialogDescription>Detail transaksi {selectedSale.invoiceNumber}</DialogDescription>
                </DialogHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Customer</span>
                    <span>{selectedSale.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Tanggal</span>
                    <span>{formatDate(selectedSale.date)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Tipe</span>
                    <span>
                      <Badge variant={selectedSale.orderType === "preorder" ? "default" : "secondary"}>{selectedSale.orderType === "preorder" ? "Pre-Order" : "Reguler"}</Badge>
                    </span>
                  </div>
                  {selectedSale.estReadyDate && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Est. Siap</span>
                      <span>{formatDate(selectedSale.estReadyDate)}</span>
                    </div>
                  )}
                </CardContent>

                <div className="flex gap-2">
                  <StatusBadge status={selectedSale.fulfillmentStatus} />
                  <StatusBadge status={selectedSale.paymentStatus} />
                </div>

                <Tabs value={activeTab} onValueChange={(v: string) => setActiveTab(v as "detail" | "payments")} className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="detail">Detail</TabsTrigger>
                    <TabsTrigger value="payments">Pembayaran</TabsTrigger>
                  </TabsList>

                  <TabsContent value="detail" className="space-y-3 mt-4">
                    <div className="border rounded p-3 bg-gray-50">
                      <div className="font-medium mb-2">Item Transaksi</div>
                      <div className="space-y-1 text-sm">
                        {selectedSale.items.map((item) => (
                          <div key={item.id} className="flex justify-between border-b pb-1">
                            <span>
                              {item.product.name} x{item.qty}
                            </span>
                            <span className="font-mono">{formatCurrency(item.priceAtSale * item.qty)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between border-t pt-2 mt-2 font-medium">
                        <span>Subtotal</span>
                        <span className="font-mono">{formatCurrency(selectedSale.subtotal)}</span>
                      </div>
                      {selectedSale.discountAmount > 0 && (
                        <div className="flex justify-between text-red-600">
                          <span>Diskon ({selectedSale.discountType === "percent" ? selectedSale.discountValue + "%" : formatCurrency(selectedSale.discountValue!)})</span>
                          <span className="font-mono">-{formatCurrency(selectedSale.discountAmount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-lg">
                        <span>Total</span>
                        <span className="font-mono">{formatCurrency(selectedSale.total)}</span>
                      </div>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      {selectedSale.fulfillmentStatus === "pending" && selectedSale.orderType === "preorder" && (
                        <Button size="sm" onClick={() => handleUpdateStatus(selectedSale.id, "ready")} disabled={statusSubmitting} loading={statusLoadingId === selectedSale.id}>
                          <Truck className="h-4 w-4 mr-1" /> Tandai Siap
                        </Button>
                      )}
                      {selectedSale.fulfillmentStatus === "ready" && (
                        <Button size="sm" onClick={() => handleUpdateStatus(selectedSale.id, "delivered")} disabled={statusSubmitting} loading={statusLoadingId === selectedSale.id}>
                          <Truck className="h-4 w-4 mr-1" /> Tandai Diambil
                        </Button>
                      )}
                      {selectedSale.paymentStatus !== "paid_full" && (
                        <Button size="sm" variant="outline" onClick={() => setActiveTab("payments")}>
                          <CreditCard className="h-4 w-4 mr-1" /> Tambah Bayar
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedSale(null);
                          openEditDialog(selectedSale.id);
                        }}
                        disabled={statusSubmitting || editLoading}
                        loading={editLoading}
                      >
                        <Pencil className="h-4 w-4 mr-1" /> Edit
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => setShowDeleteDialog(selectedSale.id)} disabled={statusSubmitting}>
                        <Trash2 className="h-4 w-4 mr-1" /> Hapus
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="payments" className="space-y-3 mt-4">
                    <form onSubmit={handleAddPayment} className="space-y-3 p-3 bg-gray-50 rounded">
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">Metode *</label>
                        <Select value={paymentForm.method} onValueChange={(v: string | null) => setPaymentForm((prev) => ({ ...prev, method: (v || "cash") as "cash" | "transfer" | "qris" | "lainnya" }))}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Pilih metode" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cash">Tunai</SelectItem>
                            <SelectItem value="transfer">Transfer</SelectItem>
                            <SelectItem value="qris">QRIS</SelectItem>
                            <SelectItem value="lainnya">Lainnya</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">Bukti Bayar (opsional)</label>
                        <Input
                          type="file"
                          accept="image/*,application/pdf"
                          name="proofFile"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setPaymentForm((prev) => ({ ...prev, proofFile: file }));
                            }
                          }}
                        />
                        <p className="text-xs text-gray-500">Format: JPG, PNG, PDF (max 5MB)</p>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">Catatan</label>
                        <Input placeholder="Catatan" name="note" value={paymentForm.note} onChange={handlePaymentChange} />
                      </div>
                      <div className="bg-gray-50 p-3 rounded">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Total Tagihan</span>
                          <span className="font-mono">{formatCurrency(selectedSale.total)}</span>
                        </div>
                        <div className="flex justify-between text-sm font-medium">
                          <span className="text-gray-500">Sudah Dibayar</span>
                          <span className="font-mono">{formatCurrency(selectedSale.paidAmount)}</span>
                        </div>
                        <div className="flex justify-between text-sm font-bold text-green-600">
                          <span>Sisa yang Harus Dibayar</span>
                          <span className="font-mono">{formatCurrency(selectedSale.total - selectedSale.paidAmount)}</span>
                        </div>
                      </div>
                      <Button type="submit" className="w-full" loading={paymentSubmitting}>
                        Tambah Pembayaran
                      </Button>
                    </form>

                    <div className="space-y-2">
                      <div className="font-medium">Riwayat Pembayaran</div>
                      {selectedSale.payments.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">Belum ada pembayaran</p>
                      ) : (
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {selectedSale.payments.map((p) => (
                            <div key={p.id} className="p-3 bg-white border rounded flex justify-between items-center">
                              <div>
                                <div className="font-mono text-sm">{formatCurrency(p.amount)}</div>
                                <div className="text-xs text-gray-500">
                                  {formatDate(p.date)} - {p.method}
                                </div>
                                {p.note && <div className="text-xs text-gray-400">{p.note}</div>}
                              </div>
                              {p.proofImageUrl && (
                                <a href={p.proofImageUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-sm hover:underline">
                                  Lihat Bukti
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="border-t pt-2 flex justify-between font-bold">
                      <span>Total Dibayar</span>
                      <span className="font-mono">{formatCurrency(selectedSale.paidAmount)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-green-600">
                      <span>Sisa</span>
                      <span className="font-mono">{formatCurrency(selectedSale.total - selectedSale.paidAmount)}</span>
                    </div>
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
    </div>
  );
}

export default PenjualanClient;
