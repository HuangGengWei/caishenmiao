// Tushare API 服务
const TUSHARE_TOKEN = "5501c8c52fffbca1ee27e604ec0c91b5aad636393f3f9ef45f9fed7f";
const TUSHARE_API_URL = "http://api.tushare.pro";

interface TushareResponse<T = any> {
  request_id: string;
  code: number;
  msg: string | null;
  data?: {
    fields: string[];
    items: T[][];
  };
}

/**
 * 调用 Tushare API
 */
async function callTushareAPI(
  apiName: string,
  params: Record<string, any> = {},
  fields: string[] = []
): Promise<any> {
  try {
    const response = await fetch(TUSHARE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_name: apiName,
        token: TUSHARE_TOKEN,
        params,
        fields: fields.join(","),
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result: TushareResponse = await response.json();

    if (result.code !== 0) {
      throw new Error(result.msg || "API调用失败");
    }

    if (!result.data) {
      return [];
    }

    // 将数据转换为对象数组
    const { fields: fieldNames, items } = result.data;
    return items.map((item) => {
      const obj: Record<string, any> = {};
      fieldNames.forEach((field, index) => {
        obj[field] = item[index];
      });
      return obj;
    });
  } catch (error) {
    console.error(`Tushare API ${apiName} error:`, error);
    throw error;
  }
}

/**
 * 获取交易日历
 * @param startDate 开始日期 YYYYMMDD
 * @param endDate 结束日期 YYYYMMDD
 */
export async function getTradeCal(
  startDate: string,
  endDate: string
): Promise<Array<{ cal_date: string; is_open: number }>> {
  return callTushareAPI(
    "trade_cal",
    {
      exchange: "SSE", // 上交所
      start_date: startDate,
      end_date: endDate,
    },
    ["cal_date", "is_open"]
  );
}

/**
 * 获取股票基本信息
 * @param tsCode 股票代码（如 000001.SZ），可选
 * @param symbol 6位数字代码（如 000001），可选
 */
export async function getStockBasic(
  tsCode?: string,
  symbol?: string
): Promise<Array<{
  ts_code: string;
  symbol: string;
  name: string;
  area: string;
  industry: string;
  market: string;
  list_date: string;
}>> {
  const params: Record<string, any> = {
    exchange: "",
    list_status: "L", // L-上市，D-退市，P-暂停
  };
  if (tsCode) {
    params.ts_code = tsCode;
  } else if (symbol) {
    // 优先使用 symbol（6位数字代码）查询，更直接
    params.symbol = symbol;
  }
  return callTushareAPI(
    "stock_basic",
    params,
    ["ts_code", "symbol", "name", "area", "industry", "market", "list_date"]
  );
}

/**
 * 获取股票日线行情
 * @param tsCode 股票代码（如 000001.SZ）
 * @param tradeDate 交易日期 YYYYMMDD
 */
export async function getDaily(
  tsCode: string,
  tradeDate: string
): Promise<Array<{
  ts_code: string;
  trade_date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  pre_close: number;
  change: number;
  pct_chg: number;
  vol: number;
  amount: number;
}>> {
  return callTushareAPI(
    "daily",
    {
      ts_code,
      trade_date: tradeDate,
    },
    [
      "ts_code",
      "trade_date",
      "open",
      "high",
      "low",
      "close",
      "pre_close",
      "change",
      "pct_chg",
      "vol",
      "amount",
    ]
  );
}

/**
 * 根据股票代码（6位数字）转换为 tushare 格式（如 000001.SZ）
 */
export function codeToTsCode(code: string): string {
  const cleanCode = code.replace(/[^\d]/g, "").padStart(6, "0");
  if (cleanCode.length !== 6) {
    return "";
  }
  // 判断市场：60开头是上交所，00/30开头是深交所
  if (cleanCode.startsWith("60")) {
    return `${cleanCode}.SH`;
  } else if (cleanCode.startsWith("00") || cleanCode.startsWith("30")) {
    return `${cleanCode}.SZ`;
  } else if (cleanCode.startsWith("68")) {
    return `${cleanCode}.SH`; // 科创板
  } else if (cleanCode.startsWith("43") || cleanCode.startsWith("83") || cleanCode.startsWith("87")) {
    return `${cleanCode}.BJ`; // 北交所
  }
  return `${cleanCode}.SZ`; // 默认深交所
}

/**
 * 获取股票近期日线行情（用于计算均线）
 * @param tsCode 股票代码（如 000001.SZ）
 * @param startDate 开始日期 YYYYMMDD
 * @param endDate 结束日期 YYYYMMDD
 */
export async function getDailyRange(
  tsCode: string,
  startDate: string,
  endDate: string
): Promise<Array<{
  ts_code: string;
  trade_date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  pct_chg: number;
  vol: number;
  amount: number;
}>> {
  return callTushareAPI(
    "daily",
    {
      ts_code: tsCode,
      start_date: startDate,
      end_date: endDate,
    },
    ["ts_code", "trade_date", "open", "high", "low", "close", "pct_chg", "vol", "amount"]
  );
}

/**
 * 获取股票20日均线及最新价格信息
 * 逻辑：取最近 ~30 个交易日的日线数据，取最新20条计算 MA20，
 * 并判断最新交易日的收盘价/最高价是否达到或穿越 MA20。
 *
 * 判断规则：
 *  - "above"   : 最新收盘价 >= MA20（已上穿/站上均线）
 *  - "touched" : 最新最高价 >= MA20 但收盘价 < MA20（日内触及均线但未收上）
 *  - "below"   : 最高价也 < MA20（未达到）
 */
export async function getMA20(code: string): Promise<{
  ma20: number;
  latestClose: number;
  latestHigh: number;
  latestTradeDate: string; // YYYY-MM-DD，数据所属的最新交易日
  status: "above" | "touched" | "below";
} | null> {
  const tsCode = codeToTsCode(code);
  if (!tsCode) throw new Error(`无法识别股票代码 ${code}`);

  // 取最近 60 个自然日（保证覆盖 20 个交易日 + 节假日缓冲）
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 60);
  const fmt = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;

  const rows = await getDailyRange(tsCode, fmt(start), fmt(today));

  if (!rows || rows.length === 0) {
    throw new Error(`未获取到 ${code} 的行情数据，请确认代码正确且该股票正常交易`);
  }

  // Tushare daily 返回倒序（最新在前），显式排序保证正确
  const sorted = [...rows].sort((a, b) =>
    b.trade_date.localeCompare(a.trade_date)
  );

  if (sorted.length < 20) {
    throw new Error(`数据仅 ${sorted.length} 条（需 ≥20 条），无法计算20日均线`);
  }

  const last20 = sorted.slice(0, 20);
  const ma20 = last20.reduce((sum, r) => sum + r.close, 0) / 20;

  const latest = sorted[0];
  const latestClose = latest.close;
  const latestHigh = latest.high;
  // trade_date 格式 YYYYMMDD → YYYY-MM-DD
  const td = latest.trade_date;
  const latestTradeDate = `${td.slice(0, 4)}-${td.slice(4, 6)}-${td.slice(6, 8)}`;

  let status: "above" | "touched" | "below";
  if (latestClose >= ma20) {
    status = "above";
  } else if (latestHigh >= ma20) {
    status = "touched";
  } else {
    status = "below";
  }

  return {
    ma20: Math.round(ma20 * 100) / 100,
    latestClose: Math.round(latestClose * 100) / 100,
    latestHigh: Math.round(latestHigh * 100) / 100,
    latestTradeDate,
    status,
  };
}

