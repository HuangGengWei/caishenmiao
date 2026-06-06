import { NextRequest, NextResponse } from "next/server";
import { getLastLimitDownDate } from "@/lib/tushare";

/**
 * GET /api/tushare/limit-down?code=xxxxxx
 * 返回：{ lastLimitDownDate: string | null }
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json(
      { error: "缺少参数 code" },
      { status: 400 }
    );
  }

  try {
    const lastLimitDownDate = await getLastLimitDownDate(code);
    return NextResponse.json({ lastLimitDownDate });
  } catch (error: any) {
    console.error(`GET /api/tushare/limit-down [${code}] error:`, error);
    return NextResponse.json(
      { error: error?.message || "获取跌停数据失败" },
      { status: 500 }
    );
  }
}