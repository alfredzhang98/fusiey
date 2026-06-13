# Fusiey 部署指南（Cloudflare 域名 + 腾讯云服务器）

一步步把网站部署上线。**不涉及任何付费认证**（BIMI/VMC 等以后再说），只做我们
现在能做的：服务器环境、应用部署、HTTPS、地区识别、邮件 SPF/DKIM/DMARC（先
`p=none` 监控）。

---

## 0. 架构总览

```
用户 ──► Cloudflare（DNS + HTTPS + CDN + 地区识别 cf-ipcountry）
            │
            ▼
       腾讯云服务器
            ├── Nginx（反向代理，监听 80/443）
            │     └─► 转发到 Node 应用 127.0.0.1:3000
            ├── Node/Express 应用（PM2 守护，serve 前端 + /api）
            └── PostgreSQL 16（数据库 fusiey）

邮件：Resend（主）+ MailerSend（备），靠域名 DNS 的 SPF/DKIM/DMARC 认证
```

一台服务器同时跑：数据库 + Node 应用 + Nginx。Node 应用在生产模式下会直接把
打包好的前端（`dist/client`）和 `/api` 接口一起对外提供，Nginx 只负责反代 + HTTPS。

---

## 1. 准备清单

- [ ] 域名已经在 **Cloudflare** 托管（域名的 NS 已改成 Cloudflare 给的两条）。
- [ ] 腾讯云服务器一台（**2 核 8G**，系统建议 **Ubuntu 22.04 LTS**），有公网 IP。
- [ ] 安全组/防火墙放行端口：**22（SSH）、80（HTTP）、443（HTTPS）**。
- [ ] 代码能拿到服务器上：推荐放到 Git 仓库（GitHub/Gitee）再 `git clone`；
      或用 `scp`/宝塔文件管理上传。
- [ ] Resend、MailerSend 账号（已有 token）。

> 下面用 **SSH 命令行**为主（最通用、最可靠）。如果你装了**宝塔面板**，括号里会
> 标注对应的图形界面位置。

---

## 2. 服务器基础环境

SSH 登录服务器（`ssh root@你的服务器IP`），逐条执行。

### 2.1 更新系统 + 基础工具
```bash
apt update && apt upgrade -y
apt install -y git curl build-essential
```

### 2.2 安装 Node.js 20 LTS
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v   # 应显示 v20.x
npm -v
```
（宝塔：软件商店 → **Node 版本管理器** → 安装 Node 20。）

### 2.3 安装 PostgreSQL 16
```bash
apt install -y postgresql postgresql-contrib
systemctl enable --now postgresql
psql --version
```
（宝塔：软件商店 → **PostgreSQL 管理器** → 安装。）

### 2.4 安装 Nginx
```bash
apt install -y nginx
systemctl enable --now nginx
```
（宝塔：软件商店 → **Nginx** → 安装。）

### 2.5 安装 PM2（Node 进程守护）
```bash
npm install -g pm2
```
（宝塔：软件商店 → **PM2 管理器**。）

---

## 3. 创建数据库

```bash
sudo -u postgres psql
```
进入 psql 后执行（**把密码换成你自己的强密码**）：
```sql
CREATE DATABASE fusiey;
CREATE USER fusiey_user WITH PASSWORD '换成强密码';
GRANT ALL PRIVILEGES ON DATABASE fusiey TO fusiey_user;
\c fusiey
GRANT ALL ON SCHEMA public TO fusiey_user;
\q
```
记下连接串（第 5 步要用）：
```
postgresql://fusiey_user:换成强密码@localhost:5432/fusiey?schema=public
```

---

## 4. 拉取代码、安装依赖、构建

```bash
# 放到 /www/fusiey（目录可自定）
mkdir -p /www && cd /www
git clone <你的仓库地址> fusiey
cd /www/fusiey

# 安装全部依赖（构建需要 vite/tsx 等开发依赖，别加 --production）
npm install
```

先创建 `.env`（见第 5 步），再继续：

```bash
# 生成 Prisma 客户端
npx prisma generate

# 建表（生产用 deploy，按已有迁移文件建库，不会乱改 schema）
npx prisma migrate deploy

