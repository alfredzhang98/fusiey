# Fusiey - 项目计划书

> **版本:** 2.1  
> **更新日期:** 2026-04-01  
> **状态:** 开发中  
> **目标市场:** 英国本土 (UK)

---

## 1. 项目概述

### 1.1 项目愿景

Fusiey 是一个面向英国市场的 AI 驱动拼豆（Perler/Hama Bead）定制电商平台。用户可以通过 AI Agent 辅助设计个性化拼豆图案，在线下单购买成品或 DIY 材料包。平台主打三大核心卖点：**定制化** (Customisation)、**环保** (Eco-Friendly)、**高质量** (Premium Quality)。

### 1.2 产品定位

| 维度 | 说明 |
|------|------|
| 目标用户 | 英国拼豆手工爱好者、DIY 创作者、亲子家庭、礼品购买者 |
| 核心差异 | AI 辅助设计 + 即时预览 + 一键下单，从设计到交付的完整闭环 |
| 商业模式 | 定制成品销售 + DIY 材料包 + 预设模板商品 |
| 货币 | GBP (英镑) |
| 支付 | Stripe + PayPal |
| 配送 | 英国本土物流 |

### 1.3 系统模块总览

```
┌─────────────────────────────────────────────────────────┐
│                     FUSIEY PLATFORM                     │
├─────────────────────┬───────────────────────────────────┤
│     前端 (Client)    │          后端 (Server)             │
├─────────────────────┼───────────────────────────────────┤
│ • 首页/品牌介绍      │ • 订单管理 (Order Management)     │
│ • 登录/注册          │ • 物流管理 (Logistics)            │
│ • AI 拼豆设计器      │ • 库存管理 (Inventory)            │
│ • 商品列表           │ • 客服管理 (Customer Service)     │
│ • 订单/下单          │ • 管理员管理 (Admin)              │
│ • 支付 (Stripe/PP)   │ • 网页配置 (Site Config)          │
└─────────────────────┴───────────────────────────────────┘
```

---

## 2. 技术架构

### 2.1 技术栈

| 层级 | 技术 | 版本 | 说明 |
|------|------|------|------|
| **前端框架** | React | 19.0 | UI 组件 |
| **UI 增强** | ReactBits | latest | 110+ 动画组件（文字动画、背景特效、交互组件） |
| **路由** | React Router | 7.5 | SPA 页面路由 |
| **语言** | TypeScript | 5.8 | 全栈类型安全 |
| **构建** | Vite | 6.2 | 前端构建 + HMR |
| **样式** | Tailwind CSS | 4.1 | 原子化 CSS |
| **状态管理** | Zustand | 5.0 | 轻量级 Store |
| **动画** | Framer Motion | 12.38 | UI 过渡动画 |
| **图标** | Lucide React | 0.546 | SVG 图标库 |
| **后端** | Express | 4.21 | Node.js API 服务器 |
| **图像处理** | Sharp | 0.34 | 服务端图像缩放/像素提取 |
| **AI** | Google Gemini | 1.29 | @google/genai - 图片生成 + 设计分析 |
| **数据验证** | Zod | 4.3 | 前后端共享 Schema 校验 |
| **导出** | html2canvas + jsPDF | - | 图案导出 PDF/PNG |
| **支付** | Stripe + PayPal | - | 英国支付集成 |
| **数据库** | PostgreSQL | 17 | 关系型数据库 |
| **ORM** | Prisma | 7.6 | 类型安全的数据库访问层 |
| **部署** | Docker | - | 容器化部署，本地→服务器无缝迁移 |

### 2.2 Monorepo 架构

```
                    ┌──────────────┐
                    │    shared/   │
                    │  (Zod 类型)   │
                    └──────┬───────┘
                           │
              ┌────────────┴────────────┐
              │                         │
        ┌─────▼─────┐           ┌──────▼──────┐
        │  client/   │           │   server/   │
        │  React SPA │  ◄─API──► │  Express    │
        │  Vite      │           │  TypeScript │
        └─────┬─────┘           └──────┬──────┘
              │                         │
        ┌─────▼─────┐           ┌──────▼──────┐
        │ ReactBits  │           │ PostgreSQL  │
        │ Tailwind   │           │ Prisma ORM  │
        │ Motion     │           │ Gemini AI   │
        └───────────┘           │ Sharp       │
                                │ Stripe/PP   │
                                └─────────────┘

⚠️ 安全原则: 前端不接触任何 API Key / 数据库 / 敏感操作
   所有 AI 调用、图像处理、支付均通过后端 API 代理
```

