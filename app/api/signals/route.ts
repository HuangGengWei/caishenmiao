import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { SignalRecord } from "@/lib/types";

function isDatabaseUnreachable(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: string; code?: string; message?: string };
  if (e.code === "P1001") return true;
  if (e.name === "PrismaClientInitializationError") return true;
  const msg = String(e.message ?? "");
  return /Can't reach database|ECONNREFUSED|P1001|数据库服务器/i.test(msg);
}

// GET: 获取所有信号记录
export async function GET(req: NextRequest) {
  try {
    const records = await prisma.signalRecord.findMany({
      orderBy: { date: "desc" },
    });

    // 转换为前端新格式：stock = code + name, tags = sector + concept
    const formatted: SignalRecord[] = records.map((r) => {
      let reason: string[] = [];
      try {
        reason = JSON.parse(r.reason || "[]");
        if (!Array.isArray(reason)) reason = [];
      } catch {
        reason = [];
      }

      // 合并 sector 和 concept 为 tags
      const sectorList = r.sector ? r.sector.split("、").filter(Boolean) : [];
      const conceptList = r.concept ? r.concept.split("、").filter(Boolean) : [];
      const tags = [...sectorList, ...conceptList].join(", ");

      return {
        date: r.date.toISOString().slice(0, 10),
        stock: `${r.code} ${r.name}`,
        tags,
        sector_pattern:
          (r.sectorPattern === "水下拉水上" || r.sectorPattern === "波动三角收窄"
            ? r.sectorPattern
            : null) as "水下拉水上" | "波动三角收窄" | null,
        turnover: r.turnover,
        chg: r.chg,
        amount: r.amount,
        debt_ratio: r.debtRatio,
        score: r.score,
        reason,
      };
    });

    return NextResponse.json(formatted);
  } catch (error: any) {
    if (isDatabaseUnreachable(error)) {
      return NextResponse.json(
        { error: "无法连接到数据库服务器" },
        { status: 503 }
      );
    }

    console.error("GET /api/signals error:", error?.message ?? error);
    return NextResponse.json(
      { error: error.message || "获取数据失败" },
      { status: 500 }
    );
  }
}

// POST: 添加新的信号记录（批量）
export async function POST(req: NextRequest) {
  try {
    const body: SignalRecord[] = await req.json();

    if (!Array.isArray(body) || body.length === 0) {
      return NextResponse.json({ error: "数据格式错误：需要非空数组" }, { status: 400 });
    }

    // 验证数据格式
    for (const r of body) {
      if (!r.stock) {
        return NextResponse.json(
          { error: "数据格式错误：缺少 stock 字段" },
          { status: 400 }
        );
      }
      if (!Array.isArray(r.reason)) {
        return NextResponse.json(
          { error: "数据格式错误：reason 必须是数组" },
          { status: 400 }
        );
      }
    }

    const data = body.map((r) => {
      // 从 stock 字段解析 code 和 name
      const parts = r.stock.trim().split(/\s+/);
      const code = parts[0]?.replace(/[^\d]/g, "").padStart(6, "0") || "";
      const name = parts.slice(1).join(" ").trim() || "";

      if (!code || !name) {
        throw new Error(`无效的 stock 格式: ${r.stock}`);
      }

      // 从 tags 字段解析 sector 和 concept
      const tagsList = (r.tags || "").split(/[,，]/).map((t) => t.trim()).filter(Boolean);
      // 简单处理：全部作为 sector，concept 为空
      const sector = tagsList.join("、");

      const score = Math.round(Number(r.score)) || 0;

      return {
        date: r.date ? new Date(r.date) : new Date(), // 使用传入日期或当前日期
        code: code.substring(0, 16),
        name: name.substring(0, 64),
        sector: sector.substring(0, 255) || "未分类",
        concept: null,
        sectorPattern: r.sector_pattern ? r.sector_pattern.substring(0, 32) : null,
        turnover: r.turnover != null ? Number(r.turnover) : null,
        chg: r.chg != null ? Number(r.chg) : null,
        amount: r.amount != null ? Number(r.amount) : null,
        debtRatio: r.debt_ratio != null ? Number(r.debt_ratio) : null,
        score: score,
        reason: JSON.stringify(r.reason || []),
      };
    });

    console.log("准备保存数据，记录数:", data.length);

    await prisma.signalRecord.createMany({ data });

    return NextResponse.json({ success: true, count: data.length });
  } catch (error: any) {
    if (isDatabaseUnreachable(error)) {
      return NextResponse.json(
        { error: "无法连接到数据库服务器" },
        { status: 503 }
      );
    }

    console.error("POST /api/signals error:", error?.message ?? error);
    return NextResponse.json(
      { error: error.message || "保存数据失败" },
      { status: 500 }
    );
  }
}

// DELETE: 清空所有记录
export async function DELETE(req: NextRequest) {
  try {
    await prisma.signalRecord.deleteMany({});
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/signals error:", error);
    return NextResponse.json(
      { error: error.message || "清空数据失败" },
      { status: 500 }
    );
  }
}