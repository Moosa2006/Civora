import { z } from 'zod';

export const createProposalSchema = z.object({
  title: z
    .string()
    .trim()
    .min(5, 'Proposal title must be at least 5 characters.')
    .max(255, 'Proposal title cannot exceed 255 characters.'),
  description: z
    .string()
    .trim()
    .min(20, 'Detailed proposal description must be at least 20 characters.')
    .max(5000, 'Description cannot exceed 5000 characters.'),
  categoryId: z
    .string()
    .uuid('Invalid civic category identifier.'),
  locality: z
    .string()
    .trim()
    .max(255, 'Locality cannot exceed 255 characters.')
    .optional(),
  problemStatement: z
    .string()
    .trim()
    .max(2000, 'Problem statement cannot exceed 2000 characters.')
    .optional(),
  suggestedSolution: z
    .string()
    .trim()
    .max(2000, 'Suggested solution cannot exceed 2000 characters.')
    .optional(),
});

export const proposalQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  categoryId: z.string().uuid().optional(),
  locality: z.string().trim().optional(),
  search: z.string().trim().optional(),
  status: z
    .enum([
      'SUBMITTED',
      'UNDER_REVIEW',
      'NEEDS_CLARIFICATION',
      'PUBLISHED',
      'ACCEPTED_FOR_CONSIDERATION',
      'DECLINED',
      'ARCHIVED',
    ])
    .optional(),
  sortBy: z.enum(['newest', 'most_supported']).default('newest'),
});

export const moderateProposalSchema = z.object({
  status: z.enum([
    'UNDER_REVIEW',
    'NEEDS_CLARIFICATION',
    'PUBLISHED',
    'ACCEPTED_FOR_CONSIDERATION',
    'DECLINED',
    'ARCHIVED',
  ]),
  internalNotes: z
    .string()
    .trim()
    .max(2000, 'Internal notes cannot exceed 2000 characters.')
    .optional(),
  publicExplanation: z
    .string()
    .trim()
    .max(2000, 'Public explanation cannot exceed 2000 characters.')
    .optional(),
});

export const officialResponseSchema = z.object({
  officialResponse: z
    .string()
    .trim()
    .min(10, 'Official authority response must be at least 10 characters.')
    .max(3000, 'Official response cannot exceed 3000 characters.'),
});

export const createCommentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(3, 'Comment must be at least 3 characters.')
    .max(1500, 'Comment cannot exceed 1500 characters.'),
});

export const createPollSchema = z.object({
  title: z
    .string()
    .trim()
    .min(5, 'Poll title must be at least 5 characters.')
    .max(255, 'Poll title cannot exceed 255 characters.'),
  question: z
    .string()
    .trim()
    .min(10, 'Poll question must be at least 10 characters.')
    .max(500, 'Poll question cannot exceed 500 characters.'),
  description: z
    .string()
    .trim()
    .max(2000, 'Description cannot exceed 2000 characters.')
    .optional(),
  categoryId: z.string().uuid().optional(),
  locality: z.string().trim().max(255).optional(),
  pollType: z.enum(['SINGLE_CHOICE', 'MULTI_CHOICE']).default('SINGLE_CHOICE'),
  maxSelections: z.coerce.number().int().min(1).max(10).default(1),
  visibilityRule: z
    .enum(['ALWAYS_VISIBLE', 'AFTER_VOTE', 'AFTER_CLOSE'])
    .default('ALWAYS_VISIBLE'),
  startDate: z.string().datetime({ message: 'Start date must be a valid ISO datetime.' }),
  endDate: z.string().datetime({ message: 'End date must be a valid ISO datetime.' }),
  options: z
    .array(z.string().trim().min(1, 'Option cannot be empty.').max(255))
    .min(2, 'A poll requires at least 2 distinct options.')
    .max(10, 'A poll can have at most 10 options.'),
  isAdvisory: z.boolean().default(true),
});

export const submitVoteSchema = z.object({
  optionIds: z
    .array(z.string().uuid('Invalid option identifier.'))
    .min(1, 'At least one option must be selected.'),
});

export const updatePollStatusSchema = z.object({
  status: z.enum(['DRAFT', 'SCHEDULED', 'OPEN', 'CLOSED', 'ARCHIVED']),
});
