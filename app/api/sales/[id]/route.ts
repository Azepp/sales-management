import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateStatusSchema = z.object({
  fulfillmentStatus: z.enum(["pending", "ready", "delivered", "cancelled"]).optional(),
  paymentStatus: z.enum(["unpaid", "dp", "paid_full"]).optional(),
  cancelReason: z.string().optional(),
});

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
    return NextResponse.json({ error: "Data status tidak valid" }, { status: 400 });
  }
  const parsed = updateStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { fulfillmentStatus, paymentStatus, cancelReason } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { id },
        include: { items: true, returns: { select: { productId: true, qty: true } } },
      });

      if (!sale) throw new SaleActionError("Transaksi tidak ditemukan", 404);

      if (fulfillmentStatus === "ready" && sale.orderType === "preorder" && sale.fulfillmentStatus === "pending") {
        for (const item of sale.items) {
          const stockUpdate = await tx.product.updateMany({
            where: { id: item.productId, stockQty: { gte: item.qty } },
            data: { stockQty: { decrement: item.qty } },
          });
          if (stockUpdate.count !== 1) {
            const product = await tx.product.findUnique({ where: { id: item.productId }, select: { name: true, stockQty: true } });
            throw new SaleActionError(`Stok ${product?.name ?? item.productId} tidak mencukupi untuk fulfillment`, 409);
          }
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              type: "out",
              qty: item.qty,
              note: `Fulfillment preorder ${sale.invoiceNumber}`,
            },
          });
        }
      }

      if (fulfillmentStatus === "cancelled" && sale.fulfillmentStatus !== "cancelled") {
        if (sale.fulfillmentStatus === "ready" || sale.fulfillmentStatus === "delivered") {
          const returnedByProduct = new Map<string, number>();
          for (const returned of sale.returns) {
            returnedByProduct.set(returned.productId, (returnedByProduct.get(returned.productId) ?? 0) + returned.qty);
          }
          const soldByProduct = new Map<string, number>();
          for (const item of sale.items) {
            soldByProduct.set(item.productId, (soldByProduct.get(item.productId) ?? 0) + item.qty);
          }
          for (const [productId, soldQty] of soldByProduct) {
            const quantityToRestore = Math.max(0, soldQty - (returnedByProduct.get(productId) ?? 0));
            if (quantityToRestore === 0) continue;
            await tx.product.update({ where: { id: productId }, data: { stockQty: { increment: quantityToRestore } } });
            await tx.stockMovement.create({
              data: {
                productId,
                type: "in",
                qty: quantityToRestore,
                note: `Cancel transaksi ${sale.invoiceNumber}: ${cancelReason || "Dibatalkan"}`,
              },
            });
          }
        } else if (sale.fulfillmentStatus === "pending" && sale.orderType === "preorder") {
        }
      }

      const updateData: Record<string, unknown> = {};
      if (fulfillmentStatus) updateData.fulfillmentStatus = fulfillmentStatus;
      if (paymentStatus) updateData.paymentStatus = paymentStatus;
      if (cancelReason) updateData.cancelReason = cancelReason;

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
            proofImageUrl: proofImageUrl ?? (proofFile ? `proof_${Date.now()}_${proofFile.name}` : null),
            note,
          },
        });

        const totalPaid = paidAmount + amount;
        const paymentStatus = totalPaid >= Number(sale.total) ? "paid_full" : "dp";
        await tx.sale.update({ where: { id }, data: { paymentStatus } });
        return payment;
      });

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
      });

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
      if (sale.payments.length > 0) {
        throw new SaleActionError("Tidak dapat menghapus transaksi yang sudah memiliki pembayaran", 409);
      }

      if (["ready", "delivered"].includes(sale.fulfillmentStatus)) {
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

      await tx.return.deleteMany({ where: { saleId: id } });
      await tx.saleItem.deleteMany({ where: { saleId: id } });
      await tx.stockMovement.deleteMany({ where: { note: { contains: sale.invoiceNumber } } });
      await tx.sale.delete({ where: { id } });
    });

    return NextResponse.json({ message: "Transaksi berhasil dihapus" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof SaleActionError ? error.message : "Gagal menghapus transaksi" },
      { status: error instanceof SaleActionError ? error.status : 500 }
    );
  }
}