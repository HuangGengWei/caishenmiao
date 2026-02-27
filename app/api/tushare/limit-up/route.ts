import { NextRequest, NextResponse } from "next/server";
import { getFirstLimitUpSince } from "@/lib/tushare";

/**
 * GET /api/tushare/limit-up?code=xxxxxx&recordDate=YYYY-MM-DD
 * 返回：{ limitUpDate: string | null }
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const recordDate = searchParams.get("recordDate");

  if (!code || !recordDate) {
    return NextResponse.json(
      { error: "缺少参数 code 或 recordDate" },
      { status: 400 }
    );
  }

  try {
    const limitUpDate = await getFirstLimitUpSince(code, recordDate);
    return NextResponse.json({ limitUpDate });
  } catch (error: any) {
    console.error(
      `GET /api/tushare/limit-up [${code} ${recordDate}] error:`,
      error
    );
    return NextResponse.json(
      { error: error?.message || "获取涨停数据失败" },
      { status: 500 }
    );
  }
}

