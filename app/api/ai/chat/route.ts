import { NextRequest, NextResponse } from "next/server";

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";

/**
 * POST /api/ai/chat
 * 代理到 OpenAI ChatGPT 接口
 * Body: { messages: [{ role: "user"|"assistant"|"system", content: string }] }
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
    const { messages } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "缺少 messages 参数" },
        { status: 400 }
      );
    }

    const res = await fetch(OPENAI_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: body.model || "gpt-4o-mini",
        messages,
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

    const content =
      data?.choices?.[0]?.message?.content ?? "";
    return NextResponse.json({ content });
  } catch (e: any) {
    console.error("POST /api/ai/chat error:", e);
    return NextResponse.json(
      { error: e?.message || "请求失败" },
      { status: 500 }
    );
  }
}
