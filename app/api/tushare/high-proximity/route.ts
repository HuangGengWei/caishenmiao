import { NextRequest, NextResponse } from "next/server";
import { getHighProximity } from "@/lib/tushare";

/**
 * GET /api/tushare/high-proximity?code=xxxxxx
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json(
      { error: "缺少参数 code（6位股票代码）" },
      { status: 400 }
    );
  }

  try {
    const result = await getHighProximity(code);
    if (!result) {
      return NextResponse.json(
        { error: `未获取到 ${code} 的前高点数据或日线不足` },
        { status: 404 }
      );
    }
    return NextResponse.json(result);
  } catch (error: any) {
    console.error(`GET /api/tushare/high-proximity [${code}] error:`, error);
    return NextResponse.json(
      { error: error.message || "获取前高点接近度失败" },
      { status: 500 }
    );
  }
}