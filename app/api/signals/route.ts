import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { SignalRecord } from "@/lib/types";

// GET: 获取所有信号记录（支持日期范围筛选）
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from"); // YYYY-MM-DD
    const to = searchParams.get("to"); // YYYY-MM-DD

    const where: any = {};
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to);
    }

    console.log("GET /api/signals - 查询条件:", where);

    const records = await prisma.signalRecord.findMany({
      where,
      orderBy: { date: "desc" },
    });

    console.log("GET /api/signals - 查询到记录数:", records.length);

    // 转换为前端需要的格式
    const formatted: SignalRecord[] = records.map((r) => {
      let reason: string[] = [];
      try {
        reason = JSON.parse(r.reason || "[]");
        if (!Array.isArray(reason)) {
          reason = [];
        }
      } catch (parseError) {
        console.warn("解析 reason 字段失败:", r.reason, parseError);
        reason = [];
      }

      return {
        date: r.date.toISOString().slice(0, 10),
        code: r.code,
        name: r.name,
        sector: r.sector ? r.sector.split("、").filter(Boolean) : [],
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
    console.error("GET /api/signals error:", error);
    console.error("错误详情:", {
      message: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack,
    });
    
    // 提供更详细的错误信息
    let errorMessage = error.message || "获取数据失败";
    
    if (error.code === 'P1001') {
      errorMessage = "无法连接到数据库，请检查数据库配置";
    } else if (error.code === 'P2025') {
      errorMessage = "记录不存在";
    } else if (error.code === 'P2002') {
      errorMessage = "数据唯一性冲突";
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: error.code,
        meta: error.meta,
      },
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
      if (!r.date || !r.code || !r.name) {
        return NextResponse.json(
          { error: `数据格式错误：缺少必要字段 (date, code, name)` },
          { status: 400 }
        );
      }
      if (!Array.isArray(r.sector)) {
        return NextResponse.json(
          { error: `数据格式错误：sector 必须是数组` },
          { status: 400 }
        );
      }
      if (!Array.isArray(r.reason)) {
        return NextResponse.json(
          { error: `数据格式错误：reason 必须是数组` },
          { status: 400 }
        );
      }
    }

    const data = body.map((r) => {
      // 验证并转换日期
      const dateObj = new Date(r.date);
      if (isNaN(dateObj.getTime())) {
        throw new Error(`无效的日期格式: ${r.date}`);
      }

      // 确保 score 是整数
      const score = Math.round(Number(r.score)) || 0;
      if (score < 0 || score > 100) {
        throw new Error(`score 必须在 0-100 之间，当前值: ${r.score}`);
      }

      // 确保字符串长度不超过数据库限制
      const sectorStr = r.sector.join("、");
      if (sectorStr.length > 255) {
        throw new Error(`sector 字符串过长 (${sectorStr.length} > 255)`);
      }

      // 验证 code 和 name 不为空
      if (!r.code || !r.name) {
        throw new Error(`code 和 name 不能为空`);
      }

      return {
        date: dateObj,
        code: r.code.substring(0, 16), // 限制长度
        name: r.name.substring(0, 64), // 限制长度
        sector: sectorStr,
        sectorPattern: r.sector_pattern ? r.sector_pattern.substring(0, 32) : null,
        turnover: r.turnover != null ? Number(r.turnover) : null,
        chg: r.chg != null ? Number(r.chg) : null,
        amount: r.amount != null ? Number(r.amount) : null,
        debtRatio: r.debt_ratio != null ? Number(r.debt_ratio) : null,
        score: score, // 确保是整数
        reason: JSON.stringify(r.reason || []),
      };
    });

    // 添加调试日志
    console.log("准备保存数据，记录数:", data.length);
    console.log("第一条数据示例:", JSON.stringify(data[0], null, 2));

    await prisma.signalRecord.createMany({ data });

    return NextResponse.json({ success: true, count: data.length });
  } catch (error: any) {
    console.error("POST /api/signals error:", error);
    console.error("错误详情:", {
      message: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack,
    });
    
    // 提供更详细的错误信息
    let errorMessage = error.message || "保存数据失败";
    
    if (error.code === 'P2002') {
      errorMessage = "数据已存在（唯一约束冲突）";
    } else if (error.code === 'P2003') {
      errorMessage = "外键约束失败";
    } else if (error.code === 'P2011') {
      errorMessage = "空值违反非空约束";
    } else if (error.code === 'P2012') {
      errorMessage = "缺少必需字段";
    }
    
    return NextResponse.json(
      { 
        error: errorMessage, 
        details: error.code,
        meta: error.meta,
      },
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
