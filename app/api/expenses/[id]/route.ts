import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

function getPrismaErrorCode(error: unknown): string | null {
    if (typeof error !== "object" || error === null || !("code" in error)) return null;
    return typeof error.code === "string" ? error.code : null;
}

const expenseSchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
        const date = new Date(`${value}T00:00:00.000Z`);
        return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
    }, "Tanggal tidak valid"),
    amount: z.number().finite().min(1).max(1_000_000_000_000),
    type: z.enum(["production_material", "operational", "unclassified"]),
    note: z.string().max(2000).optional(),
});

async function isAuthenticated() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return Boolean(user);
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    if (!(await isAuthenticated())) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Data pengeluaran tidak valid" }, { status: 400 });
    }

    const parsed = expenseSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    try {
        const existing = await prisma.expense.findUnique({ where: { id } });
        if (!existing) {
            return NextResponse.json({ error: "Data pengeluaran tidak ditemukan" }, { status: 404 });
        }

        const expense = await prisma.expense.update({
            where: { id },
            data: { ...parsed.data, date: new Date(parsed.data.date) },
        });
        return NextResponse.json(expense);
    } catch (error) {
        console.error("Error updating expense:", error);
        const errorCode = getPrismaErrorCode(error);
        if (errorCode === "P2021" || errorCode === "P2022") {
            return NextResponse.json(
                { error: "Skema database belum diperbarui. Jalankan migrasi Prisma, lalu coba lagi." },
                { status: 500 }
            );
        }
        if (errorCode === "P2025") {
            return NextResponse.json({ error: "Data pengeluaran tidak ditemukan" }, { status: 404 });
        }
        if (errorCode) {
            return NextResponse.json(
                { error: `Gagal memperbarui pengeluaran (kode Prisma: ${errorCode})` },
                { status: 500 }
            );
        }
        return NextResponse.json({ error: "Gagal memperbarui pengeluaran" }, { status: 500 });
    }
}

export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    if (!(await isAuthenticated())) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const existing = await prisma.expense.findUnique({ where: { id } });
    if (!existing) {
        return NextResponse.json({ error: "Data pengeluaran tidak ditemukan" }, { status: 404 });
    }

    await prisma.expense.delete({ where: { id } });
    return NextResponse.json({ success: true });
}