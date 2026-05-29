import { NextRequest, NextResponse } from "next/server";
import { getDailyRange } from "@/lib/tushare";

const STOCK_AI_API_URL = process.env.STOCK_AI_API_URL || "https://api.svips.org/v1/chat/completions";

interface StockInfo {
  code: string;
  name: string;
  sector?: string[];
  concept?: string[];
}

interface MarketData {
  latestClose: number;
  latestHigh: number;
  latestLow: number;
  latestOpen: number;
  latestDate: string;
  weekChange: number;      // 近一周涨跌幅
  monthChange: number;     // 近一月涨跌幅
  weekHigh: number;       // 近一周最高价
  weekLow: number;        // 近一周最低价
  monthHigh: number;      // 近一月最高价
  monthLow: number;       // 近一月最低价
  avgVol5: number;         // 5日均量（手）
  avgVol10: number;       // 10日均量（手）
  latestVol: number;       // 最新成交量
  ma5: number | null;      // 5日均线
  ma10: number | null;     // 10日均线
  ma20: number | null;     // 20日均线
  ma30: number | null;     // 30日均线
}

/**
 * 判断股票市场：沪市(SH) 或 深市(SZ)
 */
function getMarket(code: string): "SH" | "SZ" {
  const c = code.replace(/\D/g, "").padStart(6, "0");
  return c.startsWith("6") || c.startsWith("5") ? "SH" : "SZ";
}

/**
 * 股票代码转换为ts_code格式
 */
function codeToTsCode(code: string): string {
  const pureCode = code.replace(/\D/g, "").padStart(6, "0");
  const market = getMarket(code);
  return `${pureCode}.${market}`;
}

/**
 * 获取行情数据
 */
async function fetchMarketData(code: string): Promise<MarketData | null> {
  try {
    const tsCode = codeToTsCode(code);
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - 60);  // 获取近60天数据
    
    const fmt = (d: Date) =>
      `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    
    const rows = await getDailyRange(tsCode, fmt(start), fmt(today));
    if (!rows || rows.length < 5) return null;
    
    // 按日期降序排列（最新的在前）
    const sorted = [...rows].sort((a, b) => b.trade_date.localeCompare(a.trade_date));
    
    // 最新数据
    const latest = sorted[0];
    const latestClose = latest.close;
    const latestDate = `${latest.trade_date.slice(0, 4)}-${latest.trade_date.slice(4, 6)}-${latest.trade_date.slice(6, 8)}`;
    
    // 近一周（5个交易日）
    const weekData = sorted.slice(0, Math.min(5, sorted.length));
    const weekChange = ((latestClose - weekData[weekData.length - 1].close) / weekData[weekData.length - 1].close) * 100;
    const weekHigh = Math.max(...weekData.map(d => d.high));
    const weekLow = Math.min(...weekData.map(d => d.low));
    
    // 近一月（约20个交易日）
    const monthData = sorted.slice(0, Math.min(20, sorted.length));
    const monthChange = ((latestClose - monthData[monthData.length - 1].close) / monthData[monthData.length - 1].close) * 100;
    const monthHigh = Math.max(...monthData.map(d => d.high));
    const monthLow = Math.min(...monthData.map(d => d.low));
    
    // 计算均线
    const calcMA = (days: number): number | null => {
      if (sorted.length < days) return null;
      const slice = sorted.slice(0, days);
      return Math.round((slice.reduce((s, r) => s + r.close, 0) / days) * 100) / 100;
    };
    
    // 计算成交量均线
    const calcVolMA = (days: number): number => {
      if (sorted.length < days) return 0;
      const slice = sorted.slice(0, days);
      return Math.round(slice.reduce((s, r) => s + (r.vol || 0), 0) / days);
    };
    
    return {
      latestClose,
      latestHigh: latest.high,
      latestLow: latest.low,
      latestOpen: latest.open,
      latestDate,
      weekChange: Math.round(weekChange * 100) / 100,
      monthChange: Math.round(monthChange * 100) / 100,
      weekHigh,
      weekLow,
      monthHigh,
      monthLow,
      avgVol5: calcVolMA(5),
      avgVol10: calcVolMA(10),
      latestVol: latest.vol || 0,
      ma5: calcMA(5),
      ma10: calcMA(10),
      ma20: calcMA(20),
      ma30: calcMA(30),
    };
  } catch (e) {
    console.error("fetchMarketData error:", e);
    return null;
  }
}

/**
 * 构建相关链接
 */
function buildLinks(code: string) {
  const market = getMarket(code);
  const pureCode = code.replace(/\D/g, "").padStart(6, "0");
  
  return {
    xueqiu: `https://xueqiu.com/S/${market}${pureCode}`,
    szseAnnouncement: market === "SZ" 
      ? `https://www.szse.cn/disclosure/listed/notice/index.html?stock=${pureCode}`
      : null,
    sseAnnouncement: market === "SH"
      ? `https://www.sse.com.cn/assortment/stock/list/info/company/index.shtml?COMPANY_CODE=${pureCode}`
      : null,
    sinaAnnualReport: `https://money.finance.sina.com.cn/corp/go.php/vCB_Bulletin/stockid/${pureCode}/page_type/ndbg.phtml`,
    eastmoney: `https://quote.eastmoney.com/${market}${pureCode}.html`,
  };
}

