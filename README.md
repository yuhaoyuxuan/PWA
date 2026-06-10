# PWA Manager

零依赖、可配置的 PWA 安装管理器。为任意 Web 应用提供定制化的安装引导页、离线缓存和版本更新控制。

## 功能

- 定制化安装引导页面（模拟进度条、功能亮点展示）
- 三种缓存策略（cache-first / network-first / stale-while-revalidate）
- Service Worker 版本管理与更新提示
- 可视化配置编辑器（实时预览）
- iOS Safari 手动安装降级指引
- 同域名站点包裹部署

## 快速开始

1. 将 `public/` 目录部署到网站根目录
2. 编辑 `pwa.config.json` 或访问 `/config-editor.html` 可视化配置
3. 替换 `assets/icons/` 中的图标文件

## 文档

详细说明见 [docs/PWA-MANAGER.md](docs/PWA-MANAGER.md)

## 项目结构

```
public/
├── index.html              # 入口分流
├── install.html            # 安装引导页
├── offline.html            # 离线回退
├── config-editor.html      # 可视化配置编辑
├── pwa.config.json         # 核心配置
├── manifest.json           # PWA 清单
├── sw.js                   # Service Worker
├── assets/icons/           # 图标
├── styles/                 # 样式
└── scripts/                # 脚本
```
