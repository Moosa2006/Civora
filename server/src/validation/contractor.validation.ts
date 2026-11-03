import { z } from 'zod';

export const tenderQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  category: z.string().optional(),
  departmentId: z.string().uuid().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'UNDER_EVALUATION', 'AWARDED', 'CLOSED', 'CANCELLED']).optional(),
  search: z.string().max(100).optional(),
});

export const createTenderSchema = z.object({
  tenderNumber: z.string().optional(),
  title: z.string().min(3, 'Title must be at least 3 characters.').max(255),
  description: z.string().min(5, 'Description must be at least 5 characters.'),
  departmentId: z.string().uuid().optional(),
  civicWorkId: z.string().uuid().optional().nullable(),
  categoryCode: z.string().optional(),
  category: z.string().optional(),
  location: z.string().max(255).optional().default('Municipal Jurisdiction'),
  ward: z.string().max(100).optional().nullable(),
  estimatedBudget: z.coerce.number().positive('Estimated budget must be greater than zero.'),
  earnestMoneyDeposit: z.coerce.number().nonnegative().optional().nullable(),
  minimumContractorClass: z.string().optional().default('ANY'),
  minLicenseClass: z.string().optional(),
  submissionDeadline: z.string(),
  expectedDurationDays: z.coerce.number().int().positive().optional().nullable(),
  eligibilityCriteria: z.string().optional().nullable(),
  scopeOfWork: z.string().optional().nullable(),
  technicalCriteria: z.string().optional().nullable(),
});

export const updateTenderSchema = createTenderSchema.partial();

export const submitBidSchema = z.object({
  bidAmount: z.coerce.number().positive('Bid amount must be greater than zero.'),
  proposedDurationDays: z.coerce.number().int().positive('Proposed duration must be at least 1 day.'),
  technicalProposal: z.string().min(10, 'Technical proposal must be at least 10 characters.'),
  methodology: z.string().optional().nullable(),
  declarationAccepted: z.boolean().optional().default(true),
});

export const evaluateBidSchema = z.object({
  decision: z.enum(['ACCEPT', 'REJECT']).optional(),
  status: z.string().optional(),
  evaluationNotes: z.string().optional().default('Formal review recorded.'),
});

export const awardTenderSchema = z.object({
  bidId: z.string().uuid().optional(),
  winningBidId: z.string().uuid().optional(),
  remarks: z.string().optional(),
  awardJustification: z.string().optional(),
  startDate: z.string().optional().nullable(),
  expectedCompletionDate: z.string().optional().nullable(),
  emergencyAwardOverride: z.boolean().optional().default(false),
  emergencyJustification: z.string().optional(),
});

export const workStartDeclarationSchema = z.object({
  declaredStartDate: z.string().optional(),
  actualStartDate: z.string().optional(),
  siteAddress: z.string().min(3, 'Site address must be provided.'),
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  siteNotes: z.string().optional().default('Site mobilization initialized.'),
});

export const verifyWorkStartSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']).optional(),
  approved: z.boolean().optional(),
  reviewNotes: z.string().optional().default('Site inspection verified.'),
});

export const contractorProgressUpdateSchema = z.object({
  workPerformed: z.string().optional(),
  quantityCompleted: z.coerce.number().optional(),
  unitOfMeasurement: z.string().optional(),
  materialsUsed: z.string().optional(),
  physicalProgressPercentage: z.coerce.number().min(0).max(100).optional().default(10),
  financialProgressAmount: z.coerce.number().nonnegative().optional().nullable(),
  progressNotes: z.string().optional(),
  milestoneReached: z.string().max(255).optional().nullable(),
});

export const claimMilestoneSchema = z.object({
  actualCompletionDate: z.string().optional(),
  completionPercentage: z.coerce.number().min(0).max(100).optional(),
  claimedPhysicalPercentage: z.coerce.number().min(0).max(100).optional().default(100),
  claimedNotes: z.string().optional(),
  submissionNotes: z.string().optional(),
});

export const reviewMilestoneSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']).optional(),
  approved: z.boolean().optional(),
  reviewerRemarks: z.string().optional(),
  reviewComments: z.string().optional(),
  verifiedCompletionPercentage: z.coerce.number().optional(),
  rejectionReason: z.string().optional().nullable(),
});

export const recordPaymentSchema = z.object({
  amount: z.coerce.number().positive('Payment amount must be greater than zero.'),
  paymentReference: z.string().optional(),
  transactionId: z.string().optional(),
  paymentDate: z.string().optional().nullable(),
  paymentStatus: z.string().optional().default('COMPLETED'),
  remarks: z.string().optional().nullable(),
  description: z.string().optional(),
});

export const reportDefectSchema = z.object({
  title: z.string().min(3, 'Title must be provided.').max(255),
  description: z.string().min(5, 'Description must be provided.'),
  location: z.string().optional().default('Project site area'),
  severity: z.string().optional().default('MEDIUM'),
  isWarrantyCovered: z.boolean().optional().default(true),
});

export const rectifyDefectSchema = z.object({
  rectificationNotes: z.string().min(5, 'Rectification notes must be provided.'),
});

export const verifyDefectSchema = z.object({
  decision: z.enum(['VERIFIED_CLOSE', 'REJECT_REWORK']).optional(),
  approved: z.boolean().optional(),
  closureRemarks: z.string().optional(),
  verificationNotes: z.string().optional(),
});

export const updateContractorProfileSchema = z.object({
  name: z.string().min(3).max(255).optional(),
  contactPerson: z.string().max(255).optional(),
  phone: z.string().max(50).optional(),
  businessAddress: z.string().max(1000).optional(),
  operatingRegion: z.string().max(255).optional(),
  panOrTaxId: z.string().max(50).optional(),
  workCategories: z.array(z.string()).optional(),
});

export const verifyContractorSchema = z.object({
  decision: z.enum(['VERIFY', 'REJECT', 'BLACKLIST']).optional(),
  isVerified: z.boolean().optional(),
  licenseClass: z.string().optional(),
  remarks: z.string().max(500).optional(),
});
