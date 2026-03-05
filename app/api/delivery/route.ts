import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { DeliveryRecord } from "@/lib/types";

// GET: 获取交割单记录（支持日期范围、batchId 筛选）
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const batchIdParam = searchParams.get("batchId");

    const where: any = {};
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to);
    }
    if (batchIdParam !== null && batchIdParam !== undefined) {
      const bid = parseInt(batchIdParam, 10);
      if (!isNaN(bid)) {
        where.batchId = bid === 0 ? null : bid;
      }
    }

    const records = await prisma.deliveryRecord.findMany({
      where,
      orderBy: { date: "desc" },
    });

    const formatted = records.map((r) => ({
      id: r.id,
      batchId: r.batchId ?? undefined,
      date: r.date.toISOString().slice(0, 10),
      code: r.code,
      name: r.name,
      direction: r.direction === "买" ? "买" : "卖",
      quantity: r.quantity,
      price: r.price,
      amount: r.amount,
      fee: r.fee,
      tax: r.tax,
      remark: r.remark,
    }));

    return NextResponse.json(formatted);
  } catch (error: any) {
    console.error("GET /api/delivery error:", error);
    return NextResponse.json(
      { error: error.message || "获取交割单失败" },
      { status: 500 }
    );
  }
}

// POST: 批量添加交割单记录（创建新批次）
export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const body = Array.isArray(raw) ? raw : raw.records ?? raw;
    const batchName = Array.isArray(raw) ? null : (raw.batchName ?? raw.batch_name ?? null);
    const fileName = Array.isArray(raw) ? null : (raw.sourceFileName ?? raw.fileName ?? raw.file_name ?? null);

    if (!Array.isArray(body) || body.length === 0) {
      return NextResponse.json({ error: "数据格式错误：需要非空数组" }, { status: 400 });
    }

    const records = body.map((r: any) => {
      const dateObj = new Date(r.date);
      if (isNaN(dateObj.getTime())) throw new Error(`无效日期: ${r.date}`);
      if (!r.code || !r.name) throw new Error("code、name 不能为空");
      if (r.direction !== "买" && r.direction !== "卖") throw new Error("direction 须为 买 或 卖");

      return {
        date: dateObj,
        code: String(r.code).substring(0, 16),
        name: String(r.name).substring(0, 64),
        direction: r.direction,
        quantity: Math.round(Number(r.quantity)) || 0,
        price: Number(r.price) || 0,
        amount: Number(r.amount) || 0,
        fee: r.fee != null ? Number(r.fee) : null,
        tax: r.tax != null ? Number(r.tax) : null,
        remark: r.remark != null ? String(r.remark).substring(0, 255) : null,
      };
    });

    const name =
      batchName ||
      fileName?.replace(/\.csv$/i, "") ||
      `交割单 ${new Date().toISOString().slice(0, 10)}`;

    const batch = await prisma.deliveryBatch.create({
      data: {
        name,
        sourceFileName: fileName ?? null,
      },
    });

    const data = records.map((r) => ({ ...r, batchId: batch.id }));
    await prisma.deliveryRecord.createMany({ data });

    return NextResponse.json({
      success: true,
      count: data.length,
      batchId: batch.id,
      batchName: batch.name,
    });
  } catch (error: any) {
    console.error("POST /api/delivery error:", error);
    return NextResponse.json(
      { error: error.message || "保存交割单失败" },
      { status: 500 }
    );
  }
}

// DELETE: 清空所有交割单记录
export async function DELETE(req: NextRequest) {
  try {
    await prisma.deliveryRecord.deleteMany({});
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/delivery error:", error);
    return NextResponse.json(
      { error: error.message || "清空失败" },
      { status: 500 }
    );
  }
}
