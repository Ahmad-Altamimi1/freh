import * as z from 'zod';
import { CORRESPONDENCE_TYPES } from '../api/types';

export const correspondenceFormSchema = z.object({
  name: z.string().trim().min(2, 'اسم المراسلة مطلوب').max(300, 'اسم المراسلة طويل جدًا'),
  type: z.enum(CORRESPONDENCE_TYPES, { error: 'يرجى اختيار نوع المراسلة' }),
  organizationId: z.string().trim().min(1, 'الجهة المعنية مطلوبة'),
  /** Newly-picked files only — persisted files are tracked separately, outside the form. */
  files: z.array(z.file()).optional()
});

export type CorrespondenceFormValues = z.infer<typeof correspondenceFormSchema>;
