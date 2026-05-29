// Tushare API 服务（默认直连官网，可通过 .env 覆盖）
const TUSHARE_TOKEN = process.env.TUSHARE_TOKEN ?? "";
const TUSHARE_API_URL =
  process.env.TUSHARE_HTTP_URL || "https://api.tushare.pro";
// 统一节流 Tushare 请求，避免触发 daily 接口 500 次/分钟限频
const TUSHARE_MIN_INTERVAL_MS = Number(process.env.TUSHARE_MIN_INTERVAL_MS ?? "250");
const TUSHARE_RATE_LIMIT_RETRY_MS = Number(process.env.TUSHARE_RATE_LIMIT_RETRY_MS ?? "1200");
const TUSHARE_CACHE_TTL_MS = Number(process.env.TUSHARE_CACHE_TTL_MS ?? "300000"); // 默认5分钟缓存
let tushareNextRequestAt = 0;
let tushareQueue: Promise<void> = Promise.resolve();

// 内存缓存：key -> { data, timestamp }
const tushareCache: Record<string, { data: any; timestamp: number }> = {};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** 生成缓存 key */
function getCacheKey(apiName: string, params: Record<string, any>): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return `${apiName}:${sortedParams}`;
}

/** 从缓存获取数据（过期则返回 null） */
function getFromCache(key: string): any | null {
  const entry = tushareCache[key];
  if (!entry) return null;
  const now = Date.now();
  if (now - entry.timestamp > TUSHARE_CACHE_TTL_MS) {
    delete tushareCache[key];
    return null;
  }
  return entry.data;
}

/** 存入缓存 */
function setToCache(key: string, data: any): void {
  tushareCache[key] = { data, timestamp: Date.now() };
}

interface TushareResponse<T = any> {
  request_id: string;
  code: number;
  msg: string | null;
  data?: {
    fields: string[];
    items: T[][];
  };
}

/** 是否为 Token 缺失/无效/权限类错误（用于降级与减少重复日志） */
export function isTushareCredentialError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  if (!msg) return false;
  return (
    /无效|token|Token|TUSHARE|未配置|权限|过期|认证|Unauthorized/i.test(msg)
  );
}

/** 是否为频率超限错误（用于限频重试） */
function isTushareRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  if (!msg) return false;
  return /频率超限|rate.?limit|too many requests|429/i.test(msg);
}

/** 全局排队 + 最小间隔，确保多并发时也不会瞬间打满额度 */
async function acquireTushareRequestSlot(): Promise<void> {
  const scheduled = tushareQueue.then(async () => {
    const now = Date.now();
    const waitMs = Math.max(0, tushareNextRequestAt - now);
    if (waitMs > 0) {
      await sleep(waitMs);
    }
    tushareNextRequestAt = Date.now() + Math.max(0, TUSHARE_MIN_INTERVAL_MS);
  });
  // 无论当前任务成功失败，都要让队列继续流动
  tushareQueue = scheduled.catch(() => {});
  await scheduled;
}

/**
 * Token 不可用时，用「仅周末休市」近似非交易日（不含法定节假日休市），供交易天数等展示降级。
 * @param startYmd / endYmd 格式 YYYYMMDD
 * @returns YYYY-MM-DD 非交易日列表
 */
export function approximateWeekendNonTradingDays(
  startYmd: string,
  endYmd: string
): string[] {
  const y = (s: string, a: number, b: number) => Number(s.slice(a, b));
  const start = new Date(y(startYmd, 0, 4), y(startYmd, 4, 6) - 1, y(startYmd, 6, 8));
  const end = new Date(y(endYmd, 0, 4), y(endYmd, 4, 6) - 1, y(endYmd, 6, 8));
  const pad = (n: number) => String(n).padStart(2, "0");
  const out: string[] = [];
  for (
    let cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    cur <= end;
    cur.setDate(cur.getDate() + 1)
  ) {
    const dow = cur.getDay();
    if (dow === 0 || dow === 6) {
      out.push(
        `${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`
      );
    }
  }
  return out;
}

/**
 * 调用 Tushare API（带缓存）
 */
