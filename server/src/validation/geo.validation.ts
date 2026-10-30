import { z } from 'zod';
import { ComplaintPriority, ComplaintStatus } from '@prisma/client';

export const mapViewportQuerySchema = z.object({
  minLat: z.coerce.number().min(-90).max(90),
  maxLat: z.coerce.number().min(-90).max(90),
  minLng: z.coerce.number().min(-180).max(180),
  maxLng: z.coerce.number().min(-180).max(180),
  categoryId: z.string().uuid().optional(),
  status: z.nativeEnum(ComplaintStatus).optional(),
  priority: z.nativeEnum(ComplaintPriority).optional(),
  departmentId: z.string().uuid().optional(),
  search: z.string().max(100).optional(),
  locality: z.string().max(100).optional(),
  ward: z.string().max(100).optional(),
  startDate: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  endDate: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  limit: z.coerce.number().int().min(1).max(300).default(100),
}).refine((data) => data.minLat <= data.maxLat, {
  message: 'minLat must be less than or equal to maxLat.',
  path: ['minLat'],
}).refine((data) => data.minLng <= data.maxLng, {
  message: 'minLng must be less than or equal to maxLng.',
  path: ['minLng'],
});

export const nearbyQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().min(0.1).max(50).default(5),
  categoryId: z.string().uuid().optional(),
  status: z.nativeEnum(ComplaintStatus).optional(),
  priority: z.nativeEnum(ComplaintPriority).optional(),
  search: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const hotspotsQuerySchema = z.object({
  groupBy: z.enum(['ward', 'locality']).default('ward'),
  categoryId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  status: z.nativeEnum(ComplaintStatus).optional(),
  startDate: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  endDate: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
});

export const updateComplaintLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  locationAddress: z.string().trim().min(3).max(500).optional(),
  locality: z.string().trim().min(2).max(255).optional(),
  ward: z.string().trim().max(100).optional(),
  locationSource: z.enum(['GPS_DEVICE', 'MAP_PICKER', 'MANUAL_ENTRY', 'GEOCODED']).optional(),
  locationAccuracy: z.number().min(0).max(10000).optional().nullable(),
  isLocationPublic: z.boolean().optional(),
});
