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
 *
 * Callers that spread these options and supply their own `onSuccess` REPLACE
 * the handler below — call `invalidateCorrespondences()` explicitly instead.
 */

export function invalidateCorrespondences() {
  getQueryClient().invalidateQueries({ queryKey: correspondenceKeys.all });
}

export const createCorrespondenceMutation = mutationOptions({
  mutationFn: (formData: FormData) => createCorrespondence(formData),
  onSuccess: () => {
    invalidateCorrespondences();
  }
});

export const updateCorrespondenceMutation = mutationOptions({
  mutationFn: ({ id, formData }: { id: string; formData: FormData }) =>
    updateCorrespondence(id, formData),
  onSuccess: () => {
    invalidateCorrespondences();
  }
});

export const deleteCorrespondenceMutation = mutationOptions({
  mutationFn: (id: string) => deleteCorrespondence(id),
  onSuccess: () => {
    invalidateCorrespondences();
  }
});
