import { NextResponse } from "next/server"
import { exec } from "child_process"
import { promisify } from "util"
import fs from "fs"
import path from "path"

const execAsync = promisify(exec)

const DOWNLOADER_PATH = "F:/douyin-downloader-main/douyin-downloader-main"
const CONFIG_PATH = path.join(DOWNLOADER_PATH, "config.yml")

// 博主配置存储路径
const BLOGGERS_CONFIG_PATH = "F:/zhuomi/data/bloggers.json"

interface BloggerConfig {
  name: string
  sec_uid: string
  douyin_url: string
  lastUpdate: string
}

// 确保配置目录存在
function ensureConfigDir() {
  const dir = path.dirname(BLOGGERS_CONFIG_PATH)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

// 加载博主配置
function loadBloggersConfig(): Record<string, BloggerConfig> {
  ensureConfigDir()
  if (fs.existsSync(BLOGGERS_CONFIG_PATH)) {
    const content = fs.readFileSync(BLOGGERS_CONFIG_PATH, "utf-8")
    return JSON.parse(content)
  }
  return {}
}

// 保存博主配置
function saveBloggersConfig(config: Record<string, BloggerConfig>) {
  ensureConfigDir()
  fs.writeFileSync(BLOGGERS_CONFIG_PATH, JSON.stringify(config, null, 2))
}

// 获取博主的 sec_uid（从文件夹名或配置中）
function getBloggerSecUid(bloggerName: string): string | null {
  const config = loadBloggersConfig()
  if (config[bloggerName]) {
    return config[bloggerName].sec_uid
  }
  
  // 尝试从已下载的视频 data.json 中提取
  const postPath = path.join(DOWNLOADER_PATH, "Downloaded", bloggerName, "post")
  if (fs.existsSync(postPath)) {
    const folders = fs.readdirSync(postPath, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)
    
    for (const folder of folders) {
      const dataFile = path.join(postPath, folder, `${folder}_data.json`)
      if (fs.existsSync(dataFile)) {
        try {
          const content = fs.readFileSync(dataFile, "utf-8")
          const data = JSON.parse(content)
          if (data.author?.sec_uid) {
            return data.author.sec_uid
          }
        } catch (e) {
          // continue
        }
      }
    }
  }
  return null
}

// POST: 更新博主视频（增量下载）
export async function POST(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name: bloggerName } = await params
    const decodedName = decodeURIComponent(bloggerName)
    
    // 获取博主的 sec_uid
    const secUid = getBloggerSecUid(decodedName)
    if (!secUid) {
      return NextResponse.json({ 
        error: "未找到博主配置", 
        message: "请先手动添加博主配置或确保已下载过该博主的视频" 
      }, { status: 404 })
    }
    
    // 构建下载命令
    const douyinUrl = `https://www.douyin.com/user/${secUid}`
    const command = `cd "${DOWNLOADER_PATH}" && python run.py -u "${douyinUrl}" -c config.yml`
    
    console.log(`[Update] Starting update for blogger: ${decodedName}`)
    console.log(`[Update] Command: ${command}`)
    
    // 执行下载（设置超时）
    const { stdout, stderr } = await execAsync(command, {
      timeout: 300000, // 5分钟超时
      maxBuffer: 1024 * 1024 * 10 // 10MB buffer
    })
    
    console.log(`[Update] stdout:`, stdout)
    if (stderr) {
      console.log(`[Update] stderr:`, stderr)
    }
    
    // 更新最后更新时间
    const config = loadBloggersConfig()
    if (config[decodedName]) {
      config[decodedName].lastUpdate = new Date().toISOString()
      saveBloggersConfig(config)
    }
    
    return NextResponse.json({
      success: true,
      message: "更新完成",
      output: stdout.slice(-2000), // 只返回最后2000字符
      blogger: decodedName,
      url: douyinUrl
    })
    
  } catch (error: any) {
    console.error("[Update] Error:", error)
    return NextResponse.json({ 
      error: "更新失败", 
      message: error.message,
      details: error.killed ? "命令超时（超过5分钟）" : undefined
    }, { status: 500 })
  }
}

// PUT: 添加/保存博主配置
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name: bloggerName } = await params
    const decodedName = decodeURIComponent(bloggerName)
    const body = await request.json()
    
    const { sec_uid, douyin_url } = body
    
    if (!sec_uid) {
      return NextResponse.json({ error: "缺少 sec_uid 参数" }, { status: 400 })
    }
    
    const config = loadBloggersConfig()
    config[decodedName] = {
      name: decodedName,
      sec_uid,
      douyin_url: douyin_url || `https://www.douyin.com/user/${sec_uid}`,
      lastUpdate: new Date().toISOString()
    }
    
    saveBloggersConfig(config)
    
    return NextResponse.json({
      success: true,
      message: "博主配置已保存",
      blogger: config[decodedName]
    })
    
  } catch (error: any) {
    console.error("[Save] Error:", error)
    return NextResponse.json({ error: "保存失败", message: error.message }, { status: 500 })
  }
}

// GET: 获取博主配置信息
export async function GET(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name: bloggerName } = await params
    const decodedName = decodeURIComponent(bloggerName)
    
    const config = loadBloggersConfig()
    const bloggerConfig = config[decodedName]
    
    // 获取 sec_uid（从配置或已下载文件）
    const secUid = bloggerConfig?.sec_uid || getBloggerSecUid(decodedName)
    
    return NextResponse.json({
      blogger: decodedName,
      hasConfig: !!bloggerConfig,
      sec_uid: secUid,
      lastUpdate: bloggerConfig?.lastUpdate || null
    })
    
  } catch (error: any) {
    console.error("[Get] Error:", error)
    return NextResponse.json({ error: "获取失败", message: error.message }, { status: 500 })
  }
}