export type OhlcPoint = {
  date: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
};

/**
 * 获取20日均线信息 + 近30个交易日 OHLC，用于蜡烛图
 */
export async function getMA20WithOhlc(code: string): Promise<{
  ma20: number;
  latestClose: number;
  latestHigh: number;
  latestTradeDate: string;
  status: "above" | "touched" | "below";
  ohlc: OhlcPoint[];
} | null> {
  const tsCode = codeToTsCode(code);
  if (!tsCode) throw new Error(`无法识别股票代码 ${code}`);

  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 60);
  const fmt = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;

  const rows = await getDailyRange(tsCode, fmt(start), fmt(today));
  if (!rows || rows.length < 20) return null;

  const sorted = [...rows].sort((a, b) => b.trade_date.localeCompare(a.trade_date));
  const last20 = sorted.slice(0, 20);
  const ma20 = last20.reduce((sum, r) => sum + r.close, 0) / 20;
  const latest = sorted[0];
  const latestClose = latest.close;
  const latestHigh = latest.high;
  const td = latest.trade_date;
  const latestTradeDate = `${td.slice(0, 4)}-${td.slice(4, 6)}-${td.slice(6, 8)}`;

  let status: "above" | "touched" | "below";
  if (latestClose >= ma20) status = "above";
  else if (latestHigh >= ma20) status = "touched";
  else status = "below";

  const ohlc: OhlcPoint[] = sorted.slice(0, 30).reverse().map((r) => ({
    date: `${r.trade_date.slice(0, 4)}-${r.trade_date.slice(4, 6)}-${r.trade_date.slice(6, 8)}`,
    open: Math.round(r.open * 100) / 100,
    high: Math.round(r.high * 100) / 100,
    low: Math.round(r.low * 100) / 100,
    close: Math.round(r.close * 100) / 100,
  }));

  return {
    ma20: Math.round(ma20 * 100) / 100,
    latestClose: Math.round(latestClose * 100) / 100,
    latestHigh: Math.round(latestHigh * 100) / 100,
    latestTradeDate,
    status,
    ohlc,
  };
}

