import { ComplaintStatus } from '@prisma/client';
import { prisma } from './prisma.js';

export interface DuplicateCheckInput {
  title: string;
  description: string;
  categoryId: string;
  locality?: string | null;
  ward?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  excludeComplaintId?: string;
  limit?: number;
}

export interface DuplicateCandidate {
  id: string;
  trackingId: string;
  title: string;
  categoryName: string;
  status: ComplaintStatus;
  locality: string;
  ward: string | null;
  distanceMeters: number | null;
  similarityScore: number;
  matchReason: string;
  createdAt: Date;
}

const STOPWORDS = new Set([
  'the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'in', 'to', 'for', 'of', 'with', 'from',
  'by', 'or', 'as', 'it', 'this', 'that', 'are', 'was', 'were', 'be', 'been', 'being', 'have',
  'has', 'had', 'do', 'does', 'did', 'very', 'please', 'help', 'there', 'here', 'issue', 'problem',
]);

/**
 * Normalizes text and generates clean unique word tokens
 */
export function tokenizeText(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
  return new Set(words);
}

/**
 * Calculates Jaccard token overlap similarity between two token sets (0.0 to 1.0)
 */
export function calculateJaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 || setB.size === 0) return 0.0;
  let intersectionCount = 0;
  for (const token of setA) {
    if (setB.has(token)) {
      intersectionCount++;
    }
  }
  const unionCount = setA.size + setB.size - intersectionCount;
  return unionCount === 0 ? 0.0 : intersectionCount / unionCount;
}

/**
 * Calculates Great-Circle distance in meters between two lat/lng points
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * Searches for potential duplicate complaints based on multi-factor heuristic matching
 * (category, locality, geo-proximity, and title/description token similarity).
 * Respects citizen privacy by returning only public fields.
 */
export async function findPotentialDuplicates(
  input: DuplicateCheckInput
): Promise<DuplicateCandidate[]> {
  const inputTitleTokens = tokenizeText(input.title);
  const inputDescTokens = tokenizeText(input.description);

  // Search unresolved, non-moderated complaints
  const candidates = await prisma.complaint.findMany({
    where: {
      status: {
        notIn: [ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED, ComplaintStatus.REJECTED],
      },
      isModerated: false,
      ...(input.excludeComplaintId && input.excludeComplaintId.length === 36 ? { id: { not: input.excludeComplaintId } } : {}),
      ...(input.categoryId && input.categoryId.length === 36 || input.locality || input.ward
        ? {
            OR: [
              ...(input.categoryId && input.categoryId.length === 36 ? [{ categoryId: input.categoryId }] : []),
              ...(input.locality ? [{ locality: { equals: input.locality, mode: 'insensitive' as const } }] : []),
              ...(input.ward ? [{ ward: { equals: input.ward, mode: 'insensitive' as const } }] : []),
            ],
          }
        : {}),
    },
    take: 40,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      trackingId: true,
      title: true,
      description: true,
      status: true,
      locality: true,
      ward: true,
      latitude: true,
      longitude: true,
      categoryId: true,
      category: { select: { name: true } },
      createdAt: true,
    },
  });

  const scoredCandidates: DuplicateCandidate[] = [];

  for (const item of candidates) {
    let score = 0.0;
    const reasons: string[] = [];

    // 1. Category match
    const categoryMatch = item.categoryId === input.categoryId;
    if (categoryMatch) {
      score += 0.25;
      reasons.push('Same category');
    }

    // 2. Locality or Ward match
    const localityMatch =
      input.locality &&
      item.locality &&
      input.locality.toLowerCase().trim() === item.locality.toLowerCase().trim();
    const wardMatch =
      input.ward &&
      item.ward &&
      input.ward.toLowerCase().trim() === item.ward.toLowerCase().trim();

    if (localityMatch) {
      score += 0.25;
      reasons.push('Same locality');
    } else if (wardMatch) {
      score += 0.15;
      reasons.push('Same ward');
    }

    // 3. Geographic proximity (if coordinates provided)
    let distanceMeters: number | null = null;
    if (
      input.latitude !== undefined &&
      input.latitude !== null &&
      input.longitude !== undefined &&
      input.longitude !== null &&
      item.latitude !== null &&
      item.longitude !== null
    ) {
      distanceMeters = calculateDistanceMeters(
        Number(input.latitude),
        Number(input.longitude),
        Number(item.latitude),
        Number(item.longitude)
      );

      if (distanceMeters <= 300) {
        score += 0.35;
        reasons.push(`Within 300m (${distanceMeters}m)`);
      } else if (distanceMeters <= 1000) {
        score += 0.20;
        reasons.push(`Within 1km (${distanceMeters}m)`);
      } else if (distanceMeters <= 2500) {
        score += 0.10;
        reasons.push(`Within 2.5km (${distanceMeters}m)`);
      }
    }

    // 4. Title similarity
    const itemTitleTokens = tokenizeText(item.title);
    const titleSim = calculateJaccardSimilarity(inputTitleTokens, itemTitleTokens);
    if (titleSim > 0.2) {
      score += titleSim * 0.3;
      reasons.push(`Title match (${Math.round(titleSim * 100)}%)`);
    }

    // 5. Description similarity
    const itemDescTokens = tokenizeText(item.description);
    const descSim = calculateJaccardSimilarity(inputDescTokens, itemDescTokens);
    if (descSim > 0.15) {
      score += descSim * 0.2;
      reasons.push(`Description match (${Math.round(descSim * 100)}%)`);
    }

    // Cap at 1.0
    const finalScore = Math.min(1.0, Math.round(score * 100) / 100);

    // Only surface as candidate if score >= 0.35 (meaningful similarity)
    if (finalScore >= 0.35) {
      scoredCandidates.push({
        id: item.id,
        trackingId: item.trackingId,
        title: item.title,
        categoryName: item.category.name,
        status: item.status,
        locality: item.locality,
        ward: item.ward,
        distanceMeters,
        similarityScore: finalScore,
        matchReason: reasons.join(', ') || 'Similar reported details',
        createdAt: item.createdAt,
      });
    }
  }

  // Sort by highest similarity first
  scoredCandidates.sort((a, b) => b.similarityScore - a.similarityScore);

  return scoredCandidates.slice(0, input.limit || 5);
}
