import { useEffect } from 'react';
import { useConnectionStore } from '../stores/connectionStore';

export function UsageBadge() {
  const { gcApiKey, aiTier, aiLimits, aiUsageToday, aiUsageMonth, setAiStatus } = useConnectionStore();

  useEffect(() => {
    if (!gcApiKey) return;
    window.electronAPI.ai.status(gcApiKey).then((status) => {
      if (status.connected) {
        setAiStatus(status);
      }
    }).catch(() => {});
  }, [gcApiKey]);

  if (!gcApiKey || !aiLimits) return null;

  const todayRequests = aiUsageToday?.requests ?? 0;
  const monthRequests = aiUsageMonth?.requests ?? 0;
  const monthlyPct = aiLimits.monthly_requests > 0
    ? Math.min((monthRequests / aiLimits.monthly_requests) * 100, 100)
    : 0;

  const tierLabel = aiTier.charAt(0).toUpperCase() + aiTier.slice(1);

  return (
    <div className="px-4 py-2 bg-white border-t border-gray-100">
      <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
        <span>{tierLabel} tier</span>
        <span>
          {todayRequests}/{aiLimits.daily_requests} today · {monthRequests}/{aiLimits.monthly_requests} this month
        </span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-1">
        <div
          className={`h-1 rounded-full transition-all ${monthlyPct >= 90 ? 'bg-red-500' : monthlyPct >= 70 ? 'bg-yellow-500' : 'bg-primary-500'}`}
          style={{ width: `${monthlyPct}%` }}
        />
      </div>
    </div>
  );
}
