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

function formatDollars(cents: number): string {
  const dollars = cents / 100;
  if (dollars < 1) {
    return `$${dollars.toFixed(2)}`;
  }
  if (Number.isInteger(dollars)) {
    return `$${dollars}`;
  }
  return `$${dollars.toFixed(2)}`;
}

function formatOnDemandSpend(
  onDemand: NonNullable<Awaited<ReturnType<typeof fetchUsage>>['onDemand']>,
  compact = false,
): string {
  const used = formatDollars(onDemand.usedCents);
  if (onDemand.limitCents === null) {
    return compact ? used : `${used}/unlimited`;
  }
  return `${used}/${formatDollars(onDemand.limitCents)}`;
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
  md.appendMarkdown(`**Cursor Usage** (${data.planName})\n\n`);
  md.appendMarkdown(`- Cursor Models: **${formatPercent(data.cursorModelsPercent)}%**\n`);
  md.appendMarkdown(`- Other Models: **${formatPercent(data.otherModelsPercent)}%**\n`);
  md.appendMarkdown(`- Total: **${formatPercent(data.totalPercent)}%**\n`);
  if (data.onDemand) {
    md.appendMarkdown(`- On-demand: **${formatOnDemandSpend(data.onDemand)}**\n`);
  }
  if (data.billingCycleEnd) {
    md.appendMarkdown(`\nBilling cycle ends: ${data.billingCycleEnd.toLocaleDateString()}\n`);
  }
  md.appendMarkdown('\nClick to refresh · [Open Dashboard](https://cursor.com/dashboard/usage)');
  return md;
}

async function refresh(): Promise<void> {
  if (!statusBar || refreshing) {
    return;
  }
  refreshing = true;
  statusBar.text = '$(sync~spin) Cursor';
  statusBar.tooltip = 'Refreshing usage...';

  try {
    const token = getAccessToken(getStateDbPath());
    if (!token) {
      statusBar.text = '$(warning) Cursor not signed in';
      statusBar.tooltip = 'No accessToken found. Sign in to Cursor first.';
      statusBar.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
      return;
    }

    const data = await fetchUsage(token);
    let text = `$(pulse) Cursor ${formatPercent(data.cursorModelsPercent)}% | Other ${formatPercent(data.otherModelsPercent)}%`;
    if (data.onDemand) {
      text += ` | OD ${formatOnDemandSpend(data.onDemand, true)}`;
    }
    statusBar.text = text;
    statusBar.tooltip = buildTooltip(data);
    statusBar.backgroundColor = colorForPercent(
      Math.max(data.cursorModelsPercent, data.otherModelsPercent),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    statusBar.text = '$(error) Cursor usage';
    statusBar.tooltip = `Failed to fetch usage: ${message}`;
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
