import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const format = searchParams.get("format");

  if (type === "dashboard-trend") {
    const period = searchParams.get("period") || "7d";
    const today = new Date();
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    const start = period === "12m"
      ? new Date(today.getFullYear(), today.getMonth() - 11, 1)
      : new Date(today.getFullYear(), today.getMonth(), today.getDate() - (period === "30d" ? 29 : 6));
    const bucketCount = period === "12m" ? 12 : period === "30d" ? 6 : 7;
    const daysPerBucket = period === "30d" ? 5 : 1;

    const [sales, expenses] = await Promise.all([
      prisma.sale.findMany({
        where: { date: { gte: start, lte: end }, fulfillmentStatus: "delivered" },
        select: { date: true, total: true },
      }),
      prisma.expense.findMany({
        where: { date: { gte: start, lte: end } },
        select: { date: true, amount: true },
      }),
    ]);

    const buckets = Array.from({ length: bucketCount }, (_, index) => {
      const bucketStart = period === "12m"
        ? new Date(start.getFullYear(), start.getMonth() + index, 1)
        : new Date(start.getFullYear(), start.getMonth(), start.getDate() + index * daysPerBucket);
      const bucketEnd = period === "12m"
        ? new Date(bucketStart.getFullYear(), bucketStart.getMonth() + 1, 0, 23, 59, 59, 999)
        : new Date(bucketStart.getFullYear(), bucketStart.getMonth(), bucketStart.getDate() + daysPerBucket - 1, 23, 59, 59, 999);
      const label = period === "12m"
        ? bucketStart.toLocaleDateString("id-ID", { month: "short" })
        : bucketStart.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
      return { label, title: `${bucketStart.toLocaleDateString("id-ID")} - ${bucketEnd.toLocaleDateString("id-ID")}`, sales: 0, expenses: 0 };
    });

    const getBucketIndex = (date: Date) => {
      if (period === "12m") return (date.getFullYear() - start.getFullYear()) * 12 + date.getMonth() - start.getMonth();
      const dayOffset = Math.floor((new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() - start.getTime()) / 86400000);
      return period === "30d" ? Math.floor(dayOffset / daysPerBucket) : dayOffset;
    };

    for (const sale of sales) {
      const index = getBucketIndex(sale.date);
      if (buckets[index]) buckets[index].sales += Number(sale.total);
    }
    for (const expense of expenses) {
      const index = getBucketIndex(expense.date);
      if (buckets[index]) buckets[index].expenses += Number(expense.amount);
    }

    return NextResponse.json(buckets.map((bucket) => ({
      label: bucket.label,
      title: bucket.title,
      values: [bucket.sales, bucket.expenses],
    })));
  }

  const where: Record<string, unknown> = {};
  if (startDate || endDate) {
    const dateFilter: Record<string, Date> = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(`${endDate}T23:59:59.999`);
    where.date = dateFilter;
  }

  if (type === "profit-loss") {
    const sales = await prisma.sale.findMany({
      where: {
        ...where,
        fulfillmentStatus: "delivered",
      },
      include: {
        items: { include: { product: { select: { costPrice: true } } } },
        returns: true,
      },
    });

    const expenses = await prisma.expense.findMany({ where });
    const capitals = await prisma.capital.findMany({ where });

    let totalSales = 0;
    let totalCOGS = 0;
    let totalReturns = 0;

    for (const sale of sales) {
      totalSales += Number(sale.total);
      for (const item of sale.items) {
        totalCOGS += Number(item.product.costPrice) * item.qty;
      }
      for (const ret of sale.returns) {
        totalReturns += Number(ret.refundAmount);
      }
    }

    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const totalCapital = capitals.reduce((sum, c) => sum + Number(c.amount), 0);
    const netProfit = totalSales - totalCOGS - totalExpenses - totalReturns;

    const data = {
      totalSales,
      totalCOGS,
      totalExpenses,
      totalReturns,
      netProfit,
      totalCapital,
      salesCount: sales.length,
    };

    if (format === "excel") {
      return generateProfitLossExcel(data, sales, expenses, capitals, startDate, endDate);
    }
    return NextResponse.json(data);
  }

  if (type === "sales") {
    const sales = await prisma.sale.findMany({
      where,
      orderBy: { date: "desc" },
      include: {
        items: { include: { product: true } },
        payments: true,
        returns: true,
      },
    });

    if (format === "excel") {
      return generateSalesExcel(sales, startDate, endDate);
    }
    return NextResponse.json(sales);
  }

  if (type === "stock") {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      include: { stockMovements: { orderBy: { date: "desc" }, take: 10 } },
    });

    if (format === "excel") {
      return generateStockExcel(products);
    }
    return NextResponse.json(products);
  }

  return NextResponse.json({ error: "Invalid report type" }, { status: 400 });
}

