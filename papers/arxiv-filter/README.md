# Subsribed New Arxiv Submissions（周更静态列表）

仿 [Dong Lai gp.html](https://donglai6.github.io/gp.html)：打开网页**不再**打 arXiv API，只读本目录静态 `index.html` / `papers.json`。

线上：https://youwenzhang19.github.io/papers/arxiv-filter/

## 条目格式（gp）

```
MM/DD/YYYY =====================================
- Title: ShortName
```

`Title` 链到 `https://arxiv.org/abs/…`；冒号后是匹配到的关注作者 `shortName`（多人用逗号拼接）。

顶栏：标题 + **作者 arXiv 搜索链接**（Astro／Phil-sci 分行）。无搜索框／Filter notes／date mode／reload。

## arXiv 周边界

官方截止：**每天 14:00 US Eastern**（见 https://info.arxiv.org/help/availability.html）。新帖日为周日–周四宣布；**无周五／周六宣布**。

本页按「周五 14:00 ET 收盘」切 batch，节标题为该周五的 `MM/DD/YYYY`（与 gp 一致）：

| 时区 | 周五截止时刻 |
|------|----------------|
| **US Eastern** | **周五 14:00**（EDT 或 EST） |
| **UTC** | EDT：周五 **18:00 UTC**；EST：周五 **19:00 UTC** |
| **上海（Asia/Shanghai, UTC+8）** | EDT：周六 **02:00**；EST：周六 **03:00** |

区间：`(上周五 14:00 ET, 本周五 14:00 ET]` → 标签 = 本周五。

## 每周如何更新

在本目录：

```bash
npm run update
# 等价：node update.mjs
```

会按 `authors.json` **分作者**拉 arXiv API（分页）、Rovelli 仍走 `phil-sci` 启发式（UI 不展示说明）、重写 `papers.json` + `index.html`。

然后按 homepage push protocol 提交并推到 `youwenzhang19.github.io` 的 `main`（Mac worker / `youwenzhang19` 身份）。

可选 cron（本机，周五 14:00 ET 之后跑一次即可，例如上海周六上午）：

```cron
# 上海时间周六 10:00 ≈ 美东周五晚／周六早，按 DST 微调
0 10 * * 6 cd /path/to/homepage/papers/arxiv-filter && npm run update && cd /path/to/homepage && git add papers/arxiv-filter && git commit -m "Weekly arxiv-filter refresh" && git push origin main
```

## 作者名录

见 Agent Store `docs/1031-arxiv-authors.md`；机器可读：`authors.json`（含 `shortName` / `field`）。