### 2.3 数据流

```
用户浏览器 (无 API Key, 无直接数据库访问)
    │
    ├──► 首页 (品牌展示, ReactBits 动画特效)
    ├──► 登录/注册 ──► POST /api/auth/* ──► Prisma ──► PostgreSQL
    ├──► AI 设计器:
    │    ├── POST /api/ai/generate-image ──► Gemini AI (服务端安全调用)
    │    ├── POST /api/ai/analyze ──► Gemini AI (设计分析)
    │    └── POST /api/pattern/generate ──► Sharp (服务端图像处理)
    ├──► 商品列表 ──► GET /api/products ──► Prisma ──► PostgreSQL
    ├──► 下单 ──► POST /api/orders ──► Prisma ──► PostgreSQL
    └──► 支付 ──► POST /api/payment/* ──► Stripe/PayPal (服务端安全调用)
```

---

## 3. 项目文件结构

```
fusiey/
├── .env                          # 环境变量 (Gemini API key 等)
├── .env.example                  # 环境变量模板
├── .gitignore
├── package.json                  # Monorepo 根配置
├── tsconfig.json                 # TypeScript 项目引用根配置
├── PROJECT_PLAN.md               # 本文档
├── Dockerfile                    # Docker 部署配置
├── README.md
├── metadata.json                 # AI Studio 元数据
│
├── prisma/                       # 数据库
│   └── schema.prisma             # Prisma Schema (User/Product/Order/Pattern...)
├── generated/                    # Prisma 生成的客户端 (gitignore)
│
├── assets/                       # 品牌资源
│   └── logos/
│       ├── fusiey_main.svg       # 主 Logo (271x255)
│       ├── fusiey_main2.svg      # 纵向变体 (281x294)
│       ├── fusiey_main_small.svg # 小图标 (164x163)
│       └── fusiey_name.svg       # 横向文字标 (286x101)
│
├── shared/                       # 前后端共享代码
│   ├── tsconfig.json
│   └── types/
│       └── index.ts              # Zod Schema + TypeScript 类型
│                                 # (User, Order, Product, Pattern, Payment...)
│
├── client/                       # 前端应用
│   ├── index.html
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── public/
│   │   └── favicon.svg
│   └── src/
│       ├── main.tsx              # React 入口 + RouterProvider
│       ├── App.tsx               # 全局布局 (导航栏 + Outlet)
│       ├── router/
│       │   └── index.tsx         # 路由定义 (所有页面路由)
│       ├── pages/                # 页面组件
│       │   ├── HomePage.tsx      # 首页 (品牌介绍, 特色预览)
│       │   ├── DesignerPage.tsx  # AI 拼豆设计器
│       │   ├── ProductsPage.tsx  # 商品列表
│       │   ├── LoginPage.tsx     # 登录
│       │   ├── RegisterPage.tsx  # 注册
│       │   ├── OrderPage.tsx     # 订单管理
│       │   └── CheckoutPage.tsx  # 支付结算
│       ├── components/           # 可复用组件
│       │   ├── ControlPanel.tsx  # 设计器左栏 (上传/配置/导出)
│       │   ├── PatternGrid.tsx   # 设计器画布 (交互式网格)
│       │   ├── PaletteSidebar.tsx# 设计器右栏 (工具/颜色/统计)
│       │   └── StatsPanel.tsx    # 材料统计面板
│       ├── services/             # 前端服务
│       │   └── api.ts            # 后端 API 调用封装 (所有请求走后端代理)
│       ├── store/                # 状态管理
│       │   └── usePatternStore.ts# Zustand Store
│       ├── lib/                  # 工具函数
│       │   └── utils.ts          # cn() 等通用工具
│       ├── styles/               # 样式
│       │   └── index.css         # Tailwind 入口
│       ├── types/                # 类型 (re-export shared)
│       │   └── index.ts
│       └── constants/            # 常量
│           └── palettes.ts       # 拼豆色板数据
│
└── server/                       # 后端服务
    ├── tsconfig.json
    ├── tsconfig.build.json
    └── src/
        ├── app.ts                # Express 入口 (路由注册/中间件)
        ├── routes/               # API 路由
        │   ├── pattern.ts        # /api/pattern/* (图案生成)
        │   ├── ai.ts             # /api/ai/* (AI 图片生成/分析 - 安全代理)
        │   ├── auth.ts           # /api/auth/* (认证)
        │   ├── order.ts          # /api/orders/* (订单)
        │   ├── product.ts        # /api/products/* (商品)
        │   └── admin.ts          # /api/admin/* (管理后台)
        ├── controllers/          # 控制器
        │   ├── patternController.ts  # 图案生成逻辑
        │   └── aiController.ts       # AI 调用 (Gemini API Key 仅在此)
        ├── models/               # 数据模型 (Prisma 自动生成)
        ├── middleware/            # 中间件
        │   ├── errorHandler.ts   # 统一错误处理
        │   └── requestLogger.ts  # 请求日志
        ├── services/             # 后端服务
        │   ├── imageProcessor.ts # Sharp 图像处理 + 颜色量化
        │   └── geminiService.ts  # Gemini AI SDK (API Key 安全)
        └── config/               # 配置
            └── palettes.ts       # 色板数据
```

