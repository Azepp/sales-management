import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const stockMovementSchema = z.object({
  productId: z.string(),
  type: z.enum(["in", "out"]),
  qty: z.number().int().min(1, "Qty minimal 1"),
  note: z.string().optional(),
});

class StockMovementError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("productId");

  const where = productId ? { productId } : {};
  const movements = await prisma.stockMovement.findMany({
    where,
    orderBy: { date: "desc" },
    include: { product: { select: { name: true, sku: true } } },
  });

  return NextResponse.json(movements);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Data mutasi stok tidak valid" }, { status: 400 });
  }
  const parsed = stockMovementSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { productId, type, qty, note } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: productId }, select: { id: true, stockQty: true, unit: true } });
      if (!product) throw new StockMovementError("Produk tidak ditemukan", 404);

      const stockUpdate = await tx.product.updateMany({
        where: { id: productId, ...(type === "out" ? { stockQty: { gte: qty } } : {}) },
        data: { stockQty: { increment: type === "in" ? qty : -qty } },
      });
      if (stockUpdate.count !== 1) {
        const currentProduct = await tx.product.findUnique({ where: { id: productId }, select: { stockQty: true, unit: true } });
        throw new StockMovementError(`Stok tidak mencukupi. Tersedia ${currentProduct?.stockQty ?? 0} ${currentProduct?.unit || product.unit || "unit"}.`, 409);
      }

      return tx.stockMovement.create({
        data: { productId, type, qty, note },
        include: { product: true },
      });
    }, { maxWait: 10000, timeout: 15000 });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof StockMovementError ? error.message : "Gagal memperbarui stok";
    const status = error instanceof StockMovementError ? error.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}