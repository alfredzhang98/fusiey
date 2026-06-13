# BIMI 配置 —— 让发件人头像显示 Fusiey Logo

收件箱里发件人名字旁边那个圆圈（现在是字母 **F**）**不是邮件 HTML 能控制的**。
Gmail / Apple Mail 这类客户端是按 **BIMI** 标准，去你域名的 **DNS** 里读取品牌
Logo 来显示。要把 "F" 换成 Fusiey 兔子，必须：①开启强制 DMARC，②发布 BIMI
DNS 记录指向一个合规的 SVG，③（Gmail/Apple 还需要）购买 VMC 证书。

合规的 Logo 已经生成并随前端一起发布：

- **`client/public/bimi-logo.svg`** —— SVG Tiny PS 格式、正方形、约 4.5 KB、
  含 `<title>`、无脚本/位图。部署后访问地址为
  `https://<你的域名>/bimi-logo.svg`。

---

## 前提条件（必须先满足）

只有当你的邮件已经通过身份认证，BIMI 才会生效。请先在 **Resend** 和
**MailerSend** 后台完成（它们会直接给你对应的 DNS 记录）：

1. **SPF** —— 发信域名校验通过。
2. **DKIM** —— 校验通过，由发信子域名签名
   （`resend.worldangle.work` / `verify.worldangle.work`）。在"宽松对齐"下，
   它们与主域名 `worldangle.work` 是对齐的。

验证方法：用 https://www.mail-tester.com ，或查看收到邮件里的
`Authentication-Results`，需要同时出现 `spf=pass` **和** `dkim=pass`。

---

## 第 1 步 —— 开启强制 DMARC

DMARC 必须是 `p=quarantine` 或 `p=reject`（**不能是 `p=none`**），否则 BIMI 被忽略。

> ⚠️ 这会影响 `worldangle.work` 域名下的**所有邮件**。请先确认每一个合法发信方
> 的 SPF+DKIM 都通过，否则正常邮件可能被丢进垃圾箱。
> 建议：先用 `p=none`（仅观察、开启 `rua` 报告）跑一周，确认报告无误伤后，再
> 升级到 `quarantine`。

DNS TXT 记录：

```
名称(Name):  _dmarc.worldangle.work
类型(Type):  TXT
值(Value):   v=DMARC1; p=quarantine; sp=quarantine; adkim=r; aspf=r; pct=100; rua=mailto:dmarc@worldangle.work
```

说明：`sp=quarantine` 让策略覆盖发信子域名；`adkim=r` / `aspf=r`（宽松对齐）
让子域名的 DKIM/SPF 能满足主域名 From 的对齐要求。

**观察期安全版本**（先用这个跑一周）：

```
名称:  _dmarc.worldangle.work
类型:  TXT
值:    v=DMARC1; p=none; rua=mailto:dmarc@worldangle.work
```

---

## 第 2 步 —— 发布 BIMI 记录

```
名称(Name):  default._bimi.worldangle.work
类型(Type):  TXT
值(Value):   v=BIMI1; l=https://<你的域名>/bimi-logo.svg; a=https://<你的域名>/vmc.pem
```

- `l=` → `bimi-logo.svg` 的公开 HTTPS 地址（必须能直接访问、HTTPS、无跳转）。
  部署在 Cloudflare 上时，例如 `https://fusiey.com/bimi-logo.svg`。
- `a=` → VMC 证书地址（见第 3 步）。如果暂时没有 VMC，可以**先去掉 `a=` 这段**；
  部分客户端（Fastmail、La Poste）会显示 Logo，但 **Gmail 和 Apple 在有 VMC
  之前不会显示**。

补充：BIMI 也会按 **From 域名**去查记录；由于两个发信子域名共用主域名
`worldangle.work`，上面这条记录会通过"主域名回退"被找到。
（可选：再在 `default._bimi.resend.worldangle.work` 和
`default._bimi.verify.worldangle.work` 各复制一份，更保险。）

---

## 第 3 步 —— VMC 证书（Gmail/Apple 显示所必需）

Gmail 和 Apple Mail 只有在有 **VMC（Verified Mark Certificate，验证标志证书）**
支撑时才会显示 BIMI Logo；非商标标志可用 **CMC（Common Mark Certificate）**。

- 由 **DigiCert** 或 **Entrust** 签发。
- VMC 要求该 Logo 是**已注册商标**，费用约 **$1000+/年**。
- CMC 不要求商标，但支持的邮箱服务商更少。
- 你提交同一个 `bimi-logo.svg`，对方返回一个 `.pem`，把它放到 `a=` 指向的地址。

**现实提醒：** 没有 VMC/CMC，即使第 1、2 步都配好，Gmail 里头像依然是字母 "F"。
不过第 1、2 步本身仍值得做（强制 DMARC 能提升送达率、防伪冒）。等 Logo/商标和
预算都到位后，再补上 VMC。

---

## 验证

- BIMI 记录 + Logo：https://bimigroup.org/bimi-generator/ （检查器）或
  https://mxtoolbox.com/bimi.aspx
- DNS 生效后，给自己发一封邮件，在支持 BIMI 的客户端里查看。

## 重新生成 Logo

`bimi-logo.svg` 是用 `client/public/logo-icon.svg`（兔子头）生成的：先把像素画
高清渲染，再按格子取主色（block-mode 下采样，去掉抗锯齿杂色）还原成干净的
28×28 纯色网格，并贪心合并矩形（保证 < 32 KB、无锯齿杂点）。
如果品牌图标更换了，对新图标重跑这个转换即可。
