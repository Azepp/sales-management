const rupiahNumberFormat = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const rupiahCurrencyFormat = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
});

export function parseRupiah(value: string): number {
    return Number.parseInt(value.replace(/\D/g, ""), 10) || 0;
}

export function formatRupiahInput(value: string): string {
    const numericValue = value.replace(/\D/g, "");
    return numericValue ? rupiahNumberFormat.format(Number(numericValue)) : "";
}

export function formatCurrency(value: number): string {
    return rupiahCurrencyFormat.format(value);
}