/**
 * 构建AI分析prompt
 */
function buildAnalysisPrompt(
  stock: StockInfo, 
  links: ReturnType<typeof buildLinks>,
  marketData: MarketData | null
): string {
  const market = getMarket(stock.code);
  const pureCode = stock.code.replace(/\D/g, "").padStart(6, "0");
  
  const announcementUrl = market === "SZ" 
    ? links.szseAnnouncement 
    : links.sseAnnouncement;

  // 构建行情数据部分
  let marketDataSection = "";
  if (marketData) {
    marketDataSection = `
## 实时行情数据（来自Tushare，请严格基于此数据分析）
- 最新收盘价: ${marketData.latestClose} 元
- 最新交易日: ${marketData.latestDate}
- 今日最高/最低: ${marketData.latestHigh} / ${marketData.latestLow} 元
- 今日开盘: ${marketData.latestOpen} 元
- 近一周涨跌幅: ${marketData.weekChange > 0 ? "+" : ""}${marketData.weekChange}%
- 近一月涨跌幅: ${marketData.monthChange > 0 ? "+" : ""}${marketData.monthChange}%
- 近一周最高/最低: ${marketData.weekHigh} / ${marketData.weekLow} 元
- 近一月最高/最低: ${marketData.monthHigh} / ${marketData.monthLow} 元
- 5日均线(MA5): ${marketData.ma5 ?? "暂无"} 元
- 10日均线(MA10): ${marketData.ma10 ?? "暂无"} 元
- 20日均线(MA20): ${marketData.ma20 ?? "暂无"} 元
- 30日均线(MA30): ${marketData.ma30 ?? "暂无"} 元
- 最新成交量: ${Math.round(marketData.latestVol / 10000)} 万手
- 5日均量: ${Math.round(marketData.avgVol5 / 10000)} 万手
- 10日均量: ${Math.round(marketData.avgVol10 / 10000)} 万手
`;
  } else {
    marketDataSection = `
## 行情数据
暂无实时行情数据，请在分析时注明"数据待查"。
`;
  }

  return `你是一位专业的A股投资分析师。请分析 ${stock.name}(${market}${pureCode}) 的投资价值。

## 股票基本信息
- 股票代码: ${market}${pureCode}
- 股票名称: ${stock.name}
- 所属板块: ${stock.sector?.join("、") || "未知"}
- 概念标签: ${stock.concept?.join("、") || "未知"}
${marketDataSection}
## 参考数据源
- 雪球个股页: ${links.xueqiu}
- 交易所公告: ${announcementUrl}
- 新浪年度报告: ${links.sinaAnnualReport}
- 东方财富: ${links.eastmoney}

请从以下维度分析，并**严格按照JSON格式输出**：

{
  "基本面": {
    "主营业务": "简述公司主营业务（1-2句话）",
    "行业地位": "行业地位简评（1句话）",
    "财务简评": "财务状况简评（1-2句话）"
  },
  "炒作预期": {
    "短期逻辑": "短期炒作逻辑或题材（1-2句话）",
    "中期催化剂": "中期可能催化剂（1句话）",
    "板块轮动": "板块轮动可能性（1句话）"
  },
  "技术面": {
    "价位分析": "基于实时行情数据分析当前价位（必须参考上面的行情数据）",
    "支撑位": "基于行情数据给出具体支撑价位",
    "压力位": "基于行情数据给出具体压力价位",
    "量能": "量能状况简评"
  },
  "风险提示": {
    "短期风险": "短期主要风险（1句话）",
    "中长期风险": "中长期主要风险（1句话）",
    "流动性风险": "流动性风险评估（1句话）"
  },
  "操作建议": {
    "建议仓位": "建议仓位（如：轻仓/半仓/重仓）",
    "止损位": "具体止损价位（不能低于当前价格）",
    "目标位": "目标价位区间",
    "综合评级": "看多/看空/观望"
  },
  "综合评分": {
    "基本面评分": 0-100的数字评分,
    "技术面评分": 0-100的数字评分,
    "风险评分": 0-100的数字评分（分数越高风险越大）,
    "综合评分": 0-100的综合评分
  }
}

**重要提示**：
1. 支撑位必须低于当前收盘价，压力位必须高于当前收盘价
2. 止损位不能低于当前价格
3. 目标位需与综合评级保持逻辑一致：看多时目标价应合理（可略高于或接近现价），看空时目标价应低于现价
4. 技术分析必须基于提供的实时行情数据
5. 输出必须是纯JSON格式，不要有其他文字`;
}

