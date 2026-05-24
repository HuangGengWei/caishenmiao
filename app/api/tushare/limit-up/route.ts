import { NextRequest, NextResponse } from "next/server";
import { getLastLimitUpDate } from "@/lib/tushare";

/**
 * GET /api/tushare/limit-up?code=xxxxxx
 * 返回：{ lastLimitUpDate: string | null }
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
    const lastLimitUpDate = await getLastLimitUpDate(code);
    return NextResponse.json({ lastLimitUpDate });
  } catch (error: any) {
    console.error(`GET /api/tushare/limit-up [${code}] error:`, error);
    return NextResponse.json(
      { error: error?.message || "获取涨停数据失败" },
      { status: 500 }
    );
  }
}