import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

const DOWNLOADED_PATH = "F:/douyin-downloader-main/douyin-downloader-main/Downloaded"

interface BloggerSummary {
  name: string
  videoCount: number
  latestDate: string
  earliestDate: string
  analyzedCount: number
}

export async function GET() {
  try {
    if (!fs.existsSync(DOWNLOADED_PATH)) {
      return NextResponse.json({ bloggers: [] }, { status: 404 })
    }
    
    const bloggerFolders = fs.readdirSync(DOWNLOADED_PATH, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name)
    
    const bloggers: BloggerSummary[] = []
    
    for (const bloggerName of bloggerFolders) {
      const postPath = path.join(DOWNLOADED_PATH, bloggerName, "post")
      
      if (!fs.existsSync(postPath)) continue
      
      const videoFolders = fs.readdirSync(postPath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)
      
      if (videoFolders.length === 0) continue
      
      // 解析日期
      const dates = videoFolders.map(name => name.split("_")[0]).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
      dates.sort()
      
      bloggers.push({
        name: bloggerName,
        videoCount: videoFolders.length,
        latestDate: dates.length > 0 ? dates[dates.length - 1] : "未知",
        earliestDate: dates.length > 0 ? dates[0] : "未知",
        analyzedCount: 0  // TODO: 从知识库统计
      })
    }
    
    return NextResponse.json({ bloggers })
    
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ bloggers: [] }, { status: 500 })
  }
}