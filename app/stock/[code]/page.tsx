"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  ArrowLeft, Loader2, Sparkles, AlertTriangle, TrendingUp, Shield, 
  Target, BarChart3, ExternalLink, FileText, Calendar, Building2,
  TrendingDown, Activity, PieChart, DollarSign
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

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
}

interface AnalysisLinks {
  xueqiu: string;
  announcement: string;
  annualReport: string;
}

interface AnalysisResult {
  content: string;
  analysisData?: {
    基本面?: {
      主营业务?: string;
      行业地位?: string;
      财务简评?: string;
    };
    炒作预期?: {
      短期逻辑?: string;
      中期催化剂?: string;
      板块轮动?: string;
    };
    技术面?: {
      价位分析?: string;
      支撑位?: string;
      压力位?: string;
      量能?: string;
    };
    风险提示?: {
      短期风险?: string;
      中长期风险?: string;
      流动性风险?: string;
    };
    操作建议?: {
      建议仓位?: string;
      止损位?: string;
      目标位?: string;
      综合评级?: string;
    };
    综合评分?: {
      基本面评分?: number;
      技术面评分?: number;
      风险评分?: number;
      综合评分?: number;
    };
  };
  stock: StockInfo;
  marketData?: MarketData;
  links: AnalysisLinks;
  reports: Array<{
    source: string;
    title: string;
    summary: string;
    date?: string;
    type: string;
  }>;
}

// 评分颜色映射
function getScoreColor(score: number): string {
  if (score >= 70) return "text-green-500";
  if (score >= 50) return "text-amber-500";
  return "text-red-500";
}

function getScoreBg(score: number): string {
  if (score >= 70) return "bg-green-500";
  if (score >= 50) return "bg-amber-500";
  return "bg-red-500";
}

function getRatingBadge(rating: string): { color: string; icon: React.ReactNode } {
  if (rating?.includes("看多") || rating?.includes("买入")) {
    return { color: "bg-green-500 text-white", icon: <TrendingUp className="h-4 w-4" /> };
  }
  if (rating?.includes("看空") || rating?.includes("卖出")) {
    return { color: "bg-red-500 text-white", icon: <TrendingDown className="h-4 w-4" /> };
  }
  return { color: "bg-amber-500 text-white", icon: <Activity className="h-4 w-4" /> };
}

