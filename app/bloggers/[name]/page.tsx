"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Search,
  RefreshCw,
  Calendar,
  Video,
  User,
  ArrowLeft,
  BarChart3,
  Clock,
  Layers,
  CheckCircle2,
  Circle,
  X,
  FileText,
  Lightbulb,
  AlertTriangle,
  TrendingUp,
  Tag,
  Settings,
  Brain
} from "lucide-react"
import Link from "next/link"
import { VideoPlayer } from "@/components/video-player"

// 视频信息
interface VideoInfo {
  name: string
  path: string
  date: string
  id: string
  title: string
  hasKnowledge: boolean
}

// 博主详情
interface BloggerDetail {
  name: string
  videoCount: number
  videos: VideoInfo[]
  latestDate: string
  earliestDate: string
}

// 知识内容
interface KnowledgeContent {
  id: string
  video_path: string
  metadata: {
    title: string
    create_time: number
    process_time: string
  }
  content: {
    raw_transcript: string
    corrected_transcript: string
  }
  knowledge: {
    main_topic: string
    key_points: string[]
    keywords: string[]
    trading_signals: string[]
    risk_warnings: string[]
  }
  stats: {
    asr_time: number
    text_length: number
    segments_count: number
  }
}

// 视频详情数据
interface VideoDetail {
  videoId: string
  videoFolder: string
  videoUrl: string | null
  knowledge: KnowledgeContent | null
  hasKnowledge: boolean
}

