import { createClient } from "@/lib/supabase/server";
import { uploadPaymentProof } from "@/lib/supabase/storage";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";

const saleItemInputSchema = z.object({
  productId: z.string().min(1),
  qty: z.number().int().min(1).max(100000),
  priceAtSale: z.number().finite().min(0).max(1_000_000_000_000),
});

const updateSaleSchema = z
  .object({
    fulfillmentStatus: z.enum(["pending", "ready", "delivered", "cancelled"]).optional(),
    paymentStatus: z.enum(["unpaid", "dp", "paid_full"]).optional(),
    cancelReason: z.string().max(500).optional(),
    customerName: z.string().trim().min(1, "Nama customer wajib diisi").max(120).optional(),
    orderType: z.enum(["regular", "preorder"]).optional(),
    note: z.string().max(2000).nullable().optional(),
    discountType: z.enum(["percent", "fixed"]).nullable().optional(),
    discountValue: z.number().finite().min(0).max(1_000_000_000_000).nullable().optional(),
    items: z.array(saleItemInputSchema).min(1, "Minimal 1 item").max(100).optional(),
  })
  .superRefine((data, context) => {
    if (data.discountType === "percent" && (data.discountValue ?? 0) > 100) {
      context.addIssue({ code: "custom", path: ["discountValue"], message: "Diskon persen maksimal 100%" });
    }
  });

async function wasStockDeducted(
  tx: Prisma.TransactionClient,
  sale: { invoiceNumber: string; orderType: string; fulfillmentStatus: string }
): Promise<boolean> {
  if (sale.fulfillmentStatus === "cancelled") return false;
  if (sale.orderType === "regular") return true;
  if (sale.fulfillmentStatus === "pending") {
    const movement = await tx.stockMovement.findFirst({
      where: { type: "out", note: { contains: sale.invoiceNumber } },
      select: { id: true },
    });
    return Boolean(movement);
  }
  return true;
}

const proofImageUrlSchema = z.string().url().refine((value) => new URL(value).protocol === "https:", "Tautan bukti harus menggunakan HTTPS");

const paymentSchema = z.object({
  amount: z.number().finite().min(1).max(1_000_000_000_000),
  method: z.enum(["cash", "transfer", "qris", "lainnya"]),
  proofFile: z.instanceof(File)
    .refine((file) => file.size <= 5 * 1024 * 1024, "Ukuran bukti pembayaran maksimal 5 MB")
    .refine((file) => ["image/jpeg", "image/png", "application/pdf"].includes(file.type), "Bukti harus berupa JPG, PNG, atau PDF")
    .optional(),
  proofImageUrl: proofImageUrlSchema.optional(),
  note: z.string().max(500).optional(),
});

const returnSchema = z.object({
  productId: z.string().min(1),
  qty: z.number().int().min(1).max(100000),
  reason: z.string().trim().min(1, "Alasan retur wajib diisi").max(500),
  refundAmount: z.number().finite().min(0).max(1_000_000_000_000),
});

