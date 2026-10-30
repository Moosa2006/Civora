import { z } from 'zod';
import { ComplaintStatus, CivicWorkStatus } from '@prisma/client';

export const trendsQuerySchema = z.object({
  days: z.coerce
    .number()
    .int('Days must be an integer.')
    .min(1, 'Days must be at least 1.')
    .max(365, 'Days cannot exceed 365.')
    .optional()
    .default(30),
});

export const publicComplaintsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  status: z.nativeEnum(ComplaintStatus).optional(),
  categoryId: z.string().uuid('Category ID must be a valid UUID.').optional(),
  departmentId: z.string().uuid('Department ID must be a valid UUID.').optional(),
  search: z.string().trim().max(100, 'Search term must not exceed 100 characters.').optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const projectsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  status: z.nativeEnum(CivicWorkStatus).optional(),
  departmentId: z.string().uuid('Department ID must be a valid UUID.').optional(),
  search: z.string().trim().max(100, 'Search term must not exceed 100 characters.').optional(),
});

export type TrendsQueryInput = z.infer<typeof trendsQuerySchema>;
export type PublicComplaintsQueryInput = z.infer<typeof publicComplaintsQuerySchema>;
export type ProjectsQueryInput = z.infer<typeof projectsQuerySchema>;
