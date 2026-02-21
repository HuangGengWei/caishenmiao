# 财神庙

板块分时信号记录与可视化工具，用于 A 股日内复盘：录入个股信号、查看近 30 天日历、个股列表（含 5/30 日均线图、20 日均线蜡烛图），并可结合板块分时截图生成 AI 复盘建议。

---

## 功能概览

| 模块 | 说明 |
|------|------|
| **复盘智囊** | 选择日期与板块分时截图，调用 OpenAI（GPT-4o）生成次日操作建议 |
| **近30天汇总** | 日历视图按日查看信号数量与板块分布，支持按板块筛选、上传板块分时截图、导出 CSV/JSON |
| **个股** | 信号列表：搜索/板块筛选/排序，5日·30日线折线图与「接近」判断、当日均价与 30 日线接近提示，20 日均线蜡烛图及已上穿/触及/未达到状态 |

### 数据与图表

- **信号录入**：代码、名称、板块、板块分时形态（水下拉水上 / 波动三角收窄）、换手率、涨跌幅、市值、资产负债率等；支持按代码自动拉取 tushare 当日行情补全
- **5日/30日线**：近 30 个交易日收盘价 + MA5/MA30 折线图；5 日与 30 日线接近、当日均价与 30 日线接近时显示提示
- **20日均线**：近 30 日 OHLC 蜡烛图 + MA20 虚线，并标注与均线关系（已上穿 / 触及 / 未达到）
- **板块分时截图**：按日期 + 板块存储 base64 截图，复盘智囊可结合截图与个股数据生成建议

---

## 技术栈

- **前端**: Next.js 16 (App Router)、React 19、Tailwind CSS、Radix UI、Recharts、Lucide Icons
- **后端**: Next.js API Routes、Prisma
- **数据库**: MySQL
- **外部**: [Tushare](https://tushare.pro/)（行情、交易日历）、OpenAI API（复盘建议）

---

## 环境要求

- Node.js 18+
- MySQL 8+
- 可选：Tushare Token、OpenAI API Key

---

## 快速开始

### 1. 克隆与安装

```bash
git clone <your-repo-url>
cd <project-dir>
pnpm install
```

### 2. 环境变量

在项目根目录创建 `.env`：

```env
# 数据库（必填）
DATABASE_URL="mysql://user:password@localhost:3306/your_db"

# Tushare（个股补全、行情、均线、交易日历等依赖）
TUSHARE_TOKEN="your_tushare_token"

# OpenAI（复盘智囊）
OPENAI_API_KEY="your_openai_api_key"
```

### 3. 数据库初始化

```bash
pnpm prisma generate
pnpm prisma migrate deploy
```

### 4. 启动

```bash
pnpm dev
```

浏览器访问 [http://localhost:3000](http://localhost:3000) 即可使用。

---

## 常用脚本

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 开发环境启动 |
| `pnpm build` | 生产构建 |
| `pnpm start` | 生产环境启动 |
| `pnpm prisma:generate` | 生成 Prisma Client |
| `pnpm prisma:migrate` | 开发环境执行迁移 |
| `pnpm prisma:studio` | 打开 Prisma Studio 管理数据 |

---

## 项目结构（简要）

```
├── app/
│   ├── api/              # API 路由
│   │   ├── ai/           # 复盘建议、聊天
│   │   ├── signals/      # 信号 CRUD
│   │   ├── sector-screenshots/
│   │   └── tushare/      # 行情、MA、交易日历、日线图等
│   ├── layout.tsx
│   ├── page.tsx          # 主页面（Tab：复盘智囊 / 近30天 / 个股）
│   └── icon.tsx          # 站点图标
├── components/           # 页面与图表组件
├── lib/                  # 类型、store、tushare 封装、解析与评分
└── prisma/
    └── schema.prisma     # 数据模型
```

---

## 免责声明

本工具仅用于个人复盘记录与数据整理，不构成任何投资建议。股市有风险，决策需独立、谨慎。

---

## License

MIT