# （可选）写入示例商品 + 管理员账号
npx tsx server/seed.mjs

# 打包前端（生成 dist/client，应用会自动 serve 它）
npm run build:client
```

> 注：生产环境的后端用 **tsx** 运行（和开发同一套运行时，最稳）。无需 `npm run
> build:server`。

---

## 5. 配置 `.env`（生产环境变量）

在项目根目录 `/www/fusiey/.env` 新建，逐项填写：

```bash
# ── 基础 ──
NODE_ENV="production"
PORT=3000
APP_URL="https://你的域名"          # 例如 https://fusiey.com，邮件内 Logo 也靠它

# 上传文件存放目录（商品图片 + 图纸下载文件）。
# ⚠️ 设到部署目录之外，避免 git pull / 重新克隆把图片清空！
UPLOAD_DIR="/var/fusiey/uploads"

# ── 数据库（第 3 步的连接串）──
DATABASE_URL="postgresql://fusiey_user:你的密码@localhost:5432/fusiey?schema=public"

# ── JWT 密钥（务必重新生成，别用仓库里的示例值）──
# 生成命令：node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
JWT_ACCESS_SECRET="粘贴一段随机值"
JWT_REFRESH_SECRET="粘贴另一段随机值"

# ── PayPal（先用 sandbox，正式收款时再换 live 密钥并把 MODE 改成 live）──
PAYPAL_MODE="sandbox"
PAYPAL_CLIENT_ID="..."
PAYPAL_SECRET="..."
VITE_PAYPAL_CLIENT_ID="..."         # 与上面 CLIENT_ID 相同

# ── 邮件（Resend 主 + MailerSend 备）──
EMAIL_SENDER_NAME="Fusiey"
RESEND_API_TOKEN="re_..."
RESEND_SENDER_EMAIL="no-reply@resend.worldangle.work"
MAILERSEND_API_TOKEN="mlsn..."
MAILERSEND_SENDER_EMAIL="no-reply@verify.worldangle.work"

# ── Google 登录（可选，没配就不显示 Google 按钮）──
GOOGLE_CLIENT_ID="..."
VITE_GOOGLE_CLIENT_ID="..."
```

> ⚠️ `VITE_` 开头的变量是**前端构建时**读入的。改了它们要**重新 `npm run
> build:client`** 才生效。改纯后端变量只需重启 PM2。

---

## 6. 用 PM2 启动后端

```bash
cd /www/fusiey
pm2 start npm --name fusiey -- run start:prod
pm2 save                 # 保存进程列表
pm2 startup              # 按提示复制执行一条命令 → 开机自启
pm2 logs fusiey          # 看日志，确认启动成功
```
本机验证（应返回 JSON）：
```bash
curl http://127.0.0.1:3000/api/products
curl http://127.0.0.1:3000/api/geo
```

以后更新代码：
```bash
cd /www/fusiey
git pull
npm install
npx prisma migrate deploy
npm run build:client
pm2 restart fusiey
```

---

## 7. 配置 Nginx 反向代理

新建站点配置 `/etc/nginx/sites-available/fusiey`：

```nginx
server {
    listen 80;
    server_name 你的域名 www.你的域名;

    client_max_body_size 50m;   # 画布/图片上传较大

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # 关键：把 Cloudflare 的地区头透传给应用（地区识别用）
        proxy_set_header CF-IPCountry      $http_cf_ipcountry;
    }
}
```
启用并重载：
```bash
ln -s /etc/nginx/sites-available/fusiey /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```
（宝塔：网站 → 添加站点（纯静态/反代均可）→ 反向代理填 `http://127.0.0.1:3000`，
并在反代配置里加上 `proxy_set_header CF-IPCountry $http_cf_ipcountry;`）

> 应用里已设置 `trust proxy`，所以经过 Nginx 后能正确拿到真实 IP 和地区头。

---

## 8. Cloudflare 配置（DNS + HTTPS）

### 8.1 DNS 记录
Cloudflare 控制台 → 你的域名 → **DNS** → 添加：