/** 5日线与30日线“接近”的阈值：相对差异小于该比例视为接近（2%） */
const MA5_MA30_NEAR_THRESHOLD = 0.02;

/**
 * 获取股票5日均线、30日均线，并判断两均线是否接近
 * 接近定义：|MA5 - MA30| / min(MA5, MA30) < 2%
 */
export async function getMA5MA30(code: string): Promise<{
  ma5: number;
  ma30: number;
  latestTradeDate: string;
  near: boolean;
} | null> {
  const tsCode = codeToTsCode(code);
  if (!tsCode) throw new Error(`无法识别股票代码 ${code}`);

  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 60);
  const fmt = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;

  const rows = await getDailyRange(tsCode, fmt(start), fmt(today));
  if (!rows || rows.length < 30) return null;

  const sorted = [...rows].sort((a, b) => b.trade_date.localeCompare(a.trade_date));
  const last5 = sorted.slice(0, 5);
  const last30 = sorted.slice(0, 30);
  const ma5 = last5.reduce((sum, r) => sum + r.close, 0) / 5;
  const ma30 = last30.reduce((sum, r) => sum + r.close, 0) / 30;

  const td = sorted[0].trade_date;
  const latestTradeDate = `${td.slice(0, 4)}-${td.slice(4, 6)}-${td.slice(6, 8)}`;

  const minMa = Math.min(ma5, ma30);
  const diffRatio = minMa > 0 ? Math.abs(ma5 - ma30) / minMa : 0;
  const near = diffRatio < MA5_MA30_NEAR_THRESHOLD;

  return {
    ma5: Math.round(ma5 * 100) / 100,
    ma30: Math.round(ma30 * 100) / 100,
    latestTradeDate,
    near,
  };
}

export type DailyChartPoint = {
  date: string; // YYYY-MM-DD
  close: number;
  ma5: number | null;
  ma30: number | null;
};

/**
 * 获取近30个交易日行情用于图表：收盘价、5日均线、30日均线
 * 需要约60个交易日数据以计算每日的 MA30
 */