---

## 4. 前端页面规划

### 4.1 首页 (HomePage)

**目的:** 品牌展示 + 引导用户进入设计器或商品页

**内容:**
- Hero 区域：品牌 Slogan + CTA 按钮（ReactBits 文字动画/背景特效）
- 三大特色卡片：定制化 / 环保 / 高质量
- 精选商品预览轮播
- 用户评价/案例展示
- 页脚：关于我们 / 联系方式 / 社交媒体

**ReactBits 组件建议:**
- 文字动画：Hero 标题使用 TextAnimation 组件
- 背景：使用 AnimatedBackground / GradientBackground
- 滚动动画：卡片入场使用 ScrollReveal
- 交互元素：MagneticButton / TiltCard

### 4.2 登录/注册 (LoginPage / RegisterPage)

**目的:** 用户认证，数据库管理

**内容:**
- Email + Password 登录
- 注册表单（姓名/邮箱/密码/确认密码）
- 表单验证（Zod）
- JWT Token 认证
- 英国地址格式支持

### 4.3 AI 拼豆设计器 (DesignerPage)

**目的:** AI Agent 辅助设计拼豆图案（现有核心功能）

**内容:**
- 三栏布局：ControlPanel + PatternGrid + PaletteSidebar
- 图片上传 / AI 文字描述生成
- 交互式网格编辑（画笔/橡皮擦/移动）
- 缩放/平移/撤销/重做
- 多色板 + 自定义颜色
- PDF/PNG/JSON/CSV 导出
- 【新增】保存设计到账户
- 【新增】一键加入购物车（将设计转为订单）

### 4.4 商品列表 (ProductsPage)

**目的:** 展示可购买的商品

**内容:**
- 商品网格/列表视图切换
- 分类筛选（成品/材料包/工具）
- 价格排序
- 商品卡片（图片/名称/价格/标签）
- 「可定制」标记

### 4.5 订单/下单 (OrderPage)

**目的:** 查看和管理订单

**内容:**
- 订单列表（状态/日期/金额）
- 订单详情（商品/物流跟踪/发票）
- 订单状态时间线

### 4.6 支付 (CheckoutPage)

**目的:** 完成支付

**内容:**
- 订单摘要
- 配送地址（UK 格式：Line1/Line2/City/County/Postcode）
- 支付方式选择：Stripe / PayPal
- Stripe Elements 嵌入
- PayPal Button 嵌入
- 支付成功/失败状态

---

## 5. 后端 API 规划

### 5.1 认证 (Auth)

| 方法 | 路由 | 说明 |
|------|------|------|
| POST | /api/auth/register | 用户注册 |
| POST | /api/auth/login | 用户登录 |
| POST | /api/auth/logout | 登出 |
| GET | /api/auth/me | 获取当前用户信息 |
| POST | /api/auth/refresh | 刷新 Token |

### 5.2 AI 服务 (安全代理 - API Key 仅在服务端)

| 方法 | 路由 | 说明 |
|------|------|------|
| POST | /api/ai/generate-image | AI 文字生成图片 (Gemini) |
| POST | /api/ai/analyze | AI 设计意图分析 (Gemini) |