async function callTushareAPI(
  apiName: string,
  params: Record<string, any> = {},
  fields: string[] = []
): Promise<any> {
  if (!TUSHARE_TOKEN?.trim()) {
    throw new Error("未配置 TUSHARE_TOKEN，请在 .env 中设置 TUSHARE_TOKEN");
  }

  // 检查缓存
  const cacheKey = getCacheKey(apiName, params);
  const cached = getFromCache(cacheKey);
  if (cached !== null) {
    return cached;
  }

  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await acquireTushareRequestSlot();
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
        setToCache(cacheKey, []);
        return [];
      }

      // 将数据转换为对象数组
      const { fields: fieldNames, items } = result.data;
      const data = items.map((item) => {
        const obj: Record<string, any> = {};
        fieldNames.forEach((field, index) => {
          obj[field] = item[index];
        });
        return obj;
      });

      // 存入缓存
      setToCache(cacheKey, data);
      return data;
    } catch (error) {
      const shouldRetry =
        attempt < maxAttempts && isTushareRateLimitError(error);
      if (shouldRetry) {
        await sleep(Math.max(0, TUSHARE_RATE_LIMIT_RETRY_MS));
        continue;
      }
      if (!isTushareCredentialError(error)) {
        console.error(`Tushare API ${apiName} error:`, error);
      }
      throw error;
    }
  }
  return [];
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
      ts_code: tsCode,
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
 * 从指定录入日之后（含当日）检查是否出现过涨停，返回首次涨停日期（YYYY-MM-DD），若无则返回 null
 * 这里简单以日涨跌幅 pct_chg ≥ 9.8 视为涨停（忽略 ST/20cm 等特殊情况）
 */
export async function getFirstLimitUpSince(
  code: string,
  recordDate: string
): Promise<string | null> {
  const tsCode = codeToTsCode(code);
  if (!tsCode) throw new Error(`无法识别股票代码 ${code}`);

  const startDate = recordDate.replace(/-/g, "");
  const today = new Date();
  const fmt = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const endDate = fmt(today);

  const rows = await getDailyRange(tsCode, startDate, endDate);
  if (!rows || rows.length === 0) return null;

  // 按日期正序，找到第一天涨跌幅达到阈值的记录
  const sorted = [...rows].sort((a, b) => a.trade_date.localeCompare(b.trade_date));
  const THRESHOLD = 9.8; // 近似 10% 涨停
  const hit = sorted.find((r) => typeof r.pct_chg === "number" && r.pct_chg >= THRESHOLD);
  if (!hit) return null;

  const td = hit.trade_date;
  return `${td.slice(0, 4)}-${td.slice(4, 6)}-${td.slice(6, 8)}`;
}

/** 获取录入日前后涨停日期列表（以录入日为 midpoint，前后各取若干交易日） */
export async function getLimitUpDatesAround(
  code: string,
  recordDate: string,
  beforeDays = 30,
  afterDays = 60
): Promise<string[]> {
  const tsCode = codeToTsCode(code);
  if (!tsCode) throw new Error(`无法识别股票代码 ${code}`);

  const recordYmd = recordDate.replace(/-/g, "");
  const today = new Date();
  const fmt = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const endDate = fmt(today);

  const start = new Date(recordDate);
  start.setDate(start.getDate() - 90);
  const startDate = fmt(start);

  const rows = await getDailyRange(tsCode, startDate, endDate);
  if (!rows || rows.length === 0) return [];

  const THRESHOLD = 9.8;
  const sorted = [...rows].sort((a, b) => a.trade_date.localeCompare(b.trade_date));
  const result: string[] = [];
  for (const r of sorted) {
    if (typeof r.pct_chg === "number" && r.pct_chg >= THRESHOLD) {
      const td = r.trade_date;
      result.push(`${td.slice(0, 4)}-${td.slice(4, 6)}-${td.slice(6, 8)}`);
    }
  }
  return result;
}

/** 获取最近一次涨停日期（距今天最近的涨停日） */
export async function getLastLimitUpDate(code: string): Promise<string | null> {
  const tsCode = codeToTsCode(code);
  if (!tsCode) throw new Error(`无法识别股票代码 ${code}`);

  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 180); // 查找近180个自然日
  const fmt = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;

  const rows = await getDailyRange(tsCode, fmt(start), fmt(today));
  if (!rows || rows.length === 0) return null;

  const THRESHOLD = 9.8;
  // 按日期降序，找到最近的涨停日
  const sorted = [...rows].sort((a, b) => b.trade_date.localeCompare(a.trade_date));
  for (const r of sorted) {
    if (typeof r.pct_chg === "number" && r.pct_chg >= THRESHOLD) {
      const td = r.trade_date;
      return `${td.slice(0, 4)}-${td.slice(4, 6)}-${td.slice(6, 8)}`;
    }
  }
  return null;
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

/**
 * 以录入日为基准的 20 日线 OHLC：从录入日前约20个交易日至今日，用于蜡烛图标注录入日/涨停日
 */
