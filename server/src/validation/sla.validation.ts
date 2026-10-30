import { z } from 'zod';
import { ComplaintPriority, EscalationLevel, EscalationTrigger } from '@prisma/client';

export const createSlaPolicySchema = z.object({
  name: z.string().trim().min(3, 'Policy name must be at least 3 characters.').max(255),
  description: z.string().trim().max(1000).optional(),
  categoryId: z.string().uuid('Invalid category ID.').optional().nullable(),
  priority: z.nativeEnum(ComplaintPriority).optional().nullable(),
  responseTargetHours: z.number().int().min(1, 'Response target must be at least 1 hour.').max(8760),
  resolutionTargetHours: z.number().int().min(1, 'Resolution target must be at least 1 hour.').max(8760),
  warningThresholdHours: z.number().int().min(1, 'Warning threshold must be at least 1 hour.').max(8760),
  escalationThresholdHours: z.number().int().min(1, 'Escalation threshold must be at least 1 hour.').max(8760),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  effectiveStartDate: z.string().datetime().optional().or(z.date()),
  effectiveEndDate: z.string().datetime().optional().nullable().or(z.date().nullable()),
});

export const updateSlaPolicySchema = createSlaPolicySchema.partial();

export const requestExtensionSchema = z.object({
  requestedResolutionDeadline: z.string().datetime('Must be a valid ISO datetime string.'),
  reason: z.string().trim().min(10, 'Mandatory extension reason must be at least 10 characters.').max(2000),
});

export const decideExtensionSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  decisionNotes: z.string().trim().max(1000).optional(),
});

export const updateEstimatedCompletionSchema = z.object({
  estimatedCompletionDate: z.string().datetime('Must be a valid ISO datetime string.'),
  estimatedCompletionNotes: z.string().trim().max(1000).optional(),
});

export const acknowledgeEscalationSchema = z.object({
  notes: z.string().trim().max(1000).optional(),
});

export const recordActionPlanSchema = z.object({
  actionPlan: z.string().trim().min(10, 'Action plan must be at least 10 characters.').max(3000),
});

export const resolveEscalationSchema = z.object({
  resolutionReason: z.string().trim().min(5, 'Resolution reason must be at least 5 characters.').max(2000),
});

export const manualEscalationSchema = z.object({
  escalationLevel: z.nativeEnum(EscalationLevel).default(EscalationLevel.LEVEL_2_SUPERVISOR),
  triggerReason: z.nativeEnum(EscalationTrigger).default(EscalationTrigger.MANUAL_SUPERVISOR_ESCALATION),
  notes: z.string().trim().min(10, 'Escalation notes must be at least 10 characters.').max(2000),
});
