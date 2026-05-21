# TraceMark - 项目指南

TraceMark 是一个面向个人的项目工作资产沉淀工具。它通过进程活动、Git、浏览器标题、文档片段、会议/聊天标题和用户补充，生成可确认的工作资产卡片，并按项目空间沉淀为个人项目知识库，最终服务于周复盘和项目阶段复盘。

公开仓库以本文件与 [README.md](README.md) 为准；

---

## 产品定位

### 一句话

TraceMark 是个人项目工作资产账本，不是员工监控工具、团队工时系统，也不是全量桌面记忆工具。

### 优先用户

1. 程序员
2. 产品经理

### 兼容用户

- 实施工程师
- 泛办公人群

### 核心价值

产品不是只帮用户写日报/周报，而是把用户每天分散在工具、窗口、文档、浏览器、会议和代码中的工作过程，沉淀成可确认、可检索、可复用的个人工作资产。

---

## 核心原则

1. **个人数据主权优先**  
   产品定位为个人工具，数据默认属于用户本人。MVP 不做团队管理后台、员工监控、管理者视图。

2. **自动采集做底座，用户确认做可信度**  
   系统自动生成候选资产，但未确认内容不能被强行写成确定成果。

3. **项目空间组织上下文**  
   Git、浏览器关键词、文档关键词、会议/聊天关键词、隐私授权都应归入项目空间，而不是散落在全局设置中。

4. **工作资产卡片是核心对象**  
   时间线和报告是辅助能力。主流程应围绕“候选资产 -> 用户确认 -> 资产库 -> 复盘”展开。

5. **默认效果，但必须明确授权**  
   首次引导可推荐开启云端 AI 增强，但必须让用户明确同意，并提供 AI 上传预览。

6. **增强采集必须分级授权**  
   活跃文档摘要、项目目录文档摘要、会议/聊天标题摘要等能力必须遵守分级授权边界。

7. **本地轻量模型预留，不抢 MVP 主线**  
   本地模型可用于分类、脱敏、短摘要、候选资产初筛，但 MVP 不依赖它完成高质量复盘。

---

## AI/开发执行准则

本节用于约束 AI 编码和日常开发，目标是减少无关改动、过度设计和误解需求。对于非常简单的任务可以简化执行，但不能跳过关键风险判断。

### 先思考再编码

- 不要假设需求。存在多种解释时，先说清楚差异。
- 不要隐藏不确定性。发现需求、架构、隐私边界不清楚时，先明确提问。
- 不要静默选择复杂方案。若存在更简单的实现路径，需要说明取舍。
- 涉及隐私、AI 上传、文档读取、项目目录扫描、多平台权限时，必须先确认边界。

### 简单优先

- 只实现当前任务需要的能力。
- 不为单次使用代码抽象通用框架。
- 不增加未被请求的配置项、插件机制、复杂状态管理或本地模型依赖。
- 如果 200 行能被 50 行清晰解决，应优先重写为更小实现。
- 新的方向是长期资产沉淀，但每次开发仍应落到最小可验证增量。

### 外科手术式修改

- 只改与任务直接相关的文件和代码。
- 不顺手重构无关模块，不整理无关格式，不删除历史代码。
- 匹配现有代码风格，即使有更偏好的写法。
- 如果发现无关问题，只在回复中指出，不擅自修。
- 由本次改动造成的未使用 import、变量、函数必须清理。

### 目标驱动执行

每个非平凡任务都要先定义成功标准。

示例：

```text
1. 新增 work_assets 表 -> 验证：迁移后数据库存在表和索引
2. 接入今日资产收件箱 -> 验证：能展示 suggested 卡片并确认成 confirmed
3. 修复类型检查 -> 验证：node/web 两个 tsconfig 均通过
```

编码完成后必须围绕成功标准验证。无法验证时，要说明原因和剩余风险。


---

## 当前产品主流程