export async function getMA20WithOhlcAroundRecord(
  code: string,
  recordDate: string
): Promise<{
  ma20: number;
  latestClose: number;
  latestHigh: number;
  latestTradeDate: string;
  status: "above" | "touched" | "below";
  ohlc: OhlcPoint[];
} | null> {
  const tsCode = codeToTsCode(code);
  if (!tsCode) throw new Error(`无法识别股票代码 ${code}`);

  const recordYmd = recordDate.replace(/-/g, "");
  const today = new Date();
  const start = new Date(recordDate);
  start.setDate(start.getDate() - 90);
  const fmt = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;

  const rows = await getDailyRange(tsCode, fmt(start), fmt(today));
  if (!rows || rows.length < 20) return null;

  const sorted = [...rows].sort((a, b) => a.trade_date.localeCompare(b.trade_date));
  const recordIdx = sorted.findIndex((r) => r.trade_date === recordYmd);
  const startIdx = recordIdx >= 0 ? Math.max(0, recordIdx - 20) : 0;
  const use = sorted.slice(startIdx, Math.min(startIdx + 65, sorted.length));
  if (use.length < 5) return null;

  const ohlc: OhlcPoint[] = use.map((r) => ({
    date: `${r.trade_date.slice(0, 4)}-${r.trade_date.slice(4, 6)}-${r.trade_date.slice(6, 8)}`,
    open: Math.round(r.open * 100) / 100,
    high: Math.round(r.high * 100) / 100,
    low: Math.round(r.low * 100) / 100,
    close: Math.round(r.close * 100) / 100,
  }));

  const last20 = use.slice(-20);
  const ma20 = last20.reduce((sum, r) => sum + r.close, 0) / 20;
  const latest = use[use.length - 1];
  const latestClose = latest.close;
  const latestHigh = latest.high;
  const latestTradeDate = `${latest.trade_date.slice(0, 4)}-${latest.trade_date.slice(4, 6)}-${latest.trade_date.slice(6, 8)}`;

  let status: "above" | "touched" | "below";
  if (latestClose >= ma20) status = "above";
  else if (latestHigh >= ma20) status = "touched";
  else status = "below";

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
  vol5: number | null;  // 5日成交量均线（手）
  v10: number | null; // 10日成交量均线（手）
};

/**
 * 获取近30个交易日行情用于图表：收盘价、5日均线、30日均线、成交量均线
 * 需要约60个交易日数据以计算每日的 MA30
 */
export async function getDailyChartData(code: string): Promise<{
  series: DailyChartPoint[];
  near: boolean;
  lastCrossDate: string | null;
  volNear: boolean;
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
    const slice10 = use.slice(k, k + 10);
    const ma5 = slice5.length >= 5
      ? Math.round((slice5.reduce((s, r) => s + r.close, 0) / 5) * 100) / 100
      : null;
    const ma30 = slice30.length >= 30
      ? Math.round((slice30.reduce((s, r) => s + r.close, 0) / 30) * 100) / 100
      : null;
    const vol5 = slice5.length >= 5
      ? Math.round(slice5.reduce((s, r) => s + (r.vol || 0), 0) / 5)
      : null;
    const v10 = slice10.length >= 10
      ? Math.round(slice10.reduce((s, r) => s + (r.vol || 0), 0) / 10)
      : null;
    series.push({ date, close: Math.round(close * 100) / 100, ma5, ma30, vol5, v10 });
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

  // 计算上次 MA5 与 MA30 交叉的日期（从最新往前找）
  let lastCrossDate: string | null = null;
  for (let i = 0; i < series.length - 1; i++) {
    const curr = series[i];
    const prev = series[i + 1];
    if (curr.ma5 != null && curr.ma30 != null && prev.ma5 != null && prev.ma30 != null) {
      const currDiff = curr.ma5 - curr.ma30;
      const prevDiff = prev.ma5 - prev.ma30;
      // 交叉：当前和之前的差值符号不同，或任一为0（重合）
      if (currDiff * prevDiff < 0 || currDiff === 0) {
        lastCrossDate = curr.date;
        break;
      }
    }
  }

  // 5日成交量与10日成交量是否接近
  const vol5Latest = use.slice(0, 5).reduce((s, r) => s + (r.vol || 0), 0) / 5;
  const v10Latest = use.slice(0, 10).reduce((s, r) => s + (r.vol || 0), 0) / 10;
  const minVol = Math.min(vol5Latest, v10Latest);
  const volNear = minVol > 0 && Math.abs(vol5Latest - v10Latest) / minVol < MA5_MA30_NEAR_THRESHOLD;

  return { series, near, typicalNearMa30, lastCrossDate, volNear };
}

/**
 * 获取每日指标（换手率、市值等）
 * Tushare 接口: daily_basic
 * @param tsCode 股票代码（如 000001.SZ）
 * @param tradeDate 交易日期 YYYYMMDD
 */
export async function getDailyBasic(
  tsCode: string,
  tradeDate: string
): Promise<{
  turnover: number | null;  // 换手率 %
  totalMv: number | null;   // 总市值（万元）
  peTTM: number | null;     // PE(TTM)
} | null> {
  try {
    const rows = await callTushareAPI(
      "daily_basic",
      { ts_code: tsCode, trade_date: tradeDate },
      ["ts_code", "trade_date", "turnover_rate", "total_mv", "pe_ttm"]
    );
    if (!rows || rows.length === 0) return null;
    const r = rows[0];
    return {
      turnover: typeof r.turnover_rate === "number" ? r.turnover_rate : null,
      totalMv: typeof r.total_mv === "number" ? r.total_mv : null,
      peTTM: typeof r.pe_ttm === "number" ? r.pe_ttm : null,
    };
  } catch (e) {
    console.warn("获取 daily_basic 失败:", e);
    return null;
  }
}

