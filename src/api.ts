const API_BASE = 'https://api2.cursor.sh';
const USAGE_PATH = '/aiserver.v1.DashboardService/GetCurrentPeriodUsage';
const PLAN_PATH = '/aiserver.v1.DashboardService/GetPlanInfo';

export interface UsageData {
  planName: string;
  firstPartyPercent: number;
  apiPercent: number;
  totalPercent: number;
  billingCycleEnd: Date | null;
}

interface PlanUsage {
  autoPercentUsed?: number;
  apiPercentUsed?: number;
  totalPercentUsed?: number;
}

interface UsageResponse {
  enabled?: boolean;
  planUsage?: PlanUsage;
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

export async function fetchUsage(token: string): Promise<UsageData> {
  const [usageRaw, planRaw] = await Promise.all([
    postJson<UsageResponse>(`${API_BASE}${USAGE_PATH}`, token),
    postJson<PlanResponse>(`${API_BASE}${PLAN_PATH}`, token).catch(() => ({ planInfo: { planName: 'Pro' } })),
  ]);

  if (usageRaw.enabled === false || !usageRaw.planUsage) {
    throw new Error('No active subscription or usage data unavailable');
  }

  const plan = usageRaw.planUsage;
  return {
    planName: planRaw.planInfo?.planName?.trim() || 'Pro',
    firstPartyPercent: plan.autoPercentUsed ?? 0,
    apiPercent: plan.apiPercentUsed ?? 0,
    totalPercent: plan.totalPercentUsed ?? 0,
    billingCycleEnd: parseDate(usageRaw.billingCycleEnd),
  };
}
