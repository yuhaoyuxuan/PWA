# PWA Manager 说明文档

## 概述

PWA Manager 是一个可配置的 PWA 安装管理器，为零依赖的纯前端方案。它为任意 Web 应用提供：

- 定制化的安装引导页面（含模拟进度条）
- Service Worker 驱动的离线缓存策略
- 版本更新检测与提示
- 可视化配置编辑器

## 快速开始

### 1. 部署文件

将 `public/` 目录下的所有文件部署到你网站的根目录：

```
your-site.com/
├── index.html           # 入口（自动分流）
├── install.html         # 安装引导页
├── offline.html         # 离线回退页
├── manifest.json        # PWA 清单
├── pwa.config.json      # ★ 配置文件
├── sw.js               # Service Worker
├── config-editor.html   # 可视化配置界面
├── assets/icons/        # 应用图标
├── styles/              # 样式文件
└── scripts/             # 脚本文件
```

### 2. 配置应用信息

编辑 `pwa.config.json`，或访问 `/config-editor.html` 使用可视化编辑器。

最小配置示例：

```json
{
  "app": {
    "name": "我的应用",
    "short_name": "应用",
    "start_url": "/app/",
    "theme_color": "#3b82f6"
  }
}
```

### 3. 替换图标

将你的图标文件替换 `assets/icons/` 目录下的文件：
- `icon-192.png` — 192×192px
- `icon-512.png` — 512×512px
- `icon-512-maskable.png` — 512×512px（带安全边距）

更新 `pwa.config.json` 和 `manifest.json` 中的图标路径。

### 4. 验证

- 用 Chrome 打开你的网站，DevTools → Application → Manifest 检查清单
- 用 Lighthouse 检查 PWA 评分

## 配置文件说明

### app — 应用基本配置

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | string | 应用全名，显示在安装提示中 |
| `short_name` | string | 短名称，显示在主屏幕图标下方（≤12 字符） |
| `description` | string | 应用描述 |
| `start_url` | string | 安装后启动的 URL，指向你的站点入口 |
| `scope` | string | PWA 作用域，默认 `/` |
| `theme_color` | color | 主题色，影响状态栏和标题栏颜色 |
| `background_color` | color | 启动画面背景色 |
| `display` | string | 显示模式：`standalone` / `fullscreen` / `minimal-ui` / `browser` |
| `orientation` | string | 屏幕方向：`portrait-primary` / `landscape-primary` / `any` |

### installPage — 安装页面配置

| 字段 | 类型 | 说明 |
|------|------|------|
| `title` | string | 安装页标题和安装按钮文字 |
| `subtitle` | string | 引导文案 |
| `icon` | string | 安装页展示的图标 URL |
| `screenshots` | string[] | 应用截图 URL 数组 |
| `features` | string[] | 功能亮点列表 |
| `progressSteps` | string[] | 进度条分段名称（如 "下载资源", "缓存数据", "完成安装"） |
| `progressDuration` | number | 进度条动画总时长（毫秒），默认 3000 |

### installPage.theme — 主题颜色

| 字段 | 说明 |
|------|------|
| `primary` | 主色（按钮、进度条、高亮） |
| `primaryHover` | 主色悬停态 |
| `background` | 页面背景色 |
| `cardBackground` | 卡片背景色 |
| `text` | 正文颜色 |
| `textSecondary` | 次要文字颜色 |
| `success` | 成功/完成色 |
| `progressBg` | 进度条轨道色 |
| `progressFill` | 进度条填充色 |

### cache — 缓存策略

| 字段 | 类型 | 说明 |
|------|------|------|
| `version` | string | 缓存版本号（语义化版本）。修改版本号将清除所有旧缓存 |
| `precache` | string[] | 预缓存资源列表，SW 安装时自动缓存 |
| `runtimeCache` | object[] | 运行时缓存规则数组 |
| `offlineFallback` | string | 离线时显示的备用页面 |

**运行时缓存规则对象：**

| 字段 | 说明 |
|------|------|
| `urlPattern` | URL 匹配模式（包含该字符串即匹配） |
| `strategy` | 缓存策略：`cache-first` / `network-first` / `stale-while-revalidate` |
| `maxEntries` | 最大缓存条目数（仅 cache-first） |
| `maxAge` | 缓存有效期（秒），0 = 永不过期 |

**三种缓存策略说明：**

- **cache-first** — 优先返回缓存，缓存未命中才请求网络。适用于静态资源（图片、字体）
- **network-first** — 优先请求网络，失败时回退到缓存。适用于 API 数据
- **stale-while-revalidate** — 立即返回缓存，同时后台更新。适用于可容忍短暂过时的内容

