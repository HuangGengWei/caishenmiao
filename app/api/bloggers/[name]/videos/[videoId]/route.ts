import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

const DOWNLOADED_PATH = "F:/douyin-downloader-main/douyin-downloader-main/Downloaded"
const KNOWLEDGE_PATH = "F:/douyin-downloader-main/douyin-downloader-main/output/knowledge_base"

// 视频详情 API - 获取视频路径和知识内容
export async function GET(
  request: Request,
  { params }: { params: Promise<{ name: string; videoId: string }> }
) {
  try {
    const { name: bloggerName, videoId } = await params
    const decodedName = decodeURIComponent(bloggerName)
    
    // 查找视频文件夹
    const postPath = path.join(DOWNLOADED_PATH, decodedName, "post")
    if (!fs.existsSync(postPath)) {
      return NextResponse.json({ error: "Blogger not found" }, { status: 404 })
    }
    
    const videoFolders = fs.readdirSync(postPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name)
    
    // 找到匹配的视频文件夹
    const videoFolder = videoFolders.find(folder => folder.endsWith(`_${videoId}`))
    if (!videoFolder) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 })
    }
    
    const videoPath = path.join(postPath, videoFolder)
    const files = fs.readdirSync(videoPath)
    
    // 找到视频文件
    const videoFile = files.find(f => f.endsWith(".mp4"))
    const videoUrl = videoFile ? `/api/videos/${encodeURIComponent(decodedName)}/${encodeURIComponent(videoFolder)}/${encodeURIComponent(videoFile)}` : null
    
    // 加载知识内容
    let knowledge = null
    const knowledgeFile = path.join(KNOWLEDGE_PATH, `${videoFolder}_knowledge.json`)
    if (fs.existsSync(knowledgeFile)) {
      const content = fs.readFileSync(knowledgeFile, "utf-8")
      knowledge = JSON.parse(content)
    }
    
    return NextResponse.json({
      videoId,
      videoFolder,
      videoUrl,
      knowledge,
      hasKnowledge: !!knowledge
    })
    
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Failed to load video" }, { status: 500 })
  }
}