function generateProfitLossExcel(
  data: Record<string, unknown>,
  sales: unknown[],
  expenses: unknown[],
  capitals: unknown[],
  startDate: string | null,
  endDate: string | null
) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Laba Rugi");

  sheet.addRow(["LAPORAN LABA RUGI"]);
  sheet.addRow([`Periode: ${startDate || "Awal"} - ${endDate || "Akhir"}`]);
  sheet.addRow([]);

  sheet.addRow(["RINGKASAN"]);
  sheet.addRow(["Total Penjualan (Delivered)", data.totalSales]);
  sheet.addRow(["HPP (COGS)", data.totalCOGS]);
  sheet.addRow(["Total Pengeluaran", data.totalExpenses]);
  sheet.addRow(["Total Retur", data.totalReturns]);
  sheet.addRow(["Laba Bersih", data.netProfit]);
  sheet.addRow(["Total Modal", data.totalCapital]);
  sheet.addRow([]);

  sheet.addRow(["DETAIL PENJUALAN"]);
  sheet.addRow(["Invoice", "Tanggal", "Customer", "Total", "HPP", "Laba Kotor"]);
  for (const sale of sales) {
    const s = sale as Record<string, unknown>;
    const items = s.items as Array<{ product: { costPrice: number }; qty: number }>;
    const cogs = items.reduce((sum, item) => sum + item.product.costPrice * item.qty, 0);
    sheet.addRow([s.invoiceNumber, s.date, s.customerName, s.total, cogs, Number(s.total) - cogs]);
  }
  sheet.addRow([]);

  sheet.addRow(["DETAIL PENGELUARAN"]);
  sheet.addRow(["Tanggal", "Kategori", "Jumlah", "Catatan"]);
  for (const exp of expenses) {
    const e = exp as Record<string, unknown>;
    sheet.addRow([e.date, e.category, e.amount, e.note]);
  }
  sheet.addRow([]);

  sheet.addRow(["DETAIL MODAL"]);
  sheet.addRow(["Tanggal", "Jumlah", "Catatan"]);
  for (const cap of capitals) {
    const c = cap as Record<string, unknown>;
    sheet.addRow([c.date, c.amount, c.note]);
  }

  return sendExcel(workbook, `laba-rugi-${startDate || "all"}-${endDate || "all"}.xlsx`);
}

function generateSalesExcel(sales: unknown[], startDate: string | null, endDate: string | null) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Penjualan");

  sheet.addRow(["LAPORAN PENJUALAN"]);
  sheet.addRow([`Periode: ${startDate || "Awal"} - ${endDate || "Akhir"}`]);
  sheet.addRow([]);
  sheet.addRow(["Invoice", "Tanggal", "Customer", "Tipe", "Status Fulfillment", "Status Bayar", "Subtotal", "Diskon", "Total", "Dibayar", "Sisa"]);

  for (const sale of sales) {
    const s = sale as Record<string, unknown>;
    const payments = s.payments as Array<Record<string, unknown>>;
    const paid = payments.reduce((sum: number, p: Record<string, unknown>) => sum + Number(p.amount), 0);
    sheet.addRow([
      s.invoiceNumber,
      s.date,
      s.customerName,
      s.orderType,
      s.fulfillmentStatus,
      s.paymentStatus,
      s.subtotal,
      s.discountAmount,
      s.total,
      paid,
      Number(s.total) - paid,
    ]);
  }

  return sendExcel(workbook, `penjualan-${startDate || "all"}-${endDate || "all"}.xlsx`);
}

function generateStockExcel(products: unknown[]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Stok");

  sheet.addRow(["LAPORAN STOK"]);
  sheet.addRow([]);
  sheet.addRow(["Nama", "SKU", "Kategori", "Satuan", "Harga Modal", "Harga Jual", "Stok", "Min Stok", "Status"]);

  for (const product of products) {
    const p = product as Record<string, unknown>;
    const status = Number(p.stockQty) <= Number(p.minStock) ? "Menipis" : "Aman";
    sheet.addRow([
      p.name,
      p.sku,
      p.category,
      p.unit,
      p.costPrice,
      p.sellPrice,
      p.stockQty,
      p.minStock,
      status,
    ]);
  }

  return sendExcel(workbook, "stok.xlsx");
}

function sendExcel(workbook: ExcelJS.Workbook, filename: string) {
  return new Promise<Response>((resolve) => {
    workbook.xlsx.writeBuffer().then((buffer) => {
      const headers = new Headers();
      headers.set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      headers.set("Content-Disposition", `attachment; filename="${filename}"`);
      resolve(new Response(buffer, { headers }));
    });
  });
}