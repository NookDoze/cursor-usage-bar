# Cursor Usage Bar

Show **First-party models** and **API** usage percentages in the Cursor / VS Code status bar.

在 Cursor / VS Code 状态栏实时显示 **First-party models** 与 **API** 两个用量池的使用比例。

## Features / 功能

- Status bar: `1P 6% | API 0%`
- Hover for details (plan, billing cycle, totals)
- Click the status bar to refresh manually
- Configurable auto-refresh interval (default 60 seconds)
- Warning colors at 75% / 90% usage

- 状态栏显示：`1P 6% | API 0%`
- 鼠标悬停查看详情（计划、账单周期等）
- 点击状态栏手动刷新
- 可配置自动刷新间隔（默认 60 秒）
- 用量超过 75% / 90% 时状态栏变色提醒

## Install / 安装

Search in the Cursor extensions panel:

```
@id:NookDoze.cursor-usage-bar
```

Or install from [Open VSX](https://open-vsx.org/extension/NookDoze/cursor-usage-bar).

If search returns no results (common for new extensions), use the CLI:

```bash
cursor --install-extension NookDoze.cursor-usage-bar
```

在 Cursor 扩展市场搜索 `@id:NookDoze.cursor-usage-bar`，或从 Open VSX 安装。若搜不到，可用上面的命令行安装。

## Configuration / 配置

| Setting | Default | Description |
|---------|---------|-------------|
| `cursorUsageBar.refreshSeconds` | `60` | Auto-refresh interval in seconds (min 15) |
| `cursorUsageBar.stateDbPath` | empty | Custom path to `state.vscdb` (auto-detect if empty) |

| 设置项 | 默认值 | 说明 |
|--------|--------|------|
| `cursorUsageBar.refreshSeconds` | `60` | 自动刷新间隔（秒），最小 15 |
| `cursorUsageBar.stateDbPath` | 空 | 自定义 `state.vscdb` 路径 |

## Commands / 命令

- `Cursor Usage Bar: Refresh Usage`
- `Cursor Usage Bar: Open Usage Dashboard`

## Privacy & Security / 隐私与安全

- Reads `accessToken` from the local Cursor database (`state.vscdb`); **does not store** the token
- Sends HTTPS requests **only** to `api2.cursor.sh`
- No third-party servers, no telemetry

- 从本地 Cursor 数据库读取 `accessToken`，**不保存** token
- 仅向 `api2.cursor.sh` 发起 HTTPS 请求
- **无**第三方服务器、无遥测

## Disclaimer / 免责声明

This extension uses unofficial Cursor APIs that may change between Cursor versions. Not affiliated with Cursor or Anysphere.

本扩展使用 Cursor 非公开 API，接口可能随 Cursor 版本变化。与 Cursor / Anysphere 无官方关联。

## Development / 开发

```bash
npm install
npm run compile
npm run package
```

## Claim Namespace (publishers) / 认领 Namespace

To remove the unverified publisher warning on Open VSX, use the official template:

https://github.com/EclipseFdn/open-vsx.org/issues/new?template=claim-namespace-ownership.yml

## License

GPL-3.0 — see [LICENSE](LICENSE).
