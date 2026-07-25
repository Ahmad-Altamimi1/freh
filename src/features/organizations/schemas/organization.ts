import { z } from 'zod';

/**
 * Validation for a single imported row.
 *
 * Split deliberately into hard requirements and soft expectations:
 *
 *  - A row without a name or a district cannot be stored — `name` is NOT NULL,
 *    and district is what every filter and report groups by.
 *  - A malformed mobile number is a data-quality problem, not a reason to reject
 *    a society from the registry. Those are surfaced as warnings by the import
 *    action and the row is written anyway.
 *
 * Rejecting whole rows over a bad phone number would mean an import of real
 * municipal data fails on the rows that most need correcting.
 */

/** Jordanian mobile: ten digits beginning `07`. */
export const JORDAN_MOBILE_PATTERN = /^07\d{8}$/;

/** National registration number as issued: nine or ten digits. */
export const NATIONAL_ID_PATTERN = /^\d{9,10}$/;

export const organizationImportRowSchema = z.object({
  name: z.string().trim().min(1, 'اسم الجمعية مطلوب').max(300, 'اسم الجمعية طويل جدًا'),
  district: z.string().trim().min(1, 'اللواء مطلوب').max(120, 'اسم اللواء طويل جدًا'),
  classification: z.string().trim().max(120).nullable(),
  nationalId: z.string().trim().max(32).nullable(),
  establishedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'تاريخ التأسيس غير صالح')
    .nullable(),
  directorName: z.string().trim().max(200).nullable(),
  mobile: z.string().trim().max(32).nullable(),
  serialNo: z.number().int().nonnegative().nullable()
});

export type OrganizationImportRow = z.infer<typeof organizationImportRowSchema>;

/**
 * The manual create/edit form.
 *
 * Optional fields are `''` rather than `null` here — an empty text input yields
 * an empty string, and the write layer is what converts blanks to NULL. Keeping
 * the form's own shape free of nulls avoids every field needing a null guard.
 *
 * Validation is deliberately no stricter than the import's. A row imported with
 * an odd mobile number has to remain editable: if the form demanded a
 * well-formed number, correcting that row's director name would be impossible
 * without also "fixing" a number nobody can verify.
 */
export const organizationFormSchema = z.object({
  name: z.string().trim().min(2, 'اسم الجمعية مطلوب').max(300, 'اسم الجمعية طويل جدًا'),
  district: z.string().trim().min(1, 'اللواء مطلوب').max(120),
  classification: z.string().trim().max(120),
  nationalId: z
    .string()
    .trim()
    .max(32)
    .refine(
      (value) => value === '' || /^\d+$/.test(value),
      'الرقم الوطني يجب أن يتكون من أرقام فقط'
    ),
  establishedAt: z
    .string()
    .trim()
    .refine((value) => value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value), 'تاريخ التأسيس غير صالح'),
  termStart: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value),
      'تاريخ بداية الدورة غير صالح'
    ),
  termLength: z.union([
    z.literal(''),
    z
      .number()
      .int('مدة الدورة يجب أن تكون عددًا صحيحًا من الأشهر')
      .min(1, 'مدة الدورة يجب أن تكون شهرًا واحدًا على الأقل')
      .max(600, 'مدة الدورة طويلة جدًا')
  ]),
  directorName: z.string().trim().max(200),
  mobile: z
    .string()
    .trim()
    .max(32)
    .refine(
      (value) => value === '' || /^\d{9,15}$/.test(value),
      'رقم الهاتف يجب أن يتكون من أرقام فقط (مثال: 0790000000)'
    )
});

export type OrganizationFormValues = z.infer<typeof organizationFormSchema>;