| 类型 | 名称 | 内容 | 代理状态 |
|------|------|------|----------|
| A | `@` | 你的服务器公网IP | 🟠 已代理(橙云) |
| A | `www` | 你的服务器公网IP | 🟠 已代理(橙云) |

> **必须是橙色云（已代理）**，这样 Cloudflare 才会注入 `cf-ipcountry` 头、提供
> HTTPS 和 CDN。灰色云=仅 DNS，地区识别会失效。

### 8.2 HTTPS / SSL 模式
Cloudflare → **SSL/TLS** → 概述：

- 简单起步：选 **Flexible（灵活）**——用户到 Cloudflare 是 HTTPS，Cloudflare 到
  你服务器走 80 端口 HTTP。Nginx 只配第 7 步的 80 即可，**马上能用**。
- 推荐（更安全）：选 **Full (strict)**，并在服务器装 **Cloudflare Origin 证书**：
  1. Cloudflare → SSL/TLS → **源服务器** → 创建证书，把证书和私钥保存成两个文件
     （如 `/etc/ssl/cf/cert.pem`、`/etc/ssl/cf/key.pem`）。
  2. Nginx 加一个 443 server 块：
     ```nginx
     server {
         listen 443 ssl;
         server_name 你的域名 www.你的域名;
         ssl_certificate     /etc/ssl/cf/cert.pem;
         ssl_certificate_key /etc/ssl/cf/key.pem;
         client_max_body_size 50m;
         location / {
             proxy_pass http://127.0.0.1:3000;
             proxy_http_version 1.1;
             proxy_set_header Host              $host;
             proxy_set_header X-Real-IP         $remote_addr;
             proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
             proxy_set_header X-Forwarded-Proto $scheme;
             proxy_set_header CF-IPCountry      $http_cf_ipcountry;
         }
     }
     ```
  3. `nginx -t && systemctl reload nginx`
- 再开 **SSL/TLS → 边缘证书 → Always Use HTTPS**（强制跳转 HTTPS）。

### 8.3 验证
浏览器打开 `https://你的域名`，应能看到首页。再测地区识别：
```
https://你的域名/api/geo
```
- 国内/英国访问 → `{"country":"...","currency":"GBP"}`
- 美国 IP 访问 → `{"currency":"USD"}`
（cf-ipcountry 由 Cloudflare 自动注入，无需额外设置。）

---

## 9. 邮件认证 DNS（SPF / DKIM / DMARC）

目标：让订单/营销/验证码邮件稳定进收件箱、不被伪冒。**先不碰 BIMI/VMC。**

### 9.1 Resend（主发信）
1. Resend 后台 → **Domains** → 添加 `resend.worldangle.work`。
2. Resend 会给你几条 DNS 记录（通常是 1 条 SPF 的 TXT、几条 DKIM 的 CNAME/TXT、
   可能还有 MX）。
3. 到 **Cloudflare → DNS** 一条条照着添加（类型/名称/值原样复制）。
   - ⚠️ 这些邮件认证记录的"名称/主机"如果是子域名，**代理状态选灰色云（仅 DNS）**。
4. 回 Resend 点 **Verify**，等到全部变绿。

### 9.2 MailerSend（备用发信）
同理：MailerSend 后台添加 `verify.worldangle.work`，按它给的记录在 Cloudflare 添加，
然后 Verify。

### 9.3 DMARC（先用监控模式 p=none）
Cloudflare → DNS 添加一条 TXT：

