import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const saleItemSchema = z.object({
  productId: z.string().min(1),
  qty: z.number().int().min(1).max(100000),
  priceAtSale: z.number().finite().min(0).max(1_000_000_000_000),
});

const proofFileSchema = z.instanceof(File)
  .refine((file) => file.size <= 5 * 1024 * 1024, "Ukuran bukti pembayaran maksimal 5 MB")
  .refine((file) => ["image/jpeg", "image/png", "application/pdf"].includes(file.type), "Bukti harus berupa JPG, PNG, atau PDF");

const saleSchema = z.object({
  customerName: z.string().trim().min(1, "Nama customer wajib diisi").max(120),
  orderType: z.enum(["regular", "preorder"]),
  estReadyDate: z.string().optional().refine((date) => !date || !Number.isNaN(Date.parse(date)), "Tanggal estimasi tidak valid"),
  items: z.array(saleItemSchema).min(1, "Minimal 1 item").max(100),
  discountType: z.enum(["percent", "fixed"]).optional(),
  discountValue: z.number().finite().min(0).max(1_000_000_000_000).optional(),
  note: z.string().max(2000).optional(),
  paymentMethod: z.enum(["cash", "transfer", "qris", "lainnya"]).optional(),
  paymentNote: z.string().max(500).optional(),
  proofFile: proofFileSchema.optional(),
}).superRefine((sale, context) => {
  if (sale.discountType === "percent" && (sale.discountValue ?? 0) > 100) {
    context.addIssue({ code: "custom", path: ["discountValue"], message: "Diskon persen maksimal 100%" });
  }
});

const paymentSchema = z.object({
  amount: z.number().min(1, "Jumlah minimal 1"),
  method: z.enum(["cash", "transfer", "qris", "lainnya"]),
  note: z.string().optional(),
  proofFile: z.instanceof(File).optional(),
});

class SaleRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function generateInvoiceNumber(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).split("-").join("");
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `INV-${dateStr}-${random}`;
}