export async function getDailyChartData(code: string): Promise<{
  series: DailyChartPoint[];
  near: boolean;
} | null> {
  const tsCode = codeToTsCode(code);
  if (!tsCode) throw new Error(`无法识别股票代码 ${code}`);

  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 90);
  const fmt = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;

  const rows = await getDailyRange(tsCode, fmt(start), fmt(today));
  if (!rows || rows.length < 30) return null;

  const sorted = [...rows].sort((a, b) => b.trade_date.localeCompare(a.trade_date));
  const use = sorted.slice(0, 60);
  if (use.length < 30) return null;

  const series: DailyChartPoint[] = [];
  for (let k = 29; k >= 0; k--) {
    if (k >= use.length) continue;
    const close = use[k].close;
    const td = use[k].trade_date;
    const date = `${td.slice(0, 4)}-${td.slice(4, 6)}-${td.slice(6, 8)}`;
    const slice5 = use.slice(k, k + 5);
    const slice30 = use.slice(k, k + 30);
    const ma5 = slice5.length >= 5
      ? Math.round((slice5.reduce((s, r) => s + r.close, 0) / 5) * 100) / 100
      : null;
    const ma30 = slice30.length >= 30
      ? Math.round((slice30.reduce((s, r) => s + r.close, 0) / 30) * 100) / 100
      : null;
    series.push({ date, close: Math.round(close * 100) / 100, ma5, ma30 });
  }

  const ma5Latest = use.slice(0, 5).reduce((s, r) => s + r.close, 0) / 5;
  const ma30Latest = use.slice(0, 30).reduce((s, r) => s + r.close, 0) / 30;
  const minMa = Math.min(ma5Latest, ma30Latest);
  const near = minMa > 0 && Math.abs(ma5Latest - ma30Latest) / minMa < MA5_MA30_NEAR_THRESHOLD;

  // 当日分时均价（用当日 O/H/L/C 均价近似）与 30 日均线是否接近
  const latest = use[0];
  const typicalPrice = (latest.open + latest.high + latest.low + latest.close) / 4;
  const minTypical = Math.min(typicalPrice, ma30Latest);
  const typicalNearMa30 =
    minTypical > 0 && Math.abs(typicalPrice - ma30Latest) / minTypical < MA5_MA30_NEAR_THRESHOLD;

  return { series, near, typicalNearMa30 };
}

/**
 * 根据股票代码获取股票信息（名称、涨幅等）
 * @param code 6位股票代码
 * @param tradeDate 交易日期 YYYYMMDD
 */
export async function getStockInfo(
  code: string,
  tradeDate?: string
): Promise<{
  name: string;
  industry: string | null;
  chg: number | null;
  turnover: number | null;
  amount: number | null;
  debt_ratio: number | null;
} | null> {
  try {
    const cleanCode = code.replace(/[^\d]/g, "").padStart(6, "0");
    if (cleanCode.length !== 6) {
      return null;
    }

    // 使用 ts_code 进行精确查询，避免 symbol 查询返回多条结果
    const tsCode = codeToTsCode(cleanCode);
    if (!tsCode) {
      return null;
    }

    // 使用 ts_code 精确查询（ts_code 是唯一的，应该只返回一条结果）
    const basicInfo = await getStockBasic(tsCode);
    if (!basicInfo || basicInfo.length === 0) {
      return null;
    }

    // 取第一条结果（ts_code 查询应该只返回一条）
    const stock = basicInfo[0];
    
    // 严格验证返回结果的 symbol 是否与查询代码完全匹配
    if (stock.symbol !== cleanCode) {
      console.error(`代码查询不匹配: 输入 ${cleanCode}, 返回 ${stock.symbol}, 股票名称: ${stock.name}`);
      return null;
    }
    let chg: number | null = null;
    let turnover: number | null = null;
    let amount: number | null = null;

    // 如果有交易日期，获取日线行情
    if (tradeDate && stock.ts_code) {
      try {
        const dailyData = await getDaily(stock.ts_code, tradeDate);
        if (dailyData && dailyData.length > 0) {
          const daily = dailyData[0];
          chg = daily.pct_chg || null;
          // amount 可以从 daily.amount 获取（成交额，单位：千元）
          amount = daily.amount ? daily.amount / 100000 : null; // 转换为亿元
        }
      } catch (dailyError) {
        // 日线数据获取失败不影响基本信息返回
        console.warn("获取日线数据失败:", dailyError);
      }
    }

    return {
      name: stock.name,
      industry: stock.industry || null, // 行业信息，可用于板块提示
      chg,
      turnover, // 换手率需要从其他接口获取
      amount,
      debt_ratio: null, // 资产负债率需要从财务数据接口获取
    };
  } catch (error) {
    console.error("获取股票信息失败:", error);
    return null;
  }
}
