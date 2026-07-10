# Cursor Usage Bar

Show **First-party models**, **API**, and **On-demand** usage in the Cursor / VS Code status bar.

在 Cursor / VS Code 状态栏实时显示 **First-party models**、**API** 用量比例，以及本账单周期的 **On-demand** 消费（若已开启）。

## Features / 功能

- Status bar: `1P 6% | API 0%`
- On-demand spend when enabled in Cursor: `OD $0.05/$10` or `OD $10` (unlimited limit; full detail on hover)
- Hover for details (plan, billing cycle, totals, on-demand)
- Click the status bar to refresh manually
- Configurable auto-refresh interval (default 60 seconds)
- Warning colors at 75% / 90% usage

- 状态栏显示：`1P 6% | API 0%`
- 若 Cursor 已开启 On-demand，自动追加：`OD $0.05/$10`；无上限时状态栏仅显示已用金额（如 `OD $10`），悬停可见 `unlimited`
- 鼠标悬停查看详情（计划、账单周期、On-demand 等）
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

Install from a local `.vsix` (use the real Cursor binary on Linux if `~/.local/bin/cursor` is a shim):

```bash
npm run package
/usr/share/cursor/bin/cursor --install-extension cursor-usage-bar-0.3.4.vsix --force
```

在 Cursor 扩展市场搜索 `@id:NookDoze.cursor-usage-bar`，或从 Open VSX 安装。若搜不到，可用上面的命令行安装。本地 VSIX 安装时，Linux 上请使用 `/usr/share/cursor/bin/cursor`，避免 shim 未正确注册扩展。

## Configuration / 配置

| Setting | Default | Description |
|---------|---------|-------------|
| `cursorUsageBar.refreshSeconds` | `60` | Auto-refresh interval in seconds (min 15) |
| `cursorUsageBar.stateDbPath` | empty | Custom path to `state.vscdb` (auto-detect if empty) |

| 设置项 | 默认值 | 说明 |
|--------|--------|------|
| `cursorUsageBar.refreshSeconds` | `60` | 自动刷新间隔（秒），最小 15 |
| `cursorUsageBar.stateDbPath` | 空 | 自定义 `state.vscdb` 路径 |

On-demand display requires **On-demand Usage** enabled in [Cursor Dashboard → Spending](https://cursor.com/dashboard/usage). No extra extension setting is needed.

On-demand 显示需在 [Cursor Dashboard → Spending](https://cursor.com/dashboard/usage) 中开启 **On-demand Usage**，无需额外扩展配置。

## Commands / 命令

- `Cursor Usage Bar: Refresh Usage`
- `Cursor Usage Bar: Open Usage Dashboard`

## Privacy & Security / 隐私与安全

- Reads `accessToken` from the local Cursor database (`state.vscdb`); **does not store** the token
- Sends HTTPS requests to `api2.cursor.sh` (usage percentages) and `cursor.com` (on-demand summary fallback)
- No third-party servers, no telemetry

- 从本地 Cursor 数据库读取 `accessToken`，**不保存** token
- 向 `api2.cursor.sh`（用量百分比）和 `cursor.com`（On-demand 回退接口）发起 HTTPS 请求
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

## License

GPL-3.0 — see [LICENSE](LICENSE).
