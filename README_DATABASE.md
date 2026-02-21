# MySQL 数据库设置指南

## 1. 安装依赖

```bash
pnpm install
```

## 2. 配置数据库连接

创建 `.env` 文件（参考 `.env.example`）：

```bash
DATABASE_URL="mysql://用户名:密码@主机:端口/数据库名"
```

示例：
```bash
DATABASE_URL="mysql://root:password@localhost:3306/a_share_db"
```

## 3. 创建数据库

在 MySQL 中创建数据库：

```sql
CREATE DATABASE a_share_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

## 4. 运行数据库迁移

```bash
# 生成 Prisma Client
pnpm prisma:generate

# 运行迁移，创建表结构
pnpm prisma:migrate
```

或者手动执行：

```bash
npx prisma generate
npx prisma migrate dev --name init
```

## 5. 验证

启动开发服务器：

```bash
pnpm dev
```

访问应用，录入一些数据，然后可以在 Prisma Studio 中查看：

```bash
pnpm prisma:studio
```

## 数据库表结构

### signal_records（信号记录表）
- 存储所有个股信号记录
- 包含：日期、代码、名称、板块、评分等字段

### sector_screenshots（板块分时截图表）
- 存储板块分时截图（Base64 Data URL）
- 唯一约束：`(date, sector)`

## 数据迁移（从 localStorage）

如果需要将现有 localStorage 数据迁移到 MySQL：

1. 在浏览器控制台执行：
```javascript
// 导出信号记录
const signals = JSON.parse(localStorage.getItem('a_share_signal_store') || '[]');
console.log(JSON.stringify(signals, null, 2));

// 导出截图
const screenshots = JSON.parse(localStorage.getItem('a_share_sector_screenshots') || '[]');
console.log(JSON.stringify(screenshots, null, 2));
```

2. 将导出的数据通过 API 或 Prisma Studio 导入数据库
