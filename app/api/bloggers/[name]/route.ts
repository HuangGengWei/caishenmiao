import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

const DOWNLOADED_PATH = "F:/douyin-downloader-main/douyin-downloader-main/Downloaded"
const KNOWLEDGE_PATH = "F:/douyin-downloader-main/douyin-downloader-main/output/knowledge_base"

interface VideoInfo {
  name: string
  path: string
  date: string
  id: string
  title: string
  hasKnowledge: boolean  // 是否已提取知识
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name: bloggerName } = await params
    const decodedName = decodeURIComponent(bloggerName)
    const postPath = path.join(DOWNLOADED_PATH, decodedName, "post")
    
    if (!fs.existsSync(postPath)) {
      return NextResponse.json({ error: "Blogger not found" }, { status: 404 })
    }
    
    // 预加载已有的知识文件列表
    const knowledgeFiles: Set<string> = new Set()
    if (fs.existsSync(KNOWLEDGE_PATH)) {
      const kfList = fs.readdirSync(KNOWLEDGE_PATH)
      for (const kf of kfList) {
        if (kf.endsWith("_knowledge.json")) {
          // 提取视频ID: 文件名格式 xxx_xxx_xxx_视频ID_knowledge.json
          // 去掉后缀 _knowledge.json 后，最后一个下划线后面的就是视频ID
          const baseName = kf.replace("_knowledge.json", "")
          const lastUnderscoreIdx = baseName.lastIndexOf("_")
          const videoId = baseName.substring(lastUnderscoreIdx + 1)
          knowledgeFiles.add(videoId)
          console.log(`[DEBUG] Knowledge file: ${kf} -> videoId: ${videoId}`)
        }
      }
      console.log(`[DEBUG] Total knowledge files loaded: ${knowledgeFiles.size}`)
    }
    
    const videoFolders = fs.readdirSync(postPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name)
    
    const videos: VideoInfo[] = []
    
    for (const folderName of videoFolders) {
      const folderPath = path.join(postPath, folderName)
      
      const parts = folderName.split("_")
      const date = parts[0] || ""
      const id = parts[parts.length - 1] || ""
      const title = parts.slice(1, -1).join(" ") || folderName
      
      videos.push({
        name: folderName,
        path: folderName,
        date,
        id,
        title,
        hasKnowledge: knowledgeFiles.has(id)  // 检测是否有知识文件
      })
    }
    
    // 按日期排序
    videos.sort((a, b) => b.date.localeCompare(a.date))
    
    const dates = videos.map(v => v.date).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
    
    return NextResponse.json({
      name: decodedName,
      videoCount: videos.length,
      videos,
      latestDate: dates.length > 0 ? dates[0] : "未知",
      earliestDate: dates.length > 0 ? dates[dates.length - 1] : "未知"
    })
    
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Failed to load blogger" }, { status: 500 })
  }
}