/**
 * 单期股东人数数据
 */
export interface HolderNumberPeriod {
  holderNum: number;      // 股东人数
  endDate: string;        // 报告期 YYYY-MM-DD
  annDate: string | null; // 公告日期 YYYYMMDD
}

/**
 * 股东人数变化趋势分析结果
 */
export interface HolderNumberTrend {
  periods: HolderNumberPeriod[];        // 最近N期数据（按时间倒序：最新在前）
  consecutiveDecrease: number;          // 连续降低次数（0-3）
  totalChangePercent: number | null;    // 最新期相比最早期的变化率（负数表示降低）
  avgChangePercent: number | null;      // 平均每期变化率
  trendScore: number;                   // 趋势评分（0-100，连续降低越多分越高）
  latestHolderNum: number | null;       // 最新股东人数
  description: string;                  // 趋势描述（如：连续3期降低 | 2期降低 | 上升）
}

/**
 * 获取股东人数及变化趋势
 * Tushare 接口: stk_holdernumber
 * 取该股票最近4期的股东人数，分析变化趋势
 * @param tsCode 股票代码（如 000001.SZ）
 * @param periodCount 获取期数，默认4期
 */
export async function getShareNumberTrend(
  tsCode: string,
  periodCount: number = 5
): Promise<HolderNumberTrend | null> {
  try {
    const rows = await callTushareAPI(
      "stk_holdernumber",
      { ts_code: tsCode },
      ["ts_code", "ann_date", "end_date", "holder_num"]
    );
    if (!rows || rows.length === 0) return null;

    // 按 end_date 降序排列，取最近N期
    const sorted = [...rows].sort((a, b) => {
      const da = String(a.end_date || "");
      const db = String(b.end_date || "");
      return db.localeCompare(da);
    });
    
    const recent = sorted.slice(0, periodCount);
    if (recent.length === 0) return null;

    // 格式化每期数据
    const periods: HolderNumberPeriod[] = recent.map(r => {
      const endDate = String(r.end_date || "");
      const formattedEndDate = `${endDate.slice(0, 4)}-${endDate.slice(4, 6)}-${endDate.slice(6, 8)}`;
      return {
        holderNum: typeof r.holder_num === "number" ? r.holder_num : 0,
        endDate: formattedEndDate,
        annDate: r.ann_date ? String(r.ann_date) : null,
      };
    });

    // 计算连续降低次数（从最新往前数）
    let consecutiveDecrease = 0;
    for (let i = 0; i < periods.length - 1; i++) {
      const current = periods[i].holderNum;
      const prev = periods[i + 1].holderNum;
      if (current > 0 && prev > 0 && current < prev) {
        consecutiveDecrease++;
      } else {
        break; // 遇到非降低即停止
      }
    }

    // 计算总变化率和平均变化率
    let totalChangePercent: number | null = null;
    let avgChangePercent: number | null = null;
    
    if (periods.length >= 2) {
      const latest = periods[0].holderNum;
      const earliest = periods[periods.length - 1].holderNum;
      if (latest > 0 && earliest > 0) {
        totalChangePercent = ((latest - earliest) / earliest) * 100;
        
        // 计算每期变化率的平均值
        const changes: number[] = [];
        for (let i = 0; i < periods.length - 1; i++) {
          const curr = periods[i].holderNum;
          const prev = periods[i + 1].holderNum;
          if (curr > 0 && prev > 0) {
            changes.push(((curr - prev) / prev) * 100);
          }
        }
        if (changes.length > 0) {
          avgChangePercent = changes.reduce((a, b) => a + b, 0) / changes.length;
        }
      }
    }

    // 计算趋势评分
    // 连续降低越多，评分越高：连续3期=100分，连续2期=80分，连续1期=60分，无降低=40分，上升=20分
    let trendScore = 0;
    if (consecutiveDecrease >= 3) {
      trendScore = 100;
    } else if (consecutiveDecrease === 2) {
      trendScore = 80;
    } else if (consecutiveDecrease === 1) {
      trendScore = 60;
    } else if (totalChangePercent !== null && totalChangePercent < 0) {
      // 没有连续降低但总体下降
      trendScore = 40;
    } else if (totalChangePercent !== null && totalChangePercent > 0) {
      // 上升
      trendScore = 20;
    } else {
      trendScore = 50; // 无足够数据
    }

    // 描述
    let description = "";
    if (consecutiveDecrease >= 3) {
      description = `连续${consecutiveDecrease}期降低`;
      if (totalChangePercent !== null) {
        description += ` | 累计${totalChangePercent.toFixed(1)}%`;
      }
    } else if (consecutiveDecrease >= 1) {
      description = `连续${consecutiveDecrease}期降低`;
    } else if (totalChangePercent !== null && totalChangePercent < 0) {
      description = `下降${Math.abs(totalChangePercent).toFixed(1)}%`;
    } else if (totalChangePercent !== null && totalChangePercent > 0) {
      description = `上升${totalChangePercent.toFixed(1)}%`;
    } else {
      description = "-";
    }

    return {
      periods,
      consecutiveDecrease,
      totalChangePercent,
      avgChangePercent,
      trendScore,
      latestHolderNum: periods[0]?.holderNum || null,
      description,
    };
  } catch (e) {
    console.warn("获取股东人数趋势失败:", e);
    return null;
  }
}

