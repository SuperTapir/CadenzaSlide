# Cadenza illustration rules

插画不是填空素材。只有当具体画面比文字、真实媒体、图表或 diagram 更快解释页面关系时才画；结果默认属于当前 deck，不自动进入公共资产库。

## 生成前 contract

每次生成或绘制前必须先写清 `illustration-rules.json` 规定的 contract：页面目的、主体、`figure / object / machine / annotation` 四类角色、唯一焦点、留白方向、三色 token、来源、1-bit case 和明确淘汰条件。没有 contract，不开始生成。

## 视觉语法

- 只保留一个 hero；主体占画面约 28%–62%，至少 28% 负空间留给 slide copy。
- 优先 profile、three-quarter 或 top-down 视角；避免正面对称徽章、居中吉祥物和 UI 卡片云。
- `paper / ink / accent` 是唯一颜色角色；accent 覆盖不超过 12%，只能标记一个语义信号。
- figure 通过姿态、视线、重心表达关系；object 与 machine 必须有具体叙事职责；annotation 只解释关系，不做气氛装饰。
- 不预先添加 pixel、halftone、噪点或渐变；像素语言由 Cadenza one-bit renderer 统一产生。

## 立即淘汰

出现 generic SaaS blob people、漂浮 UI 卡片、渐变装饰、无叙事职责的 mascot、glossy 3D、随机环/粒子、图内文字，或必须依赖 accent 才能理解时，直接淘汰。

## 1-bit gate

在短边至少 320px、`gridScale: 1 / 2 / 3` 下捕获。主体轮廓、关键物件和关系必须仍可读；细线消失、语义物件粘连、方向不清或黑块超过 45% 时，调整原图或放弃 one-bit treatment，不能用滤镜结果勉强交付。

## 验证样例

规则文件包含 enterprise strategy、technical architecture、people/culture 三类 materially different brief。它们是 contract 与验收 case，不是待生产的成品插画。