```text
前台活动采集
  -> 进程/窗口标题解析
  -> 项目空间归属判断
  -> Git / 浏览器 / 文档 / 会议等证据摘要
  -> 生成候选工作资产卡片
  -> 用户在今日资产收件箱轻量确认
  -> confirmed 资产进入资产库
  -> 生成周复盘 / 项目阶段复盘
```

### 主导航（底部悬浮菜单）

```text
今日 | 项目 | 时间轴 | 报告 | 设置
```

- **今日** 为默认入口，承载工作资产收件箱
- **项目** 管理项目空间与已确认资产
- **时间轴** 原始活动查看能力（排障、回看）
- **报告** 日报 / 周报生成（辅助导出）
- **设置** 监听、隐私、AI、分类、通知


---

## 核心对象

### 项目空间

项目空间是用户个人对一个项目、客户、产品模块或工作主题的本地归档。

项目空间包含：

- 项目名称
- 项目别名
- 隐私别名
- Git 仓库路径
- 文档目录或文档关键词
- 浏览器关键词
- 会议/聊天关键词
- 隐私授权级别
- 工作资产列表
- 复盘记录

### 工作资产卡片

工作资产卡片由系统候选生成，用户确认后进入项目知识库。

三类卡片：

| 类型 | 说明 |
|------|------|
| 成果卡 | 已产生明确交付或结果 |
| 过程卡 | 重要但尚未形成明确成果的过程 |
| 证据卡 | 原始证据或辅助材料，不能单独写成成果 |

关键规则：

- 未确认卡片不能进入默认复盘。
- 证据卡只能支撑成果卡或过程卡，不能直接作为成果输出。
- 低置信度卡片必须标记“待确认”，并请求用户补充一句话。

### 复盘报告


1. 周复盘
2. 项目阶段复盘

日报/周报可以保留，但它们是资产复用出口，不是产品核心。

---

## 技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| 桌面框架 | Electron | 主进程 + 渲染进程 |
| 前端 | React 18 + TypeScript + Tailwind CSS 4 | 渲染进程 UI |
| 本地数据库 | better-sqlite3 | 本地 SQLite 存储 |
| 当前采集 | Win32 API + PowerShell | 当前 Windows 前台窗口采集实现 |
| 多平台抽象 | ActivityProvider | 新增的平台采集适配层 |
| 窗口标题解析 | 本地规则引擎 | 提取分类、项目、文件、浏览器标题摘要 |
| AI 模型 | 云端模型 / 自定义 API / 本地轻量模型预留 | 云端优先，自定义 API 支持，本地模型先预留 |
| 构建工具 | electron-vite + Vite | 主进程、预加载、渲染进程构建 |
| 打包 | electron-builder | 桌面安装包 |

---

## 项目结构

当前结构：

```text
traceMark/
├── electron/
│   ├── main.ts
│   ├── preload.ts
│   ├── process-watcher.ts
│   ├── active-window.ts
│   ├── window-title-parser.ts
│   ├── sanitizer.ts
│   ├── activity-logs.ts
│   ├── database.ts
│   ├── ai-gateway.ts
│   ├── notification.ts
│   ├── enrichment/
│   │   └── git-enrichment.ts
│   └── ipc-handlers.ts
├── src/
│   ├── App.tsx
│   ├── pages/
│   │   ├── Timeline.tsx
│   │   ├── ReportEditor.tsx
│   │   └── Settings.tsx
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   └── styles/
├── prompts/
├── build/
└── resources/
```

建议新增或重构：

```text
electron/
├── active-window/
│   ├── index.ts
│   ├── windows.ts
│   ├── macos.ts
│   └── linux.ts
├── project-spaces.ts
├── work-assets.ts
├── retrospectives.ts
├── privacy-consents.ts
└── session-summaries.ts

src/
├── pages/
│   ├── TodayInbox.tsx
│   ├── Projects.tsx
│   ├── AssetLibrary.tsx
│   ├── Retrospectives.tsx
│   └── Settings.tsx
├── components/
│   ├── WorkAssetCard.tsx
│   ├── EvidenceList.tsx
│   ├── ProjectSpaceForm.tsx
│   ├── UploadPreview.tsx
│   └── PrivacyConsentPanel.tsx
└── lib/
    ├── projectSpaces.ts
    ├── workAssets.ts
    ├── retrospectives.ts
    └── privacy.ts
```

