"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  Video,
  Brain,
  TrendingUp,
  BarChart3,
  Target,
  Shield,
  Eye,
  Heart,
  Users,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Layers
} from "lucide-react"

interface ProfileData {
  blogger_name: string
  metadata: {
    total_videos: number
    total_batches: number
    successful_batches: number
    analysis_time: string
  }
  batch_results: Array<{
    batch_num: number
    video_range: string
    video_count: number
    result: {
      status: string
      analysis: {
        "一、交易哲学": Record<string, string>
        "二、资金行为": Record<string, string>
        "三、市场环境": Record<string, any>
        "四、核心交易模式": Record<string, any>
        "五、认知层级": Record<string, string>
        "六、真正隐藏的核心": Record<string, string>
      }
    }
  }>
}

// 数据概览卡片
function StatCard({ icon, value, label, color }: { icon: React.ReactNode; value: string | number; label: string; color: string }) {
  return (
    <Card className={`bg-gradient-to-br ${color} border-0`}>
      <CardContent className="p-4 text-center">
        <div className="mb-2">{icon}</div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-sm text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  )
}

// 关键洞察卡片
function InsightCard({ title, content, icon, variant = "default" }: { title: string; content: string; icon: React.ReactNode; variant?: "default" | "warning" | "success" | "purple" }) {
  const variantStyles = {
    default: "bg-muted/50",
    warning: "bg-red-500/10 border-red-500/30",
    success: "bg-green-500/10 border-green-500/30",
    purple: "bg-purple-500/10 border-purple-500/30"
  }
  
  return (
    <Card className={`${variantStyles[variant]} overflow-hidden`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
      </CardContent>
    </Card>
  )
}

// 交易模式卡片
function PatternCard({ name, data }: { name: string; data: Record<string, string> }) {
  return (
    <Card className="bg-gradient-to-br from-indigo-500/5 to-purple-500/5 border-indigo-500/20">
      <CardHeader className="pb-2">
        <Badge variant="outline" className="border-indigo-500 text-indigo-600 mb-1">{name}</Badge>
        {data["形态名称"] && (
          <CardDescription className="font-medium text-indigo-700">{data["形态名称"]}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-xs">
          {Object.entries(data).filter(([k]) => k !== "形态名称").map(([key, val]) => (
            <div key={key} className="flex gap-2">
              <span className="font-semibold text-muted-foreground shrink-0 w-20">{key}:</span>
              <span className="text-muted-foreground">{val}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// 环境适用性卡片
function EnvironmentCard({ env, reason, suitable }: { env: string; reason: string; suitable: boolean }) {
  return (
    <Card className={`${suitable ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-1">
          {suitable ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-red-500" />
          )}
          <Badge variant={suitable ? "default" : "destructive"} className={suitable ? "bg-green-600" : ""}>
            {env}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{reason}</p>
      </CardContent>
    </Card>
  )
}

export function BloggerProfileView({ data }: { data: ProfileData }) {
  const analysis = data.batch_results?.[0]?.result?.analysis
  
  if (!analysis) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
          <Brain className="h-10 w-10 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">暂无分析数据</h3>
        <p className="text-muted-foreground text-sm max-w-md">
          该博主尚未生成深度画像分析
        </p>
      </div>
    )
  }

  return (
    <ScrollArea className="h-[calc(90vh-100px)]">
      <div className="space-y-6 p-6">
        {/* 头部统计 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            icon={<Video className="h-8 w-8 mx-auto text-blue-500" />}
            value={data.metadata.total_videos}
            label="分析视频数"
            color="from-blue-500/10 to-blue-600/5"
          />
          <StatCard
            icon={<Layers className="h-8 w-8 mx-auto text-green-500" />}
            value={data.metadata.total_batches}
            label="分析批次"
            color="from-green-500/10 to-green-600/5"
          />
          <StatCard
            icon={<CheckCircle2 className="h-8 w-8 mx-auto text-purple-500" />}
            value={data.metadata.successful_batches}
            label="成功批次"
            color="from-purple-500/10 to-purple-600/5"
          />
          <StatCard
            icon={<Calendar className="h-8 w-8 mx-auto text-orange-500" />}
            value={data.metadata.analysis_time?.split('T')[0] || '-'}
            label="分析日期"
            color="from-orange-500/10 to-orange-600/5"
          />
        </div>

        {/* 一、交易哲学 */}
        {analysis["一、交易哲学"] && (
          <Card className="overflow-hidden border-l-4 border-l-blue-500">
            <CardHeader className="bg-gradient-to-r from-blue-500/10 to-transparent pb-3">
              <CardTitle className="flex items-center gap-2 text-blue-700">
                <Brain className="h-5 w-5" />
                一、交易哲学
              </CardTitle>
              <CardDescription>博主的核心信念与市场认知</CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {Object.entries(analysis["一、交易哲学"]).map(([key, value]) => (
                <InsightCard
                  key={key}
                  title={key}
                  content={value}
                  icon={<Target className="h-4 w-4 text-blue-500" />}
                />
              ))}
            </CardContent>
          </Card>
        )}

        {/* 二、资金行为 */}
        {analysis["二、资金行为"] && (
          <Card className="overflow-hidden border-l-4 border-l-green-500">
            <CardHeader className="bg-gradient-to-r from-green-500/10 to-transparent pb-3">
              <CardTitle className="flex items-center gap-2 text-green-700">
                <TrendingUp className="h-5 w-5" />
                二、资金行为分析
              </CardTitle>
              <CardDescription>主力资金的运作手法与逻辑</CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {Object.entries(analysis["二、资金行为"]).map(([key, value]) => (
                <InsightCard
                  key={key}
                  title={key}
                  content={value}
                  icon={<Zap className="h-4 w-4 text-green-500" />}
                  variant="success"
                />
              ))}
            </CardContent>
          </Card>
        )}

        {/* 三、市场环境 */}
        {analysis["三、市场环境"] && (
          <Card className="overflow-hidden border-l-4 border-l-orange-500">
            <CardHeader className="bg-gradient-to-r from-orange-500/10 to-transparent pb-3">
              <CardTitle className="flex items-center gap-2 text-orange-700">
                <BarChart3 className="h-5 w-5" />
                三、适用市场环境
              </CardTitle>
              <CardDescription>交易体系的适用场景分析</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {analysis["三、市场环境"]["适用环境分析"] ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Object.entries(analysis["三、市场环境"]["适用环境分析"]).map(([env, reason]) => (
                    <EnvironmentCard key={env} env={env} reason={String(reason)} suitable={true} />
                  ))}
                </div>
              ) : analysis["三、市场环境"]["适用环境"] ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Array.isArray(analysis["三、市场环境"]["适用环境"]) && 
                    analysis["三、市场环境"]["适用环境"].map((item: any, i: number) => (
                      <EnvironmentCard 
                        key={i} 
                        env={item["环境"] || item.environment} 
                        reason={item["原因"] || item.reason} 
                        suitable={true} 
                      />
                    ))
                  }
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-muted/50 border">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {String(analysis["三、市场环境"])}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 四、核心交易模式 */}
        {analysis["四、核心交易模式"] && (
          <Card className="overflow-hidden border-l-4 border-l-purple-500">
            <CardHeader className="bg-gradient-to-r from-purple-500/10 to-transparent pb-3">
              <CardTitle className="flex items-center gap-2 text-purple-700">
                <Target className="h-5 w-5" />
                四、核心交易模式
              </CardTitle>
              <CardDescription>实战交易形态与操作要点</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(analysis["四、核心交易模式"]).map(([modeName, modeData]) => (
                  <PatternCard 
                    key={modeName} 
                    name={modeName} 
                    data={typeof modeData === 'object' ? modeData as Record<string, string> : { "描述": String(modeData) }} 
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 五、认知定位 */}
        {analysis["五、认知层级"] && (
          <Card className="overflow-hidden border-l-4 border-l-cyan-500">
            <CardHeader className="bg-gradient-to-r from-cyan-500/10 to-transparent pb-3">
              <CardTitle className="flex items-center gap-2 text-cyan-700">
                <Eye className="h-5 w-5" />
                五、认知定位
              </CardTitle>
              <CardDescription>博主的交易风格与认知层级</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="p-6 rounded-xl bg-gradient-to-r from-cyan-500/10 via-blue-500/5 to-purple-500/10 border">
                {typeof analysis["五、认知层级"] === 'object' ? (
                  <div className="space-y-3">
                    {Object.entries(analysis["五、认知层级"]).map(([key, value]) => (
                      <div key={key}>
                        <Badge variant="secondary" className="mb-1">{key}</Badge>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap ml-1">{String(value)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed">{String(analysis["五、认知层级"])}</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 六、隐藏核心 */}
        {analysis["六、真正隐藏的核心"] && (
          <Card className="overflow-hidden border-l-4 border-l-red-500 bg-gradient-to-br from-red-500/5 to-orange-500/5">
            <CardHeader className="bg-gradient-to-r from-red-500/10 to-orange-500/5 pb-3">
              <CardTitle className="flex items-center gap-2 text-red-700">
                <Heart className="h-5 w-5 animate-pulse" />
                六、隐藏核心（关键洞察）
              </CardTitle>
              <CardDescription>视频未明说但真正关键的东西</CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {Object.entries(analysis["六、真正隐藏的核心"]).map(([key, value]) => (
                <InsightCard
                  key={key}
                  title={key}
                  content={value}
                  icon={<AlertTriangle className="h-4 w-4 text-red-500 animate-pulse" />}
                  variant="warning"
                />
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </ScrollArea>
  )
}