### update — 版本更新

| 字段 | 类型 | 说明 |
|------|------|------|
| `autoUpdate` | boolean | 检测到新版本是否自动应用 |
| `promptUser` | boolean | 是否显示更新横幅提示用户 |
| `checkInterval` | number | 定期检查间隔（毫秒），0 = 不自动检查 |

## 工作流程

```
用户访问网站
  │
  ├─ 已安装（standalone 模式）
  │   └─ 重定向到 start_url（你的站点）
  │
  └─ 未安装
      └─ 重定向到 install.html
          ├─ Chrome/Android：显示安装按钮 → 触发 beforeinstallprompt → 进度条动画 → 跳转站点
          └─ iOS Safari：显示手动添加指引（分享 → 添加到主屏幕）
```

## 同域名部署

PWA Manager 与目标站点部署在同一域名下：

```
your-site.com/
├── index.html           ← PWA Manager 入口
├── install.html         ← PWA Manager 安装页
├── sw.js               ← PWA Manager Service Worker
├── ...
├── app/                 ← 你的目标站点
│   └── index.html
└── ...
```

配置 `start_url` 指向你的站点入口（如 `/app/`）。用户在 PWA 模式下打开时，直接进入你的站点。

**注意：** Service Worker 的 `scope` 默认是 `/`，会影响整个域名。如需限定范围，将 PWA 文件放在子目录（如 `/pwa/`），并相应调整 `scope` 和所有路径。

## 可视化配置编辑器

访问 `/config-editor.html` 打开可视化配置界面：

- **左侧表单** — 5 个 Tab 分组（App 信息 / 安装页面 / 主题外观 / 缓存策略 / 版本更新）
- **右侧预览** — 手机模拟框实时反映配置变更
- **工具栏** — 导入/导出 JSON 文件、重置默认、保存
- **快捷键** — `Cmd/Ctrl + S` 保存配置
- **自动暂存** — 所有修改自动保存到 localStorage，防止丢失

## iOS Safari 降级策略

iOS Safari 不支持 `beforeinstallprompt` API，因此采用手动引导方案：

1. 检测到 iOS Safari 时，自动隐藏安装按钮
2. 显示图文指引卡片：分享按钮 → 添加到主屏幕 → 确认添加
3. 用户按指引操作后，下次打开即进入 standalone 模式

## 缓存版本管理

修改 `cache.version` 后，Service Worker 会：

1. 安装新版本 SW，预缓存新资源
2. 激活时清除旧版本号命名的所有缓存
3. 如果 `update.promptUser = true`，弹窗提示用户刷新

## 自定义建议

- **图标**：提供至少 192px 和 512px 两个尺寸，maskable 图标需在 512px 内保留 80% 安全区
- **启动画面**：iOS 使用 `apple-touch-icon` 和 `apple-mobile-web-app-capable` meta 标签（可选添加）
- **截图**：Chrome 要求至少 1 张 1280×720 以上的截图用于安装对话框
- **缓存**：先预缓存核心页面和样式，再按需配置运行时缓存规则

## 浏览器兼容性

| 功能 | Chrome | Edge | Firefox | Safari | Safari iOS |
|------|--------|------|---------|--------|------------|
| Service Worker | ✓ | ✓ | ✓ | ✓ | ✓ |
| beforeinstallprompt | ✓ | ✓ | ✗ | ✗ | ✗ |
| Web App Manifest | ✓ | ✓ | ✗ | ✗ | ✓* |
| 安装引导 | 原生 | 原生 | 不支持 | 不支持 | 手动指引 |

\* Safari iOS 支持部分 manifest 属性（`apple-mobile-web-app-capable` 等）

## 常见问题

**Q: 修改配置后安装页没有变化？**
A: 检查 `pwa.config.json` 是否被缓存。SW 对该文件使用 network-first 策略，但首次加载可能使用旧缓存。建议修改后清空浏览器缓存测试。

**Q: iOS 上安装后没有独立窗口效果？**
A: 确保 HTML 中有 `<meta name="apple-mobile-web-app-capable" content="yes">`，并且用户是从 Safari 的"添加到主屏幕"操作的。

**Q: start_url 指向的页面需要做什么？**
A: 目标站点页面不需要特殊处理。如果希望目标站点也注册 SW 获得离线能力，可以在页面中引入 `/scripts/sw-register.js`。

**Q: 如何彻底卸载 PWA 应用？**
A: 用户从主屏幕删除图标即可。开发调试时，在 Chrome DevTools → Application → Clear site data。