/**
 * 获取股东人数（单期，兼容旧接口）
 * Tushare 接口: stk_holdernumber
 * 取该股票最新一期的股东人数
 * @param tsCode 股票代码（如 000001.SZ）
 */
export async function getShareNumber(
  tsCode: string
): Promise<{
  holderNum: number | null; // 股东人数
  annDate: string | null;   // 公告日期 YYYYMMDD
} | null> {
  const trend = await getShareNumberTrend(tsCode, 1);
  if (!trend || trend.periods.length === 0) return null;
  const latest = trend.periods[0];
  return {
    holderNum: latest.holderNum || null,
    annDate: latest.annDate,
  };
}

/**
 * 获取财务指标（资产负债率）
 * Tushare 接口: fina_indicator
 * 取该股票最新一期财报的 debt_to_assets 字段
 * @param tsCode 股票代码（如 000001.SZ）
 */
export async function getFinaIndicator(
  tsCode: string
): Promise<{
  debtToAssets: number | null; // 资产负债率 %
  annDate: string | null;      // 公告日期 YYYYMMDD
} | null> {
  try {
    const rows = await callTushareAPI(
      "fina_indicator",
      { ts_code: tsCode },
      ["ts_code", "ann_date", "end_date", "debt_to_assets"]
    );
    if (!rows || rows.length === 0) return null;

    // 按 ann_date 降序排列，取最新一期
    const sorted = [...rows].sort((a, b) => {
      const da = String(a.ann_date || a.end_date || "");
      const db = String(b.ann_date || b.end_date || "");
      return db.localeCompare(da);
    });
    const latest = sorted[0];
    return {
      debtToAssets: typeof latest.debt_to_assets === "number" ? latest.debt_to_assets : null,
      annDate: String(latest.ann_date || latest.end_date || ""),
    };
  } catch (e) {
    console.warn("获取 fina_indicator 失败:", e);
    return null;
  }
}

/**
 * 获取股票所属概念（同花顺概念分类）
 * Tushare 接口: ths_member
 * @param tsCode 股票代码（如 000001.SZ）
 */
