"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  Brain, 
  TrendingUp, 
  Target, 
  Shield, 
  Lightbulb, 
  BarChart3,
  Users,
  ArrowLeft,
  RefreshCw,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
  Zap,
  Eye,
  Scale,
  User,
  Video,
  Calendar
} from "lucide-react"
import Link from "next/link"

// 博主索引信息
interface BloggerIndex {
  generated_time: string
  total_bloggers: number
  bloggers: Array<{
    name: string
    video_count?: number
    analyzed_count?: number
    profile_file: string
  }>
}

// 博主画像数据
interface BloggerProfile {
  blogger_name?: string
  metadata: {
    total_videos: number
    analyzed_videos: number
    failed_videos: number
    analysis_time: string
  }
  profile: {
    博主核心理念?: {
      交易哲学?: string
      盈利核心认知?: string
      对散户亏钱的看法?: string
    }
    资金行为模式?: {
      建仓特征?: string
      洗盘手法?: string
      拉升逻辑?: string
      出货特征?: string
    }
    适用市场环境?: {
      牛市策略?: string
      熊市策略?: string
      震荡市策略?: string
    }
    核心交易模式?: {
      主要形态列表?: string[]
      形态详细说明?: Record<string, {
        逻辑?: string
        操作?: string
        环境?: string
      }>
    }
    认知定位?: {
      所属派别?: string
      核心能力?: string
      局限性?: string
    }
    隐藏核心?: {
      未明说的关键?: string
      利用人性弱点?: string
      心理学逻辑?: string
    }
    评分?: {
      实战性?: number
      系统性?: number
      可复制性?: number
      风险意识?: number
    }
  }
}

