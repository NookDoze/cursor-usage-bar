# Cursor Usage Bar

在 Cursor / VS Code 状态栏实时显示 **First-party models** 与 **API** 两个用量池的使用比例。

## 功能

- 状态栏显示：`1P 6% | API 0%`
- 鼠标悬停查看详情（计划、账单周期等）
- 点击状态栏手动刷新
- 可配置自动刷新间隔（默认 60 秒）
- 用量超过 75% / 90% 时状态栏变色提醒

## 安装

在 Cursor 扩展市场搜索：

```
@id:NookDoze.cursor-usage-bar
```

或从 [Open VSX](https://open-vsx.org/extension/NookDoze/cursor-usage-bar) 安装。

## 配置

| 设置项 | 默认值 | 说明 |
|--------|--------|------|
| `cursorUsageBar.refreshSeconds` | `60` | 自动刷新间隔（秒），最小 15 |
| `cursorUsageBar.stateDbPath` | 空 | 自定义 `state.vscdb` 路径 |

## 命令

- `Cursor Usage Bar: 刷新用量`
- `Cursor Usage Bar: 打开用量面板`

## 隐私与安全

- 从本地 Cursor 数据库（`state.vscdb`）读取 `accessToken`，**不保存** token
- 仅向 `api2.cursor.sh` 发起 HTTPS 请求获取用量
- **无**第三方服务器、无遥测

## 免责声明

本扩展使用 Cursor 非公开 API，接口可能随 Cursor 版本变化。与 Cursor / Anysphere 无官方关联。

## 开发

```bash
npm install
npm run compile
npm run package
```

## License

GPL-3.0 — see [LICENSE](LICENSE).
