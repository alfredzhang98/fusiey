# Fusiey AI 功能归档

2026-06-11 从主代码库移除的全部 AI 功能代码。目录结构与原位置一一对应，
重新集成时按下表搬回即可。

## 功能概述

AI 图案生成管线（v2）：
1. 用户上传照片（可裁剪）或输入文字描述
2. **Agent S** — Gemini 图像风格化 + 结构化分析（`geminiService.ts` / `POST /api/ai/stylize`）
3. **Replicate RMBG-2.0** — 背景移除，提供真实 alpha 通道（`replicateService.ts`）
4. **Engine T** — 确定性的图像→拼豆网格映射（`beadEngineV2/`）
5. 信用点系统 — 每次生成消耗 1 点，社区积分可兑换（`credits.ts`）

## 文件清单（→ 原位置）

| 归档文件 | 原位置 |
|---|---|
| `client/components/ControlPanel.tsx` | `client/src/components/ControlPanel.tsx`（AI 时代完整版快照，含上传/裁剪/prompt/Generate 流程） |
| `client/components/CropStep.tsx` | `client/src/components/CropStep.tsx` |
| `client/utils/cropImage.ts` | `client/src/utils/cropImage.ts` |
| `client/utils/autoFitAspect.ts` | `client/src/utils/autoFitAspect.ts` |
| `client/config/features.ts` | `client/src/config/features.ts`（ENABLE_AI 开关） |
| `client/services/beadEngineV2/` | `client/src/services/beadEngineV2/`（注意：`colorSpace.ts` 仍留在主代码 `client/src/utils/colorSpace.ts`，搬回时需统一引用） |
| `server/routes/ai.ts` | `server/src/routes/ai.ts` |
| `server/controllers/aiController.ts` | `server/src/controllers/aiController.ts` |
| `server/services/geminiService.ts` | `server/src/services/geminiService.ts` |
| `server/services/replicateService.ts` | `server/src/services/replicateService.ts` |
| `server/services/credits.ts` | `server/src/services/credits.ts` |

## 重新集成步骤

1. **依赖**（已从 package.json 移除，需重装）：
   ```
   npm install @google/genai replicate react-easy-crop
   ```
2. **环境变量**（.env）：
   ```
   GEMINI_API_KEY=...
   REPLICATE_API_TOKEN=...   # 可选，缺失时跳过背景移除
   ```
3. **服务端**：把 `server/` 下文件搬回原位置，然后在 `server/src/app.ts` 恢复：
   ```ts
   import { aiRoutes } from './routes/ai';
   const aiLimiter = rateLimit({ windowMs: 60_000, max: 10 });
   app.use('/api/ai', aiLimiter, aiRoutes);
   ```
4. **客户端**：搬回 `client/` 下文件；在 `client/src/services/api.ts` 恢复 AI 端点函数
   （generateImage / stylizeImage / evaluateGrid / analyzeDesign — 见归档版 ControlPanel 顶部 import 即知用法）；
   在 `useAuthStore` 恢复 `setCredits` action；在 `App.tsx` 恢复信用点徽章。
5. **数据库**：Prisma schema 中 AI 相关字段（`User.generateCredits`、`SavedPattern.source/aiImageData`、
   `GenerateLog` 表）从未删除，无需迁移。
6. 共享类型（`shared/types/index.ts` 的 `AnalysisV2`、`StylizeResponse` 等）也从未删除，直接可用。

## 注意

- 归档代码不参与编译（在 client/src、server/src 之外），import 路径搬回后才有效。
- 归档时的 Gemini 模型名：`gemini-3.1-flash-image-preview`（stylize）、`gemini-3-flash-preview`（analyze）——
  重新集成时确认模型是否仍可用。