---

## 数据模型方向

现有表可保留：

- `activity_logs`
- `file_logs`
- `reports`
- `settings`

新增：

- `project_spaces`
- `project_aliases`
- `work_assets`
- `session_summaries`
- `privacy_consents`
- `retrospectives`


### 数据建模原则

- `activity_logs` 是原始活动底座，不直接作为最终价值对象。
- `work_assets` 是核心业务对象。
- `retrospectives` 应基于 confirmed assets 生成。
- `project_spaces` 应承接 Git 路径、关键词、隐私授权，避免继续依赖硬编码路径猜测。
- `settings` 保留全局配置，但项目级授权不应全部塞进 settings。

---

## 隐私与授权规则

### 四级采集能力

| 等级 | 名称 | 内容 | 默认 |
|------|------|------|------|
| L0 | 本地基础 | 进程名、窗口标题、时长，本地保存 | 开启 |
| L1 | 云端结构化 | 脱敏项目名、分类、时长、用户确认内容 | 用户同意后开启 |
| L2 | 增强摘要 | Git diff 摘要、浏览器标题摘要、会议/聊天标题摘要、当前活跃文档片段摘要 | 默认推荐，需明确同意 |
| L3 | 项目空间授权 | 读取项目空间绑定目录下的文档片段用于摘要 | 单项目单独授权 |

### 文档摘要边界

支持：

- 当前活跃文档片段摘要
- 用户对项目空间单独授权后的项目目录文档片段摘要

禁止：

- 默认读取全盘文档
- 默认读取未绑定目录
- 默认上传完整文档
- 默认长期保存原文片段

### AI 上传规则

必须提供上传预览。用户应能看到云端 AI 将收到什么。

可以上传：

- 项目隐私别名
- 脱敏文件名
- Git diff 统计
- 浏览器标题摘要
- 文档片段摘要
- 会议/聊天标题摘要
- 用户补充内容

禁止上传：

- 原始完整窗口标题
- 可执行文件路径
- 完整本地路径
- 完整文档内容
- 原始聊天内容
- 原始屏幕截图

---

## 模型策略

支持三种模式：

1. 云端模型
2. 用户自定义 API
3. 本地轻量模型预留

### 云端模型

用于高质量资产生成、周复盘、项目阶段复盘。必须走脱敏与上传预览。

### 用户自定义 API

支持用户配置 `base_url`、`model`、`api_key`，优先兼容 OpenAI Chat Completions 风格接口。

### 本地轻量模型

MVP 不依赖本地模型完成主流程，只做架构预留或实验开关。

适合：

- 本地分类
- 本地脱敏建议
- 候选资产标题生成
- 短摘要
- 低风险卡片初筛

不适合 MVP 阶段承担：

- 高质量周复盘
- 项目阶段复盘
- 复杂多证据归纳

---

## 代码约定

### 通用

- TypeScript 严格模式。
- 优先命名导出，避免 default export。
- 函数式 React 组件 + Hooks，不使用 class 组件。
- 文件名：组件用 PascalCase，工具函数用 camelCase。
- 路径别名：`@/` 指向 `src/`。
- 新增依赖前必须评估：现有栈能否解决、包体积、维护状态、跨平台影响。

### Electron 主进程

- IPC 通道统一在 `ipc-handlers.ts` 或按领域拆分后集中注册。
- 渲染进程只能通过 `contextBridge` 暴露的 API 访问主进程能力。
- 数据库操作通过领域模块封装，如 `activity-logs.ts`、`work-assets.ts`、`project-spaces.ts`。
- 禁止渲染进程直接操作 SQLite。
- 平台采集必须走 `ActivityProvider` 抽象，不在业务代码里散落 `process.platform` 分支。

### React 渲染进程

