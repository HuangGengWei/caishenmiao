import { NextResponse } from "next/server";
import { readFile, access, readdir } from "fs/promises";
import { constants } from "fs";
import path from "path";

const PROFILE_BASE_PATHS = [
  "F:/douyin-downloader-main/douyin-downloader-main/output/profiles",
  path.join(process.cwd(), "data", "profiles"),
];

// 获取博主列表索引
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const blogger = searchParams.get("blogger");
  const format = searchParams.get("format"); // 'json' or 'md'
  
  // 如果指定了博主，返回该博主的画像
  if (blogger) {
    const safeName = blogger.replace("/", "_").replace("\\", "_");
    
    for (const basePath of PROFILE_BASE_PATHS) {
      try {
        // 根据format参数返回不同格式
        const fileName = format === 'md' ? `${safeName}_profile.md` : `${safeName}_profile.json`;
        const profilePath = path.join(basePath, fileName);
        await access(profilePath, constants.R_OK);
        
        const content = await readFile(profilePath, "utf-8");
        
        if (format === 'md') {
          return new NextResponse(content, {
            headers: { 'Content-Type': 'text/markdown; charset=utf-8' }
          });
        } else {
          const data = JSON.parse(content);
          return NextResponse.json(data);
        }
      } catch {
        continue;
      }
    }
    
    return NextResponse.json({ error: "未找到该博主画像" }, { status: 404 });
  }
  
  // 否则返回博主列表索引
  for (const basePath of PROFILE_BASE_PATHS) {
    try {
      const indexPath = path.join(basePath, "blogger_profiles_index.json");
      await access(indexPath, constants.R_OK);
      const content = await readFile(indexPath, "utf-8");
      const index = JSON.parse(content);
      return NextResponse.json(index);
    } catch {
      continue;
    }
  }
  
  // 如果都不存在，扫描目录中的 profile 文件
  for (const basePath of PROFILE_BASE_PATHS) {
    try {
      await access(basePath, constants.R_OK);
      const files = await readdir(basePath);
      const profileFiles = files.filter(f => f.endsWith("_profile.json") && !f.includes("index"));
      
      if (profileFiles.length > 0) {
        const bloggers = profileFiles.map(f => {
          const name = f.replace("_profile.json", "");
          return { name, profile_file: f };
        });
        
        return NextResponse.json({
          generated_time: new Date().toISOString(),
          total_bloggers: bloggers.length,
          bloggers
        });
      }
    } catch {
      continue;
    }
  }
  
  // 返回示例数据
  return NextResponse.json({
    generated_time: new Date().toISOString(),
    total_bloggers: 1,
    bloggers: [
      { 
        name: "邻居大爷", 
        video_count: 284, 
        analyzed_count: 5,
        profile_file: "邻居大爷_profile.json"
      }
    ]
  });
}