### 5.3 图案生成 (Pattern)

| 方法 | 路由 | 说明 |
|------|------|------|
| POST | /api/pattern/generate | 图片转拼豆图案 (Sharp) |
| POST | /api/pattern/save | 保存设计到用户账户 |
| GET | /api/pattern/my | 获取用户已保存设计 |

### 5.4 商品 (Products)

| 方法 | 路由 | 说明 |
|------|------|------|
| GET | /api/products | 商品列表 |
| GET | /api/products/:id | 商品详情 |
| POST | /api/products | 创建商品 (管理员) |
| PATCH | /api/products/:id | 更新商品 (管理员) |
| DELETE | /api/products/:id | 删除商品 (管理员) |

### 5.5 订单 (Orders)

| 方法 | 路由 | 说明 |
|------|------|------|
| GET | /api/orders | 订单列表 |
| GET | /api/orders/:id | 订单详情 |
| POST | /api/orders | 创建订单 |
| PATCH | /api/orders/:id | 更新订单状态 |
| DELETE | /api/orders/:id | 取消订单 |

### 5.6 支付 (Payment)

| 方法 | 路由 | 说明 |
|------|------|------|
| POST | /api/payment/stripe/create-intent | 创建 Stripe PaymentIntent |
| POST | /api/payment/stripe/webhook | Stripe Webhook 回调 |
| POST | /api/payment/paypal/create-order | 创建 PayPal 订单 |
| POST | /api/payment/paypal/capture | 确认 PayPal 支付 |

### 5.7 管理后台 (Admin)

| 方法 | 路由 | 说明 |
|------|------|------|
| GET | /api/admin/dashboard | 仪表盘统计 |
| GET | /api/admin/inventory | 库存管理 |
| PATCH | /api/admin/inventory/:id | 更新库存 |
| GET | /api/admin/logistics | 物流管理 |
| GET | /api/admin/customers | 客户管理 |
| GET | /api/admin/config | 获取网站配置 |
| PATCH | /api/admin/config | 更新网站配置 |

---

## 6. 品牌与 Logo 使用规范

### 6.1 Logo 资源

| 文件 | 尺寸 | 用途 |
|------|------|------|
| `fusiey_main.svg` | 271x255 | **主 Logo**：启动画面、关于页、社交头像、空状态 |
| `fusiey_main2.svg` | 281x294 | **纵向变体**：海报、App Store、竖版宣传 |
| `fusiey_main_small.svg` | 164x163 | **小图标**：Favicon、移动端图标、PWA |
| `fusiey_name.svg` | 286x101 | **横向文字标**：导航栏、Banner、页脚 |

### 6.2 使用场景

| 场景 | 推荐 Logo | 尺寸建议 |
|------|----------|---------|
| 导航栏 Header | `fusiey_name.svg` | 高度 32-40px |
| 浏览器 Favicon | `fusiey_main_small.svg` | 32x32 |
| 首页 Hero | `fusiey_main.svg` | 120-200px |
| 登录/注册页 | `fusiey_main.svg` | 80px |
| 设计器空状态 | `fusiey_main.svg` | 100px |
| 邮件模板 | `fusiey_name.svg` | 高度 40px |
| PWA 图标 | `fusiey_main_small.svg` | 192/512px PNG |

### 6.3 品牌色

| 名称 | 色值 | 用途 |
|------|------|------|
| Deep Purple | `#522756` | 主色调、深色元素 |
| Blush Pink | `#FCDFE5` | 浅色背景、卡片 |
| Rose | `#FFB2BE` | 按钮高亮、CTA |
| Sky Blue | `#BBE4F8` | 信息提示 |
| Peach | `#FFDFCA` | 温暖点缀 |

---

## 7. 已完成功能 (v0.1 - v0.2)

