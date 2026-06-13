# P1 — 上线前待办清单

代码功能已全部完成并通过端到端测试(28/28)。剩下的都是**配置 / 部署 / 内容**类工作。
详细步骤见对应文档:`DEPLOY.md`(部署)、`PRODUCT-IMAGES.md`(图片/发布)、`BIMI-SETUP.md`(邮件头像)。

## 必做

- [ ] **PayPal 切正式**:`.env` 设 `PAYPAL_MODE=live` + 正式 `PAYPAL_CLIENT_ID/PAYPAL_SECRET/VITE_PAYPAL_CLIENT_ID`,重新 `build:client`。
      ⚠️ 之前在聊天里贴过的那串 live secret **务必先在 PayPal 后台作废重置**。
- [ ] **上真实商品**:Admin → Media 传图(自动水印)→ 建商品填各地区价(£ 必填、$ 选填)。详见 `PRODUCT-IMAGES.md`。
- [x] **邮件送达**:Resend 已 Verified(SPF/DKIM/DMARC 齐);MailerSend DNS 已配齐(确认后台也显示 Verified 即可);DMARC `_dmarc.worldangle.work` 已 `p=quarantine`。✅ 基本完成。
- [ ] **部署**(腾讯云 + Cloudflare,按 `DEPLOY.md`):
  - `UPLOAD_DIR` 设到部署目录之外(如 `/var/fusiey/uploads`),避免重新拉代码丢图。
  - `APP_URL` 设成正式域名(邮件内 Logo 靠它)。
  - 部署/更新时先 `prisma migrate deploy && prisma generate` 再 `pm2 restart`。
  - Cloudflare DNS 用**橙色云代理**(否则 `cf-ipcountry` 地区识别失效)。
- [ ] **后台 Settings 配置**:运费(默认 £4.99 / $6.99)、欢迎券 %、TikTok 链接、(可选)首页公告、水印开关/透明度。

## 可选

- [x] **Google 登录**:`GOOGLE_CLIENT_ID` + `VITE_GOOGLE_CLIENT_ID` 已配,头像显示已修复。
      ⚠️ 上线时记得在 Google Console 的 OAuth 客户端 **Authorized JavaScript origins** 加上正式域名(开发的 `http://localhost:5173` 已配)。
- [x] **DMARC**:`_dmarc.worldangle.work` 已是 `p=quarantine`(可保持;想更严再上 `p=reject`)。
- [ ] **BIMI 发件人头像**:见 `BIMI-SETUP.md`(需强制 DMARC + 付费 VMC 证书,有品牌/预算需求再做)。
- [ ] **数据库备份**:配置 `pg_dump` 定时任务(连 `UPLOAD_DIR` 一起备份)。

## 已修复的隐患(记录)

- JWT 密钥曾被误填成公开的 Google Client ID(可伪造令牌)→ 已重新生成两条强随机密钥。
