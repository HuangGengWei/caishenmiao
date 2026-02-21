import { NextRequest, NextResponse } from "next/server";

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";

function formatStockData(records: any[]): string {
  if (!records || records.length === 0) return "（当日无个股数据）";
  return records
    .map(
      (r) =>
        `- ${r.code} ${r.name} | 板块: ${(r.sector || []).join("、")} | 板块分时: ${r.sector_pattern || "-"} | 换手${r.turnover ?? "-"}% | 涨跌${r.chg != null ? r.chg + "%" : "-"} | 市值${r.amount ?? "-"}亿 | 负债率${r.debt_ratio ?? "-"}%`
    )
    .join("\n");
}

/**
 * POST /api/ai/review-suggestions
 * 复盘智囊：根据当日板块分时图、个股数据生成操作建议
 * Body: {
 *   date: string (YYYY-MM-DD),
 *   records: SignalRecord[],
 *   sectorScreenshots: { sector: string, imageDataUrl: string }[]
 * }
 */
export async function POST(req: NextRequest) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "未配置 AI API Key（OPENAI_API_KEY）" },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    const { date, records = [], sectorScreenshots = [] } = body;

    if (!date) {
      return NextResponse.json(
        { error: "缺少 date 参数" },
        { status: 400 }
      );
    }

    const stockText = formatStockData(records);
    const sectorList = [...new Set(records.flatMap((r: any) => r.sector || []))].join("、");

    const systemPrompt = `你是A股日内复盘顾问。根据用户提供的当日板块分时图与个股数据，输出可执行的次日操作建议。

规则：
1. 先看板块分时形态（水下拉水上、波动三角收窄等）判断板块强弱。
2. 结合个股：换手、涨跌、市值、负债率，区分龙头与跟风。
3. 输出格式：分条列出，每条一行或两行，每条不超过80字。标明「优先」「观察」「回避」及简要理由。
4. 禁止空洞表述，只给具体标的与理由。`;

    const dataDesc = `【${date} 复盘数据】

一、当日个股（共 ${records.length} 只）：\n${stockText}

二、涉及板块：${sectorList || "无"}

三、板块分时图：下方为各板块当日分时截图。请根据形态判断强弱，并结合个股数据给出次日操作建议（优先/观察/回避 + 理由）。`;

    const userContent: any[] = [
      {
        type: "text",
        text: dataDesc,
      },
    ];

    // 添加板块分时图片（Vision 模型可识别）
    for (const shot of sectorScreenshots) {
      if (shot.imageDataUrl && typeof shot.imageDataUrl === "string") {
        userContent.push({
          type: "image_url",
          image_url: {
            url: shot.imageDataUrl,
          },
        });
      }
    }

    const res = await fetch(OPENAI_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        stream: false,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      const errMsg =
        data?.error?.message || data?.error || JSON.stringify(data);
      return NextResponse.json(
        { error: `AI 服务异常: ${errMsg}` },
        { status: res.status }
      );
    }

    const content = data?.choices?.[0]?.message?.content ?? "";
    return NextResponse.json({ content });
  } catch (e: any) {
    console.error("POST /api/ai/review-suggestions error:", e);
    return NextResponse.json(
      { error: e?.message || "请求失败" },
      { status: 500 }
    );
  }
}
