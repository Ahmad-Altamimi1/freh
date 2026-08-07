import { mutationOptions } from '@tanstack/react-query';

import { getQueryClient } from '@/lib/query-client';
import { correspondenceKeys } from './queries';
import { createCorrespondence, deleteCorrespondence, updateCorrespondence } from './service';

/**
 * Mutation options for the correspondence log.
 *
 * Every one invalidates `correspondenceKeys.all` rather than a narrower key —
 * a write can change which rows match the active filter and what the facet
 * counts are, so the list and the facets both have to be refetched.
 */

export const createCorrespondenceMutation = mutationOptions({
  mutationFn: (formData: FormData) => createCorrespondence(formData),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: correspondenceKeys.all });
  }
});

export const updateCorrespondenceMutation = mutationOptions({
  mutationFn: ({ id, formData }: { id: string; formData: FormData }) =>
    updateCorrespondence(id, formData),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: correspondenceKeys.all });
  }
});

export const deleteCorrespondenceMutation = mutationOptions({
  mutationFn: (id: string) => deleteCorrespondence(id),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: correspondenceKeys.all });
  }
});