export default function StockAnalysisPage() {
  const params = useParams();
  const router = useRouter();
  const code = params?.code as string;
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  
  // 博主分析状态
  const [bloggerLoading, setBloggerLoading] = useState(false);
  const [bloggerResult, setBloggerResult] = useState<any>(null);

  // 获取博主视角分析
  const fetchBloggerAnalysis = async (bloggerName: string) => {
    if (!result?.stock) return;
    
    setBloggerLoading(true);
    setBloggerResult(null);
    
    try {
      const res = await fetch("/api/ai/stock-blogger-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stock: result.stock,
          bloggerName
        }),
      });
      
      const data = await res.json();
      
      if (data.error) {
        console.error("博主分析失败:", data.error);
      } else {
        setBloggerResult(data);
      }
    } catch (e: any) {
      console.error("博主分析请求失败:", e);
    } finally {
      setBloggerLoading(false);
    }
  };

  useEffect(() => {
    if (!code) {
      setError("缺少股票代码");
      setLoading(false);
      return;
    }

    // 从URL参数获取股票信息
    const urlParams = new URLSearchParams(window.location.search);
    const name = urlParams.get("name") || "";
    const sector = urlParams.get("sector")?.split(",").filter(Boolean) || [];
    const concept = urlParams.get("concept")?.split(",").filter(Boolean) || [];

    const stock: StockInfo = { code, name, sector, concept };

    // 调用AI分析API
    fetch("/api/ai/stock-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stock }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setResult(data);
        }
      })
      .catch((e) => {
        setError(e.message || "请求失败");
      })
      .finally(() => setLoading(false));
  }, [code]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="mx-auto max-w-5xl w-full px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.back()}
                className="h-9 w-9"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-amber-500" />
                  {result?.stock?.name || "个股AI分析"}
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {result?.links?.xueqiu ? (
                    <a 
                      href={result.links.xueqiu} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="hover:text-primary flex items-center gap-1"
                    >
                      {code} <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : code}
                </p>
              </div>
            </div>
            
            {/* 快捷链接 */}
            {result?.links && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1"
                  onClick={() => window.open(result.links.xueqiu, "_blank")}
                >
                  <BarChart3 className="h-3 w-3" />
                  雪球
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1"
                  onClick={() => window.open(result.links.announcement, "_blank")}
                >
                  <FileText className="h-3 w-3" />
                  公告
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1"
                  onClick={() => window.open(result.links.annualReport, "_blank")}
                >
                  <Calendar className="h-3 w-3" />
                  年报
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-5xl w-full px-4 py-6">
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="mt-4 text-sm text-muted-foreground">
              正在获取公告和年报数据，AI分析中...
            </p>
            <p className="mt-2 text-xs text-muted-foreground/70">
              首次请求可能需要10-30秒
            </p>
          </div>
        )}

        {error && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader>
              <CardTitle className="text-destructive flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                分析失败
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => window.location.reload()}
              >
                重试
              </Button>
            </CardContent>
          </Card>
        )}

        {result && !loading && !error && (
          <div className="space-y-6">
            {/* 股票信息卡片 */}
            <Card>
              <CardContent className="py-4">
                <div className="flex flex-wrap gap-2">
                  {result.stock.sector?.map((s) => (
                    <Badge
                      key={s}
                      variant="secondary"
                      className="text-xs"
                    >
                      {s}
                    </Badge>
                  ))}
                  {result.stock.concept?.map((c) => (
                    <Badge
                      key={c}
                      variant="outline"
                      className="text-xs border-amber-500/50 text-amber-600 dark:text-amber-400"
                    >
                      {c}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 实时行情数据卡片 */}
            {result.marketData && (
              <Card className="bg-gradient-to-br from-blue-500/10 to-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Activity className="h-5 w-5 text-blue-500" />
                    实时行情
                    <span className="text-xs font-normal text-muted-foreground ml-auto">
                      {result.marketData.latestDate}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-secondary/50 rounded-lg p-3 text-center">
                      <div className="text-xs text-muted-foreground mb-1">最新价</div>
                      <div className="text-2xl font-bold text-blue-500">{result.marketData.latestClose}</div>
                    </div>
                    <div className="bg-secondary/50 rounded-lg p-3 text-center">
                      <div className="text-xs text-muted-foreground mb-1">周涨跌</div>
                      <div className={`text-xl font-bold ${result.marketData.weekChange >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                        {result.marketData.weekChange > 0 ? '+' : ''}{result.marketData.weekChange}%
                      </div>
                    </div>
                    <div className="bg-secondary/50 rounded-lg p-3 text-center">
                      <div className="text-xs text-muted-foreground mb-1">月涨跌</div>
                      <div className={`text-xl font-bold ${result.marketData.monthChange >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                        {result.marketData.monthChange > 0 ? '+' : ''}{result.marketData.monthChange}%
                      </div>
                    </div>
                    <div className="bg-secondary/50 rounded-lg p-3 text-center">
                      <div className="text-xs text-muted-foreground mb-1">成交量</div>
                      <div className="text-xl font-bold">{Math.round(result.marketData.latestVol / 10000)}万手</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground">今开</div>
                      <div className="text-sm font-medium">{result.marketData.latestOpen}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground">最高</div>
                      <div className="text-sm font-medium text-red-500">{result.marketData.latestHigh}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground">最低</div>
                      <div className="text-sm font-medium text-green-500">{result.marketData.latestLow}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground">周最高/最低</div>
                      <div className="text-sm font-medium">{result.marketData.weekHigh} / {result.marketData.weekLow}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 md:grid-cols-4 gap-3 mt-3 pt-3 border-t border-border">
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground">MA5</div>
                      <div className="text-sm font-medium">{result.marketData.ma5 ?? '-'}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground">MA10</div>
                      <div className="text-sm font-medium">{result.marketData.ma10 ?? '-'}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground">MA20</div>
                      <div className="text-sm font-medium">{result.marketData.ma20 ?? '-'}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground">MA30</div>
                      <div className="text-sm font-medium">{result.marketData.ma30 ?? '-'}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 综合评分卡片 */}
            {result.analysisData?.综合评分 && (
              <Card className="bg-gradient-to-br from-card to-secondary/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <PieChart className="h-5 w-5 text-primary" />
                    综合评分
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: "基本面", score: result.analysisData.综合评分.基本面评分, icon: <Building2 className="h-4 w-4" /> },
                      { label: "技术面", score: result.analysisData.综合评分.技术面评分, icon: <BarChart3 className="h-4 w-4" /> },
                      { label: "风险度", score: result.analysisData.综合评分.风险评分, icon: <Shield className="h-4 w-4" /> },
                      { label: "综合", score: result.analysisData.综合评分.综合评分, icon: <Target className="h-4 w-4" /> },
                    ].map((item) => (
                      <div key={item.label} className="text-center">
                        <div className="flex items-center justify-center gap-1 mb-1 text-muted-foreground text-xs">
                          {item.icon}
                          {item.label}
                        </div>
                        <div className={`text-2xl font-bold ${getScoreColor(item.score || 0)}`}>
                          {item.score ?? "-"}
                        </div>
                        <Progress 
                          value={item.score || 0} 
                          className="h-2 mt-2"
                        />
                      </div>
                    ))}
                  </div>
                  
                  {/* 综合评级 */}
                  {result.analysisData?.操作建议?.综合评级 && (
                    <div className="mt-4 flex justify-center">
                      <Badge 
                        className={`px-4 py-2 text-base gap-2 ${getRatingBadge(result.analysisData.操作建议.综合评级).color}`}
                      >
                        {getRatingBadge(result.analysisData.操作建议.综合评级).icon}
                        {result.analysisData.操作建议.综合评级}
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* 操作建议卡片 */}
            {result.analysisData?.操作建议 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-green-500" />
                    操作建议
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-secondary/50 rounded-lg p-3">
                      <div className="text-xs text-muted-foreground mb-1">建议仓位</div>
                      <div className="text-lg font-semibold">{result.analysisData.操作建议.建议仓位 || "-"}</div>
                    </div>
                    <div className="bg-red-500/10 rounded-lg p-3 border border-red-500/20">
                      <div className="text-xs text-muted-foreground mb-1">止损位</div>
                      <div className="text-lg font-semibold text-red-500">{result.analysisData.操作建议.止损位 || "-"}</div>
                    </div>
                    <div className="bg-green-500/10 rounded-lg p-3 border border-green-500/20">
                      <div className="text-xs text-muted-foreground mb-1">目标位</div>
                      <div className="text-lg font-semibold text-green-500">{result.analysisData.操作建议.目标位 || "-"}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 详细分析网格 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 基本面 */}
              {result.analysisData?.基本面 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-blue-500" />
                      基本面分析
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {result.analysisData.基本面.主营业务 && (
                      <div>
                        <span className="text-muted-foreground">主营业务：</span>
                        <span>{result.analysisData.基本面.主营业务}</span>
                      </div>
                    )}
                    {result.analysisData.基本面.行业地位 && (
                      <div>
                        <span className="text-muted-foreground">行业地位：</span>
                        <span>{result.analysisData.基本面.行业地位}</span>
                      </div>
                    )}
                    {result.analysisData.基本面.财务简评 && (
                      <div>
                        <span className="text-muted-foreground">财务简评：</span>
                        <span>{result.analysisData.基本面.财务简评}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* 炒作预期 */}
              {result.analysisData?.炒作预期 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-amber-500" />
                      炒作预期
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {result.analysisData.炒作预期.短期逻辑 && (
                      <div>
                        <span className="text-muted-foreground">短期逻辑：</span>
                        <span>{result.analysisData.炒作预期.短期逻辑}</span>
                      </div>
                    )}
                    {result.analysisData.炒作预期.中期催化剂 && (
                      <div>
                        <span className="text-muted-foreground">中期催化剂：</span>
                        <span>{result.analysisData.炒作预期.中期催化剂}</span>
                      </div>
                    )}
                    {result.analysisData.炒作预期.板块轮动 && (
                      <div>
                        <span className="text-muted-foreground">板块轮动：</span>
                        <span>{result.analysisData.炒作预期.板块轮动}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* 技术面 */}
              {result.analysisData?.技术面 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Activity className="h-4 w-4 text-purple-500" />
                      技术面分析
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {result.analysisData.技术面.价位分析 && (
                      <div>
                        <span className="text-muted-foreground">价位分析：</span>
                        <span>{result.analysisData.技术面.价位分析}</span>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      {result.analysisData.技术面.支撑位 && (
                        <div className="bg-green-500/10 rounded p-2">
                          <div className="text-xs text-muted-foreground">支撑位</div>
                          <div className="font-medium text-green-500">{result.analysisData.技术面.支撑位}</div>
                        </div>
                      )}
                      {result.analysisData.技术面.压力位 && (
                        <div className="bg-red-500/10 rounded p-2">
                          <div className="text-xs text-muted-foreground">压力位</div>
                          <div className="font-medium text-red-500">{result.analysisData.技术面.压力位}</div>
                        </div>
                      )}
                    </div>
                    {result.analysisData.技术面.量能 && (
                      <div>
                        <span className="text-muted-foreground">量能：</span>
                        <span>{result.analysisData.技术面.量能}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* 风险提示 */}
              {result.analysisData?.风险提示 && (
                <Card className="border-red-500/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2 text-red-500">
                      <AlertTriangle className="h-4 w-4" />
                      风险提示
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {result.analysisData.风险提示.短期风险 && (
                      <div>
                        <span className="text-muted-foreground">短期风险：</span>
                        <span className="text-red-500">{result.analysisData.风险提示.短期风险}</span>
                      </div>
                    )}
                    {result.analysisData.风险提示.中长期风险 && (
                      <div>
                        <span className="text-muted-foreground">中长期风险：</span>
                        <span className="text-red-500">{result.analysisData.风险提示.中长期风险}</span>
                      </div>
                    )}
                    {result.analysisData.风险提示.流动性风险 && (
                      <div>
                        <span className="text-muted-foreground">流动性风险：</span>
                        <span className="text-red-500">{result.analysisData.风险提示.流动性风险}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* 公告/报告来源 */}
            {result.reports && result.reports.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    数据来源
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {result.reports.map((r, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {r.source}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 博主视角分析 */}
            <Card className="border-purple-500/30 bg-gradient-to-br from-purple-500/5 to-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-500" />
                  博主视角分析
                  <Badge variant="outline" className="text-xs border-purple-500/50 text-purple-600">
                    AI模拟
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  选择一位博主，用他的投资理念和交易体系来分析这只股票
                </p>
                
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchBloggerAnalysis("邻居大爷")}
                    className="gap-2"
                  >
                    <span className="h-6 w-6 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs">
                      邻
                    </span>
                    邻居大爷
                  </Button>
                  {/* 更多博主可以在这里添加 */}
                </div>
                
                {/* 博主分析结果 */}
                {bloggerLoading && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
                    <span className="ml-2 text-sm text-muted-foreground">正在用博主视角分析...</span>
                  </div>
                )}
                
                {bloggerResult?.analysisData && !bloggerLoading && (
                  <div className="mt-4 space-y-4 border-t border-purple-500/20 pt-4">
                    {/* 当前阶段 */}
                    <div className="bg-secondary/50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">当前阶段判断</span>
                        <Badge variant="outline" className="border-purple-500 text-purple-600">
                          {bloggerResult.analysisData.当前阶段判断 || "分析中"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {bloggerResult.analysisData.主力意图分析}
                      </p>
                    </div>
                    
                    {/* 匹配的交易模式 */}
                    {bloggerResult.analysisData.匹配的交易模式 && (
                      <div className="bg-purple-500/10 rounded-lg p-4 border border-purple-500/20">
                        <div className="text-sm font-medium mb-2 flex items-center gap-2">
                          <Target className="h-4 w-4 text-purple-500" />
                          匹配的交易模式
                        </div>
                        <p className="text-sm">{bloggerResult.analysisData.匹配的交易模式}</p>
                      </div>
                    )}
                    
                    {/* 关键观察点 */}
                    {bloggerResult.analysisData.关键观察点?.length > 0 && (
                      <div>
                        <div className="text-sm font-medium mb-2">关键观察点</div>
                        <ul className="space-y-1">
                          {bloggerResult.analysisData.关键观察点.map((point: string, i: number) => (
                            <li key={i} className="text-sm flex items-start gap-2">
                              <span className="text-purple-500 font-bold">•</span>
                              {point}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {/* 风险警示 */}
                    {bloggerResult.analysisData.风险警示?.length > 0 && (
                      <div className="bg-red-500/10 rounded-lg p-4 border border-red-500/20">
                        <div className="text-sm font-medium mb-2 flex items-center gap-2 text-red-500">
                          <AlertTriangle className="h-4 w-4" />
                          风险警示
                        </div>
                        <ul className="space-y-1">
                          {bloggerResult.analysisData.风险警示.map((risk: string, i: number) => (
                            <li key={i} className="text-sm text-red-600 dark:text-red-400">
                              {risk}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {/* 操作建议 */}
                    {bloggerResult.analysisData.操作建议 && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-secondary/50 rounded-lg p-3 text-center">
                          <div className="text-xs text-muted-foreground">是否可介入</div>
                          <div className="text-sm font-medium mt-1">
                            {bloggerResult.analysisData.操作建议.是否可介入}
                          </div>
                        </div>
                        <div className="bg-secondary/50 rounded-lg p-3 text-center">
                          <div className="text-xs text-muted-foreground">介入时机</div>
                          <div className="text-sm font-medium mt-1">
                            {bloggerResult.analysisData.操作建议.介入时机}
                          </div>
                        </div>
                        <div className="bg-secondary/50 rounded-lg p-3 text-center">
                          <div className="text-xs text-muted-foreground">仓位建议</div>
                          <div className="text-sm font-medium mt-1">
                            {bloggerResult.analysisData.操作建议.仓位建议}
                          </div>
                        </div>
                        <div className="bg-secondary/50 rounded-lg p-3 text-center">
                          <div className="text-xs text-muted-foreground">止损策略</div>
                          <div className="text-sm font-medium mt-1">
                            {bloggerResult.analysisData.操作建议.止损策略}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* 博主点评 */}
                    {bloggerResult.analysisData.博主点评 && (
                      <div className="bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-lg p-4 border border-purple-500/30">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-sm">
                            {bloggerResult.bloggerName?.charAt(0) || "博"}
                          </span>
                          <span className="font-medium">{bloggerResult.bloggerName}点评</span>
                        </div>
                        <p className="text-sm italic text-muted-foreground">
                          "{bloggerResult.analysisData.博主点评}"
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 原始分析（可折叠） */}
            <details className="group">
              <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                <span>查看原始分析结果</span>
                <span className="group-open:hidden">展开</span>
                <span className="hidden group-open:inline">收起</span>
              </summary>
              <Card className="mt-3 bg-secondary/50">
                <CardContent className="py-4">
                  <pre className="text-xs whitespace-pre-wrap overflow-x-auto font-mono text-muted-foreground max-h-96 overflow-y-auto">
                    {result.content}
                  </pre>
                </CardContent>
              </Card>
            </details>

            {/* 免责声明 */}
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-muted-foreground">
                    <p className="font-medium text-amber-600 dark:text-amber-400 mb-1">
                      免责声明
                    </p>
                    <p>
                      本分析由AI生成，仅供参考，不构成任何投资建议。投资有风险，入市需谨慎。
                      请结合自身风险承受能力，独立做出投资决策。
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}