import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const productSchema = z.object({
  name: z.string().trim().min(1, "Nama produk wajib diisi").max(120),
  sku: z.string().trim().max(80).transform((value) => value || null).optional(),
  unit: z.string().max(32).optional(),
  costPrice: z.number().finite().min(0, "Harga modal tidak boleh negatif").max(1_000_000_000_000),
  sellPrice: z.number().finite().min(0, "Harga jual tidak boleh negatif").max(1_000_000_000_000),
  minStock: z.number().int().min(0).max(1_000_000).default(5),
  isActive: z.boolean().default(true),
});

const updateProductSchema = productSchema.partial().extend({
  initialStock: z.number().int().min(0).max(1_000_000).optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      stockMovements: { orderBy: { date: "desc" }, take: 50 },
    },
  });

  if (!product) {
    return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });
  }

  return NextResponse.json(product);
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
    return NextResponse.json({ error: "Data produk tidak valid" }, { status: 400 });
  }
  const parsed = updateProductSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { initialStock, ...productData } = parsed.data;
  const product = await prisma.$transaction(async (tx) => {
    const existing = await tx.product.findUnique({ where: { id } });
    if (!existing) return null;

    const updated = await tx.product.update({ where: { id }, data: productData });
    if (initialStock !== undefined && initialStock !== existing.stockQty) {
      const type = initialStock > existing.stockQty ? "in" : "out";
      await tx.product.update({ where: { id }, data: { stockQty: initialStock } });
      await tx.stockMovement.create({
        data: {
          productId: id,
          type,
          qty: Math.abs(initialStock - existing.stockQty),
          note: "Penyesuaian stok dari edit produk",
        },
      });
    }
    return updated;
  });

  if (!product) return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });

  return NextResponse.json(product);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    await prisma.product.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2003") {
      return NextResponse.json(
        { error: "Produk memiliki riwayat transaksi atau mutasi dan tidak dapat dihapus." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Gagal menghapus produk" }, { status: 500 });
  }
}