import { mutationOptions } from '@tanstack/react-query';

import { organizationKeys } from '@/features/organizations/api/queries';
import { getQueryClient } from '@/lib/query-client';
import { renewalKeys } from './queries';
import { setRenewalStage, updateRenewalDetails } from './service';
import type { RenewalDetailsPayload, RenewalStagePayload } from './types';

/**
 * Both writes invalidate the board root — a move changes which column a card is
 * in, and the summary counts above it.
 *
 * They do NOT invalidate `organizationKeys.all`, with one exception below: a
 * renewal records what the directorate did, not what the registry says, so the
 * listing and the report are unaffected and refetching them would be waste.
 */
function invalidateBoard() {
  getQueryClient().invalidateQueries({ queryKey: renewalKeys.all });
}

export const setRenewalStageMutation = mutationOptions({
  mutationFn: (payload: RenewalStagePayload) => setRenewalStage(payload),
  onSuccess: () => {
    invalidateBoard();
    // The dashboard's term panel counts the same societies this board tracks,
    // and it hangs off the registry root.
    getQueryClient().invalidateQueries({ queryKey: organizationKeys.dashboard() });
  }
});

export const updateRenewalDetailsMutation = mutationOptions({
  mutationFn: (payload: RenewalDetailsPayload) => updateRenewalDetails(payload),
  onSuccess: invalidateBoard
});
