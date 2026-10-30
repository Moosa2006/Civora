import { z } from 'zod';
import {
  DocumentCategory,
  DocumentVisibility,
  EvidencePurpose,
  EvidenceReviewStatus,
} from '@prisma/client';

export const uploadEvidenceMetadataSchema = z.object({
  evidencePurpose: z
    .nativeEnum(EvidencePurpose)
    .optional()
    .default(EvidencePurpose.CITIZEN_SUPPORTING),
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
    .max(1000, 'Description cannot exceed 1000 characters.')
    .optional()
    .nullable(),
  siteInspectionId: z
    .string()
    .uuid('Invalid site inspection ID.')
    .optional()
    .nullable(),
  replacedDocumentId: z
    .string()
    .uuid('Invalid replacement document ID.')
    .optional()
    .nullable(),
  clientPerceptualHash: z
    .string()
    .regex(/^[0-9a-fA-F]{16}$/, 'Client perceptual hash must be a 16-character hexadecimal string.')
    .optional()
    .nullable(),
  browserCaptureTimestamp: z
    .string()
    .datetime({ offset: true })
    .optional()
    .nullable(),
  browserLatitude: z
    .coerce
    .number()
    .min(-90)
    .max(90)
    .optional()
    .nullable(),
  browserLongitude: z
    .coerce
    .number()
    .min(-180)
    .max(180)
    .optional()
    .nullable(),
  browserAccuracy: z
    .coerce
    .number()
    .positive()
    .optional()
    .nullable(),
});

export const reviewEvidenceSchema = z
  .object({
    decision: z.enum(['VERIFIED', 'REJECTED', 'RESUBMISSION_REQUESTED'], {
      message: 'Decision must be VERIFIED, REJECTED, or RESUBMISSION_REQUESTED.',
    }),
    reviewNotes: z
      .string()
      .trim()
      .max(2000, 'Review notes cannot exceed 2000 characters.')
      .optional()
      .nullable(),
    rejectionReason: z
      .string()
      .trim()
      .max(1000, 'Rejection reason cannot exceed 1000 characters.')
      .optional()
      .nullable(),
    resubmissionGuidance: z
      .string()
      .trim()
      .max(1000, 'Resubmission guidance cannot exceed 1000 characters.')
      .optional()
      .nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.decision === 'REJECTED') {
      if (!data.rejectionReason || data.rejectionReason.length < 5) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'A detailed rejection reason of at least 5 characters is mandatory when rejecting evidence.',
          path: ['rejectionReason'],
        });
      }
    }
    if (data.decision === 'RESUBMISSION_REQUESTED') {
      if (!data.resubmissionGuidance || data.resubmissionGuidance.length < 5) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Clear resubmission guidance of at least 5 characters is required when requesting resubmission.',
          path: ['resubmissionGuidance'],
        });
      }
    }
  });

export const quarantineEvidenceSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(5, 'Quarantine reason must be at least 5 characters long.')
    .max(1000, 'Quarantine reason cannot exceed 1000 characters.'),
});

export const evidenceQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  purpose: z.nativeEnum(EvidencePurpose).optional(),
  status: z.nativeEnum(EvidenceReviewStatus).optional(),
  category: z.nativeEnum(DocumentCategory).optional(),
  complaintId: z.string().uuid().optional(),
});
