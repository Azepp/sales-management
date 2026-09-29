import { prisma } from "@/lib/prisma";
import { PenjualanClient } from "./PenjualanClient";

export default async function PenjualanPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const query = await searchParams;
  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: { id: true, name: true, sku: true, sellPrice: true, stockQty: true },
    orderBy: { name: "asc" },
  });

  const productsForClient = products.map((p) => ({
    ...p,
    sellPrice: Number(p.sellPrice),
  }));

  return <PenjualanClient products={productsForClient} autoOpenCreate={query.action === "new"} initialSaleId={typeof query.saleId === "string" ? query.saleId : null} />;
}
