"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Search, Package, RotateCcw, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatCurrency, formatRupiahInput, parseRupiah } from "@/lib/format-rupiah";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";

interface Product {
  id: string;
  name: string;
  sku: string | null;
  unit: string | null;
  costPrice: number;
  sellPrice: number;
  stockQty: number;
  minStock: number;
  isActive: boolean;
  createdAt: string;
}

export function ProductsClient() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [formData, setFormData] = useState<{
    name: string;
    sku: string;
    unit: string;
    costPrice: string;
    sellPrice: string;
    minStock: string;
    initialStock: string;
    isActive: boolean;
  }>({
    name: "",
    sku: "",
    unit: "",
    costPrice: "",
    sellPrice: "",
    minStock: "5",
    initialStock: "",
    isActive: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [stockDialogProduct, setStockDialogProduct] = useState<Product | null>(null);
  const [stockForm, setStockForm] = useState({ type: "in" as "in" | "out", qty: "1", note: "" });
  const [stockSaving, setStockSaving] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (stockFilter !== "all") params.set("stockStatus", stockFilter);
    if (activeFilter !== "all") params.set("isActive", activeFilter);
    const res = await fetch(`/api/products?${params}`);
    if (res.ok) {
      const data = await res.json();
      setProducts(data);
    }
    setLoading(false);
  }, [search, stockFilter, activeFilter]);

  useEffect(() => {
    const timer = setTimeout(fetchProducts, 300);
    return () => clearTimeout(timer);
  }, [fetchProducts]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = "Nama produk wajib diisi";
    if (!formData.costPrice || parseRupiah(formData.costPrice) < 1) newErrors.costPrice = "Harga modal wajib > 0";
    if (!formData.sellPrice || parseRupiah(formData.sellPrice) < 1) newErrors.sellPrice = "Harga jual wajib > 0";
    if (!formData.initialStock || parseRupiah(formData.initialStock) < 0) newErrors.initialStock = "Stok awal tidak boleh negatif";
    if (!formData.minStock || parseRupiah(formData.minStock) < 0) newErrors.minStock = "Min stok tidak boleh negatif";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setSubmitting(true);

    const url = editingProduct ? `/api/products/${editingProduct.id}` : "/api/products";
    const method = editingProduct ? "PUT" : "POST";
    const body = {
      ...formData,
      costPrice: parseRupiah(formData.costPrice),
      sellPrice: parseRupiah(formData.sellPrice),
      minStock: parseRupiah(formData.minStock),
      initialStock: parseRupiah(formData.initialStock),
    };
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan produk");
      toast.success(editingProduct ? "Produk diperbarui" : "Produk ditambahkan");
      resetForm();
      setEditingProduct(null);
      setProductDialogOpen(false);
      await fetchProducts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan produk");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({ name: "", sku: "", unit: "", costPrice: "", sellPrice: "", minStock: "5", initialStock: "", isActive: true });
    setErrors({});
  };

  const handleDelete = async (id: string): Promise<boolean> => {
    setDeleting(id);
    try {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal menghapus produk");
      toast.success("Produk dihapus");
      await fetchProducts();
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menghapus produk");
      return false;
    } finally {
      setDeleting(null);
    }
  };

  const handleToggleActive = async (product: Product) => {
    setToggling(product.id);
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !product.isActive }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal mengubah status produk");
      toast.success(product.isActive ? "Produk dinonaktifkan" : "Produk diaktifkan");
      await fetchProducts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal mengubah status produk");
    } finally {
      setToggling(null);
    }
  };

  const handleStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockDialogProduct || parseRupiah(stockForm.qty) < 1) {
      toast.error("Qty stok minimal 1");
      return;
    }

    setStockSaving(true);
    try {
      const res = await fetch("/api/stock-movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: stockDialogProduct.id,
          type: stockForm.type,
          qty: parseRupiah(stockForm.qty),
          note: stockForm.note,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal memperbarui stok");
      toast.success(stockForm.type === "in" ? "Stok ditambahkan" : "Stok dikurangi");
      setStockDialogProduct(null);
      setStockForm({ type: "in", qty: "1", note: "" });
      await fetchProducts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal memperbarui stok");
    } finally {
      setStockSaving(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      setFormData((prev) => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else if (name === "costPrice" || name === "sellPrice") {
      setFormData((prev) => ({ ...prev, [name]: formatRupiahInput(value) }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const openEdit = (product: Product) => {
    setFormData({
      name: product.name,
      sku: product.sku || "",
      unit: product.unit || "",
      costPrice: formatCurrency(product.costPrice),
      sellPrice: formatCurrency(product.sellPrice),
      minStock: String(product.minStock),
      initialStock: String(product.stockQty),
      isActive: product.isActive,
    });
    setEditingProduct(product);
    setErrors({});
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-end sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="flex-1 w-full">
          <h1 className="text-2xl font-bold text-gray-900">Produk & Stok</h1>
          <p className="text-gray-500">Kelola produk, stok, dan mutasi barang</p>
        </div>
        <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
          <Button
            onClick={() => {
              resetForm();
              setEditingProduct(null);
              setProductDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Tambah Produk
          </Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingProduct ? "Edit Produk" : "Tambah Produk"}</DialogTitle>
              <DialogDescription>Isi data produk di bawah ini. Harga akan otomatis diformat ke Rupiah.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Nama Produk *</label>
                <Input placeholder="Nama produk" name="name" value={formData.name} onChange={handleInputChange} className={errors.name ? "border-red-500" : ""} />
                {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">SKU</label>
                  <Input placeholder="SKU (opsional)" name="sku" value={formData.sku} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Satuan</label>
                  <Input placeholder="pcs, kg, box, dll" name="unit" value={formData.unit} onChange={handleInputChange} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Harga Modal *</label>
                  <Input type="text" min="1" step="100" placeholder="Rp 0" name="costPrice" value={formData.costPrice} onChange={handleInputChange} inputMode="numeric" className={errors.costPrice ? "border-red-500" : ""} required />
                  {errors.costPrice && <p className="text-sm text-red-500">{errors.costPrice}</p>}
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Harga Jual *</label>
                  <Input type="text" min="1" step="100" placeholder="Rp 0" name="sellPrice" value={formData.sellPrice} onChange={handleInputChange} inputMode="numeric" className={errors.sellPrice ? "border-red-500" : ""} required />
                  {errors.sellPrice && <p className="text-sm text-red-500">{errors.sellPrice}</p>}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">{editingProduct ? "Stok saat ini *" : "Stok awal *"}</label>
                  <Input type="number" min="0" step="1" placeholder="0" name="initialStock" value={formData.initialStock} onChange={handleInputChange} className={errors.initialStock ? "border-red-500" : ""} />
                  {errors.initialStock && <p className="text-sm text-red-500">{errors.initialStock}</p>}
                  <p className="text-xs text-gray-500">{editingProduct ? "Perubahan dicatat pada riwayat mutasi." : "Jumlah stok saat produk dibuat."}</p>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Min Stok (Notifikasi)</label>
                  <Input type="number" min="0" step="1" name="minStock" value={formData.minStock} onChange={handleInputChange} placeholder="5" className={errors.minStock ? "border-red-500" : ""} />
                  {errors.minStock && <p className="text-sm text-red-500">{errors.minStock}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" name="isActive" checked={formData.isActive} onChange={handleInputChange} className="h-4 w-4 rounded border-gray-300" />
                <label className="text-sm font-medium text-gray-700">Aktif</label>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Menyimpan..." : editingProduct ? "Update" : "Simpan"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filter & Pencarian</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid items-end gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1 md:col-span-2 xl:col-span-2">
              <label htmlFor="product-search" className="text-xs font-medium text-gray-600">
                Cari produk
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input id="product-search" placeholder="Nama atau SKU" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
              </div>
            </div>
            <div className="space-y-1">
              <label htmlFor="stock-filter" className="text-xs font-medium text-gray-600">
                Status stok
              </label>
              <Select value={stockFilter} onValueChange={(v: string | null) => setStockFilter(v || "all")}>
                <SelectTrigger id="stock-filter" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua stok</SelectItem>
                  <SelectItem value="low">Menipis atau habis</SelectItem>
                  <SelectItem value="ok">Aman</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label htmlFor="active-filter" className="text-xs font-medium text-gray-600">
                Status produk
              </label>
              <Select value={activeFilter} onValueChange={(v: string | null) => setActiveFilter(v || "all")}>
                <SelectTrigger id="active-filter" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  <SelectItem value="true">Aktif</SelectItem>
                  <SelectItem value="false">Nonaktif</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Nama Produk</TableHead>
                  <TableHead className="hidden md:table-cell">SKU</TableHead>
                  <TableHead className="text-right">Harga Modal</TableHead>
                  <TableHead className="text-right">Harga Jual</TableHead>
                  <TableHead className="text-center">Stok</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="w-32">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 6 }, (_, index) => (
                    <TableRow key={`products-skeleton-${index}`}>
                      <TableCell colSpan={8}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : products.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      Belum ada produk
                    </TableCell>
                  </TableRow>
                ) : (
                  products.map((product, index) => {
                    const stockStatus = product.stockQty <= 0 ? "out_of_stock" : product.stockQty <= product.minStock ? "low_stock" : "in_stock";
                    return (
                      <TableRow key={product.id}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell className="hidden md:table-cell text-gray-500">{product.sku || "-"}</TableCell>
                        <TableCell className="text-right text-gray-600">{formatCurrency(product.costPrice)}</TableCell>
                        <TableCell className="text-right text-gray-600">{formatCurrency(product.sellPrice)}</TableCell>
                        <TableCell className="text-center font-mono font-medium">
                          {product.stockQty} {product.unit && <span className="text-xs text-gray-400 ml-1">{product.unit}</span>}
                        </TableCell>
                        <TableCell className="text-center">
                          <StatusBadge status={stockStatus} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 justify-end">
                            <Button variant="outline" size="sm" onClick={() => openEdit(product)}>
                              <Edit className="h-4 w-4" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setStockDialogProduct(product);
                                setStockForm({ type: "in", qty: "1", note: "" });
                              }}
                            >
                              <RotateCcw className="h-4 w-4" />
                              Stok
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleToggleActive(product)} disabled={toggling === product.id}>
                              <Package className="h-4 w-4" />
                              {toggling === product.id ? "Memproses..." : product.isActive ? "Nonaktifkan" : "Aktifkan"}
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => setDeletingProductId(product.id)}>
                              <Trash2 className="h-4 w-4" />
                              Hapus
                            </Button>
                          </div>
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
              Array.from({ length: 5 }, (_, index) => (
                <div key={`mobile-product-skeleton-${index}`} className="space-y-3 px-4 py-4">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ))
            ) : products.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-500">Belum ada produk</p>
            ) : (
              products.map((product) => {
                const stockStatus = product.stockQty <= 0 ? "out_of_stock" : product.stockQty <= product.minStock ? "low_stock" : "in_stock";
                return (
                  <article key={`mobile-${product.id}`} className="space-y-3 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{product.name}</p>
                        {product.sku && <p className="mt-0.5 truncate text-xs text-muted-foreground">SKU {product.sku}</p>}
                      </div>
                      <StatusBadge status={stockStatus} />
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Harga modal</p>
                        <p className="font-medium tabular-nums">{formatCurrency(product.costPrice)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Harga jual</p>
                        <p className="font-medium tabular-nums">{formatCurrency(product.sellPrice)}</p>
                      </div>
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
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(product)}>
                        <Edit className="h-4 w-4" /> Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setStockDialogProduct(product);
                          setStockForm({ type: "in", qty: "1", note: "" });
                        }}
                      >
                        <RotateCcw className="h-4 w-4" /> Stok
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleToggleActive(product)} disabled={toggling === product.id}>
                        <Package className="h-4 w-4" />
                        {product.isActive ? "Nonaktifkan" : "Aktifkan"}
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => setDeletingProductId(product.id)}>
                        <Trash2 className="h-4 w-4" /> Hapus
                      </Button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingProduct} onOpenChange={(open) => !open && setEditingProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Produk</DialogTitle>
            <DialogDescription>Edit data produk di bawah ini.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Nama Produk *</label>
              <Input placeholder="Nama produk" name="name" value={formData.name} onChange={handleInputChange} className={errors.name ? "border-red-500" : ""} />
              {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">SKU</label>
                <Input placeholder="SKU (opsional)" name="sku" value={formData.sku} onChange={handleInputChange} />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Satuan</label>
                <Input placeholder="pcs, kg, box, dll" name="unit" value={formData.unit} onChange={handleInputChange} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Harga Modal *</label>
                <Input type="text" min="1" step="100" placeholder="Rp 0" name="costPrice" value={formData.costPrice} onChange={handleInputChange} inputMode="numeric" className={errors.costPrice ? "border-red-500" : ""} required />
                {errors.costPrice && <p className="text-sm text-red-500">{errors.costPrice}</p>}
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Harga Jual *</label>
                <Input type="text" min="1" step="100" placeholder="Rp 0" name="sellPrice" value={formData.sellPrice} onChange={handleInputChange} inputMode="numeric" className={errors.sellPrice ? "border-red-500" : ""} required />
                {errors.sellPrice && <p className="text-sm text-red-500">{errors.sellPrice}</p>}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Stok saat ini *</label>
                <Input type="text" min="0" step="100" placeholder="Rp 0" name="initialStock" value={formData.initialStock} onChange={handleInputChange} inputMode="numeric" className={errors.initialStock ? "border-red-500" : ""} />
                {errors.initialStock && <p className="text-sm text-red-500">{errors.initialStock}</p>}
                <p className="text-xs text-gray-500">Perubahan dicatat pada riwayat mutasi.</p>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Min Stok (Notifikasi)</label>
                <Input type="text" min="0" name="minStock" value={formData.minStock} onChange={handleInputChange} placeholder="5" inputMode="numeric" className={errors.minStock ? "border-red-500" : ""} />
                {errors.minStock && <p className="text-sm text-red-500">{errors.minStock}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" name="isActive" checked={formData.isActive} onChange={handleInputChange} className="h-4 w-4 rounded border-gray-300" />
              <label className="text-sm font-medium text-gray-700">Aktif</label>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Menyimpan..." : "Update"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deletingProductId !== null}
        onOpenChange={(open) => !open && setDeletingProductId(null)}
        title="Hapus produk?"
        description="Produk akan dihapus jika belum digunakan dalam transaksi atau mutasi stok."
        isLoading={deleting === deletingProductId}
        onConfirm={() => (deletingProductId ? handleDelete(deletingProductId) : false)}
      />

      <Dialog open={!!stockDialogProduct} onOpenChange={(open) => !open && setStockDialogProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mutasi Stok</DialogTitle>
            <DialogDescription>
              {stockDialogProduct?.name} · Stok saat ini {stockDialogProduct?.stockQty ?? 0}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleStockSubmit} className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Aksi</label>
              <Select value={stockForm.type} onValueChange={(value: string | null) => setStockForm((prev) => ({ ...prev, type: (value || "in") as "in" | "out" }))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">Tambah stok</SelectItem>
                  <SelectItem value="out">Kurangi stok</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Jumlah *</label>
              <Input type="text" inputMode="numeric" value={stockForm.qty} onChange={(e) => setStockForm((prev) => ({ ...prev, qty: formatRupiahInput(e.target.value) }))} required />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Catatan</label>
              <Input value={stockForm.note} onChange={(e) => setStockForm((prev) => ({ ...prev, note: e.target.value }))} placeholder="Opsional" />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={stockSaving}>
                {stockSaving ? "Menyimpan..." : "Simpan Mutasi"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