### 核心设计器
- [x] 图片上传 + Base64 编码 + 拖拽上传
- [x] AI 文字描述生成图片 (Gemini 2.5 Flash Image)
- [x] AI 设计意图分析 (Gemini 3 Flash Preview)
- [x] Sharp 图像缩放 + 红均值感知颜色量化
- [x] 边缘泛洪填充背景去除
- [x] 稀少颜色自动合并
- [x] 交互式网格 (画笔/橡皮擦/移动/缩放/平移)
- [x] 触摸支持 + 双指缩放
- [x] 右键批量替换颜色
- [x] 撤销/重做
- [x] Perler Classic (28色) + Hama Midi (8色) 色板
- [x] 自定义颜色 + 屏幕取色器
- [x] PDF/PNG/JSON/CSV 导出
- [x] 圆形/烫平渲染模式

### 项目工程化
- [x] Monorepo 结构 (client/ + server/ + shared/)
- [x] TypeScript 全栈类型共享
- [x] Vite 前端构建 + Express 后端
- [x] React Router SPA 路由
- [x] 页面骨架 (首页/设计器/商品/登录/注册/订单/支付)
- [x] 后端路由骨架 (pattern/auth/order/product/admin)
- [x] 共享 Zod Schema (User/Order/Product/Payment 类型)
- [x] 环境变量配置 (.env)

---

## 8. 开发路线图

### Phase 1: 基础搭建 ✅ (当前)

- [x] Monorepo 结构重组
- [x] 前后端分离 (client/ + server/)
- [x] 共享类型层 (shared/)
- [x] React Router 路由系统
- [x] 页面骨架 + 后端路由骨架
- [x] 项目计划书

### Phase 2: 用户系统 + 数据库

- [ ] 选择并集成数据库 (PostgreSQL / MongoDB)
- [ ] 用户注册/登录 (JWT 认证)
- [ ] 登录/注册页面 UI (表单验证)
- [ ] 用户 Session 管理
- [ ] 保存设计到用户账户
- [ ] 用户个人中心

### Phase 3: 首页 + ReactBits UI 增强

- [ ] 安装 ReactBits 组件库
- [ ] 首页 Hero 区域 (文字动画 + 背景特效)
- [ ] 三大卖点展示卡片 (定制化/环保/高质量)
- [ ] 精选商品预览
- [ ] 滚动动画 + 交互效果
- [ ] 导航栏集成 Logo
- [ ] 响应式移动端适配
- [ ] 深色模式支持

### Phase 4: 商品 + 订单系统

- [ ] 商品 CRUD (管理端)
- [ ] 商品列表/详情页 (客户端)
- [ ] 购物车功能
- [ ] 订单创建流程 (设计 → 商品 → 下单)
- [ ] 订单列表/详情/状态跟踪
- [ ] 管理端订单管理面板

### Phase 5: 支付集成

- [ ] Stripe Elements 集成 (UK 支付)
- [ ] PayPal Button 集成
- [ ] Webhook 处理 (支付状态回调)
- [ ] 支付成功/失败流程
- [ ] 发票生成

### Phase 6: 管理后台

- [ ] 管理员仪表盘 (订单/收入/用户统计)
- [ ] 库存管理 (入库/出库/预警)
- [ ] 物流管理 (发货/跟踪/签收)
- [ ] 客服管理 (工单/消息)
- [ ] 网站配置 (Banner/公告/SEO)

### Phase 7: 优化与上线

- [ ] 性能优化 (Canvas 渲染、懒加载、代码分割)
- [ ] SEO 优化 (英国市场关键词)
- [ ] 安全加固 (CSRF/XSS/Rate Limiting)
- [ ] Docker 部署配置
- [ ] CI/CD 流水线
- [ ] 域名 + SSL + 上线

---

## 9. ReactBits UI 集成计划

### 安装方式
```bash
# 通过 shadcn CLI 安装单个组件
npx shadcn@latest add "https://www.reactbits.dev/r/text-animation"
```

### 推荐使用场景

| 页面 | ReactBits 组件 | 效果 |
|------|---------------|------|
| 首页 Hero | TextAnimation / SplitText | 品牌标题打字/拆分动画 |
| 首页背景 | AnimatedBackground / Aurora | 渐变流动背景 |
| 特色卡片 | TiltCard / GlowCard | 悬浮倾斜/发光效果 |
| 按钮 | MagneticButton / ShinyButton | 磁力吸引/闪光按钮 |
| 滚动 | ScrollReveal / FadeIn | 内容入场动画 |
| 加载 | Skeleton / Shimmer | 骨架屏加载效果 |
| 导航 | AnimatedTabs / MenuSlider | 动画标签页/菜单 |
| 数字 | CountUp / NumberFlow | 统计数字滚动 |
| 通知 | Toast / Notification | 提示消息动画 |

