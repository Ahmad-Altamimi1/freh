import { mutationOptions } from '@tanstack/react-query';

import { getQueryClient } from '@/lib/query-client';
import { organizationKeys } from './queries';
import {
  createOrganization,
  deleteOrganization,
  updateOrganization,
  updateOrganizationMembers
} from './service';
import type { Member, OrganizationMutationPayload } from './types';

/**
 * Mutation options for the organizations registry.
 *
 * Every one invalidates `organizationKeys.all` rather than a narrower key. A
 * write can change which rows match the active filter, what the facet counts
 * are, and every figure on the report — so the list, the facets and the report
 * all have to be refetched, and they hang off that root key by design.
 */

export const createOrganizationMutation = mutationOptions({
  mutationFn: (values: OrganizationMutationPayload) => createOrganization(values),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: organizationKeys.all });
  }
});

export const updateOrganizationMutation = mutationOptions({
  mutationFn: ({ id, values }: { id: string; values: OrganizationMutationPayload }) =>
    updateOrganization(id, values),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: organizationKeys.all });
  }
});

export const deleteOrganizationMutation = mutationOptions({
  mutationFn: (id: string) => deleteOrganization(id),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: organizationKeys.all });
  }
});

export const updateOrganizationMembersMutation = mutationOptions({
  mutationFn: ({ id, members }: { id: string; members: Member[] }) =>
    updateOrganizationMembers(id, members),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: organizationKeys.all });
  }
});
