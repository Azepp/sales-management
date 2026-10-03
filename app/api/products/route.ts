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

const createProductSchema = productSchema.extend({
  initialStock: z.number().int().min(0).max(1_000_000).default(0),
});

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const stockStatus = searchParams.get("stockStatus") || "";
  const isActive = searchParams.get("isActive");

  if (search.length > 120 || (stockStatus && !["low", "ok"].includes(stockStatus)) || (isActive !== null && !["true", "false"].includes(isActive))) {
    return NextResponse.json({ error: "Filter produk tidak valid" }, { status: 400 });
  }

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { sku: { contains: search, mode: "insensitive" } },
    ];
  }
  if (isActive !== null) where.isActive = isActive === "true";
  const products = await prisma.product.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      stockMovements: { orderBy: { date: "desc" }, take: 1 },
    },
  });

  const filteredProducts = products.filter((product) => {
    if (stockStatus === "low") return product.stockQty <= product.minStock;
    if (stockStatus === "ok") return product.stockQty > product.minStock;
    return true;
  });

  return NextResponse.json(filteredProducts);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Data produk tidak valid" }, { status: 400 });
  }
  const parsed = createProductSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { initialStock, ...productData } = parsed.data;
  try {
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: { ...productData, stockQty: initialStock },
      });
      if (initialStock > 0) {
        await tx.stockMovement.create({
          data: { productId: created.id, type: "in", qty: initialStock, note: "Stok awal produk" },
        });
      }
      return created;
    }, { maxWait: 10000, timeout: 15000 });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error("Error creating product:", error);
    const code = typeof error === "object" && error !== null && "code" in error ? error.code : null;
    if (code === "P2002") {
      return NextResponse.json({ error: "SKU sudah digunakan oleh produk lain." }, { status: 409 });
    }
    const message = process.env.NODE_ENV === "development" && error instanceof Error
      ? error.message
      : "Gagal menyimpan produk. Periksa log server untuk detail.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}