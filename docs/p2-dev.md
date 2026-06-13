# P2 — 未来开发清单（Coming soon）

首页已做"Coming soon"预告、但尚未开发的功能。数据模型已有部分铺垫
（`SavedPattern.isPublished/publishedAt/downloadCount/likeCount`、`CommunityLike`、
`User.communityPoints` 已存在），实现时可直接复用。

## 1. 拼豆社区 (Fusiey Community)
- 用户把自己的图纸**发布**到公开社区（`SavedPattern.isPublished`）。
- 社区画廊：浏览/搜索/分类，**点赞**（`CommunityLike` 已有模型）、下载量统计。
- 分享 / 发现 / 交流。

## 2. 图纸导入画布二次创作
- **社区图纸** 和 **Fusiey 官方图纸** 都能一键**导入设计器画布**，在别人的设计基础上继续改。
- 涉及：复制图纸到自己 My Works（或临时载入）+ 设计器 `?load=` 流程扩展。

## 3. 积分 / 奖励系统
- Profile 现有 "Community Points" 卡片（标注 coming soon，`User.communityPoints` 已存在）。
- **赚积分**：发布图纸 / 被点赞 / 下载 / 购买等。
- **花积分**：兑换社区付费图纸、或抵扣订单。
- 积分流水/明细。

---
> 这些是 P1 上线**之后**的迭代方向，上线不依赖它们。P1 上线清单见 `p1-dev.md`。