class SaleActionError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const sale = await prisma.sale.findUnique({
    where: { id },
    include: {
      items: { include: { product: { select: { name: true, sku: true, costPrice: true } } } },
      payments: { orderBy: { date: "desc" } },
      returns: { include: { product: { select: { name: true } } } },
    },
  });

  if (!sale) {
    return NextResponse.json({ error: "Transaksi tidak ditemukan" }, { status: 404 });
  }

  const paidAmount = sale.payments.reduce((sum, p) => sum + Number(p.amount), 0);

  return NextResponse.json({ ...sale, paidAmount });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Data transaksi tidak valid" }, { status: 400 });
  }
  const parsed = updateSaleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { fulfillmentStatus, paymentStatus, cancelReason, customerName, orderType, note, discountType, discountValue, items } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { id },
        include: {
          items: true,
          returns: { select: { productId: true, qty: true } },
          payments: { select: { amount: true } },
        },
      });

      if (!sale) throw new SaleActionError("Transaksi tidak ditemukan", 404);

      if (items) {
        for (const item of items) {
          const product = await tx.product.findUnique({ where: { id: item.productId }, select: { name: true } });
          if (!product) throw new SaleActionError("Produk yang dipilih tidak ditemukan", 404);
        }
      }

      let newFulfillmentStatus = fulfillmentStatus ?? sale.fulfillmentStatus;
      if (orderType !== undefined && orderType !== sale.orderType && orderType === "regular" && newFulfillmentStatus === "pending") {
        newFulfillmentStatus = "ready";
      }

      const oldQtyByProduct = new Map<string, number>();
      for (const item of sale.items) {
        oldQtyByProduct.set(item.productId, (oldQtyByProduct.get(item.productId) ?? 0) + item.qty);
      }

      const newItems = items ?? sale.items.map((item) => ({ productId: item.productId, qty: item.qty, priceAtSale: Number(item.priceAtSale) }));
      const newQtyByProduct = new Map<string, number>();
      for (const item of newItems) {
        newQtyByProduct.set(item.productId, (newQtyByProduct.get(item.productId) ?? 0) + item.qty);
      }

      const returnedQtyByProduct = new Map<string, number>();
      for (const returned of sale.returns) {
        returnedQtyByProduct.set(returned.productId, (returnedQtyByProduct.get(returned.productId) ?? 0) + returned.qty);
      }

      if (items) {
        for (const [productId, returnedQty] of returnedQtyByProduct) {
          if ((newQtyByProduct.get(productId) ?? 0) < returnedQty) {
            const product = await tx.product.findUnique({ where: { id: productId }, select: { name: true } });
            throw new SaleActionError(`Qty ${product?.name ?? productId} tidak boleh lebih kecil dari jumlah yang sudah diretur`, 409);
          }
        }
      }

      const wasDeducted = await wasStockDeducted(tx, sale);
      const willDeduct =
        newFulfillmentStatus === "cancelled" ? false : newFulfillmentStatus === "pending" ? wasDeducted : true;
      const becameCancelled = newFulfillmentStatus === "cancelled" && sale.fulfillmentStatus !== "cancelled";
      const becameReady = newFulfillmentStatus === "ready" && sale.fulfillmentStatus === "pending";

      for (const productId of new Set([...oldQtyByProduct.keys(), ...newQtyByProduct.keys()])) {
        const oldQty = wasDeducted ? oldQtyByProduct.get(productId) ?? 0 : 0;
        const newQty = willDeduct ? newQtyByProduct.get(productId) ?? 0 : 0;
        const stockChange =
          wasDeducted && !willDeduct
            ? Math.max(0, oldQty - (returnedQtyByProduct.get(productId) ?? 0))
            : oldQty - newQty;

        if (stockChange > 0) {
          await tx.product.update({ where: { id: productId }, data: { stockQty: { increment: stockChange } } });
        } else if (stockChange < 0) {
          const needed = Math.abs(stockChange);
          const stockUpdate = await tx.product.updateMany({
            where: { id: productId, stockQty: { gte: needed } },
            data: { stockQty: { decrement: needed } },
          });
          if (stockUpdate.count !== 1) {
            const product = await tx.product.findUnique({ where: { id: productId }, select: { name: true, stockQty: true } });
            throw new SaleActionError(`Stok ${product?.name ?? productId} tidak mencukupi (tersedia: ${product?.stockQty ?? 0})`, 409);
          }
        }
      }

      const itemsChanged =
        oldQtyByProduct.size !== newQtyByProduct.size || [...oldQtyByProduct].some(([productId, qty]) => newQtyByProduct.get(productId) !== qty);

      if (willDeduct && (itemsChanged || becameReady || !wasDeducted)) {
        await tx.stockMovement.deleteMany({
          where: { note: { in: [`Penjualan ${sale.invoiceNumber}`, `Fulfillment preorder ${sale.invoiceNumber}`] } },
        });
        for (const [productId, qty] of newQtyByProduct) {
          await tx.stockMovement.create({
            data: {
              productId,
              type: "out",
              qty,
              note: `Penjualan ${sale.invoiceNumber}`,
            },
          });
        }
      }

      if (becameCancelled && wasDeducted) {
        for (const [productId, qty] of oldQtyByProduct) {
          const quantityToRestore = Math.max(0, qty - (returnedQtyByProduct.get(productId) ?? 0));
          if (quantityToRestore === 0) continue;
          await tx.stockMovement.create({
            data: {
              productId,
              type: "in",
              qty: quantityToRestore,
              note: `Cancel transaksi ${sale.invoiceNumber}: ${cancelReason || "Dibatalkan"}`,
            },
          });
        }
      }

      const totalsChanged = items !== undefined || discountType !== undefined || discountValue !== undefined;
      let subtotalFinal = Number(sale.subtotal);
      let discountTypeFinal: string | null = sale.discountType;
      let discountValueFinal: number | null = sale.discountValue !== null ? Number(sale.discountValue) : null;
      if (totalsChanged) {
        subtotalFinal = newItems.reduce((sum, item) => sum + item.priceAtSale * item.qty, 0);
        if (discountType !== undefined) discountTypeFinal = discountType;
        if (discountValue !== undefined) discountValueFinal = discountValue;
      }
      const discountAmountFinal =
        !discountTypeFinal || !discountValueFinal
          ? 0
          : discountTypeFinal === "percent"
            ? Math.round(subtotalFinal * (discountValueFinal / 100))
            : Math.min(discountValueFinal, subtotalFinal);
      const totalFinal = subtotalFinal - discountAmountFinal;
      const totalChanged = totalsChanged && totalFinal !== Number(sale.total);

      const paidAmount = sale.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
      if (totalChanged && paidAmount > totalFinal) {
        throw new SaleActionError("Total baru lebih kecil dari jumlah yang sudah dibayar", 409);
      }

      const updateData: Record<string, unknown> = {};
      if (newFulfillmentStatus !== sale.fulfillmentStatus) updateData.fulfillmentStatus = newFulfillmentStatus;
      if (cancelReason) updateData.cancelReason = cancelReason;
      if (customerName !== undefined) updateData.customerName = customerName;
      if (orderType !== undefined) updateData.orderType = orderType;
      if (note !== undefined) updateData.note = note;
      if (totalsChanged) {
        updateData.subtotal = subtotalFinal;
        updateData.discountType = discountTypeFinal;
        updateData.discountValue = discountValueFinal;
        updateData.discountAmount = discountAmountFinal;
        updateData.total = totalFinal;
      }

      const finalPaymentStatus =
        paymentStatus ??
        (totalsChanged ? (paidAmount >= totalFinal ? "paid_full" : paidAmount > 0 ? "dp" : "unpaid") : undefined);
      if (finalPaymentStatus) updateData.paymentStatus = finalPaymentStatus;

      if (items) {
        await tx.saleItem.deleteMany({ where: { saleId: id } });
        await tx.saleItem.createMany({
          data: newItems.map((item) => ({
            saleId: id,
            productId: item.productId,
            qty: item.qty,
            priceAtSale: item.priceAtSale,
            subtotal: item.priceAtSale * item.qty,
          })),
        });
      }

      const updated = await tx.sale.update({
        where: { id },
        data: updateData,
        include: {
          items: { include: { product: true } },
          payments: true,
          returns: true,
        },
      });

      return updated;
    }, { maxWait: 10000, timeout: 15000 });

    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof SaleActionError ? error.status : 500;
    return NextResponse.json(
      { error: error instanceof SaleActionError ? error.message : "Gagal memperbarui transaksi" },
      { status }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 6 * 1024 * 1024) {
    return NextResponse.json({ error: "Ukuran permintaan maksimal 6 MB" }, { status: 413 });
  }

  if (action === "payment") {
    let body: unknown;
    try {
      if (request.headers.get("content-type")?.includes("multipart/form-data")) {
        const formData = await request.formData();
        const proofFile = formData.get("proofFile");
        body = {
          amount: Number(formData.get("amount")),
          method: String(formData.get("method") ?? "cash"),
          note: String(formData.get("note") ?? ""),
          proofFile: proofFile instanceof File && proofFile.size > 0 ? proofFile : undefined,
        };
      } else {
        body = await request.json();
      }
    } catch {
      return NextResponse.json({ error: "Data pembayaran tidak valid" }, { status: 400 });
    }

    const parsed = paymentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { amount, method, proofImageUrl, proofFile, note } = parsed.data;

    let uploadedProofUrl: string | null = null;
    if (proofFile) {
      uploadedProofUrl = await uploadPaymentProof(proofFile);
      if (!uploadedProofUrl) {
        return NextResponse.json({ error: "Gagal mengunggah bukti pembayaran" }, { status: 500 });
      }
    }

    try {
      const payment = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Sale" WHERE "id" = ${id} FOR UPDATE`;
        const sale = await tx.sale.findUnique({
          where: { id },
          include: { payments: true },
        });
        if (!sale) throw new SaleActionError("Transaksi tidak ditemukan", 404);

        const paidAmount = sale.payments.reduce((sum, item) => sum + Number(item.amount), 0);
        const remainingAmount = Number(sale.total) - paidAmount;
        if (amount > remainingAmount) throw new SaleActionError("Jumlah melebihi sisa yang harus dibayar", 409);

        const payment = await tx.payment.create({
          data: {
            saleId: id,
            amount,
            method,
            proofImageUrl: proofImageUrl ?? uploadedProofUrl,
            note,
          },
        });

        const totalPaid = paidAmount + amount;
        const paymentStatus = totalPaid >= Number(sale.total) ? "paid_full" : "dp";
        await tx.sale.update({ where: { id }, data: { paymentStatus } });
        return payment;
      }, { maxWait: 10000, timeout: 15000 });

      return NextResponse.json(payment, { status: 201 });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof SaleActionError ? error.message : "Gagal menambah pembayaran" },
        { status: error instanceof SaleActionError ? error.status : 500 }
      );
    }
  }

  if (action === "return") {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Data retur tidak valid" }, { status: 400 });
    }
    const parsed = returnSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { productId, qty, reason, refundAmount } = parsed.data;

    try {
      const result = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Sale" WHERE "id" = ${id} FOR UPDATE`;
        const sale = await tx.sale.findUnique({
          where: { id },
          include: { items: true },
        });

        if (!sale) throw new SaleActionError("Transaksi tidak ditemukan", 404);
        if (sale.fulfillmentStatus !== "delivered") {
          throw new SaleActionError("Retur hanya dapat diproses setelah transaksi diambil", 409);
        }

        const soldQty = sale.items.filter((item) => item.productId === productId).reduce((sum, item) => sum + item.qty, 0);
        if (soldQty === 0) throw new SaleActionError("Item tidak ditemukan di transaksi ini", 404);

        const existingReturns = await tx.return.aggregate({
          where: { saleId: id, productId },
          _sum: { qty: true },
        });
        const returnedQty = existingReturns._sum.qty || 0;
        if (returnedQty + qty > soldQty) {
          throw new SaleActionError("Qty retur melebihi qty terjual", 409);
        }

        const returnRecord = await tx.return.create({
          data: { saleId: id, productId, qty, reason, refundAmount },
        });

        await tx.product.update({
          where: { id: productId },
          data: { stockQty: { increment: qty } },
        });
        await tx.stockMovement.create({
          data: {
            productId,
            type: "in",
            qty,
            note: `Retur ${sale.invoiceNumber}: ${reason}`,
          },
        });

        return returnRecord;
      }, { maxWait: 10000, timeout: 15000 });

      return NextResponse.json(result, { status: 201 });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof SaleActionError ? error.message : "Gagal memproses retur" },
        { status: error instanceof SaleActionError ? error.status : 500 }
      );
    }
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Sale" WHERE "id" = ${id} FOR UPDATE`;
      const sale = await tx.sale.findUnique({
        where: { id },
        include: { items: true, payments: true, returns: { select: { productId: true, qty: true } } },
      });
      if (!sale) throw new SaleActionError("Transaksi tidak ditemukan", 404);

      if (await wasStockDeducted(tx, sale)) {
        const returnedByProduct = new Map<string, number>();
        const soldByProduct = new Map<string, number>();
        for (const returned of sale.returns) {
          returnedByProduct.set(returned.productId, (returnedByProduct.get(returned.productId) ?? 0) + returned.qty);
        }
        for (const item of sale.items) {
          soldByProduct.set(item.productId, (soldByProduct.get(item.productId) ?? 0) + item.qty);
        }
        for (const [productId, soldQty] of soldByProduct) {
          const stockToRestore = Math.max(0, soldQty - (returnedByProduct.get(productId) ?? 0));
          if (stockToRestore > 0) await tx.product.update({ where: { id: productId }, data: { stockQty: { increment: stockToRestore } } });
        }
      }

      await tx.payment.deleteMany({ where: { saleId: id } });
      await tx.return.deleteMany({ where: { saleId: id } });
      await tx.saleItem.deleteMany({ where: { saleId: id } });
      await tx.stockMovement.deleteMany({ where: { note: { contains: sale.invoiceNumber } } });
      await tx.sale.delete({ where: { id } });
    }, { maxWait: 10000, timeout: 15000 });

    return NextResponse.json({ message: "Transaksi berhasil dihapus" });
  } catch (error) {
    if (!(error instanceof SaleActionError)) console.error("Error deleting sale:", error);
    return NextResponse.json(
      { error: error instanceof SaleActionError ? error.message : "Gagal menghapus transaksi" },
      { status: error instanceof SaleActionError ? error.status : 500 }
    );
  }
}