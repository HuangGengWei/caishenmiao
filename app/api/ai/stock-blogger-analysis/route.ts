import { NextRequest, NextResponse } from "next/server";
import { getDailyRange } from "@/lib/tushare";
import { readFile, access } from "fs/promises";
import { constants } from "fs";
import path from "path";

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
  weekChange: number;
  monthChange: number;
  weekHigh: number;
  weekLow: number;
  monthHigh: number;
  monthLow: number;
  avgVol5: number;
  avgVol10: number;
  latestVol: number;
  ma5: number | null;
  ma10: number | null;
  ma20: number | null;
  ma30: number | null;
  // 新增技术指标
  volRatio?: number;
  maPattern?: string;
  recentPatterns?: string[];
  pricePosition?: string;
  recent5Days?: Array<{
    date: string;
    open: number;
    close: number;
    high: number;
    low: number;
    vol: number;
    change: string;
  }>;
}

interface BloggerProfile {
  blogger_name: string;
  batch_results: Array<{
    result: {
      status: string;
      analysis: {
        "一、交易哲学": Record<string, string>;
        "二、资金行为": Record<string, string>;
        "三、市场环境": Record<string, any>;
        "四、核心交易模式": Record<string, any>;
        "五、认知层级": Record<string, string>;
        "六、真正隐藏的核心": Record<string, string>;
      };
    };
  }>;
}