// 视频卡片
function VideoCard({ video, onClick }: { video: VideoInfo; onClick: () => void }) {
  return (
    <Card 
      className="hover:shadow-md transition-all hover:border-primary/30 group cursor-pointer"
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <Badge variant="outline" className="text-xs">
                {video.date}
              </Badge>
              {video.hasKnowledge ? (
                <Badge variant="default" className="text-xs gap-1 bg-green-600 hover:bg-green-700">
                  <CheckCircle2 className="h-3 w-3" />
                  已解析
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Circle className="h-3 w-3" />
                  未解析
                </Badge>
              )}
            </div>
            <p className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
              {video.title}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// 视频详情模态框
function VideoDetailModal({ 
  video, 
  bloggerName, 
  open, 
  onClose 
}: { 
  video: VideoInfo | null
  bloggerName: string
  open: boolean
  onClose: () => void 
}) {
  const [detail, setDetail] = useState<VideoDetail | null>(null)
  const [loading, setLoading] = useState(false)
  
  useEffect(() => {
    if (open && video) {
      setLoading(true)
      fetch(`/api/bloggers/${encodeURIComponent(bloggerName)}/videos/${video.id}`)
        .then(res => res.json())
        .then(data => setDetail(data))
        .catch(err => console.error("Error:", err))
        .finally(() => setLoading(false))
    }
  }, [open, video, bloggerName])
  
  if (!video) return null
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            {video.title}
          </DialogTitle>
        </DialogHeader>
        
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            <span className="ml-3">加载中...</span>
          </div>
        )}
        
        {!loading && detail && (
          <Tabs defaultValue="video" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="video">视频</TabsTrigger>
              <TabsTrigger value="transcript">文稿</TabsTrigger>
              <TabsTrigger value="knowledge">解析</TabsTrigger>
            </TabsList>
            
            <TabsContent value="video" className="mt-4">
              {detail.videoUrl ? (
                <VideoPlayer src={detail.videoUrl} />
              ) : (
                <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <Video className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">视频文件不存在</p>
                  </div>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="transcript" className="mt-4">
              <ScrollArea className="h-[400px]">
                {detail.knowledge?.content?.corrected_transcript ? (
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {detail.knowledge.content.corrected_transcript}
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">暂无文稿内容</p>
                    </div>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
            
            <TabsContent value="knowledge" className="mt-4">
              <ScrollArea className="h-[400px]">
                {detail.knowledge?.knowledge ? (
                  <div className="space-y-4 p-2">
                    {/* 主题 */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-primary" />
                          核心主题
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm">{detail.knowledge.knowledge.main_topic}</p>
                      </CardContent>
                    </Card>
                    
                    {/* 关键要点 */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Lightbulb className="h-4 w-4 text-yellow-500" />
                          关键要点
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {detail.knowledge.knowledge.key_points.map((point, i) => (
                            <li key={i} className="text-sm flex items-start gap-2">
                              <span className="text-primary font-bold">{i + 1}.</span>
                              {point}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                    
                    {/* 关键词 */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Tag className="h-4 w-4 text-blue-500" />
                          关键词
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {detail.knowledge.knowledge.keywords.map((kw, i) => (
                            <Badge key={i} variant="outline">{kw}</Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                    
                    {/* 交易信号 */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-green-500" />
                          交易信号
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {detail.knowledge.knowledge.trading_signals.map((signal, i) => (
                            <li key={i} className="text-sm text-green-700 dark:text-green-400">
                              {signal}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                    
                    {/* 风险警告 */}
                    <Card className="border-yellow-500/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                          风险警告
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {detail.knowledge.knowledge.risk_warnings.map((warning, i) => (
                            <li key={i} className="text-sm text-yellow-700 dark:text-yellow-400">
                              {warning}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                    
                    {/* 统计信息 */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2">
                      <span>文本长度: {detail.knowledge.stats.text_length} 字</span>
                      <span>分段数: {detail.knowledge.stats.segments_count}</span>
                      <span>ASR耗时: {Math.round(detail.knowledge.stats.asr_time)}秒</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">暂未解析此视频</p>
                    </div>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}

// 博主详情页
export default function BloggerDetailPage() {
  const params = useParams()
  const bloggerName = decodeURIComponent(params.name as string)
  
  const [blogger, setBlogger] = useState<BloggerDetail | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [selectedYearMonth, setSelectedYearMonth] = useState<string | null>(null)
  
  // 视频详情模态框状态
  const [selectedVideo, setSelectedVideo] = useState<VideoInfo | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  
  // 更新状态
  const [updating, setUpdating] = useState(false)
  const [updateResult, setUpdateResult] = useState<{ success: boolean; message: string } | null>(null)
  const [hasSecUid, setHasSecUid] = useState(false)
  
  useEffect(() => {
    async function fetchBlogger() {
      try {
        const response = await fetch(`/api/bloggers/${encodeURIComponent(bloggerName)}`)
        if (!response.ok) throw new Error("Failed")
        const data = await response.json()
        setBlogger(data)
      } catch (err) {
        console.error("Error:", err)
        setBlogger({
          name: bloggerName,
          videoCount: 302,
          latestDate: "2026-05-22",
          earliestDate: "2022-06-08",
          videos: Array.from({ length: 20 }, (_, i) => ({
            name: `video-${i}`,
            path: `2024-${String(Math.floor(i/3) + 1).padStart(2,'0')}-${String(i%28 + 1).padStart(2,'0')}_视频标题_${1000000000000000000 + i}`,
            date: `2024-${String(Math.floor(i/3) + 1).padStart(2,'0')}-${String(i%28 + 1).padStart(2,'0')}`,
            id: String(1000000000000000000 + i),
            title: `示例视频标题 ${i + 1}`,
            hasKnowledge: i < 3
          }))
        })
      } finally {
        setLoading(false)
      }
    }
    fetchBlogger()
  }, [bloggerName])
  
  // 检查是否有 sec_uid
  useEffect(() => {
    fetch(`/api/bloggers/${encodeURIComponent(bloggerName)}/update`)
      .then(res => res.json())
      .then(data => setHasSecUid(!!data.sec_uid))
      .catch(() => setHasSecUid(false))
  }, [bloggerName])
  
  // 检查更新
  const handleCheckUpdate = async () => {
    setUpdating(true)
    setUpdateResult(null)
    
    try {
      const response = await fetch(`/api/bloggers/${encodeURIComponent(bloggerName)}/update`, {
        method: "POST"
      })
      const data = await response.json()
      
      if (data.success) {
        setUpdateResult({ success: true, message: "更新完成！" })
        // 刷新列表
        setTimeout(() => window.location.reload(), 2000)
      } else {
        setUpdateResult({ 
          success: false, 
          message: data.message || "更新失败，请检查博主配置" 
        })
      }
    } catch (err: any) {
      setUpdateResult({ success: false, message: err.message || "网络错误" })
    } finally {
      setUpdating(false)
    }
  }
  
  // 过滤视频
  const filteredVideos = blogger?.videos?.filter(video => 
    video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    video.date.includes(searchQuery)
  ) || []
  
  // 按年月分组
  const groupedVideos: Record<string, VideoInfo[]> = {}
  filteredVideos.forEach(video => {
    const yearMonth = video.date.slice(0, 7)
    if (!groupedVideos[yearMonth]) groupedVideos[yearMonth] = []
    groupedVideos[yearMonth].push(video)
  })
  
  const yearMonths = Object.keys(groupedVideos).sort((a, b) => b.localeCompare(a))
  
  // 计算已解析数量
  const analyzedCount = blogger?.videos?.filter(v => v.hasKnowledge).length || 0
  
  // 计算日期跨度天数
  const daysSpan = blogger ? 
    Math.ceil((new Date(blogger.latestDate).getTime() - new Date(blogger.earliestDate).getTime()) / (1000 * 60 * 60 * 24)) 
    : 0
  
  const handleVideoClick = (video: VideoInfo) => {
    setSelectedVideo(video)
    setModalOpen(true)
  }
  
  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      {/* 返回导航 */}
      <div className="mb-4">
        <Link href="/bloggers">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            返回博主列表
          </Button>
        </Link>
      </div>
      
      {/* 博主信息头部 */}
      <Card className="mb-6 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center">
              <User className="h-8 w-8 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-2xl">{blogger?.name || bloggerName}</CardTitle>
              <CardDescription className="mt-1">
                财经短视频博主 · 技术分析风格解析
              </CardDescription>
            </div>
            {/* 检查更新按钮 */}
            <div className="flex gap-2">
              <Link href={`/bloggers/${encodeURIComponent(bloggerName)}/profile`}>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="gap-2"
                >
                  <Brain className="h-4 w-4" />
                  查看深度画像
                </Button>
              </Link>
              <Button 
                variant="outline" 
                size="sm"
                className="gap-2"
                onClick={handleCheckUpdate}
                disabled={updating || !hasSecUid}
              >
                <RefreshCw className={`h-4 w-4 ${updating ? 'animate-spin' : ''}`} />
                {updating ? '检查中...' : '检查更新'}
              </Button>
            </div>
          </div>
        </CardHeader>
        
        {/* 更新结果提示 */}
        {updateResult && (
          <div className={`mx-6 mb-4 p-3 rounded-lg text-sm ${
            updateResult.success 
              ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' 
              : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
          }`}>
            {updateResult.success ? (
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                {updateResult.message}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                {updateResult.message}
              </span>
            )}
          </div>
        )}
        
        {/* 未配置提示 */}
        {!hasSecUid && !loading && (
          <div className="mx-6 mb-4 p-3 rounded-lg text-sm bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
            <span className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              未配置博主更新源，请先下载该博主的视频或手动添加配置
            </span>
          </div>
        )}
        
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Video className="h-4 w-4 text-primary" />
              <span className="text-sm">
                <strong>{blogger?.videoCount || 0}</strong> 个视频
              </span>
            </div>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <span className="text-sm">
                已解析 <strong className="text-green-600">{analyzedCount}</strong> 个
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <span className="text-sm">
                跨度 <strong>{daysSpan}</strong> 天
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="text-sm">
                {blogger?.earliestDate} ~ {blogger?.latestDate}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              <span className="text-sm">
                共 <strong>{yearMonths.length}</strong> 个月份
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* 搜索和筛选 */}
      <div className="flex gap-4 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索视频标题..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>
      
      {/* 加载状态 */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          <span className="ml-3">加载中...</span>
        </div>
      )}
      
      {/* 视频列表 */}
      {!loading && blogger && (
        <div className="flex gap-4">
          {/* 侧边栏：月份导航 */}
          <Card className="w-48 shrink-0 hidden md:block self-start">
            <CardHeader className="py-3">
              <CardTitle className="text-sm">按月份浏览</CardTitle>
            </CardHeader>
            <CardContent className="py-2">
              <ScrollArea className="h-[calc(100vh-380px)] min-h-[400px]">
                <div className="space-y-1">
                  {yearMonths.map(ym => (
                    <Button
                      key={ym}
                      variant={selectedYearMonth === ym ? "secondary" : "ghost"}
                      size="sm"
                      className="w-full justify-between"
                      onClick={() => setSelectedYearMonth(selectedYearMonth === ym ? null : ym)}
                    >
                      {ym}
                      <Badge variant="outline" className="text-xs">
                        {groupedVideos[ym].length}
                      </Badge>
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
          
          {/* 主内容：视频网格 */}
          <div className="flex-1">
            <ScrollArea className="h-[600px]">
              {(selectedYearMonth ? [selectedYearMonth] : yearMonths).map(ym => (
                <div key={ym} className="mb-6">
                  <div className="flex items-center gap-2 mb-3 sticky top-0 bg-background/95 backdrop-blur z-10 py-2 border-b">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold">{ym}</h3>
                    <Badge variant="outline">{groupedVideos[ym].length} 个</Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {groupedVideos[ym]
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map((video, idx) => (
                        <VideoCard 
                          key={`${video.id}-${idx}`} 
                          video={video} 
                          onClick={() => handleVideoClick(video)}
                        />
                      ))}
                  </div>
                </div>
              ))}
              
              {filteredVideos.length === 0 && (
                <Card>
                  <CardContent className="py-8 text-center">
                    <p className="text-muted-foreground">未找到匹配的视频</p>
                  </CardContent>
                </Card>
              )}
            </ScrollArea>
          </div>
        </div>
      )}
      
      {/* 视频详情模态框 */}
      <VideoDetailModal 
        video={selectedVideo}
        bloggerName={bloggerName}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </div>
  )
}