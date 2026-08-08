import { mutationOptions } from '@tanstack/react-query';

import { getQueryClient } from '@/lib/query-client';
import { organizationKeys, reportTemplateKeys } from './queries';
import {
  createOrganization,
  deleteOrganization,
  deleteReportTemplate,
  saveReportTemplate,
  updateOrganization,
  updateOrganizationMembers,
  updateReportTemplate
} from './service';
import type { Member, OrganizationMutationPayload, ReportTemplatePayload } from './types';

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

/**
 * Template writes invalidate only the template root — saving a report definition
 * changes no registry data, so the list, facets and report caches stay warm.
 */

export const saveReportTemplateMutation = mutationOptions({
  mutationFn: (values: ReportTemplatePayload) => saveReportTemplate(values),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: reportTemplateKeys.all });
  }
});

export const updateReportTemplateMutation = mutationOptions({
  mutationFn: ({ id, values }: { id: string; values: ReportTemplatePayload }) =>
    updateReportTemplate(id, values),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: reportTemplateKeys.all });
  }
});

export const deleteReportTemplateMutation = mutationOptions({
  mutationFn: (id: string) => deleteReportTemplate(id),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: reportTemplateKeys.all });
  }
});