const PROFILE_BASE_PATHS = [
  "F:/douyin-downloader-main/douyin-downloader-main/output/profiles",
  path.join(process.cwd(), "data", "profiles"),
];

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
    start.setDate(start.getDate() - 60);
    
    const fmt = (d: Date) =>
      `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    
    const rows = await getDailyRange(tsCode, fmt(start), fmt(today));
    if (!rows || rows.length < 5) return null;
    
    const sorted = [...rows].sort((a, b) => b.trade_date.localeCompare(a.trade_date));
    const latest = sorted[0];
    const latestClose = latest.close;
    const latestDate = `${latest.trade_date.slice(0, 4)}-${latest.trade_date.slice(4, 6)}-${latest.trade_date.slice(6, 8)}`;
    
    const weekData = sorted.slice(0, Math.min(5, sorted.length));
    const weekChange = ((latestClose - weekData[weekData.length - 1].close) / weekData[weekData.length - 1].close) * 100;
    const weekHigh = Math.max(...weekData.map(d => d.high));
    const weekLow = Math.min(...weekData.map(d => d.low));
    
    const monthData = sorted.slice(0, Math.min(20, sorted.length));
    const monthChange = ((latestClose - monthData[monthData.length - 1].close) / monthData[monthData.length - 1].close) * 100;
    const monthHigh = Math.max(...monthData.map(d => d.high));
    const monthLow = Math.min(...monthData.map(d => d.low));
    
    const calcMA = (days: number): number | null => {
      if (sorted.length < days) return null;
      const slice = sorted.slice(0, days);
      return Math.round((slice.reduce((s, r) => s + r.close, 0) / days) * 100) / 100;
    };
    
    const calcVolMA = (days: number): number => {
      if (sorted.length < days) return 0;
      const slice = sorted.slice(0, days);
      return Math.round(slice.reduce((s, r) => s + (r.vol || 0), 0) / days);
    };
    
    // 计算量价关系指标
    const calcVolRatio = (): number => {
      if (calcVolMA(5) === 0) return 0;
      return Math.round((latest.vol || 0) / calcVolMA(5) * 100) / 100;
    };
    
    // 判断均线排列（多头/空头）
    const ma5Val = calcMA(5);
    const ma10Val = calcMA(10);
    const ma20Val = calcMA(20);
    const ma30Val = calcMA(30);
    const getMaPattern = (): string => {
      if (ma5Val && ma10Val && ma20Val && ma30Val) {
        if (ma5Val > ma10Val && ma10Val > ma20Val && ma20Val > ma30Val) return "多头排列";
        if (ma5Val < ma10Val && ma10Val < ma20Val && ma20Val < ma30Val) return "空头排列";
        return "交叉/混乱";
      }
      return "数据不足";
    };
    
    // 计算近期K线形态特征
    const getRecentPattern = (): string[] => {
      const patterns: string[] = [];
      const recent5 = sorted.slice(0, 5);
      
      // 判断上影线/下影线
      const today = recent5[0];
      const upperShadow = today.high - Math.max(today.open, today.close);
      const lowerShadow = Math.min(today.open, today.close) - today.low;
      const body = Math.abs(today.close - today.open);
      
      if (upperShadow > body * 2 && body > 0) patterns.push("长上影线(试盘信号)");
      if (lowerShadow > body * 2 && body > 0) patterns.push("长下影线(支撑信号)");
      
      // 判断连续涨跌
      const upDays = recent5.filter(d => d.close > d.open).length;
      if (upDays >= 4) patterns.push("连续阳线(强势)");
      if (upDays <= 1) patterns.push("连续阴线(弱势)");
      
      // 判断放量/缩量
      const avgVol5 = calcVolMA(5);
      if (latest.vol > avgVol5 * 2) patterns.push("放量(活跃)");
      if (latest.vol < avgVol5 * 0.5) patterns.push("缩量(观望)");
      
      return patterns;
    };
    
    // 计算价格位置（相对于近期高低点）
    const getPricePosition = (): string => {
      const rangeHigh = monthHigh;
      const rangeLow = monthLow;
      const position = (latestClose - rangeLow) / (rangeHigh - rangeLow) * 100;
      if (position > 80) return "高位区域(接近月高)";
      if (position < 20) return "低位区域(接近月低)";
      return "中间区域";
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
      ma5: ma5Val,
      ma10: ma10Val,
      ma20: ma20Val,
      ma30: ma30Val,
      // 新增技术指标
      volRatio: calcVolRatio(),
      maPattern: getMaPattern(),
      recentPatterns: getRecentPattern(),
      pricePosition: getPricePosition(),
      // 新增近期K线数据（供AI分析形态）
      recent5Days: recent5.map(d => ({
        date: d.trade_date,
        open: d.open,
        close: d.close,
        high: d.high,
        low: d.low,
        vol: d.vol,
        change: ((d.close - d.pre_close) / d.pre_close * 100).toFixed(2)
      }))
    };
  } catch (e) {
    console.error("fetchMarketData error:", e);
    return null;
  }
}

/**
 * 获取博主画像
 */
async function fetchBloggerProfile(bloggerName: string): Promise<BloggerProfile | null> {
  const safeName = bloggerName.replace("/", "_").replace("\\", "_");
  const fileNames = [
    `${safeName}_complete_profile.json`,
    `${safeName}_profile.json`,
  ];
  
  for (const basePath of PROFILE_BASE_PATHS) {
    for (const fileName of fileNames) {
      try {
        const filePath = path.join(basePath, fileName);
        await access(filePath, constants.R_OK);
        const content = await readFile(filePath, "utf-8");
        return JSON.parse(content);
      } catch {
        continue;
      }
    }
  }
  return null;
}

/**
 * 提取博主画像核心内容
 */
function extractBloggerWisdom(profile: BloggerProfile): string {
  const analysis = profile.batch_results?.[0]?.result?.analysis;
  if (!analysis) return "";
  
  const sections: string[] = [];
  
  // 交易哲学
  if (analysis["一、交易哲学"]) {
    sections.push(`【交易哲学】`);
    Object.entries(analysis["一、交易哲学"]).forEach(([key, val]) => {
      sections.push(`- ${key}: ${val}`);
    });
  }
  
  // 资金行为
  if (analysis["二、资金行为"]) {
    sections.push(`\n【资金行为分析】`);
    Object.entries(analysis["二、资金行为"]).forEach(([key, val]) => {
      sections.push(`- ${key}: ${val}`);
    });
  }
  
  // 核心交易模式
  if (analysis["四、核心交易模式"]) {
    sections.push(`\n【核心交易模式】`);
    Object.entries(analysis["四、核心交易模式"]).forEach(([modeName, modeData]) => {
      if (typeof modeData === "object") {
        sections.push(`\n${modeName}:`);
        Object.entries(modeData).forEach(([k, v]) => {
          sections.push(`  - ${k}: ${v}`);
        });
      }
    });
  }
  
  // 隐藏核心
  if (analysis["六、真正隐藏的核心"]) {
    sections.push(`\n【隐藏核心洞察】`);
    Object.entries(analysis["六、真正隐藏的核心"]).forEach(([key, val]) => {
      sections.push(`- ${key}: ${val}`);
    });
  }
  
  return sections.join("\n");
}

/**
 * 构建博主视角分析prompt
 */
function buildBloggerAnalysisPrompt(
  stock: StockInfo,
  bloggerName: string,
  bloggerWisdom: string,
  marketData: MarketData | null
): string {
  const market = getMarket(stock.code);
  const pureCode = stock.code.replace(/\D/g, "").padStart(6, "0");
  
  let marketDataSection = "";
  if (marketData) {
    // 近5日K线数据表格
    let recentKlineTable = "";
    if (marketData.recent5Days && marketData.recent5Days.length > 0) {
      recentKlineTable = `
