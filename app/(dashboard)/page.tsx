import { prisma } from "@/lib/prisma";
import { DashboardClient } from "./DashboardClient";

export default async function DashboardPage() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [todaySales, monthExpenses, monthCapitals, lowStockProducts, readyOrders, recentSales] = await Promise.all([
    prisma.sale.aggregate({
      where: { date: { gte: todayStart }, fulfillmentStatus: "delivered" },
      _sum: { total: true },
    }),
    prisma.expense.aggregate({
      where: { date: { gte: monthStart } },
      _sum: { amount: true },
    }),
    prisma.capital.aggregate({
      where: { date: { gte: monthStart } },
      _sum: { amount: true },
    }),
    prisma.product.findMany({
      where: { isActive: true },
      take: 50,
      orderBy: { stockQty: "asc" },
    }),
    prisma.sale.findMany({
      where: { fulfillmentStatus: "ready" },
      take: 5,
      orderBy: { date: "desc" },
      select: { id: true, invoiceNumber: true, customerName: true, total: true },
    }),
    prisma.sale.findMany({
      take: 6,
      orderBy: { date: "desc" },
      select: { id: true, invoiceNumber: true, date: true, customerName: true, total: true, paymentStatus: true, fulfillmentStatus: true },
    }),
  ]);

  const lowStock = lowStockProducts.filter((p) => p.stockQty <= p.minStock).slice(0, 5);

  const readyOrdersTyped = readyOrders.map((o) => ({ ...o, total: Number(o.total) }));
  const recentSalesTyped = recentSales.map((sale) => ({
    ...sale,
    date: sale.date.toISOString(),
    total: Number(sale.total),
  }));

  const todayRevenue = Number(todaySales._sum.total || 0);
  const monthExpenseTotal = Number(monthExpenses._sum.amount || 0);
  const monthCapitalTotal = Number(monthCapitals._sum.amount || 0);

  const monthSales = await prisma.sale.findMany({
    where: { date: { gte: monthStart }, fulfillmentStatus: "delivered" },
    include: { items: { include: { product: { select: { costPrice: true } } } }, returns: true },
  });

  let monthRevenue = 0;
  let monthCOGS = 0;
  let monthReturns = 0;
  for (const sale of monthSales) {
    monthRevenue += Number(sale.total);
    for (const item of sale.items) {
      monthCOGS += Number(item.product.costPrice) * item.qty;
    }
    for (const ret of sale.returns) {
      monthReturns += Number(ret.refundAmount);
    }
  }

  const netProfit = monthRevenue - monthCOGS - monthExpenseTotal - monthReturns;

  return (
    <DashboardClient todayRevenue={todayRevenue} monthExpenseTotal={monthExpenseTotal} monthCapitalTotal={monthCapitalTotal} netProfit={netProfit} lowStockProducts={lowStock} readyOrders={readyOrdersTyped} recentSales={recentSalesTyped} />
  );
}
