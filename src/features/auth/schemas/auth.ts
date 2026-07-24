import * as z from 'zod';

export const signInSchema = z.object({
  email: z.email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required')
});

export type SignInFormValues = z.infer<typeof signInSchema>;
