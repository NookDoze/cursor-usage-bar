import { buildWorkosSessionCookie } from './auth';

const API_BASE = 'https://api2.cursor.sh';
const CURSOR_WEB_BASE = 'https://cursor.com';
const USAGE_PATH = '/aiserver.v1.DashboardService/GetCurrentPeriodUsage';
const PLAN_PATH = '/aiserver.v1.DashboardService/GetPlanInfo';
const USAGE_SUMMARY_PATHS = ['/api/usage-summary', '/api/usage/summary'];

export interface OnDemandSpend {
  usedCents: number;
  limitCents: number | null;
}

export interface UsageData {
  planName: string;
  cursorModelsPercent: number;
  otherModelsPercent: number;
  totalPercent: number;
  billingCycleEnd: Date | null;
  onDemand: OnDemandSpend | null;
}

interface PlanUsage {
  autoPercentUsed?: number;
  apiPercentUsed?: number;
  totalPercentUsed?: number;
}

interface SpendLimitUsage {
  totalSpend?: number;
  individualLimit?: number | null;
  individualUsed?: number;
  individualRemaining?: number | null;
  pooledLimit?: number;
  pooledUsed?: number;
  pooledRemaining?: number;
  limitType?: string;
}

interface UsageResponse {
  enabled?: boolean;
  planUsage?: PlanUsage;
  spendLimitUsage?: SpendLimitUsage;
  billingCycleEnd?: string;
}

interface PlanResponse {
  planInfo?: { planName?: string };
}

async function postJson<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Connect-Protocol-Version': '1',
    },
    body: '{}',
  });
  if (!response.ok) {
    throw new Error(`Cursor API returned ${response.status}`);
  }
  return (await response.json()) as T;
}

function parseDate(ms: string | undefined): Date | null {
  if (!ms) {
    return null;
  }
  const value = Number(ms);
  return Number.isFinite(value) ? new Date(value) : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isOnDemandEnabled(spend: SpendLimitUsage | undefined): boolean {
  if (!spend) {
    return false;
  }
  if (spend.individualLimit !== undefined) {
    return true;
  }
  if (spend.individualUsed !== undefined || spend.individualRemaining !== undefined) {
    return true;
  }
  const pooledLimit = finiteNumber(spend.pooledLimit);
  if (pooledLimit !== null && pooledLimit > 0) {
    return true;
  }
  if (spend.pooledUsed !== undefined || spend.pooledRemaining !== undefined) {
    return true;
  }
  return false;
}

function parseOnDemandSpend(spend: SpendLimitUsage | undefined): OnDemandSpend | null {
  if (!isOnDemandEnabled(spend)) {
    return null;
  }

  const pooledLimit = finiteNumber(spend?.pooledLimit);
  if (pooledLimit !== null && pooledLimit > 0) {
    const pooledUsed = finiteNumber(spend?.pooledUsed) ?? pooledLimit - (finiteNumber(spend?.pooledRemaining) ?? 0);
    return { usedCents: pooledUsed, limitCents: pooledLimit };
  }

  const usedCents = finiteNumber(spend?.individualUsed) ?? 0;
  if (spend?.individualLimit === null) {
    return { usedCents, limitCents: null };
  }
  const limitCents = finiteNumber(spend?.individualLimit);
  if (limitCents !== null && limitCents > 0) {
    return { usedCents, limitCents };
  }
  if (spend?.individualRemaining === null) {
    return { usedCents, limitCents: null };
  }
  return { usedCents, limitCents: null };
}

interface UsageSummaryOnDemand {
  enabled?: boolean;
  used?: number;
  limit?: number | null;
  remaining?: number | null;
}

function parseUsageSummaryOnDemand(raw: unknown): OnDemandSpend | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const root = raw as Record<string, unknown>;
  const candidates: UsageSummaryOnDemand[] = [];

  const individual = root.individualUsage;
  if (individual && typeof individual === 'object') {
    const onDemand = (individual as Record<string, unknown>).onDemand;
    if (onDemand && typeof onDemand === 'object') {
      candidates.push(onDemand as UsageSummaryOnDemand);
    }
  }

  const team = root.teamUsage;
  if (team && typeof team === 'object') {
    const onDemand = (team as Record<string, unknown>).onDemand;
    if (onDemand && typeof onDemand === 'object') {
      candidates.push(onDemand as UsageSummaryOnDemand);
    }
  }

  for (const onDemand of candidates) {
    if (!onDemand.enabled) {
      continue;
    }
    const usedCents = finiteNumber(onDemand.used) ?? 0;
    const limitCents = onDemand.limit === null ? null : finiteNumber(onDemand.limit);
    return { usedCents, limitCents };
  }

  return null;
}

async function fetchUsageSummaryOnDemand(token: string): Promise<OnDemandSpend | null> {
  const session = buildWorkosSessionCookie(token);
  if (!session) {
    return null;
  }

  for (const path of USAGE_SUMMARY_PATHS) {
    try {
      const response = await fetch(`${CURSOR_WEB_BASE}${path}`, {
        headers: { Cookie: `WorkosCursorSessionToken=${session}` },
      });
      if (!response.ok) {
        continue;
      }
      const raw = await response.json();
      const parsed = parseUsageSummaryOnDemand(raw);
      if (parsed) {
        return parsed;
      }
    } catch {
      // try next endpoint
    }
  }

  return null;
}

export async function fetchUsage(token: string): Promise<UsageData> {
  const [usageRaw, planRaw] = await Promise.all([
    postJson<UsageResponse>(`${API_BASE}${USAGE_PATH}`, token),
    postJson<PlanResponse>(`${API_BASE}${PLAN_PATH}`, token).catch(() => ({ planInfo: { planName: 'Pro' } })),
  ]);

  if (usageRaw.enabled === false || !usageRaw.planUsage) {
    throw new Error('No active subscription or usage data unavailable');
  }

  const plan = usageRaw.planUsage;
  let onDemand = parseOnDemandSpend(usageRaw.spendLimitUsage);
  if (!onDemand) {
    onDemand = await fetchUsageSummaryOnDemand(token);
  }

  return {
    planName: planRaw.planInfo?.planName?.trim() || 'Pro',
    cursorModelsPercent: plan.autoPercentUsed ?? 0,
    otherModelsPercent: plan.apiPercentUsed ?? 0,
    totalPercent: plan.totalPercentUsed ?? 0,
    billingCycleEnd: parseDate(usageRaw.billingCycleEnd),
    onDemand,
  };
}
