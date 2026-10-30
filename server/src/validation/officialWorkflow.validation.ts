import { z } from 'zod';
import { InspectionOutcome, DocumentCategory, DocumentVisibility } from '@prisma/client';

export const progressUpdateSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Title must be at least 3 characters long.')
    .max(255, 'Title must not exceed 255 characters.'),
  description: z
    .string()
    .trim()
    .min(5, 'Detailed description must be at least 5 characters long.')
    .max(3000, 'Description must not exceed 3000 characters.'),
  stage: z
    .string()
    .trim()
    .max(100, 'Stage name must not exceed 100 characters.')
    .optional(),
  estimatedNextActionDate: z
    .string()
    .datetime({ offset: true })
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}/))
    .optional()
    .nullable(),
  visibility: z
    .nativeEnum(DocumentVisibility)
    .optional()
    .default(DocumentVisibility.PUBLIC),
});

export const inspectionSchema = z.object({
  outcome: z.nativeEnum(InspectionOutcome, {
    message: 'Valid inspection outcome is required.',
  }),
  observations: z
    .string()
    .trim()
    .min(5, 'Observations must be at least 5 characters long.')
    .max(3000, 'Observations must not exceed 3000 characters.'),
  measurements: z
    .string()
    .trim()
    .max(500, 'Measurements must not exceed 500 characters.')
    .optional()
    .nullable(),
  notes: z
    .string()
    .trim()
    .max(1000, 'Notes must not exceed 1000 characters.')
    .optional()
    .nullable(),
  inspectionDate: z
    .string()
    .datetime({ offset: true })
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}/))
    .optional()
    .nullable(),
});

export const evidenceMetadataSchema = z.object({
  fileName: z
    .string()
    .trim()
    .min(1, 'File name is required.')
    .max(255, 'File name must not exceed 255 characters.')
    .refine(
      (name) => !name.includes('..') && !name.includes('/') && !name.includes('\\'),
      'File name contains unsafe path characters.'
    ),
  mimeType: z
    .string()
    .trim()
    .toLowerCase()
    .refine(
      (mime) =>
        ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(mime),
      'Unsupported media type. Allowed types: JPEG, PNG, WebP, PDF.'
    ),
  fileSize: z
    .number()
    .int()
    .positive('File size must be positive.')
    .max(10485760, 'File size cannot exceed 10MB limit.'),
  documentCategory: z
    .nativeEnum(DocumentCategory)
    .optional()
    .default(DocumentCategory.COMPLAINT_EVIDENCE),
  visibility: z
    .nativeEnum(DocumentVisibility)
    .optional()
    .default(DocumentVisibility.PUBLIC),
  description: z
    .string()
    .trim()
    .max(1000, 'Description must not exceed 1000 characters.')
    .optional()
    .nullable(),
  siteInspectionId: z
    .string()
    .uuid('Invalid site inspection ID.')
    .optional()
    .nullable(),
});

export const submitResolutionSchema = z.object({
  resolutionNotes: z
    .string()
    .trim()
    .min(10, 'Resolution notes must provide at least 10 characters of detail.')
    .max(3000, 'Resolution notes must not exceed 3000 characters.'),
});

export const verifyResolutionSchema = z.object({
  confirmationNotes: z
    .string()
    .trim()
    .max(1000, 'Confirmation notes must not exceed 1000 characters.')
    .optional()
    .nullable(),
});

export const reopenComplaintSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(10, 'Reopening reason must provide at least 10 characters explaining why the issue is unresolved.')
    .max(2000, 'Reopening reason must not exceed 2000 characters.'),
});

export const reassignComplaintSchema = z.object({
  departmentId: z
    .string()
    .uuid('Valid department ID is required.'),
  officialId: z
    .string()
    .uuid('Official ID must be a valid UUID.')
    .optional()
    .nullable(),
  reason: z
    .string()
    .trim()
    .min(3, 'Reassignment reason is required.')
    .max(1000, 'Reason must not exceed 1000 characters.'),
});
