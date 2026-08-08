import * as z from 'zod';
import { USER_VALIDATION_MESSAGES } from '../constants/labels';

export const userStatusSchema = z.enum(['Active', 'Inactive', 'Invited']);

const baseUserSchema = z.object({
  first_name: z.string().min(2, USER_VALIDATION_MESSAGES.firstName),
  last_name: z.string().min(2, USER_VALIDATION_MESSAGES.lastName),
  email: z.string().email(USER_VALIDATION_MESSAGES.email),
  // Both optional: a Supabase account needs neither a contact number nor a
  // role, and inventing one to satisfy the form would be worse than an empty
  // cell in the table.
  phone: z.string(),
  role: z.string(),
  status: userStatusSchema
});

/** Sign-in is email + password, so a new account needs an initial password. */
export const createUserSchema = baseUserSchema.extend({
  password: z.string().min(8, USER_VALIDATION_MESSAGES.password)
});

/** On edit the password field is a reset: blank leaves the existing one alone. */
export const updateUserSchema = baseUserSchema.extend({
  password: z
    .string()
    .refine((value) => value === '' || value.length >= 8, USER_VALIDATION_MESSAGES.password)
});

export type UserFormValues = z.infer<typeof createUserSchema>;
