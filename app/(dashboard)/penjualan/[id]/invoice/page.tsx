import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { InvoiceView } from "./InvoiceView";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sale = await prisma.sale.findUnique({
    where: { id },
    include: {
      items: { include: { product: { select: { name: true, sku: true, costPrice: true } } } },
      payments: { orderBy: { date: "desc" } },
      returns: { include: { product: { select: { name: true } } } },
    },
  });

  if (!sale) notFound();

  const paidAmount = sale.payments.reduce((sum, p) => sum + Number(p.amount), 0);

  const saleForView = {
    ...sale,
    date: sale.date.toISOString(),
    estReadyDate: sale.estReadyDate?.toISOString() || null,
    paidAmount,
    orderType: sale.orderType as "regular" | "preorder",
    discountType: sale.discountType as "percent" | "fixed" | null,
    discountValue: sale.discountValue ? Number(sale.discountValue) : null,
    items: sale.items.map((item) => ({
      ...item,
      priceAtSale: Number(item.priceAtSale),
      subtotal: Number(item.subtotal),
      product: {
        ...item.product,
        costPrice: Number(item.product.costPrice),
      },
    })),
    payments: sale.payments.map((p) => ({
      ...p,
      amount: Number(p.amount),
      date: p.date.toISOString(),
    })),
    returns: sale.returns.map((r) => ({
      ...r,
      refundAmount: Number(r.refundAmount),
      date: r.date.toISOString(),
    })),
    subtotal: Number(sale.subtotal),
    discountAmount: Number(sale.discountAmount),
    total: Number(sale.total),
  };

  return <InvoiceView sale={saleForView} />;
}
