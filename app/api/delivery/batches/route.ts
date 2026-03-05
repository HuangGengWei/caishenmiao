import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: 获取所有交割单批次（书架用）
export async function GET() {
  try {
    const batches = await prisma.deliveryBatch.findMany({
      include: {
        records: {
          select: { date: true, amount: true, direction: true, fee: true, tax: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const result = batches.map((b) => {
      const dates = b.records.map((r) => r.date.toISOString().slice(0, 10));
      const minDate = dates.length ? dates.reduce((a, c) => (a < c ? a : c)) : null;
      const maxDate = dates.length ? dates.reduce((a, c) => (a > c ? a : c)) : null;
      const buyAmount = b.records.filter((r) => r.direction === "买").reduce((s, r) => s + r.amount, 0);
      const sellAmount = b.records.filter((r) => r.direction === "卖").reduce((s, r) => s + r.amount, 0);

      return {
        id: b.id,
        name: b.name,
        sourceFileName: b.sourceFileName,
        createdAt: b.createdAt.toISOString(),
        recordCount: b.records.length,
        dateRange: minDate && maxDate ? { min: minDate, max: maxDate } : null,
        buyAmount,
        sellAmount,
      };
    });

    // 未分组的记录（batchId 为 null）
    const ungrouped = await prisma.deliveryRecord.findMany({
      where: { batchId: null },
      select: { date: true, amount: true, direction: true },
    });
    if (ungrouped.length > 0) {
      const dates = ungrouped.map((r) => r.date.toISOString().slice(0, 10));
      result.push({
        id: 0,
        name: "历史导入",
        sourceFileName: null,
        createdAt: null,
        recordCount: ungrouped.length,
        dateRange: {
          min: dates.reduce((a, c) => (a < c ? a : c)),
          max: dates.reduce((a, c) => (a > c ? a : c)),
        },
        buyAmount: ungrouped.filter((r) => r.direction === "买").reduce((s, r) => s + r.amount, 0),
        sellAmount: ungrouped.filter((r) => r.direction === "卖").reduce((s, r) => s + r.amount, 0),
      });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("GET /api/delivery/batches error:", error);
    return NextResponse.json(
      { error: error.message || "获取批次失败" },
      { status: 500 }
    );
  }
}