| 类型 | 名称 | 值 |
|------|------|----|
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc@worldangle.work` |

- `p=none` = 只监控、不拦截，**不会误伤任何邮件**，最安全。
- 跑一两周，看 `rua` 收到的报告确认所有合法邮件 SPF/DKIM 都 pass 后，再考虑升级到
  `p=quarantine`（这一步是将来做 BIMI 的前提，详见 `docs/BIMI-SETUP.md`）。

### 9.4 验证
- 给自己（或用 https://www.mail-tester.com 给的地址）发一封测试邮件。
- 看邮件原文的 `Authentication-Results`，需要 `spf=pass` 且 `dkim=pass`。
- 触发方式：网站首页填邮箱领 10% 券 / 注册 / 忘记密码，都会发信。

---

## 10. 上线自检清单

- [ ] `https://你的域名` 首页正常、HTTPS 生效（绿锁）
- [ ] `/api/geo` 返回正确国家/货币；美国 IP 显示 USD、其余 GBP
- [ ] 注册（带确认密码 + 同意条款）→ 能登录
- [ ] 商品页价格按地区显示；未填 USD 的商品对美国用户隐藏
- [ ] 下单走 PayPal sandbox 能成功、后台能看到订单
- [ ] 首页填邮箱能收到 10% 优惠码邮件；忘记密码能收到验证码邮件
- [ ] 后台 Settings 改运费 → 结账页运费随之变化
- [ ] 后台 Accounting 能按币种看汇总、能导出 CSV
- [ ] PM2 `pm2 status` 显示 fusiey online；重启服务器后能自启

---

## 11. 常见问题

| 现象 | 排查 |
|------|------|
| 打开网站 **502 Bad Gateway** | 后端没起或端口不对：`pm2 logs fusiey`、`curl 127.0.0.1:3000` |
| `/api/geo` 一直 GBP（美国也是） | Cloudflare DNS 是不是**灰云**？需橙云代理才有 cf-ipcountry；Nginx 是否透传了 `CF-IPCountry` 头 |
| 邮件进垃圾箱/收不到 | Resend/MailerSend 域名是否 Verified；`spf=pass`/`dkim=pass` 是否通过；发信地址域名要和后台验证的一致 |
| `prisma migrate deploy` 报错 | `DATABASE_URL` 是否正确、数据库/用户/权限是否建好 |
| 改了 `VITE_` 变量没生效 | 必须重新 `npm run build:client` |
| 上传图片/大画布 413 错误 | Nginx `client_max_body_size 50m;` 是否加了 |
| PayPal 报 currency 错误 | 美国用 USD、英国用 GBP（都支持）；live 上线前先确认 `PAYPAL_MODE` 和密钥 |

---

## 12. 之后再做（花钱/进阶）

1. **DMARC 升级到 `p=quarantine`**（观察期无误伤后）。
2. **BIMI**（发件人头像显示 Logo）—— 见 `docs/BIMI-SETUP.md`，需要注册商标 + VMC
   证书（约 $1000+/年），有订单量和品牌需求后再做。
3. **PayPal 切 live** —— 在 PayPal 后台拿正式密钥，`.env` 改 `PAYPAL_MODE=live` +
   换三个密钥，重新 `build:client` 并 `pm2 restart`。
4. **数据库备份** —— 配置 `pg_dump` 定时任务（宝塔有计划任务）。

---

## 13. 上传文件 / 图片存储（重要）

- 商品图片、图纸下载文件存在服务器本地磁盘的 **`UPLOAD_DIR`**（见 `.env`），由应用在
  `/uploads/...` 路径对外提供，经 Cloudflare CDN 缓存。
- **务必把 `UPLOAD_DIR` 设到部署目录之外**（如 `/var/fusiey/uploads`）并 `mkdir -p` +
  确保运行用户有写权限：`mkdir -p /var/fusiey/uploads && chown -R <运行用户> /var/fusiey`。
  否则 `git pull` / 重新克隆代码会把上传的图片清掉。
- 备份时记得连 `UPLOAD_DIR` 一起备份（数据库只存 URL，不存图片本体）。
- **每次部署有数据库结构变更时**：先 `npx prisma migrate deploy && npx prisma generate`
  再 `pm2 restart fusiey`（应用把 Prisma 客户端缓存在内存里，不重启不会用上新结构）。
- `sharp`（图片处理）有平台原生二进制：生产机务必自己 `npm install`，**不要**把 Windows
  的 `node_modules` 拷过去。
- 管理：后台 **Media** 标签批量上传/管理图片（按 5 大类 → 商品编号+名称 分文件夹）；
  商品表单里「From library / upload」选图或粘贴 URL，最多 9 张。图纸商品可勾选「Fusiey
  认证」上传 JSON（买家得到可编辑副本），或不勾选上传 PDF/PNG（买家下载）。
