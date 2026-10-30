import { z } from 'zod';

export const notificationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(15),
  isRead: z
    .enum(['true', 'false', 'all'])
    .optional()
    .transform((val) => {
      if (val === 'true') return true;
      if (val === 'false') return false;
      return undefined;
    }),
});

export const updatePreferencesSchema = z.object({
  emailNotifications: z.boolean().optional(),
  statusChangeAlerts: z.boolean().optional(),
  progressUpdateAlerts: z.boolean().optional(),
  assignmentAlerts: z.boolean().optional(),
  messageAlerts: z.boolean().optional(),
  resolutionAlerts: z.boolean().optional(),
});

export const createMessageSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, 'Message content is required.')
    .max(2000, 'Message cannot exceed 2000 characters.'),
  isInternal: z.boolean().optional().default(false),
});