export async function getStockConcepts(
  tsCode: string
): Promise<string[]> {
  try {
    const rows = await callTushareAPI(
      "ths_member",
      { ts_code: tsCode },
      ["ts_code", "con_code", "con_name"]
    );
    if (!rows || rows.length === 0) return [];
    // 去重并过滤空值
    const concepts = [...new Set(
      rows
        .map((r: any) => r.con_name ? String(r.con_name).trim() : "")
        .filter(Boolean)
    )];
    return concepts;
  } catch (e) {
    console.warn("获取 ths_member 失败:", e);
    return [];
  }
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
  concept: string[];
  chg: number | null;
  turnover: number | null;
  amount: number | null;
  debt_ratio: number | null;
  peTTM: number | null;
  holderNum: number | null; // 股东人数（最新）
  holderTrend: HolderNumberTrend | null; // 股东人数趋势
} | null> {
  try {
    const cleanCode = code.replace(/[^\d]/g, "").padStart(6, "0");
    if (cleanCode.length !== 6) {
      return null;
    }

    const tsCode = codeToTsCode(cleanCode);
    if (!tsCode) {
      return null;
    }

    const basicInfo = await getStockBasic(tsCode);
    if (!basicInfo || basicInfo.length === 0) {
      return null;
    }

    const stock = basicInfo[0];
    const normalizedReturn = String(stock.symbol ?? "").replace(/[^\d]/g, "").padStart(6, "0");
    if (normalizedReturn !== cleanCode) {
      console.error(`代码查询不匹配: 输入 ${cleanCode}, 返回 symbol ${stock.symbol} -> ${normalizedReturn}, 股票名称: ${stock.name}`);
      return null;
    }
    let chg: number | null = null;
    let turnover: number | null = null;
    let amount: number | null = null;
    let debt_ratio: number | null = null;
    let peTTM: number | null = null;
    let holderNum: number | null = null;
    let holderTrend: HolderNumberTrend | null = null;
    let concepts: string[] = [];

    // 顺序获取日线行情、每日指标、财务指标、概念（避免并发触发限频）
    if (stock.ts_code) {
      // 日线行情 → 涨跌幅
      if (tradeDate) {
        try {
          const dailyRows = await getDaily(stock.ts_code, tradeDate);
          if (dailyRows && dailyRows.length > 0) {
            chg = dailyRows[0].pct_chg || null;
          }
        } catch (e) {
          console.warn("获取日线行情失败:", e);
        }
      }

      // 每日指标 → 换手率 + 总市值（万元→亿元）+ PE(TTM)
      if (tradeDate) {
        try {
          const db = await getDailyBasic(stock.ts_code, tradeDate);
          if (db) {
            turnover = db.turnover;
            amount = db.totalMv != null ? Math.round((db.totalMv / 10000) * 100) / 100 : null;
            peTTM = db.peTTM;
          }
        } catch (e) {
          console.warn("获取每日指标失败:", e);
        }
      }

      // 财务指标 → 资产负债率
      try {
        const fina = await getFinaIndicator(stock.ts_code);
        if (fina) {
          debt_ratio = fina.debtToAssets;
        }
      } catch (e) {
        console.warn("获取财务指标失败:", e);
      }

      // 概念 → 概念列表
      try {
        concepts = await getStockConcepts(stock.ts_code);
      } catch (e) {
        console.warn("获取概念失败:", e);
      }

      // 股东人数趋势
      try {
        const trend = await getShareNumberTrend(stock.ts_code);
        if (trend) {
          holderTrend = trend;
          holderNum = trend.latestHolderNum;
        }
      } catch (e) {
        console.warn("获取股东人数趋势失败:", e);
      }
    }

    return {
      name: stock.name,
      industry: stock.industry || null,
      concept: concepts,
      chg,
      turnover,
      amount,
      debt_ratio,
      peTTM,
      holderNum,
      holderTrend,
    };
  } catch (error) {
    console.error("获取股票信息失败:", error);
    return null;
  }
}

/**
 * 单个前高点信息
 */
export type HighPoint = {
  price: number;           // 高点价格
  date: string;            // 高点日期 YYYY-MM-DD
  proximityPercent: number; // 目标价距离该高点的百分比
  aboveOrBelow: "above" | "below" | "equal"; // 目标价与该高点关系
};

/**
 * 获取股票多个前高点（第一/二/三高点）及其与"最新收盘价+10%"的距离
 * 第一高点 = 最高价，第二高点 = 次高价（且与第一高点间隔至少20个交易日），以此类推
 * @param code 6位股票代码
 * @returns 多个前高点信息，若无法计算返回 null
 */
