import { z } from 'zod';
import { ComplaintPriority, ComplaintStatus } from '@prisma/client';

export const createComplaintSchema = z.object({
  title: z
    .string()
    .trim()
    .min(5, 'Title must be at least 5 characters long.')
    .max(255, 'Title must not exceed 255 characters.'),
  description: z
    .string()
    .trim()
    .min(10, 'Description must provide at least 10 characters of detail.')
    .max(3000, 'Description must not exceed 3000 characters.'),
  categoryId: z
    .string()
    .uuid('Category ID must be a valid UUID.'),
  priority: z
    .nativeEnum(ComplaintPriority)
    .optional()
    .default(ComplaintPriority.MEDIUM),
  locationAddress: z
    .string()
    .trim()
    .min(3, 'Location address must be at least 3 characters long.')
    .max(500, 'Location address must not exceed 500 characters.'),
  locality: z
    .string()
    .trim()
    .min(2, 'Locality/landmark must be at least 2 characters long.')
    .max(255, 'Locality must not exceed 255 characters.'),
  ward: z
    .string()
    .trim()
    .max(100, 'Ward identifier must not exceed 100 characters.')
    .optional(),
  latitude: z
    .number()
    .min(-90, 'Latitude must be between -90 and 90.')
    .max(90, 'Latitude must be between -90 and 90.')
    .optional()
    .nullable(),
  longitude: z
    .number()
    .min(-180, 'Longitude must be between -180 and 180.')
    .max(180, 'Longitude must be between -180 and 180.')
    .optional()
    .nullable(),
});

export const updateComplaintStatusSchema = z.object({
  status: z.nativeEnum(ComplaintStatus, {
    message: 'Invalid complaint status.',
  }),
  reason: z
    .string()
    .trim()
    .max(1000, 'Reason must not exceed 1000 characters.')
    .optional(),
  resolutionNotes: z
    .string()
    .trim()
    .max(2000, 'Resolution notes must not exceed 2000 characters.')
    .optional(),
}).refine(
  (data) => {
    if (data.status === ComplaintStatus.REJECTED && (!data.reason || data.reason.trim().length === 0)) {
      return false;
    }
    return true;
  },
  {
    message: 'A rejection reason is mandatory when marking a complaint as REJECTED.',
    path: ['reason'],
  }
);

export const assignComplaintSchema = z.object({
  departmentId: z
    .string()
    .uuid('Department ID must be a valid UUID.')
    .optional()
    .nullable(),
  officialId: z
    .string()
    .uuid('Official user ID must be a valid UUID.')
    .optional()
    .nullable(),
  notes: z
    .string()
    .trim()
    .max(1000, 'Assignment notes must not exceed 1000 characters.')
    .optional(),
}).refine(
  (data) => !!data.departmentId || !!data.officialId,
  {
    message: 'At least one of departmentId or officialId must be provided for assignment.',
  }
);

export type CreateComplaintInput = z.infer<typeof createComplaintSchema>;
export type UpdateComplaintStatusInput = z.infer<typeof updateComplaintStatusSchema>;
export type AssignComplaintInput = z.infer<typeof assignComplaintSchema>;