// 评分卡片
function ScoreCard({ label, score, icon: Icon, color }: { 
  label: string
  score: number
  icon: React.ElementType
  color: string 
}) {
  return (
    <Card className="relative overflow-hidden">
      <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${color}`} />
      <CardContent className="pt-4">
        <div className="flex items-center gap-3 mb-3">
          <div className={`p-2 rounded-lg ${color.replace('from-', 'bg-').replace('to-', '/')}/10`}>
            <Icon className={`h-5 w-5 ${color.replace('from-', 'text-').replace('to-', '/')}`} />
          </div>
          <span className="font-medium">{label}</span>
        </div>
        <div className="flex items-center gap-3">
          <Progress value={score * 10} className="h-2" />
          <span className="text-2xl font-bold">{score}</span>
        </div>
      </CardContent>
    </Card>
  )
}

// 核心理念卡片
function PhilosophyCard({ philosophy }: { philosophy: NonNullable<BloggerProfile['profile']['博主核心理念']> }) {
  return (
    <Card className="bg-gradient-to-br from-purple-500/10 via-blue-500/5 to-transparent">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-purple-500" />
          交易哲学
        </CardTitle>
        <CardDescription>博主的核心理念与认知体系</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {philosophy.交易哲学 && (
          <div className="p-4 bg-background/50 rounded-lg border">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-yellow-500" />
              <span className="font-semibold text-sm text-muted-foreground">核心信仰</span>
            </div>
            <p className="text-sm leading-relaxed">{philosophy.交易哲学}</p>
          </div>
        )}
        {philosophy.盈利核心认知 && (
          <div className="p-4 bg-background/50 rounded-lg border">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-green-500" />
              <span className="font-semibold text-sm text-muted-foreground">盈利核心</span>
            </div>
            <p className="text-sm leading-relaxed">{philosophy.盈利核心认知}</p>
          </div>
        )}
        {philosophy.对散户亏钱的看法 && (
          <div className="p-4 bg-background/50 rounded-lg border border-red-500/20">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="font-semibold text-sm text-muted-foreground">散户亏损根源</span>
            </div>
            <p className="text-sm leading-relaxed">{philosophy.对散户亏钱的看法}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// 资金行为卡片
function CapitalBehaviorCard({ behavior }: { behavior: NonNullable<BloggerProfile['profile']['资金行为模式']> }) {
  const items = [
    { key: '建仓特征', value: behavior.建仓特征, icon: BookOpen, color: 'text-blue-500' },
    { key: '洗盘手法', value: behavior.洗盘手法, icon: RefreshCw, color: 'text-orange-500' },
    { key: '拉升逻辑', value: behavior.拉升逻辑, icon: TrendingUp, color: 'text-green-500' },
    { key: '出货特征', value: behavior.出货特征, icon: Shield, color: 'text-red-500' },
  ].filter(item => item.value)
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-orange-500" />
          资金行为模式
        </CardTitle>
        <CardDescription>主力资金运作的四个阶段特征</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((item, i) => (
            <div key={i} className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <item.icon className={`h-4 w-4 ${item.color}`} />
                <span className="font-semibold text-sm">{item.key}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// 认知定位卡片
function CognitiveLevelCard({ cognitive }: { cognitive: NonNullable<BloggerProfile['profile']['认知定位']> }) {
  return (
    <Card className="bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-amber-500" />
          认知定位
        </CardTitle>
        <CardDescription>博主的交易派别与核心能力</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {cognitive.所属派别 && (
          <div className="flex items-center gap-3">
            <Badge variant="default" className="text-base px-4 py-1 bg-gradient-to-r from-amber-500 to-orange-500">
              {cognitive.所属派别}
            </Badge>
          </div>
        )}
        {cognitive.核心能力 && (
          <div className="p-4 bg-background/50 rounded-lg border">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-yellow-500" />
              <span className="font-semibold text-sm text-muted-foreground">核心能力</span>
            </div>
            <p className="text-sm leading-relaxed">{cognitive.核心能力}</p>
          </div>
        )}
        {cognitive.局限性 && (
          <div className="p-4 bg-red-500/5 rounded-lg border border-red-500/20">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="font-semibold text-sm text-muted-foreground">局限性</span>
            </div>
            <p className="text-sm leading-relaxed text-red-600/80 dark:text-red-400/80">{cognitive.局限性}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// 隐藏核心卡片
function HiddenInsightsCard({ hidden }: { hidden: NonNullable<BloggerProfile['profile']['隐藏核心']> }) {
  return (
    <Card className="border-purple-500/30 bg-gradient-to-br from-purple-500/10 to-pink-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-purple-500" />
          隐藏核心
        </CardTitle>
        <CardDescription>视频未明说但真正关键的内容</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {hidden.未明说的关键 && (
          <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/30">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              <span className="font-semibold text-sm text-muted-foreground">未明说的关键</span>
            </div>
            <p className="text-sm leading-relaxed">{hidden.未明说的关键}</p>
          </div>
        )}
        {hidden.利用人性弱点 && (
          <div className="p-4 bg-background/50 rounded-lg border">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-orange-500" />
              <span className="font-semibold text-sm text-muted-foreground">利用人性弱点</span>
            </div>
            <p className="text-sm leading-relaxed">{hidden.利用人性弱点}</p>
          </div>
        )}
        {hidden.心理学逻辑 && (
          <div className="p-4 bg-background/50 rounded-lg border">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="h-4 w-4 text-blue-500" />
              <span className="font-semibold text-sm text-muted-foreground">心理学逻辑</span>
            </div>
            <p className="text-sm leading-relaxed">{hidden.心理学逻辑}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// 博主列表卡片
function BloggerListItem({ blogger, isActive, onClick }: { 
  blogger: BloggerIndex['bloggers'][0]
  isActive: boolean
  onClick: () => void 
}) {
  return (
    <Card 
      className={`cursor-pointer transition-all hover:shadow-md ${
        isActive ? 'border-primary bg-primary/5' : ''
      }`}
      onClick={onClick}
    >
      <CardContent className="py-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{blogger.name}</p>
            <div className="flex items-center gap-2 mt-1">
              {blogger.video_count !== undefined && (
                <Badge variant="outline" className="text-xs">
                  <Video className="h-3 w-3 mr-1" />
                  {blogger.video_count} 视频
                </Badge>
              )}
              {blogger.analyzed_count !== undefined && blogger.analyzed_count > 0 && (
                <Badge variant="secondary" className="text-xs">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  已分析 {blogger.analyzed_count}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// 主页面
export default function BloggerProfilePage() {
  const [index, setIndex] = useState<BloggerIndex | null>(null)
  const [selectedBlogger, setSelectedBlogger] = useState<string | null>(null)
  const [profile, setProfile] = useState<BloggerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // 加载博主列表索引
  useEffect(() => {
    fetch("/api/blogger-profile")
      .then(res => res.json())
      .then(data => {
        setIndex(data)
        // 自动选择第一个博主
        if (data.bloggers && data.bloggers.length > 0) {
          setSelectedBlogger(data.bloggers[0].name)
        }
      })
      .catch(err => {
        console.error("Error:", err)
        setError("无法加载博主列表")
      })
      .finally(() => setLoading(false))
  }, [])
  
  // 加载选中博主的画像
  useEffect(() => {
    if (!selectedBlogger) return
    
    setProfileLoading(true)
    setProfile(null)
    fetch(`/api/blogger-profile?blogger=${encodeURIComponent(selectedBlogger)}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error)
        } else {
          setProfile(data)
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setProfileLoading(false))
  }, [selectedBlogger])
  
  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      {/* 返回导航 */}
      <div className="mb-4">
        <Link href="/bloggers">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            返回博主列表
          </Button>
        </Link>
      </div>
      
      {/* 页面标题 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20">
              <Brain className="h-7 w-7 text-purple-500" />
            </div>
            博主深度画像
          </h1>
          <p className="text-muted-foreground mt-2">
            基于视频内容分析的交易体系画像
          </p>
        </div>
      </div>
      
      {/* 加载状态 */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4" />
            <p className="text-muted-foreground">加载博主列表中...</p>
          </div>
        </div>
      )}
      
      {/* 错误提示 */}
      {error && !loading && (
        <Card className="border-red-500 bg-red-50 dark:bg-red-900/20">
          <CardContent className="py-6 text-center">
            <AlertTriangle className="h-10 w-10 mx-auto text-red-500 mb-3" />
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </CardContent>
        </Card>
      )}
      
      {/* 主内容区 */}
      {!loading && !error && index && (
        <div className="flex gap-6">
          {/* 左侧博主列表 */}
          <Card className="w-72 shrink-0 self-start">
            <CardHeader className="py-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                博主列表
                <Badge variant="secondary" className="ml-auto">{index.total_bloggers}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2">
              <ScrollArea className="h-[calc(100vh-320px)] min-h-[400px]">
                <div className="space-y-2 pr-2">
                  {index.bloggers.map((blogger) => (
                    <BloggerListItem
                      key={blogger.name}
                      blogger={blogger}
                      isActive={selectedBlogger === blogger.name}
                      onClick={() => setSelectedBlogger(blogger.name)}
                    />
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
          
          {/* 右侧画像详情 */}
          <div className="flex-1">
            {profileLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4" />
                  <p className="text-muted-foreground">加载 {selectedBlogger} 的画像中...</p>
                </div>
              </div>
            ) : profile ? (
              <ScrollArea className="h-[calc(100vh-200px)]">
                <div className="space-y-6 pr-4">
                  {/* 博主信息头部 */}
                  <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
                    <CardHeader>
                      <div className="flex items-center gap-4">
                        <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center">
                          <User className="h-8 w-8 text-primary" />
                        </div>
                        <div className="flex-1">
                          <CardTitle className="text-2xl">{profile.blogger_name || selectedBlogger}</CardTitle>
                          <CardDescription className="mt-1">
                            财经短视频博主 · 深度画像分析
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-4">
                        <div className="flex items-center gap-2">
                          <Video className="h-4 w-4 text-primary" />
                          <span className="text-sm"><strong>{profile.metadata.total_videos}</strong> 个视频</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span className="text-sm">已分析 <strong className="text-green-600">{profile.metadata.analyzed_videos}</strong> 个</span>
                        </div>
                        {profile.metadata.analysis_time && (
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-primary" />
                            <span className="text-sm text-muted-foreground">
                              {new Date(profile.metadata.analysis_time).toLocaleString('zh-CN')}
                            </span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* 评分概览 */}
                  {profile.profile.评分 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {profile.profile.评分.实战性 !== undefined && (
                        <ScoreCard label="实战性" score={profile.profile.评分.实战性} icon={Zap} color="from-yellow-500 to-orange-500" />
                      )}
                      {profile.profile.评分.系统性 !== undefined && (
                        <ScoreCard label="系统性" score={profile.profile.评分.系统性} icon={Scale} color="from-blue-500 to-cyan-500" />
                      )}
                      {profile.profile.评分.可复制性 !== undefined && (
                        <ScoreCard label="可复制性" score={profile.profile.评分.可复制性} icon={Users} color="from-purple-500 to-pink-500" />
                      )}
                      {profile.profile.评分.风险意识 !== undefined && (
                        <ScoreCard label="风险意识" score={profile.profile.评分.风险意识} icon={Shield} color="from-green-500 to-emerald-500" />
                      )}
                    </div>
                  )}
                  
                  {/* 核心理念 */}
                  {profile.profile.博主核心理念 && (
                    <PhilosophyCard philosophy={profile.profile.博主核心理念} />
                  )}
                  
                  {/* 认知定位 */}
                  {profile.profile.认知定位 && (
                    <CognitiveLevelCard cognitive={profile.profile.认知定位} />
                  )}
                  
                  {/* 资金行为模式 */}
                  {profile.profile.资金行为模式 && (
                    <CapitalBehaviorCard behavior={profile.profile.资金行为模式} />
                  )}
                  
                  {/* 隐藏核心 */}
                  {profile.profile.隐藏核心 && (
                    <HiddenInsightsCard hidden={profile.profile.隐藏核心} />
                  )}
                </div>
              </ScrollArea>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">请从左侧选择一个博主查看画像</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}