import { z } from 'zod';

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters long.')
    .max(100, 'Name must not exceed 100 characters.'),
  email: z
    .string()
    .trim()
    .email('Please provide a valid email address.')
    .max(255, 'Email must not exceed 255 characters.')
    .toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long.')
    .max(128, 'Password must not exceed 128 characters.'),
  phone: z
    .string()
    .trim()
    .max(50, 'Phone number must not exceed 50 characters.')
    .optional(),
});

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email('Please provide a valid email address.')
    .max(255, 'Email must not exceed 255 characters.')
    .toLowerCase(),
  password: z
    .string()
    .min(1, 'Password is required.')
    .max(128, 'Password must not exceed 128 characters.'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export const bootstrapAdminSchema = z.object({
  setupSecret: z.string().trim().optional(),
  email: z
    .string()
    .trim()
    .email('Please provide a valid administrator email address.')
    .max(255, 'Email must not exceed 255 characters.')
    .toLowerCase(),
  password: z
    .string()
    .min(8, 'Administrator password must be at least 8 characters long.')
    .max(128, 'Password must not exceed 128 characters.'),
  name: z
    .string()
    .trim()
    .min(2, 'Administrator name must be at least 2 characters long.')
    .max(100, 'Name must not exceed 100 characters.')
    .default('Platform Administrator'),
  phone: z
    .string()
    .trim()
    .max(50, 'Phone number must not exceed 50 characters.')
    .optional(),
});

export type BootstrapAdminInput = z.infer<typeof bootstrapAdminSchema>;

export const registerContractorSchema = z.object({
  // Contact Account Details
  name: z
    .string()
    .trim()
    .min(2, 'Contact person name must be at least 2 characters long.')
    .max(100, 'Contact person name must not exceed 100 characters.'),
  email: z
    .string()
    .trim()
    .email('Please provide a valid official email address.')
    .max(255, 'Email must not exceed 255 characters.')
    .toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long.')
    .max(128, 'Password must not exceed 128 characters.'),
  phone: z
    .string()
    .trim()
    .min(7, 'Phone number must be at least 7 digits.')
    .max(50, 'Phone number must not exceed 50 characters.'),

  // Company Details
  companyName: z
    .string()
    .trim()
    .min(2, 'Registered company name must be at least 2 characters long.')
    .max(255, 'Company name must not exceed 255 characters.'),
  registrationNumber: z
    .string()
    .trim()
    .min(3, 'Company registration identifier must be at least 3 characters.')
    .max(100, 'Company registration identifier must not exceed 100 characters.')
    .toUpperCase(),
  panOrTaxId: z
    .string()
    .trim()
    .min(5, 'Tax / PAN registration ID must be at least 5 characters.')
    .max(50, 'Tax / PAN registration ID must not exceed 50 characters.')
    .toUpperCase(),
  businessAddress: z
    .string()
    .trim()
    .min(5, 'Registered business address must be at least 5 characters.')
    .max(500, 'Business address must not exceed 500 characters.'),
  operatingRegion: z
    .string()
    .trim()
    .min(2, 'Operating region must be at least 2 characters.')
    .max(255, 'Operating region must not exceed 255 characters.'),
  licenseClass: z
    .enum(['CLASS_A', 'CLASS_B', 'CLASS_C', 'CLASS_D'])
    .default('CLASS_B'),
  workCategories: z
    .array(z.string().trim().min(2))
    .min(1, 'Please select at least one work category.')
    .default(['ROADS_POTHOLES']),
});

export const createOfficialSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Official name must be at least 2 characters long.')
    .max(100, 'Official name must not exceed 100 characters.'),
  email: z
    .string()
    .trim()
    .email('Please provide a valid government or work email address.')
    .max(255, 'Email must not exceed 255 characters.')
    .toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long.')
    .max(128, 'Password must not exceed 128 characters.'),
  phone: z
    .string()
    .trim()
    .max(50, 'Phone number must not exceed 50 characters.')
    .optional(),
  departmentId: z
    .string()
    .uuid('Valid department selection is required.'),
});

export const contractorReviewSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  reason: z
    .string()
    .trim()
    .max(1000, 'Reason must not exceed 1000 characters.')
    .optional(),
});

export type RegisterContractorInput = z.infer<typeof registerContractorSchema>;
export type CreateOfficialInput = z.infer<typeof createOfficialSchema>;
export type ContractorReviewInput = z.infer<typeof contractorReviewSchema>;

