import { z } from 'zod';
import {
  ReportTargetType,
  AbuseReportReason,
  ModerationActionType,
  UserRestrictionType,
} from '@prisma/client';

export const createAbuseReportSchema = z.object({
  targetType: z.nativeEnum(ReportTargetType, {
    message: 'Valid target content type is required.',
  }),
  targetId: z.string().uuid('Invalid target content UUID.'),
  reason: z.nativeEnum(AbuseReportReason, {
    message: 'Valid report reason category is required.',
  }),
  explanation: z
    .string()
    .max(1000, 'Explanation cannot exceed 1000 characters.')
    .optional()
    .transform((val) => (val?.trim() ? val.trim() : undefined)),
});

export const duplicateCheckQuerySchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters.'),
  description: z.string().min(5, 'Description must be at least 5 characters.'),
  categoryId: z.string().uuid('Invalid category ID.'),
  locality: z.string().optional(),
  ward: z.string().optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  excludeComplaintId: z.string().uuid().optional(),
});

export const moderationActionSchema = z.object({
  caseId: z.string().uuid('Invalid moderation case ID.'),
  actionType: z.nativeEnum(ModerationActionType, {
    message: 'Valid moderation action type is required.',
  }),
  reason: z
    .string()
    .min(5, 'A clear mandatory explanation (minimum 5 characters) is required for moderation decisions.'),
  internalNotes: z.string().max(2000).optional(),
});

export const createAppealSchema = z.object({
  caseId: z.string().uuid('Invalid moderation case ID.'),
  reason: z
    .string()
    .min(10, 'Please provide an appeal explanation of at least 10 characters.'),
});

export const reviewAppealSchema = z.object({
  decision: z.enum(['UPHELD', 'REJECTED'], {
    message: 'Decision must be UPHELD or REJECTED.',
  }),
  decisionReason: z
    .string()
    .min(5, 'A clear mandatory reason (minimum 5 characters) is required for appeal decisions.'),
});

export const userRestrictionSchema = z.object({
  userId: z.string().uuid('Invalid user UUID.'),
  restrictionType: z.nativeEnum(UserRestrictionType, {
    message: 'Valid restriction type is required.',
  }),
  reason: z
    .string()
    .min(5, 'A clear mandatory reason (minimum 5 characters) is required for account restrictions.'),
  durationHours: z.number().int().min(1).max(8760).optional(),
});

export const liftRestrictionSchema = z.object({
  liftReason: z
    .string()
    .min(5, 'A clear mandatory reason (minimum 5 characters) is required to lift a restriction.'),
});

export const linkDuplicateSchema = z.object({
  primaryComplaintId: z.string().uuid('Invalid primary complaint UUID.'),
  duplicateComplaintId: z.string().uuid('Invalid duplicate complaint UUID.'),
  reason: z.string().min(3, 'Reason must be at least 3 characters.').optional(),
});
