# Design System and custom registry

Built-in and custom previews must use the same catalog registry as deck rendering.

Workspace custom code belongs under `design-system/custom/`. A custom registration needs:

- a stable kebab-case ID;
- a kind (`layout` or `component`);
- a renderer implementation owned by workspace code;
- a non-executable JSON fixture for Gallery/creation-assistant preview;
- any declared media paths resolved inside the workspace or public assets.

Do not embed arbitrary HTML/JS in `deck.cadenza.json`. Register code first, then reference its ID from slide data. Verify Gallery preview, deck render, and browser smoke with the same ID.

When a deck needs an original illustration, follow [illustration-rules.md](../../../../design-system/visual-assets/illustration-rules.md) and its machine-readable sibling `illustration-rules.json`. Generated illustrations stay deck-local by default; do not promote them into the shared registry merely because one slide looks good.

`custom:numbered-series` is the reusable multi-page method/step layout. Its fixed contract is `seriesLabel + seriesNumber + title + subtitle`; variable page objects use the shared `{ x: 6, y: 35, width: 88, height: 49 }` frame and must stay above the master-owned bottom navigation. The layout may repeat across a chapter because continuity is its purpose, while the content composition should vary with evidence and relationships. Copyable, cross-topic qualified scenarios are `series-peer-panels`, `series-ordered-gates`, `series-evidence-split`, `series-asymmetric-evidence`, and `series-code-contract`; `series-evidence-split` is the preferred follow-up proof page for expanding one abstract point, and `series-code-contract` requires verified commands plus a visible explanation of observable results. Use their applicability and failure conditions instead of introducing deck-local geometry.

## Evidence-first visual contract

任何 layout、component 或视觉资产都必须遵守 [visual-review-contract.md](visual-review-contract.md)。该文件是证据优先、媒体主导、One Bit、一致 icon 语法、构图节奏与 Audience 验收的单一事实来源；本文件只维护 registry 与自定义实现契约。