### 近5日K线数据（重点分析）
| 日期 | 开盘 | 收盘 | 最高 | 最低 | 成交量(万手) | 涨跌幅 |
|------|------|------|------|------|-------------|--------|
${marketData.recent5Days.map(d => 
  `| ${d.date} | ${d.open} | ${d.close} | ${d.high} | ${d.low} | ${Math.round(d.vol/10000)} | ${d.change}% |`
).join("\n")}
`;
    }
    
    marketDataSection = `
## 实时行情数据（Tushare提供）
### 基础行情
- 最新收盘价: ${marketData.latestClose} 元
- 最新交易日: ${marketData.latestDate}
- 今日开盘/最高/最低: ${marketData.latestOpen} / ${marketData.latestHigh} / ${marketData.latestLow} 元
- 近一周涨跌幅: ${marketData.weekChange > 0 ? "+" : ""}${marketData.weekChange}%
- 近一月涨跌幅: ${marketData.monthChange > 0 ? "+" : ""}${marketData.monthChange}%

### 技术指标分析
- 均线系统: MA5=${marketData.ma5 ?? "暂无"}, MA10=${marketData.ma10 ?? "暂无"}, MA20=${marketData.ma20 ?? "暂无"}, MA30=${marketData.ma30 ?? "暂无"}
- 均线排列形态: ${marketData.maPattern || "数据不足"}
- 价格位置: ${marketData.pricePosition || "未知"}
- 量比(当日/5日均量): ${marketData.volRatio || 0}（>1.5为放量，<0.5为缩量）
- K线形态信号: ${marketData.recentPatterns?.join("、") || "无明显信号"}

### 成交量分析
- 最新成交量: ${Math.round(marketData.latestVol / 10000)} 万手
- 5日均量: ${Math.round(marketData.avgVol5 / 10000)} 万手
- 10日均量: ${Math.round(marketData.avgVol10 / 10000)} 万手
${recentKlineTable}
`;
  }

  return `你现在要扮演博主"${bloggerName}"，用他的投资理念和交易体系来分析股票 ${stock.name}(${market}${pureCode})。

# 博主"${bloggerName}"的投资体系（请严格按照这套体系分析）
${bloggerWisdom}

---

## 待分析股票信息
- 股票代码: ${market}${pureCode}
- 股票名称: ${stock.name}
- 所属板块: ${stock.sector?.join("、") || "未知"}
- 概念标签: ${stock.concept?.join("、") || "未知"}
${marketDataSection}

---

请以"${bloggerName}"的视角和语气，分析这只股票。你需要：

1. **判断当前阶段**：这只股票目前处于主力运作的哪个阶段？（建仓、洗盘、拉升、出货、无主力关注）

2. **识别资金行为**：根据K线数据判断主力意图
   - 观察量价关系（放量涨/缩量涨/放量跌/缩量跌）
   - 分析K线形态（上影线/下影线/十字星/大阳大阴）
   - 判断均线排列（多头/空头/纠缠）

3. **匹配交易模式**：**严格按照以下条件判断**，如不符合任何模式，填"当前不符合任何交易模式"
   
   - **低位试盘启动模式**：需满足【低位 + 长上影线 + 缩量横盘未破低 + 均线多头】
   - **利好兑现模式（卖出）**：需满足【涨幅超50%出利好 + 股价滞涨】
   - **跌停板翘板模式**：需满足【跌停板 + 尾盘大单翘板】
   - **打板回封模式**：需满足【涨停开板 + 未放巨量 + 板块效应存在】
   - **休克交易抄底模式**：需满足【低位 + 缩量阴跌不破成本区 + 主力建仓完成】
   - **主升浪持股模式**：需满足【涨幅30%-50%后 + 均线多头排列 + 斜率变陡】

