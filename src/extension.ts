import * as vscode from 'vscode';
import { fetchUsage } from './api';
import { getAccessToken } from './auth';

let statusBar: vscode.StatusBarItem | undefined;
let timer: ReturnType<typeof setInterval> | undefined;
let refreshing = false;

function getRefreshSeconds(): number {
  const value = vscode.workspace.getConfiguration('cursorUsageBar').get<number>('refreshSeconds', 60);
  return Math.max(15, value);
}

function getStateDbPath(): string | undefined {
  const value = vscode.workspace.getConfiguration('cursorUsageBar').get<string>('stateDbPath', '').trim();
  return value || undefined;
}

function formatPercent(value: number): string {
  if (value < 1 && value > 0) {
    return value.toFixed(1);
  }
  return String(Math.round(value));
}

function colorForPercent(percent: number): vscode.ThemeColor | undefined {
  if (percent >= 90) {
    return new vscode.ThemeColor('statusBarItem.errorBackground');
  }
  if (percent >= 75) {
    return new vscode.ThemeColor('statusBarItem.warningBackground');
  }
  return undefined;
}

function buildTooltip(data: ReturnType<typeof fetchUsage> extends Promise<infer T> ? T : never): vscode.MarkdownString {
  const md = new vscode.MarkdownString();
  md.isTrusted = true;
  md.appendMarkdown(`**Cursor 用量** (${data.planName})\n\n`);
  md.appendMarkdown(`- First-party models: **${formatPercent(data.firstPartyPercent)}%**\n`);
  md.appendMarkdown(`- API: **${formatPercent(data.apiPercent)}%**\n`);
  md.appendMarkdown(`- 总计: **${formatPercent(data.totalPercent)}%**\n`);
  if (data.billingCycleEnd) {
    md.appendMarkdown(`\n账单周期结束: ${data.billingCycleEnd.toLocaleDateString()}\n`);
  }
  md.appendMarkdown('\n点击刷新 · [打开 Dashboard](https://cursor.com/dashboard/usage)');
  return md;
}

async function refresh(): Promise<void> {
  if (!statusBar || refreshing) {
    return;
  }
  refreshing = true;
  statusBar.text = '$(sync~spin) Cursor';
  statusBar.tooltip = '正在刷新用量...';

  try {
    const token = getAccessToken(getStateDbPath());
    if (!token) {
      statusBar.text = '$(warning) Cursor 未登录';
      statusBar.tooltip = '未找到 accessToken，请先在 Cursor 中登录';
      statusBar.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
      return;
    }

    const data = await fetchUsage(token);
    statusBar.text = `$(pulse) 1P ${formatPercent(data.firstPartyPercent)}% | API ${formatPercent(data.apiPercent)}%`;
    statusBar.tooltip = buildTooltip(data);
    statusBar.backgroundColor = colorForPercent(Math.max(data.firstPartyPercent, data.apiPercent));
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    statusBar.text = '$(error) Cursor 用量';
    statusBar.tooltip = `获取失败: ${message}`;
    statusBar.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
  } finally {
    refreshing = false;
  }
}

function schedulePolling(): void {
  if (timer) {
    clearInterval(timer);
  }
  timer = setInterval(() => {
    void refresh();
  }, getRefreshSeconds() * 1000);
}

export function activate(context: vscode.ExtensionContext): void {
  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.command = 'cursorUsageBar.refresh';
  statusBar.show();
  context.subscriptions.push(statusBar);

  context.subscriptions.push(
    vscode.commands.registerCommand('cursorUsageBar.refresh', () => refresh()),
    vscode.commands.registerCommand('cursorUsageBar.openDashboard', () => {
      void vscode.env.openExternal(vscode.Uri.parse('https://cursor.com/dashboard/usage'));
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('cursorUsageBar.refreshSeconds')) {
        schedulePolling();
      }
    }),
    new vscode.Disposable(() => {
      if (timer) {
        clearInterval(timer);
      }
    }),
  );

  schedulePolling();
  void refresh();
}

export function deactivate(): void {
  if (timer) {
    clearInterval(timer);
  }
  statusBar?.dispose();
}
