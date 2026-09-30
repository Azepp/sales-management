"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { toast } from "sonner";
import { formatCurrency, formatRupiahInput, parseRupiah } from "@/lib/format-rupiah";
import { Skeleton } from "@/components/ui/skeleton";

interface Capital {
  id: string;
  date: string;
  amount: number;
  note: string | null;
  createdAt: string;
}

interface Expense {
  id: string;
  date: string;
  amount: number;
  note: string | null;
  createdAt: string;
}

export function KeuanganClient() {
  const [activeTab, setActiveTab] = useState<"capital" | "expense">("capital");
  const [capitals, setCapitals] = useState<Capital[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const [capitalStart, setCapitalStart] = useState("");
  const [capitalEnd, setCapitalEnd] = useState("");
  const [expenseStart, setExpenseStart] = useState("");
  const [expenseEnd, setExpenseEnd] = useState("");

  const [editingCapital, setEditingCapital] = useState<Capital | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const [capitalForm, setCapitalForm] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    amountRaw: "",
    amount: 0,
    note: "",
  });
  const [expenseForm, setExpenseForm] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    amountRaw: "",
    amount: 0,
    note: "",
  });

  const [capitalSaving, setCapitalSaving] = useState(false);
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [capitalDialogOpen, setCapitalDialogOpen] = useState(false);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "capital" | "expense"; id: string; label: string } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [capRes, expRes] = await Promise.all([fetch(`/api/capital?startDate=${capitalStart}&endDate=${capitalEnd}`), fetch(`/api/expenses?startDate=${expenseStart}&endDate=${expenseEnd}`)]);
      if (capRes.ok) setCapitals(await capRes.json());
      if (expRes.ok) setExpenses(await expRes.json());
    } finally {
      setLoading(false);
    }
  }, [capitalStart, capitalEnd, expenseStart, expenseEnd]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const handleCapitalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!capitalForm.date || capitalForm.amount < 1) {
      toast.error("Isi semua field wajib");
      return;
    }
    setCapitalSaving(true);
    const url = editingCapital ? `/api/capital/${editingCapital.id}` : "/api/capital";
    const method = editingCapital ? "PUT" : "POST";
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...capitalForm, amount: capitalForm.amount }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan modal");
      resetCapitalForm();
      await fetchData();
      toast.success(editingCapital ? "Modal diperbarui" : "Modal ditambahkan");
      setCapitalDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan modal");
    } finally {
      setCapitalSaving(false);
    }
  };

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.date || expenseForm.amount < 1) {
      toast.error("Isi semua field wajib");
      return;
    }
    setExpenseSaving(true);
    const url = editingExpense ? `/api/expenses/${editingExpense.id}` : "/api/expenses";
    const method = editingExpense ? "PUT" : "POST";
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...expenseForm, amount: expenseForm.amount }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan pengeluaran");
      resetExpenseForm();
      await fetchData();
      toast.success(editingExpense ? "Pengeluaran diperbarui" : "Pengeluaran ditambahkan");
      setExpenseDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan pengeluaran");
    } finally {
      setExpenseSaving(false);
    }
  };

  const handleDeleteCapital = async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/capital/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal menghapus modal");
      await fetchData();
      toast.success("Modal dihapus");
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menghapus modal");
      return false;
    }
  };

  const handleDeleteExpense = async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal menghapus pengeluaran");
      await fetchData();
      toast.success("Pengeluaran dihapus");
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menghapus pengeluaran");
      return false;
    }
  };

  const formatDate = (dateStr: string) => format(new Date(dateStr), "dd MMM yyyy", { locale: id });

  const totalCapital = capitals.reduce((sum, c) => sum + Number(c.amount), 0);
  const totalExpense = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  const handleCapitalChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === "amountRaw") {
      const amount = parseRupiah(value);
      setCapitalForm((prev) => ({ ...prev, [name]: formatRupiahInput(value), amount }));
    } else {
      setCapitalForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleExpenseChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === "amountRaw") {
      const amount = parseRupiah(value);
      setExpenseForm((prev) => ({ ...prev, [name]: formatRupiahInput(value), amount }));
    } else {
      setExpenseForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const openEditCapital = (item: Capital) => {
    setCapitalForm({
      date: item.date.split("T")[0],
      amountRaw: formatRupiahInput(String(item.amount)),
      amount: Number(item.amount),
      note: item.note || "",
    });
    setEditingCapital(item);
    setCapitalDialogOpen(true);
  };

  const openEditExpense = (item: Expense) => {
    setExpenseForm({
      date: item.date.split("T")[0],
      amountRaw: formatRupiahInput(String(item.amount)),
      amount: Number(item.amount),
      note: item.note || "",
    });
    setEditingExpense(item);
    setExpenseDialogOpen(true);
  };

  const resetCapitalForm = () => {
    setCapitalForm({ date: format(new Date(), "yyyy-MM-dd"), amountRaw: "", amount: 0, note: "" });
    setEditingCapital(null);
  };

  const resetExpenseForm = () => {
    setExpenseForm({ date: format(new Date(), "yyyy-MM-dd"), amountRaw: "", amount: 0, note: "" });
    setEditingExpense(null);
  };

  const capitalAmountDisplay = capitalForm.amountRaw || "";
  const expenseAmountDisplay = expenseForm.amountRaw || "";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Keuangan</h1>
          <p className="text-gray-500">Kelola modal dan pengeluaran usaha</p>
        </div>
        <div className="flex gap-2">
          {activeTab === "capital" && (
            <Dialog open={capitalDialogOpen} onOpenChange={setCapitalDialogOpen}>
              <Button
                onClick={() => {
                  resetCapitalForm();
                  setCapitalDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4" /> Tambah Modal
              </Button>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingCapital ? "Edit Modal" : "Tambah Modal"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCapitalSubmit} className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Tanggal *</label>
                    <Input type="date" name="date" value={capitalForm.date} onChange={handleCapitalChange} required />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Jumlah *</label>
                    <Input type="text" name="amountRaw" value={capitalAmountDisplay} onChange={handleCapitalChange} placeholder="Rp 0" inputMode="numeric" required />
                    <p className="text-xs text-gray-500">Format otomatis: Rp 1.000.000</p>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Catatan</label>
                    <Input placeholder="Catatan (opsional)" name="note" value={capitalForm.note} onChange={handleCapitalChange} />
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={capitalSaving}>
                      {capitalSaving ? "Menyimpan..." : "Simpan"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
          {activeTab === "expense" && (
            <Dialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen}>
              <Button
                onClick={() => {
                  resetExpenseForm();
                  setExpenseDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4" /> Tambah Pengeluaran
              </Button>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingExpense ? "Edit Pengeluaran" : "Tambah Pengeluaran"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleExpenseSubmit} className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Tanggal *</label>
                    <Input type="date" name="date" value={expenseForm.date} onChange={handleExpenseChange} required />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Jumlah *</label>
                    <Input type="text" name="amountRaw" value={expenseAmountDisplay} onChange={handleExpenseChange} placeholder="Rp 0" inputMode="numeric" required />
                    <p className="text-xs text-gray-500">Format otomatis: Rp 1.000.000</p>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Catatan</label>
                    <Input placeholder="Catatan (opsional)" name="note" value={expenseForm.note} onChange={handleExpenseChange} />
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={expenseSaving}>
                      {expenseSaving ? "Menyimpan..." : "Simpan"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Total Modal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{formatCurrency(totalCapital)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Total Pengeluaran</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{formatCurrency(totalExpense)}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="capital">Modal</TabsTrigger>
          <TabsTrigger value="expense">Pengeluaran</TabsTrigger>
        </TabsList>

        <TabsContent value="capital" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Filter Modal</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 sm:max-w-2xl">
                <div className="space-y-1">
                  <label htmlFor="capital-start" className="text-xs font-medium text-gray-600">
                    Tanggal mulai
                  </label>
                  <Input id="capital-start" type="date" value={capitalStart} onChange={(e) => setCapitalStart(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label htmlFor="capital-end" className="text-xs font-medium text-gray-600">
                    Tanggal akhir
                  </label>
                  <Input id="capital-end" type="date" value={capitalEnd} onChange={(e) => setCapitalEnd(e.target.value)} />
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
                      <TableHead>Tanggal</TableHead>
                      <TableHead className="text-right">Jumlah</TableHead>
                      <TableHead>Catatan</TableHead>
                      <TableHead className="w-24">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 5 }, (_, index) => (
                        <TableRow key={`capital-skeleton-${index}`}>
                          <TableCell colSpan={4}>
                            <Skeleton className="h-5 w-full" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : capitals.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                          Belum ada data modal
                        </TableCell>
                      </TableRow>
                    ) : (
                      capitals.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{formatDate(item.date)}</TableCell>
                          <TableCell className="text-right font-mono text-green-600">+{formatCurrency(item.amount)}</TableCell>
                          <TableCell className="text-gray-500">{item.note || "-"}</TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              <Button variant="outline" size="sm" onClick={() => openEditCapital(item)}>
                                <Edit className="h-4 w-4" />
                                Edit
                              </Button>
                              <Button variant="destructive" size="sm" onClick={() => setDeleteTarget({ type: "capital", id: item.id, label: formatCurrency(item.amount) })}>
                                <Trash2 className="h-4 w-4" />
                                Hapus
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
                    <div key={`mobile-capital-${index}`} className="space-y-3 px-4 py-4">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  ))
                ) : capitals.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-gray-500">Belum ada data modal</p>
                ) : (
                  capitals.map((item) => (
                    <article key={`mobile-${item.id}`} className="space-y-3 px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs text-muted-foreground">{formatDate(item.date)}</span>
                        <span className="font-medium tabular-nums text-green-700">+{formatCurrency(item.amount)}</span>
                      </div>
                      {item.note && <p className="wrap-break-word text-sm text-muted-foreground">{item.note}</p>}
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEditCapital(item)}>
                          <Edit className="h-4 w-4" /> Edit
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => setDeleteTarget({ type: "capital", id: item.id, label: formatCurrency(item.amount) })}>
                          <Trash2 className="h-4 w-4" /> Hapus
                        </Button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expense" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Filter Pengeluaran</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 sm:max-w-2xl">
                <div className="space-y-1">
                  <label htmlFor="expense-start" className="text-xs font-medium text-gray-600">
                    Tanggal mulai
                  </label>
                  <Input id="expense-start" type="date" value={expenseStart} onChange={(e) => setExpenseStart(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label htmlFor="expense-end" className="text-xs font-medium text-gray-600">
                    Tanggal akhir
                  </label>
                  <Input id="expense-end" type="date" value={expenseEnd} onChange={(e) => setExpenseEnd(e.target.value)} />
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
                      <TableHead>Tanggal</TableHead>
                      <TableHead className="text-right">Jumlah</TableHead>
                      <TableHead>Catatan</TableHead>
                      <TableHead className="w-24">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 5 }, (_, index) => (
                        <TableRow key={`expense-skeleton-${index}`}>
                          <TableCell colSpan={4}>
                            <Skeleton className="h-5 w-full" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : expenses.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                          Belum ada data pengeluaran
                        </TableCell>
                      </TableRow>
                    ) : (
                      expenses.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{formatDate(item.date)}</TableCell>
                          <TableCell className="text-right font-mono text-red-600">-{formatCurrency(item.amount)}</TableCell>
                          <TableCell className="text-gray-500">{item.note || "-"}</TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              <Button variant="outline" size="sm" onClick={() => openEditExpense(item)}>
                                <Edit className="h-4 w-4" />
                                Edit
                              </Button>
                              <Button variant="destructive" size="sm" onClick={() => setDeleteTarget({ type: "expense", id: item.id, label: formatCurrency(item.amount) })}>
                                <Trash2 className="h-4 w-4" />
                                Hapus
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
                    <div key={`mobile-expense-${index}`} className="space-y-3 px-4 py-4">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  ))
                ) : expenses.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-gray-500">Belum ada data pengeluaran</p>
                ) : (
                  expenses.map((item) => (
                    <article key={`mobile-${item.id}`} className="space-y-3 px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs text-muted-foreground">{formatDate(item.date)}</span>
                        <span className="font-medium tabular-nums text-red-700">-{formatCurrency(item.amount)}</span>
                      </div>
                      {item.note && <p className="wrap-break-word text-sm text-muted-foreground">{item.note}</p>}
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEditExpense(item)}>
                          <Edit className="h-4 w-4" /> Edit
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => setDeleteTarget({ type: "expense", id: item.id, label: formatCurrency(item.amount) })}>
                          <Trash2 className="h-4 w-4" /> Hapus
                        </Button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={deleteTarget?.type === "capital" ? "Hapus modal?" : "Hapus pengeluaran?"}
        description={`Data ${deleteTarget?.label ?? "ini"} akan dihapus dan tidak dapat dipulihkan.`}
        onConfirm={() => {
          if (!deleteTarget) return false;
          return deleteTarget.type === "capital" ? handleDeleteCapital(deleteTarget.id) : handleDeleteExpense(deleteTarget.id);
        }}
      />
    </div>
  );
}