4. **风险警示**：用博主的方式提醒潜在风险

5. **操作建议**：给出符合博主体系的操作建议

**重要提示**：
- 如果股票处于高位（接近月高），优先考虑"利好兑现"或"出货"风险
- 如果股票处于低位（接近月低），可以关注"试盘"或"建仓"信号
- 如果无明显主力行为，建议"观望"
- 不要强行匹配模式，必须严格对照条件

**请用博主惯用的语言风格回答**，比如：
- 使用"主力"、"筹码"、"洗盘"、"出货"等术语
- 强调"择时"和"资金行为分析"
- 指出散户常见的错误思维
- 可以适当使用"切记"、"警惕"等警示语

输出格式如下（JSON）：
{
  "当前阶段判断": "建仓期/洗盘期/拉升期/出货期/无主力/观望",
  "主力意图分析": "根据K线数据和量价关系的具体分析",
  "匹配的交易模式": "如果符合某个模式，说明是哪个及原因；如不符合，填'当前不符合任何交易模式'",
  "模式匹配理由": "具体说明为什么符合或不符合（对照模式条件逐一分析）",
  "关键观察点": ["需要关注的几个关键信号"],
  "风险警示": ["用博主视角指出的风险"],
  "操作建议": {
    "是否可介入": "是/否/观望",
    "介入时机": "具体时机说明（如符合某个模式，说明等待什么信号）",
    "仓位建议": "轻仓/半仓/重仓/空仓",
    "止损策略": "具体止损策略",
    "目标预期": "预期目标"
  },
  "博主点评": "用博主语气的一句话总结"
}`;
}

/**
 * POST /api/ai/stock-blogger-analysis
 * 用博主画像视角分析股票
 */
export async function POST(req: NextRequest) {
  const key = process.env.STOCK_AI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "未配置AI API Key" },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    const { stock, bloggerName } = body as { stock: StockInfo; bloggerName: string };

    if (!stock?.code || !stock?.name) {
      return NextResponse.json(
        { error: "缺少股票代码或名称" },
        { status: 400 }
      );
    }

    if (!bloggerName) {
      return NextResponse.json(
        { error: "缺少博主名称" },
        { status: 400 }
      );
    }

    // 获取博主画像
    const profile = await fetchBloggerProfile(bloggerName);
    if (!profile) {
      return NextResponse.json(
        { error: `未找到博主"${bloggerName}"的画像数据` },
        { status: 404 }
      );
    }

    // 提取博主智慧
    const bloggerWisdom = extractBloggerWisdom(profile);
    if (!bloggerWisdom) {
      return NextResponse.json(
        { error: "博主画像数据解析失败" },
        { status: 500 }
      );
    }

    // 获取行情数据
    const marketData = await fetchMarketData(stock.code);
    
    // 构建prompt
    const prompt = buildBloggerAnalysisPrompt(stock, bloggerName, bloggerWisdom, marketData);

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
            content: `你是一位经验丰富的A股博主"${bloggerName}"，擅长主力资金行为分析和择时操作。你的分析风格特点是：
1. 不迷信技术指标，关注资金意图
2. 强调"择时"比"选股"更重要
3. 善于识别主力的建仓、洗盘、拉升、出货四个阶段
4. 用通俗易懂的语言揭示市场真相
请用你的专业视角和独特风格来分析股票，输出JSON格式结果。`,
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
      const errMsg = data?.error?.message || data?.error || JSON.stringify(data);
      return NextResponse.json(
        { error: `AI服务异常: ${errMsg}` },
        { status: res.status }
      );
    }

    const content = data?.choices?.[0]?.message?.content ?? "";

    // 解析JSON
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
      bloggerName,
      bloggerProfile: {
        name: profile.blogger_name,
        totalVideos: profile.batch_results?.length || 0,
      },
      marketData,
    });
  } catch (e: any) {
    console.error("POST /api/ai/stock-blogger-analysis error:", e);
    return NextResponse.json(
      { error: e?.message || "请求失败" },
      { status: 500 }
    );
  }
}