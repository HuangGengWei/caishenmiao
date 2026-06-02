import { NextResponse } from "next/server";
import { readFile, access } from "fs/promises";
import { constants } from "fs";
import path from "path";

const PROFILE_BASE_PATHS = [
  "F:/douyin-downloader-main/douyin-downloader-main/output/profiles",
  path.join(process.cwd(), "data", "profiles"),
];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const bloggerName = decodeURIComponent(name);
  const safeName = bloggerName.replace("/", "_").replace("\\", "_");
  
  // 尝试查找 JSON 文件（优先查找 _complete_profile.json）
  const fileNames = [
    `${safeName}_complete_profile.json`,
    `${safeName}_profile.json`,
  ];
  
  for (const basePath of PROFILE_BASE_PATHS) {
    for (const fileName of fileNames) {
      try {
        const filePath = path.join(basePath, fileName);
        await access(filePath, constants.R_OK);
        
        const content = await readFile(filePath, "utf-8");
        const data = JSON.parse(content);
        
        return NextResponse.json(data);
      } catch {
        continue;
      }
    }
  }
  
  return NextResponse.json({ 
    error: "未找到该博主的深度画像",
    blogger: bloggerName,
    searched: fileNames,
    searchPaths: PROFILE_BASE_PATHS
  }, { status: 404 });
}