- 页面组件放在 `src/pages/`。
- 可复用组件放在 `src/components/`。
- 数据请求放在 `src/lib/`，状态与订阅放在 `src/hooks/`。
- Tailwind CSS 优先，`globals.css` 只放全局变量和基础样式。
- 状态管理优先 React 内置能力，暂不引入 Redux/Zustand/MobX。

### 数据库

- SQL 写操作必须使用参数化查询。
- 表结构变更必须通过迁移逻辑处理，不要只修改 `CREATE TABLE`。
- 新增表需配套索引、类型约束、基础 CRUD 封装。
- 不要把所有结构化业务数据塞进 `settings` key-value。

---

## 工程基线

当前已知问题：根 `npm run typecheck` 可能无法真实检查 node/web 子项目。PRO5.0 W1 必须先修复工程基线。

推荐脚本目标：

```bash
npm run typecheck
```

应真实执行：

```bash
npx tsc -p tsconfig.node.json --noEmit
npx tsc -p tsconfig.web.json --noEmit
```

或改为可正确检查 project references 的 `tsc -b --noEmit`。

在修复脚本前，开发者自查必须分别运行 node/web 两个 tsconfig。

---


## MoSCoW 优先级

### Must

- 修复真实 typecheck 和 build。
- 项目空间。
- 工作资产卡片。
- 候选资产生成。
- 今日资产收件箱。
- 用户确认、编辑、忽略、合并。
- 资产库基础列表与过滤。
- 周复盘。
- 项目阶段复盘。
- 分级授权与 AI 上传预览。
- 云端模型与自定义 API。
- ActivityProvider 多平台抽象。

### Should

- 活跃文档片段摘要。
- 会议/聊天标题摘要。
- 项目目录文档片段授权。
- 本地轻量模型接口预留。
- macOS 前台窗口采集 PoC。

### Could

- 本地轻量模型实验版。
- 浏览器扩展。
- VS Code 插件。
- GitHub/Jira/Linear 集成。
- Obsidian/Notion 导出。

### Won't

- 团队管理后台。
- 员工监控。
- 默认屏幕录制。
- 默认音频录制。
- 全盘文档索引。
- 移动端。

---

## 安全红线

- 禁止做员工监控、团队管理者视图、后台查看个人记录。
- 禁止默认屏幕录制、音频录制、全屏 OCR。
- 禁止默认读取完整文件内容。
- 禁止默认读取未绑定目录下的文档。
- 禁止上传原始完整窗口标题、完整本地路径、可执行路径。
- 禁止在 Git 中提交 `.env`、API Key、证书私钥。
- 必须提供 AI 上传预览。
- 必须支持用户按项目和应用关闭增强采集。

---

## 开发工作流

1. 接到任务先读 `CLAUDE.md` 与 [README.md](README.md)（中文见 [README.zh-CN.md](README.zh-CN.md)）。
2. 明确任务属于：工程基线、项目空间、工作资产、资产库、复盘、隐私授权、多平台采集、AI 模型。
3. 先写出简短成功标准，再编码。
4. 优先遵循现有架构，外科手术式修改。
5. 涉及隐私/AI 上传/文档读取的功能，必须先对照“隐私与授权规则”。
6. 涉及数据模型的功能，必须补 CRUD、迁移、索引、IPC 类型。
7. 提交前至少运行相关 typecheck；工程基线修复前要分别跑 node/web tsconfig。
8. 完成后按成功标准报告验证结果；未验证项必须说明原因。

### Git 提交规范

```text
<type>: <简短描述>

<可选正文：说明为什么这么改>
```

类型：

- `feat`
- `fix`
- `docs`
- `refactor`
- `test`
- `chore`

---

## 快速命令

```bash
# 开发启动
npm run dev

# 当前脚本类型检查
npm run typecheck

# 更可靠的分项目类型检查（工程基线修复前必须使用）
npx tsc -p tsconfig.node.json --noEmit
npx tsc -p tsconfig.web.json --noEmit

# 构建
npm run build

# 打包
npm run package
```

---

