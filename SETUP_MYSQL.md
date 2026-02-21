# MySQL 数据库配置步骤

根据你的 MySQL 配置信息，我已经创建了 `.env` 文件。请按以下步骤完成配置：

## 你的 MySQL 配置信息
- **Host**: localhost
- **Port**: 3306
- **User**: root
- **Password**: wei19940116

## 配置步骤

### 1. 创建数据库

在 MySQL 客户端（如 MySQL Workbench、Navicat 或命令行）中执行：

```sql
CREATE DATABASE IF NOT EXISTS a_share_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

或者直接运行项目根目录下的 `setup_database.sql` 文件。

### 2. 验证 .env 文件

确认项目根目录下的 `.env` 文件内容为：

```
DATABASE_URL="mysql://root:wei19940116@localhost:3306/a_share_db"
```

### 3. 生成 Prisma Client

在 PowerShell 中执行：

```powershell
pnpm prisma:generate
```

或者：

```powershell
npx prisma generate
```

### 4. 运行数据库迁移

执行迁移创建表结构：

```powershell
pnpm prisma:migrate
```

或者：

```powershell
npx prisma migrate dev --name init
```

### 5. 验证配置

启动开发服务器：

```powershell
pnpm dev
```

如果启动成功，说明数据库连接正常。

### 6. 查看数据库（可选）

使用 Prisma Studio 可视化查看数据库：

```powershell
pnpm prisma:studio
```

或者：

```powershell
npx prisma studio
```

## 常见问题

### 连接失败？

1. 确认 MySQL 服务已启动
2. 确认用户名和密码正确
3. 确认端口 3306 没有被占用
4. 检查防火墙设置

### 迁移失败？

1. 确认数据库已创建
2. 确认 `.env` 文件中的 DATABASE_URL 格式正确
3. 确认数据库用户有创建表的权限

## 数据库表结构

迁移完成后，会自动创建两个表：

1. **signal_records** - 信号记录表
2. **sector_screenshots** - 板块分时截图表