function calculateDiscount(subtotal: number, discountType?: string, discountValue?: number): number {
  if (!discountType || !discountValue) return 0;
  if (discountType === "percent") {
    return Math.round(subtotal * (discountValue / 100));
  }
  return Math.min(discountValue, subtotal);
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const orderType = searchParams.get("orderType");
  const fulfillmentStatus = searchParams.get("fulfillmentStatus");
  const paymentStatus = searchParams.get("paymentStatus");
  const customerName = searchParams.get("customerName");
  const shortcut = searchParams.get("shortcut");

  const where: Record<string, unknown> = {};

  if (startDate || endDate) {
    const dateFilter: Record<string, Date> = {};
    if (startDate) dateFilter.gte = new Date(`${startDate}T00:00:00.000Z`);
    if (endDate) dateFilter.lte = new Date(`${endDate}T23:59:59.999Z`);
    where.date = dateFilter;
  }
  if (orderType && orderType !== "all") where.orderType = orderType;
  if (fulfillmentStatus && fulfillmentStatus !== "all") where.fulfillmentStatus = fulfillmentStatus;
  if (paymentStatus && paymentStatus !== "all") where.paymentStatus = paymentStatus;
  if (customerName) where.customerName = { contains: customerName, mode: "insensitive" };

  if (shortcut === "ready_not_delivered") {
    where.fulfillmentStatus = "ready";
  } else if (shortcut === "unpaid") {
    where.paymentStatus = { in: ["unpaid", "dp"] };
  }

  const sales = await prisma.sale.findMany({
    where,
    orderBy: { date: "desc" },
    include: {
      items: { include: { product: { select: { name: true, sku: true } } } },
      payments: { orderBy: { date: "desc" } },
      returns: { include: { product: { select: { name: true } } } },
    },
  });

  const salesWithPaidAmount = sales.map((sale) => ({
    ...sale,
    paidAmount: sale.payments.reduce((sum, p) => sum + Number(p.amount), 0),
  }));

  return NextResponse.json(salesWithPaidAmount);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 6 * 1024 * 1024) {
    return NextResponse.json({ error: "Ukuran permintaan transaksi maksimal 6 MB" }, { status: 413 });
  }

  let parsedData: z.infer<typeof saleSchema>;
  try {
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const formData = await request.formData();
      let items: unknown;
      try {
        items = JSON.parse(String(formData.get("items") ?? "[]"));
      } catch {
        return NextResponse.json({ error: "Daftar item transaksi tidak valid" }, { status: 400 });
      }
      const proofFile = formData.get("proofFile");
      const parsed = saleSchema.safeParse({
        customerName: String(formData.get("customerName") ?? ""),
        orderType: String(formData.get("orderType") ?? ""),
        estReadyDate: String(formData.get("estReadyDate") ?? "") || undefined,
        note: String(formData.get("note") ?? ""),
        discountType: String(formData.get("discountType") ?? "") || undefined,
        discountValue: Number(formData.get("discountValue") ?? 0),
        paymentMethod: String(formData.get("paymentMethod") ?? "") || undefined,
        paymentNote: String(formData.get("paymentNote") ?? "") || undefined,
        items,
        proofFile: proofFile instanceof File && proofFile.size > 0 ? proofFile : undefined,
      });
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }
      parsedData = parsed.data;
    } else {
      const body = await request.json();
      const parsed = saleSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }
      parsedData = parsed.data;
    }
  } catch {
    return NextResponse.json({ error: "Data transaksi tidak valid" }, { status: 400 });
  }

  const { customerName, orderType, estReadyDate, items, discountType, discountValue, note, paymentMethod, paymentNote, proofFile } = parsedData;

  const subtotal = items.reduce((sum: number, item: { priceAtSale: number; qty: number }) => sum + item.priceAtSale * item.qty, 0);
  const discountAmount = calculateDiscount(subtotal, discountType, discountValue);
  const total = subtotal - discountAmount;

  const fulfillmentStatus = orderType === "preorder" ? "pending" : "ready";
  const hasInitialPayment = orderType === "regular" && Boolean(paymentMethod);
  const paymentStatus = hasInitialPayment ? "paid_full" : "unpaid";

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        for (const item of items) {
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (!product) throw new SaleRequestError("Produk yang dipilih tidak ditemukan", 404);
          if (orderType === "regular" && product.stockQty < item.qty) {
            throw new SaleRequestError(`Stok ${product.name} tidak mencukupi (tersedia: ${product.stockQty})`, 409);
          }
        }

        const sale = await tx.sale.create({
          data: {
            invoiceNumber: generateInvoiceNumber(),
            customerName,
            orderType,
            fulfillmentStatus,
            paymentStatus,
            estReadyDate: estReadyDate ? new Date(estReadyDate) : null,
            subtotal,
            discountType,
            discountValue,
            discountAmount,
            total,
            note,
            items: {
              create: items.map((item: { productId: string; qty: number; priceAtSale: number }) => ({
                productId: item.productId,
                qty: item.qty,
                priceAtSale: item.priceAtSale,
                subtotal: item.priceAtSale * item.qty,
              })),
            },
            payments: hasInitialPayment ? {
              create: {
                amount: total,
                method: paymentMethod!,
                note: paymentNote,
                proofImageUrl: proofFile ? `proof_${Date.now()}_${proofFile.name}` : null,
              },
            } : undefined,
          },
          include: { items: { include: { product: true } } },
        });

        if (orderType === "regular") {
          for (const item of items as { productId: string; qty: number; priceAtSale: number }[]) {
            const stockUpdate = await tx.product.updateMany({
              where: { id: item.productId, stockQty: { gte: item.qty } },
              data: { stockQty: { decrement: item.qty } },
            });
            if (stockUpdate.count !== 1) {
              const product = await tx.product.findUnique({ where: { id: item.productId }, select: { name: true, stockQty: true } });
              throw new SaleRequestError(`Stok ${product?.name ?? "produk"} tidak mencukupi (tersedia: ${product?.stockQty ?? 0})`, 409);
            }
            await tx.stockMovement.create({
              data: {
                productId: item.productId,
                type: "out",
                qty: item.qty,
                note: `Penjualan ${sale.invoiceNumber}`,
              },
            });
          }
        }

        return sale;
      },
      { timeout: 10000 }
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Error creating sale:", error);
    return NextResponse.json(
      { error: error instanceof SaleRequestError ? error.message : "Gagal membuat transaksi" },
      { status: error instanceof SaleRequestError ? error.status : 500 }
    );
  }
}
export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const saleId = searchParams.get("id");

  if (!saleId) {
    return NextResponse.json({ error: "Sale ID is required" }, { status: 400 });
  }

  if (action === "payment") {
    return handleAddPayment(request, saleId);
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

async function handleAddPayment(request: Request, saleId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let paymentData: {
    amount: number;
    method: "cash" | "transfer" | "qris" | "lainnya";
    note?: string;
    proofFile?: File | null;
  };

  try {
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const formData = await request.formData();
      paymentData = {
        amount: parseFloat(String(formData.get("amount") ?? "0")),
        method: String(formData.get("method") ?? "cash") as "cash" | "transfer" | "qris" | "lainnya",
        note: String(formData.get("note") ?? ""),
        proofFile: formData.get("proofFile") instanceof File ? formData.get("proofFile") as File : null,
      };
    } else {
      const body = await request.json();
      const parsed = paymentSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }
      paymentData = parsed.data;
    }
  } catch (error) {
    console.error("Error parsing payment data:", error);
    return NextResponse.json({ error: "Gagal memparsing data pembayaran" }, { status: 400 });
  }

  if (!paymentData.amount || paymentData.amount < 1) {
    return NextResponse.json({ error: "Jumlah minimal 1" }, { status: 400 });
  }

  try {
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: { payments: true },
    });

    if (!sale) {
      return NextResponse.json({ error: "Transaksi tidak ditemukan" }, { status: 404 });
    }

    const paidAmount = sale.payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const remainingAmount = Number(sale.total) - paidAmount;

    if (paymentData.amount > remainingAmount) {
      return NextResponse.json({ error: `Jumlah melebihi sisa yang harus dibayar (Rp ${remainingAmount.toLocaleString("id-ID")})` }, { status: 400 });
    }

    // TODO: Upload proofFile to storage if needed
    // For now, we'll store a placeholder
    let proofFileUrl = null;
    if (paymentData.proofFile) {
      proofFileUrl = `proof_${Date.now()}_${paymentData.proofFile.name}`;
    }

    const payment = await prisma.payment.create({
      data: {
        saleId,
        amount: paymentData.amount,
        method: paymentData.method,
        note: paymentData.note,
        proofImageUrl: proofFileUrl,
      },
    });

    // Recalculate paid amount
    const totalPaidAgg = await prisma.payment.aggregate({
      where: { saleId },
      _sum: { amount: true }
    });
    const totalPaid = totalPaidAgg._sum.amount ? Number(totalPaidAgg._sum.amount) : 0;
    const totalSale = Number(sale.total);

    let newPaymentStatus = "unpaid";
    if (totalPaid >= totalSale) {
      newPaymentStatus = "paid_full";
    } else if (totalPaid > 0) {
      newPaymentStatus = "dp";
    } else {
      newPaymentStatus = "unpaid";
    }

    await prisma.sale.update({
      where: { id: saleId },
      data: { paymentStatus: newPaymentStatus },
    });

    return NextResponse.json({ payment }, { status: 201 });
  } catch (error) {
    console.error("Error adding payment:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal menambah pembayaran" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const saleId = searchParams.get("id");

  if (!saleId) {
    return NextResponse.json({ error: "Sale ID is required" }, { status: 400 });
  }

  try {
    // Check if sale exists
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: { items: true, payments: true },
    });

    if (!sale) {
      return NextResponse.json({ error: "Transaksi tidak ditemukan" }, { status: 404 });
    }

    // Check if there are payments - prevent deletion if there are payments
    if (sale.payments.length > 0) {
      return NextResponse.json({ error: "Tidak dapat menghapus transaksi yang sudah memiliki pembayaran" }, { status: 400 });
    }

    // Delete related records first (cascade delete)
    // Delete sale items
    await prisma.saleItem.deleteMany({
      where: { saleId },
    });

    // Delete stock movements related to this sale
    await prisma.stockMovement.deleteMany({
      where: {
        note: { contains: sale.invoiceNumber },
      },
    });

    // Delete the sale
    await prisma.sale.delete({
      where: { id: saleId },
    });

    return NextResponse.json({ message: "Transaksi berhasil dihapus" }, { status: 200 });
  } catch (error) {
    console.error("Error deleting sale:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal menghapus transaksi" },
      { status: 500 }
    );
  }
}