/**
 * POST /api/ai/stock-analysis
 * 个股AI分析接口
 */
export async function POST(req: NextRequest) {
  const key = process.env.STOCK_AI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "未配置个股AI分析API Key（STOCK_AI_API_KEY）" },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    const { stock } = body as { stock: StockInfo };

    if (!stock?.code || !stock?.name) {
      return NextResponse.json(
        { error: "缺少股票代码或名称" },
        { status: 400 }
      );
    }

    const market = getMarket(stock.code);
    const pureCode = stock.code.replace(/\D/g, "").padStart(6, "0");
    const links = buildLinks(stock.code);
    
    // 获取实时行情数据
    const marketData = await fetchMarketData(stock.code);
    
    // 构建分析prompt
    const prompt = buildAnalysisPrompt(stock, links, marketData);

    // 调用AI API
    const res = await fetch(STOCK_AI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "GLM-5",
        messages: [
          {
            role: "system",
            content: "你是一位专业的A股投资分析师，擅长基本面分析、技术分析和题材炒作分析。请用简洁、专业的语言进行分析，严格按照JSON格式输出结果。技术分析必须基于提供的实时行情数据，止损位不能低于当前价格，目标位必须高于当前价格。",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        stream: false,
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      const errMsg =
        data?.error?.message || data?.error || JSON.stringify(data);
      return NextResponse.json(
        { error: `AI服务异常: ${errMsg}` },
        { status: res.status }
      );
    }

    const content = data?.choices?.[0]?.message?.content ?? "";

    // 尝试解析JSON格式的内容
    let analysisData: any = null;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisData = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.log("JSON解析失败，返回原始文本");
    }

    return NextResponse.json({
      content,
      analysisData,
      stock,
      marketData,
      links: {
        ...links,
        announcement: market === "SZ" ? links.szseAnnouncement : links.sseAnnouncement,
        annualReport: links.sinaAnnualReport,
      },
      reports: [
        { source: "交易所公告", url: market === "SZ" ? links.szseAnnouncement : links.sseAnnouncement },
        { source: "新浪年报", url: links.sinaAnnualReport },
        { source: "雪球", url: links.xueqiu },
        { source: "东方财富", url: links.eastmoney },
      ].filter(r => r.url),
      reportsCount: 4,
    });
  } catch (e: any) {
    console.error("POST /api/ai/stock-analysis error:", e);
    return NextResponse.json(
      { error: e?.message || "请求失败" },
      { status: 500 }
    );
  }
}