export async function getHighProximity(
  code: string
): Promise<{
  highPoints: HighPoint[];       // 多个前高点（按价格降序）
  latestClose: number;           // 最新收盘价
  latestTradeDate: string;       // 最新交易日 YYYY-MM-DD
  targetPrice: number;           // 最新收盘价 + 10%
  nearestHighIndex: number;      // 距离目标价最近的高点索引（-1表示无）
} | null> {
  const tsCode = codeToTsCode(code);
  if (!tsCode) throw new Error(`无法识别股票代码 ${code}`);

  // 取近 365 个自然日的日线数据
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 365);
  const fmt = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;

  const rows = await getDailyRange(tsCode, fmt(start), fmt(today));
  if (!rows || rows.length < 20) {
    return null;
  }

  // 按日期正序排列，并记录每个交易日的索引
  const sorted = [...rows].sort((a, b) => a.trade_date.localeCompare(b.trade_date));

  // 格式化日期 YYYYMMDD → YYYY-MM-DD
  const formatDate = (ymd: string) =>
    `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;

  // 找出多个前高点：按最高价降序，每个高点之间需间隔至少 MIN_GAP_DAYS 个交易日
  const MIN_GAP_DAYS = 20; // 高点之间最小间隔天数
  const highPointsRaw: { price: number; date: string; index: number }[] = [];

  // 收集所有高点候选（按价格降序）
  const candidates = sorted
    .map((r, idx) => ({ price: r.high, date: r.trade_date, index: idx }))
    .filter(r => typeof r.price === "number" && r.price > 0)
    .sort((a, b) => b.price - a.price);

  // 选出间隔足够的前高点（最多3个）
  for (const c of candidates) {
    // 检查是否与已选高点间隔足够
    const hasNearby = highPointsRaw.some(h => 
      Math.abs(h.index - c.index) < MIN_GAP_DAYS
    );
    if (!hasNearby) {
      highPointsRaw.push(c);
      if (highPointsRaw.length >= 3) break;
    }
  }

  if (highPointsRaw.length === 0) {
    return null;
  }

  // 最新收盘价（最后一条记录）
  const latest = sorted[sorted.length - 1];
  const latestClose = latest.close;
  const latestTradeDate = latest.trade_date;

  if (typeof latestClose !== "number" || latestClose <= 0) {
    return null;
  }

  // 目标价 = 最新收盘价 + 10%
  const targetPrice = latestClose * 1.10;

  // 计算每个高点与目标价的关系
  const highPoints: HighPoint[] = highPointsRaw.map(h => {
    const diff = targetPrice - h.price;
    const proximityPercent = Math.abs(diff) / h.price * 100;
    let aboveOrBelow: "above" | "below" | "equal";
    if (Math.abs(diff) < 0.01) {
      aboveOrBelow = "equal";
    } else if (diff > 0) {
      aboveOrBelow = "above";
    } else {
      aboveOrBelow = "below";
    }
    return {
      price: Math.round(h.price * 100) / 100,
      date: formatDate(h.date),
      proximityPercent: Math.round(proximityPercent * 100) / 100,
      aboveOrBelow,
    };
  });

  // 找距离目标价最近的高点
  let nearestHighIndex = -1;
  let minProximity = Infinity;
  for (let i = 0; i < highPoints.length; i++) {
    if (highPoints[i].proximityPercent < minProximity) {
      minProximity = highPoints[i].proximityPercent;
      nearestHighIndex = i;
    }
  }

  return {
    highPoints,
    latestClose: Math.round(latestClose * 100) / 100,
    latestTradeDate: formatDate(latestTradeDate),
    targetPrice: Math.round(targetPrice * 100) / 100,
    nearestHighIndex,
  };
}

/**
 * 获取股票周线数据
 * @param tsCode 股票代码（如 000001.SZ）
 * @param startDate 开始日期 YYYYMMDD
 * @param endDate 结束日期 YYYYMMDD
 */
export async function getWeeklyData(
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
  vol: number;
  amount: number;
}>> {
  return callTushareAPI(
    "weekly",
    {
      ts_code: tsCode,
      start_date: startDate,
      end_date: endDate,
    },
    ["ts_code", "trade_date", "open", "high", "low", "close", "vol", "amount"]
  );
}

/**
 * 周线成交量形态分析结果
 * 分析最近4周（包含本周）
 */
export interface WeeklyVolumePattern {
  hasPattern: boolean; // 是否符合温和放量形态
  patternType: "gentle_ramp" | "none"; // 形态类型：温和放量 | 无形态
  patternStrength: number; // 形态强度评分 (0-100)
  description: string; // 形态描述
  weekCount: number; // 分析的周数
  weeklyVolumes: number[]; // 各周成交量（最近4周，从远到近：W4, W3, W2, W1）
  weekMinus1Volume: number; // W1 - 最近一周（本周）
  weekMinus2Volume: number; // W2 - 前1周
  weekMinus3Volume: number; // W3 - 前2周
  weekMinus4Volume: number; // W4 - 前3周（最早）
}

/**
 * 检测周线成交量温和放量形态
 * 分析最近4周（包含本周）
 * 形态：W4(放量) → W3(缩量) → W2(缩量) → W1(再放量)
 */
export async function analyzeWeeklyVolumePattern(
  code: string
): Promise<WeeklyVolumePattern> {
  const tsCode = codeToTsCode(code);
  if (!tsCode) {
    return {
      hasPattern: false,
      patternType: "none",
      patternStrength: 0,
      description: "无法识别股票代码",
      weekCount: 0,
      weeklyVolumes: [],
      weekMinus1Volume: 0,
      weekMinus2Volume: 0,
      weekMinus3Volume: 0,
      weekMinus4Volume: 0,
    };
  }

  // 获取近8周的周线数据
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 60); // 约8周
  const fmt = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;

  const weeklyData = await getWeeklyData(tsCode, fmt(startDate), fmt(today));

  // 需要至少4条周线数据
  if (!weeklyData || weeklyData.length < 4) {
    return {
      hasPattern: false,
      patternType: "none",
      patternStrength: 0,
      description: "周线数据不足",
      weekCount: weeklyData?.length || 0,
      weeklyVolumes: [],
      weekMinus1Volume: 0,
      weekMinus2Volume: 0,
      weekMinus3Volume: 0,
      weekMinus4Volume: 0,
    };
  }

  // 按日期降序，取最近4周（sorted[0-3]，包含本周）
  const sorted = [...weeklyData].sort((a, b) => b.trade_date.localeCompare(a.trade_date));

  const w1 = sorted[0]; // 最近一周（本周）
  const w2 = sorted[1]; // 前1周
  const w3 = sorted[2]; // 前2周
  const w4 = sorted[3]; // 前3周（最早）

  if (!w1 || !w2 || !w3 || !w4) {
    return {
      hasPattern: false,
      patternType: "none",
      patternStrength: 0,
      description: "周线数据不足",
      weekCount: weeklyData.length,
      weeklyVolumes: [],
      weekMinus1Volume: 0,
      weekMinus2Volume: 0,
      weekMinus3Volume: 0,
      weekMinus4Volume: 0,
    };
  }

  // 从远到近：W4, W3, W2, W1
  const v4 = w4.vol || 0; // 最早
  const v3 = w3.vol || 0;
  const v2 = w2.vol || 0;
  const v1 = w1.vol || 0; // 最近（本周）

  const weeklyVolumes = [v4, v3, v2, v1];

  // ── 主升过滤：排除涨幅过大的股票 ──
  const p4 = w4.close || 0;
  const p3 = w3.close || 0;
  const p2 = w2.close || 0;
  const p1 = w1.close || 0;

  const week4Change = p4 > 0 && p3 > 0 ? (p3 - p4) / p4 : 0;
  const week3Change = p3 > 0 && p2 > 0 ? (p2 - p3) / p3 : 0;
  const week2Change = p2 > 0 && p1 > 0 ? (p1 - p2) / p2 : 0;
  const totalChange = p4 > 0 && p1 > 0 ? (p1 - p4) / p4 : 0;

  const MAX_TOTAL_CHANGE = 0.25;
  const MAX_WEEK_CHANGE = 0.20;
  const isReasonableChange = totalChange <= MAX_TOTAL_CHANGE &&
    Math.abs(week4Change) <= MAX_WEEK_CHANGE &&
    Math.abs(week3Change) <= MAX_WEEK_CHANGE &&
    Math.abs(week2Change) <= MAX_WEEK_CHANGE;

  // ═══════════════════════════════════════════════════════════
  // 温和放量（gentle_ramp）：成交量递增，涨幅合理
  // ═══════════════════════════════════════════════════════════
  const rampRatio1 = v4 > 0 ? v3 / v4 : 1;
  const rampRatio2 = v3 > 0 ? v2 / v3 : 1;
  const rampRatio3 = v2 > 0 ? v1 / v2 : 1;

  const MIN_RAMP = 1.0;
  const MAX_RAMP = 1.5;
  const isGentleRamp = 
    v4 > 0 &&
    v3 >= v4 * MIN_RAMP && v3 <= v4 * MAX_RAMP &&
    v2 >= v3 * MIN_RAMP && v2 <= v3 * MAX_RAMP &&
    v1 >= v2 * MIN_RAMP && v1 <= v2 * MAX_RAMP;

  const hasPattern = isGentleRamp && isReasonableChange;

  // 评分
  let patternStrength = 0;

  const avgRampRate = (rampRatio1 + rampRatio2 + rampRatio3) / 3;
  const rampVariance = (
    Math.abs(rampRatio1 - avgRampRate) +
    Math.abs(rampRatio2 - avgRampRate) +
    Math.abs(rampRatio3 - avgRampRate)
  ) / 3;
  const stabilityScore = Math.max(0, 30 - rampVariance * 40);
  patternStrength += stabilityScore;

  const idealRampChange = 0.15;
  const rampChangeScore = Math.max(0, 20 - Math.abs(totalChange - idealRampChange) * 100);
  patternStrength += rampChangeScore;

  const totalRampRatio = v4 > 0 ? v1 / v4 : 1;
  const totalRampScore = Math.max(0, 20 - Math.abs(totalRampRatio - 2.0) * 10);
  patternStrength += totalRampScore;

  if (isReasonableChange) patternStrength += 10;
  if (hasPattern) patternStrength += 20;
  patternStrength = Math.max(0, Math.min(100, patternStrength));

  // 描述
  const patternType = hasPattern ? "gentle_ramp" : "none";
  let description = "";
  if (hasPattern) {
    const totalRampPercent = Math.round((totalRampRatio - 1) * 100);
    const avgRampPercent = Math.round((avgRampRate - 1) * 100);
    description = `温和放量 | 总增${totalRampPercent}% | 周均增${avgRampPercent}%`;
  } else if (!isReasonableChange) {
    description = `涨幅过大`;
  } else if (!isGentleRamp) {
    // 计算各周量变化百分比
    const r1p = v4 > 0 ? Math.round((v3 / v4 - 1) * 100) : 0;
    const r2p = v3 > 0 ? Math.round((v2 / v3 - 1) * 100) : 0;
    const r3p = v2 > 0 ? Math.round((v1 / v2 - 1) * 100) : 0;
    description = `量变: ${r1p >= 0 ? "+" : ""}${r1p}% | ${r2p >= 0 ? "+" : ""}${r2p}% | ${r3p >= 0 ? "+" : ""}${r3p}%`;
  }

  return {
    hasPattern,
    patternType,
    patternStrength,
    description,
    weekCount: 4,
    weeklyVolumes,
    weekMinus1Volume: Math.round(v1),
    weekMinus2Volume: Math.round(v2),
    weekMinus3Volume: Math.round(v3),
    weekMinus4Volume: Math.round(v4),
  };
}
