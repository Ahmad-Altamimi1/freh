import { mutationOptions } from '@tanstack/react-query';

import { organizationKeys } from '@/features/organizations/api/queries';
import { getQueryClient } from '@/lib/query-client';
import { renewalKeys } from './queries';
import { setRenewalStage, updateRenewalDetails } from './service';
import type { RenewalDetailsPayload, RenewalStagePayload } from './types';

/**
 * Refreshes the board after a write — a move changes which column a card is in,
 * the summary counts above it, and the dashboard's term panel (which counts the
 * same societies off the registry root).
 *
 * Exported and called directly by the components rather than left to run only
 * from the `onSuccess` handlers below. A caller that spreads these options and
 * then supplies its own `onSuccess` — which both the board and the details sheet
 * do, to raise a toast and close the sheet — REPLACES the handler rather than
 * adding to it, so without this the board silently stops refreshing until the
 * page is reloaded. Same footgun, and same fix, as `invalidateReportTemplates`.
 */
export function invalidateRenewals() {
  const queryClient = getQueryClient();
  queryClient.invalidateQueries({ queryKey: renewalKeys.all });
  queryClient.invalidateQueries({ queryKey: organizationKeys.dashboard() });
}

export const setRenewalStageMutation = mutationOptions({
  mutationFn: (payload: RenewalStagePayload) => setRenewalStage(payload),
  onSuccess: invalidateRenewals
});

export const updateRenewalDetailsMutation = mutationOptions({
  mutationFn: (payload: RenewalDetailsPayload) => updateRenewalDetails(payload),
  onSuccess: invalidateRenewals
});
