import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

const DOWNLOADED_PATH = "F:/douyin-downloader-main/douyin-downloader-main/Downloaded"

// 视频静态文件服务
export async function GET(
  request: Request,
  { params }: { params: Promise<{ blogger: string; folder: string; filename: string }> }
) {
  try {
    const { blogger, folder, filename } = await params
    const decodedBlogger = decodeURIComponent(blogger)
    const decodedFolder = decodeURIComponent(folder)
    const decodedFilename = decodeURIComponent(filename)
    
    const filePath = path.join(DOWNLOADED_PATH, decodedBlogger, "post", decodedFolder, decodedFilename)
    
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }
    
    const fileBuffer = fs.readFileSync(filePath)
    const ext = path.extname(decodedFilename).toLowerCase()
    
    const contentType: Record<string, string> = {
      ".mp4": "video/mp4",
      ".mp3": "audio/mpeg",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
    }
    
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType[ext] || "application/octet-stream",
        "Content-Length": fileBuffer.length.toString(),
      },
    })
    
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Failed to load file" }, { status: 500 })
  }
}