---

## 10. 部署方案 (本地 → 服务器)

### 10.1 本地开发流程

```bash
# 1. 安装依赖
npm install

# 2. 启动 PostgreSQL (本地需安装)
# 3. 配置 .env (DATABASE_URL, GEMINI_API_KEY)

# 4. 初始化数据库
npm run db:push          # 推送 Schema 到数据库
npm run db:generate      # 生成 Prisma Client

# 5. 启动开发服务器
npm run dev              # 同时启动前端 (5173) + 后端 (3000)

# 6. 数据库管理
npm run db:studio        # 打开 Prisma Studio 可视化管理
npm run db:migrate       # 创建数据库迁移
```

### 10.2 Docker 部署 (本地 → 服务器无缝迁移)

```bash
# 构建镜像
docker build -t fusiey .

# 运行 (需外部 PostgreSQL)
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e GEMINI_API_KEY="..." \
  fusiey
```

### 10.3 部署架构

```
┌─────────────────────────────────────────┐
│           Docker Container              │
│  ┌─────────────────────────────────┐    │
│  │   Express Server (:3000)        │    │
│  │   ├── API Routes               │    │
│  │   └── Static Files (React SPA) │    │
│  └─────────────┬───────────────────┘    │
└────────────────┼────────────────────────┘
                 │
    ┌────────────┼────────────┐
    ▼            ▼            ▼
PostgreSQL   Gemini API   Stripe/PayPal
 (托管DB)    (Google)     (支付网关)
```

**推荐服务器:** Railway / Render / Fly.io (支持 Docker + PostgreSQL 托管)

---

## 11. 已知问题

| # | 问题 | 优先级 | 状态 |
|---|------|--------|------|
| 1 | StatsPanel.tsx 未使用（功能内联在 PaletteSidebar） | 低 | 待清理 |
| 2 | 大图案（100x100+）性能问题：DOM 渲染瓶颈 | 中 | Phase 7 用 Canvas 替代 |
| 3 | Logo SVG 文件较大（~200KB） | 低 | 考虑优化 |
| 4 | Client bundle 较大（~1MB），需 code-splitting | 中 | Phase 7 优化 |

---

## 12. 更新日志

| 日期 | 版本 | 内容 |
|------|------|------|
| 2026-04-01 | v0.3 | 架构安全修复：Gemini API 调用迁移到后端（API Key 不再暴露）、移除前端 Sharp 依赖、集成 PostgreSQL + Prisma ORM（完整数据模型）、新增 Docker 部署配置、新增 `/api/ai/*` 安全代理路由、前端改用统一 API 服务层 |
| 2026-04-01 | v0.2 | 全面升级为电商平台架构：Monorepo 重组 (client/server/shared)、React Router 路由系统、7 个页面骨架、5 组后端路由、共享类型层、ReactBits UI 规划 |
| 2026-04-01 | v0.1 | 初始版本：AI 拼豆图案生成器核心功能 |

---

## 13. 开发讨论区

> 此区域用于记录开发过程中的讨论、决策和待确认事项。

### 已决策

| 决策 | 结论 | 原因 |
|------|------|------|
| 数据库 | PostgreSQL + Prisma | 关系型适合电商（订单/库存/用户），Prisma 提供类型安全 |
| API Key 安全 | 所有第三方 API 调用走后端 | 防止密钥泄露 |
| 前后端分离 | 共享 package.json + Vite proxy | 开发简单，部署时 Express 托管静态文件 |
| 部署方案 | Docker 容器化 | 本地开发环境与服务器完全一致 |

### 待讨论

1. **认证方案**: JWT (stateless) vs Session (stateful)?  
   → 建议 JWT + HttpOnly Cookie

2. **部署平台**: Railway / Render / Fly.io / VPS?

3. **国际化**: 当前仅英文，未来是否需要中文?

4. **ReactBits 组件选择**: 需要实际预览后确认具体使用哪些组件

5. **PostgreSQL 托管**: 本地安装 vs 云服务 (Supabase / Neon / Railway)?

---

*本文档是 Fusiey 项目的核心规划文件。所有开发更新、架构决策、版本变更均在此记录。*
