"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  ArrowLeft,
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
  Layers,
  FileText
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
      analysis: Record<string, any>
    }
  }>
}

// 数据概览卡片
function StatCard({ icon, value, label, color }: { icon: React.ReactNode; value: string | number; label: string; color: string }) {
  return (
    <Card className={`bg-gradient-to-br ${color} border-0 shadow-lg`}>
      <CardContent className="p-6 text-center">
        <div className="mb-3">{icon}</div>
        <div className="text-3xl font-bold">{value}</div>
        <div className="text-sm text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  )
}

// 关键洞察卡片
function InsightCard({ title, content, icon, variant = "default" }: { title: string; content: string; icon: React.ReactNode; variant?: "default" | "warning" | "success" | "purple" }) {
  const variantStyles = {
    default: "bg-muted/50 hover:bg-muted/70 transition-colors",
    warning: "bg-red-500/10 border-red-500/30 hover:bg-red-500/20 transition-colors",
    success: "bg-green-500/10 border-green-500/30 hover:bg-green-500/20 transition-colors",
    purple: "bg-purple-500/10 border-purple-500/30 hover:bg-purple-500/20 transition-colors"
  }
  
  return (
    <Card className={`${variantStyles[variant]} overflow-hidden`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
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
    <Card className="bg-gradient-to-br from-indigo-500/5 to-purple-500/5 border-indigo-500/20 hover:shadow-lg transition-shadow">
      <CardHeader className="pb-2">
        <Badge variant="outline" className="border-indigo-500 text-indigo-600 mb-1 w-fit">{name}</Badge>
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
    <Card className={`${suitable ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'} hover:shadow-md transition-shadow`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          {suitable ? (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-red-500" />
          )}
          <Badge variant={suitable ? "default" : "destructive"} className={suitable ? "bg-green-600" : ""}>
            {env}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{reason}</p>
      </CardContent>
    </Card>
  )
}

export default function BloggerProfilePage() {
  const params = useParams()
  const bloggerName = decodeURIComponent(params.name as string)
  
  const [data, setData] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    async function fetchProfile() {
      try {
        const response = await fetch(`/api/blogger-profile/${encodeURIComponent(bloggerName)}`)
        if (response.ok) {
          const profileData = await response.json()
          setData(profileData)
        } else {
          setError("暂未生成该博主的深度画像")
        }
      } catch (err) {
        setError("加载失败")
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
  }, [bloggerName])
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <div className="container mx-auto py-8 px-4 max-w-6xl">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
              <p className="text-lg text-muted-foreground">正在加载博主画像...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }
  
  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <div className="container mx-auto py-8 px-4 max-w-6xl">
          <Link href={`/bloggers/${encodeURIComponent(bloggerName)}`}>
            <Button variant="ghost" size="sm" className="mb-6">
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回博主详情
            </Button>
          </Link>
          
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-6">
              <Brain className="h-12 w-12 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-bold mb-4">未找到深度画像</h2>
            <p className="text-muted-foreground mb-8 max-w-md">
              {error || "该博主尚未生成深度画像分析，请先运行画像分析脚本"}
            </p>
            <Link href={`/bloggers/${encodeURIComponent(bloggerName)}`}>
              <Button>返回博主详情</Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }
  
  const analysis = data.batch_results?.[0]?.result?.analysis
  
  // 调试日志
  console.log('=== Profile Data Debug ===')
  console.log('data:', data)
  console.log('batch_results:', data.batch_results)
  console.log('first batch:', data.batch_results?.[0])
  console.log('analysis:', analysis)
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        {/* 返回按钮 */}
        <Link href={`/bloggers/${encodeURIComponent(bloggerName)}`}>
          <Button variant="ghost" size="sm" className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回博主详情
          </Button>
        </Link>
        
        {/* 头部 */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-lg">
              <Brain className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">{bloggerName}</h1>
              <p className="text-muted-foreground">深度画像分析报告</p>
            </div>
          </div>
        </div>
        
        {/* 数据概览 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={<Video className="h-10 w-10 mx-auto text-blue-500" />}
            value={data.metadata.total_videos}
            label="分析视频数"
            color="from-blue-500/20 to-blue-600/10"
          />
          <StatCard
            icon={<Layers className="h-10 w-10 mx-auto text-green-500" />}
            value={data.metadata.total_batches}
            label="分析批次"
            color="from-green-500/20 to-green-600/10"
          />
          <StatCard
            icon={<CheckCircle2 className="h-10 w-10 mx-auto text-purple-500" />}
            value={data.metadata.successful_batches}
            label="成功批次"
            color="from-purple-500/20 to-purple-600/10"
          />
          <StatCard
            icon={<Calendar className="h-10 w-10 mx-auto text-orange-500" />}
            value={data.metadata.analysis_time?.split('T')[0] || '-'}
            label="分析日期"
            color="from-orange-500/20 to-orange-600/10"
          />
        </div>
        
        {!analysis ? (
          <Card className="p-8 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">暂无分析数据</p>
          </Card>
        ) : (
          <div className="space-y-8">
            {/* 一、交易哲学 */}
            {analysis["一、交易哲学"] && (
              <Card className="overflow-hidden border-l-4 border-l-blue-500 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-blue-500/10 to-transparent pb-4">
                  <CardTitle className="flex items-center gap-2 text-blue-700 text-xl">
                    <Brain className="h-6 w-6" />
                    一、交易哲学
                  </CardTitle>
                  <CardDescription>博主的核心信念与市场认知</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
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
              <Card className="overflow-hidden border-l-4 border-l-green-500 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-green-500/10 to-transparent pb-4">
                  <CardTitle className="flex items-center gap-2 text-green-700 text-xl">
                    <TrendingUp className="h-6 w-6" />
                    二、资金行为分析
                  </CardTitle>
                  <CardDescription>主力资金的运作手法与逻辑</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
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
              <Card className="overflow-hidden border-l-4 border-l-orange-500 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-orange-500/10 to-transparent pb-4">
                  <CardTitle className="flex items-center gap-2 text-orange-700 text-xl">
                    <BarChart3 className="h-6 w-6" />
                    三、适用市场环境
                  </CardTitle>
                  <CardDescription>交易体系的适用场景分析</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  {analysis["三、市场环境"]["适用环境分析"] ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries(analysis["三、市场环境"]["适用环境分析"]).map(([env, reason]) => (
                        <EnvironmentCard key={env} env={env} reason={String(reason)} suitable={true} />
                      ))}
                    </div>
                  ) : analysis["三、市场环境"]["适用环境"] ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <Card className="overflow-hidden border-l-4 border-l-purple-500 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-purple-500/10 to-transparent pb-4">
                  <CardTitle className="flex items-center gap-2 text-purple-700 text-xl">
                    <Target className="h-6 w-6" />
                    四、核心交易模式
                  </CardTitle>
                  <CardDescription>实战交易形态与操作要点</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
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
              <Card className="overflow-hidden border-l-4 border-l-cyan-500 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-cyan-500/10 to-transparent pb-4">
                  <CardTitle className="flex items-center gap-2 text-cyan-700 text-xl">
                    <Eye className="h-6 w-6" />
                    五、认知定位
                  </CardTitle>
                  <CardDescription>博主的交易风格与认知层级</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="p-6 rounded-xl bg-gradient-to-r from-cyan-500/10 via-blue-500/5 to-purple-500/10 border">
                    {typeof analysis["五、认知层级"] === 'object' ? (
                      <div className="space-y-4">
                        {Object.entries(analysis["五、认知层级"]).map(([key, value]) => (
                          <div key={key}>
                            <Badge variant="secondary" className="mb-2">{key}</Badge>
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
              <Card className="overflow-hidden border-l-4 border-l-red-500 bg-gradient-to-br from-red-500/5 to-orange-500/5 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-red-500/10 to-orange-500/5 pb-4">
                  <CardTitle className="flex items-center gap-2 text-red-700 text-xl">
                    <Heart className="h-6 w-6 animate-pulse" />
                    六、隐藏核心（关键洞察）
                  </CardTitle>
                  <CardDescription>视频未明说但真正关键的东西</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
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
        )}
      </div>
    </div>
  )
}