"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  User, 
  Video, 
  ChevronRight, 
  FolderOpen, 
  TrendingUp,
  BarChart3,
  FileText,
  Calendar
} from "lucide-react"
import Link from "next/link"

// 博主简要信息
interface BloggerSummary {
  name: string
  videoCount: number
  latestDate: string
  earliestDate: string
  analyzedCount: number
}

// 博主卡片组件
function BloggerCard({ blogger }: { blogger: BloggerSummary }) {
  return (
    <Link href={`/bloggers/${encodeURIComponent(blogger.name)}`}>
      <Card className="hover:shadow-lg transition-all duration-300 hover:border-primary/50 cursor-pointer group">
        <CardHeader>
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center shrink-0">
              <User className="h-7 w-7 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-xl group-hover:text-primary transition-colors">
                {blogger.name}
              </CardTitle>
              <CardDescription className="flex items-center gap-2 mt-2">
                <Video className="h-4 w-4" />
                {blogger.videoCount} 个视频
              </CardDescription>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="gap-1">
              <Calendar className="h-3 w-3" />
              {blogger.earliestDate} ~ {blogger.latestDate}
            </Badge>
            {blogger.analyzedCount > 0 && (
              <Badge variant="secondary" className="gap-1">
                <BarChart3 className="h-3 w-3" />
                已解析 {blogger.analyzedCount} 个
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

// 主页面：博主列表
export default function BloggersPage() {
  const [bloggers, setBloggers] = useState<BloggerSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    async function fetchBloggers() {
      try {
        const response = await fetch("/api/bloggers")
        if (!response.ok) throw new Error("Failed to fetch")
        const data = await response.json()
        setBloggers(data.bloggers || [])
      } catch (err) {
        console.error("Error:", err)
        setError("无法加载博主数据")
        // 示例数据
        setBloggers([
          { name: "邻居大爷", videoCount: 302, latestDate: "2026-05-22", earliestDate: "2022-06-08", analyzedCount: 2 }
        ])
      } finally {
        setLoading(false)
      }
    }
    fetchBloggers()
  }, [])
  
  const totalVideos = bloggers.reduce((sum, b) => sum + b.videoCount, 0)
  
  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      {/* 页面标题 */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-primary" />
              博主分析
            </h1>
            <p className="text-muted-foreground mt-2">
              分析抖音财经博主的技术特点与交易风格
            </p>
          </div>
          <Link href="/">
            <Button variant="outline">
              <ChevronRight className="h-4 w-4 mr-1 rotate-180" />
              返回首页
            </Button>
          </Link>
        </div>
      </div>
      
      {/* 统计概览 */}
      <Card className="mb-6 bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="py-4">
          <div className="flex items-center gap-8">
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">博主数量</p>
                  <p className="text-2xl font-bold">{bloggers.length}</p>
                </div>
              </div>
              <div className="h-12 w-px bg-border" />
              <div className="flex items-center gap-3">
                <Video className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">视频总数</p>
                  <p className="text-2xl font-bold">{totalVideos}</p>
                </div>
              </div>
            </div>
        </CardContent>
      </Card>
      
      {/* 加载状态 */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          <span className="ml-3">加载中...</span>
        </div>
      )}
      
      {/* 错误提示 */}
      {error && (
        <Card className="border-yellow-500 bg-yellow-50 mb-4">
          <CardContent className="py-3">
            <p className="text-yellow-700 text-sm">{error}</p>
          </CardContent>
        </Card>
      )}
      
      {/* 博主列表 */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bloggers.length > 0 ? (
            bloggers.map((blogger) => (
              <BloggerCard key={blogger.name} blogger={blogger} />
            ))
          ) : (
            <Card className="col-span-full">
              <CardContent className="py-12 text-center">
                <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">暂无博主数据</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}