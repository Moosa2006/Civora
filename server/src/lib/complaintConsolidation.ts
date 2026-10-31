import { ComplaintPriority, ComplaintStatus, Prisma, PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from './prisma.js';
import {
  tokenizeText,
  calculateJaccardSimilarity,
  calculateDistanceMeters,
} from './duplicateDetector.js';
import { calculateHammingDistance, hammingToSimilarity } from './imageAnalysis.js';

export interface ConsolidationCheckInput {
  title: string;
  description: string;
  categoryId: string;
  ward?: string | null;
  locality: string;
  locationAddress: string;
  latitude?: number | null;
  longitude?: number | null;
  clientPerceptualHash?: string | null;
  citizenId?: string | null;
}

export interface ConsolidationDecision {
  shouldConsolidate: boolean;
  masterComplaintId: string | null;
  masterTrackingId: string | null;
  confidence: number;
  matchReason: string;
  distanceMeters: number | null;
  signals: {
    categoryMatch: boolean;
    wardMatch: boolean;
    distanceMeters: number | null;
    semanticSimilarity: number;
    visualSimilarity?: number | null;
  };
}

/**
 * High-impact categories that carry inherent public safety / hazardous infrastructure risk
 */
const HIGH_HAZARD_CATEGORIES = new Set([
  'ROADS_POTHOLES',
  'DRAINAGE_SEWAGE',
  'WATER_CONTAMINATION',
  'ELECTRICAL_HAZARD',
  'STREET_LIGHTING',
]);

/**
 * Minimum confidence required to automatically consolidate complaints in the backend
 */
export const AUTO_CONSOLIDATE_CONFIDENCE_THRESHOLD = 0.72;

/**
 * Maximum geographic distance in meters to permit automatic consolidation
 */
export const MAX_AUTO_CONSOLIDATE_DISTANCE_METERS = 300;

export class ComplaintConsolidationService {
  /**
   * Evaluates an incoming complaint submission against existing active issues to determine
   * if it represents the same physical civic defect.
   */
  static async evaluateForConsolidation(
    input: ConsolidationCheckInput,
    prisma: PrismaClient | Prisma.TransactionClient = defaultPrisma
  ): Promise<ConsolidationDecision> {
    const inputTitleTokens = tokenizeText(input.title);
    const inputDescTokens = tokenizeText(input.description);

    // Query active, unresolved complaints in the same category or ward/locality
    const activeComplaints = await prisma.complaint.findMany({
      where: {
        status: {
          in: [
            ComplaintStatus.SUBMITTED,
            ComplaintStatus.UNDER_REVIEW,
            ComplaintStatus.ASSIGNED,
            ComplaintStatus.IN_PROGRESS,
          ],
        },
        isModerated: false,
        // Only evaluate master complaints directly (if a candidate is linked, resolve to root master)
        isMaster: true,
        OR: [
          { categoryId: input.categoryId },
          ...(input.ward ? [{ ward: { equals: input.ward, mode: 'insensitive' as const } }] : []),
          ...(input.locality ? [{ locality: { equals: input.locality, mode: 'insensitive' as const } }] : []),
        ],
      },
      select: {
        id: true,
        trackingId: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        categoryId: true,
        category: { select: { code: true, name: true } },
        ward: true,
        locality: true,
        latitude: true,
        longitude: true,
        citizenId: true,
        affectedReportCount: true,
        distinctReporterCount: true,
        documents: {
          where: { perceptualHash: { not: null } },
          select: { perceptualHash: true },
          take: 3,
        },
      },
      take: 25,
      orderBy: { createdAt: 'desc' },
    });

    let bestMatch: (typeof activeComplaints)[0] | null = null;
    let highestConfidence = 0.0;
    let bestReason = '';
    let bestDistance: number | null = null;
    let bestSignals = {
      categoryMatch: false,
      wardMatch: false,
      distanceMeters: null as number | null,
      semanticSimilarity: 0,
      visualSimilarity: null as number | null,
    };

    for (const cand of activeComplaints) {
      let score = 0.0;
      const reasons: string[] = [];

      // 1. Category Compatibility (Mandatory)
      const isSameCategory = cand.categoryId === input.categoryId;
      if (!isSameCategory) {
        // Different category cannot be auto-merged into the same physical defect
        continue;
      }
      score += 0.20;
      reasons.push('Identical civic category');

      // 2. Geographic Proximity & Municipal Ward
      const isSameWard = Boolean(
        input.ward &&
        cand.ward &&
        input.ward.trim().toLowerCase() === cand.ward.trim().toLowerCase()
      );

      let distanceMeters: number | null = null;
      let geoScore = 0.0;

      if (
        input.latitude !== undefined &&
        input.latitude !== null &&
        input.longitude !== undefined &&
        input.longitude !== null &&
        cand.latitude !== null &&
        cand.longitude !== null
      ) {
        distanceMeters = calculateDistanceMeters(
          Number(input.latitude),
          Number(input.longitude),
          Number(cand.latitude),
          Number(cand.longitude)
        );

        if (distanceMeters <= 50) {
          geoScore = 0.40;
          reasons.push(`Exact geographic proximity (${distanceMeters}m)`);
        } else if (distanceMeters <= 150) {
          geoScore = 0.35;
          reasons.push(`Close proximity (${distanceMeters}m)`);
        } else if (distanceMeters <= MAX_AUTO_CONSOLIDATE_DISTANCE_METERS) {
          geoScore = 0.25;
          reasons.push(`Near proximity (${distanceMeters}m)`);
        } else {
          // If GPS is known and distance exceeds 300m, DO NOT auto-merge even if ward matches!
          // (Two potholes in the same ward 1km apart are separate issues)
          continue;
        }
      } else if (isSameWard) {
        // Without GPS coordinates, rely on locality and ward
        const isSameLocality = Boolean(
          input.locality &&
          cand.locality &&
          input.locality.trim().toLowerCase() === cand.locality.trim().toLowerCase()
        );
        if (isSameLocality) {
          geoScore = 0.25;
          reasons.push('Identical ward and locality landmark');
        } else {
          geoScore = 0.10;
          reasons.push('Same municipal ward');
        }
      }

      score += geoScore;

      // 3. Semantic & Keyword Similarity
      const candTitleTokens = tokenizeText(cand.title);
      const candDescTokens = tokenizeText(cand.description);

      const titleSim = calculateJaccardSimilarity(inputTitleTokens, candTitleTokens);
      const descSim = calculateJaccardSimilarity(inputDescTokens, candDescTokens);
      const semanticSim = Math.max(titleSim, descSim * 0.7 + titleSim * 0.3);

      if (semanticSim >= 0.40) {
        score += 0.30;
        reasons.push(`Strong description similarity (${Math.round(semanticSim * 100)}%)`);
      } else if (semanticSim >= 0.25) {
        score += 0.20;
        reasons.push(`Moderate description similarity (${Math.round(semanticSim * 100)}%)`);
      } else if (semanticSim >= 0.15) {
        score += 0.10;
      }

      // 4. Perceptual Image Similarity (if evidence dHash available)
      let visualSim: number | null = null;
      if (input.clientPerceptualHash && cand.documents.length > 0) {
        for (const doc of cand.documents) {
          if (doc.perceptualHash) {
            const dist = calculateHammingDistance(input.clientPerceptualHash, doc.perceptualHash);
            const sim = hammingToSimilarity(dist);
            if (visualSim === null || sim > visualSim) {
              visualSim = sim;
            }
          }
        }

        if (visualSim !== null && visualSim >= 85) {
          score += 0.25;
          reasons.push(`Matching photographic evidence (${visualSim}% visual similarity)`);
        }
      }

      // Safeguard: Geographic proximity is mandatory to auto-merge physical civic defects
      const hasValidGeoMatch =
        (distanceMeters !== null && distanceMeters <= MAX_AUTO_CONSOLIDATE_DISTANCE_METERS) ||
        (distanceMeters === null && isSameWard && score >= 0.85);

      if (score > highestConfidence && hasValidGeoMatch) {
        highestConfidence = Math.min(1.0, Math.round(score * 100) / 100);
        bestMatch = cand;
        bestReason = reasons.join('; ');
        bestDistance = distanceMeters;
        bestSignals = {
          categoryMatch: isSameCategory,
          wardMatch: isSameWard,
          distanceMeters,
          semanticSimilarity: Math.round(semanticSim * 100) / 100,
          visualSimilarity: visualSim !== null ? Math.round(visualSim) : null,
        };
      }
    }

    const shouldConsolidate =
      Boolean(bestMatch) && highestConfidence >= AUTO_CONSOLIDATE_CONFIDENCE_THRESHOLD;

    return {
      shouldConsolidate,
      masterComplaintId: shouldConsolidate && bestMatch ? bestMatch.id : null,
      masterTrackingId: shouldConsolidate && bestMatch ? bestMatch.trackingId : null,
      confidence: highestConfidence,
      matchReason: bestReason || 'No duplicate match detected',
      distanceMeters: bestDistance,
      signals: bestSignals,
    };
  }

  /**
   * Deterministic Priority Escalation Policy:
   * Recalculates master issue priority when additional reports are consolidated.
   */
  static calculateEscalatedPriority(params: {
    currentPriority: ComplaintPriority;
    categoryCode?: string | null;
    affectedReports: number;
    distinctReporters: number;
    verifiedHazard?: boolean;
  }): {
    newPriority: ComplaintPriority;
    escalated: boolean;
    reason: string | null;
  } {
    const { currentPriority, categoryCode, affectedReports, distinctReporters, verifiedHazard } = params;
    const isHazardCategory = categoryCode ? HIGH_HAZARD_CATEGORIES.has(categoryCode) : false;

    let targetPriority = currentPriority;
    let escalationReason: string | null = null;

    // RULE 1: Urgent hazard escalation
    // If verified immediate safety hazard or >= 5 distinct reporters on a high-hazard civic infrastructure
    if (
      verifiedHazard ||
      (distinctReporters >= 5 && isHazardCategory) ||
      (distinctReporters >= 8)
    ) {
      targetPriority = ComplaintPriority.URGENT;
      escalationReason = `Escalated to URGENT due to high public impact (${distinctReporters} distinct citizens reporting across ${affectedReports} complaints) in a critical civic infrastructure domain.`;
    }
    // RULE 2: High impact escalation
    // >= 3 distinct citizens reporting, or >= 5 total reports with multiple citizens
    else if (
      (distinctReporters >= 3 && currentPriority !== ComplaintPriority.HIGH) ||
      (affectedReports >= 4 && distinctReporters >= 2 && currentPriority === ComplaintPriority.LOW)
    ) {
      targetPriority = ComplaintPriority.HIGH;
      escalationReason = `Escalated to HIGH due to growing community impact (${distinctReporters} verified reporting citizens, ${affectedReports} total submissions).`;
    }
    // RULE 3: Moderate recurring escalation
    // >= 2 distinct citizens or multiple recurring reports on a LOW priority issue
    else if (distinctReporters >= 2 && currentPriority === ComplaintPriority.LOW) {
      targetPriority = ComplaintPriority.MEDIUM;
      escalationReason = `Escalated to MEDIUM due to multiple independent citizen reports (${distinctReporters} citizens).`;
    }

    const priorityWeight: Record<ComplaintPriority, number> = {
      LOW: 1,
      MEDIUM: 2,
      HIGH: 3,
      URGENT: 4,
    };

    const escalated = priorityWeight[targetPriority] > priorityWeight[currentPriority];

    return {
      newPriority: escalated ? targetPriority : currentPriority,
      escalated,
      reason: escalated ? escalationReason : null,
    };
  }

  /**
   * Separates a previously consolidated subordinate complaint back into an independent master complaint.
   * Preserves full history and recalculates the original master complaint's counters.
   */
  static async separateSubordinateComplaint(params: {
    subordinateId: string;
    officialUser: { id: string; name: string; role: string };
    separationReason: string;
    prisma?: PrismaClient;
  }) {
    const client = params.prisma || defaultPrisma;

    const subordinate = await client.complaint.findUnique({
      where: { id: params.subordinateId },
      include: {
        primaryComplaint: true,
      },
    });

    if (!subordinate) {
      throw new Error('Complaint not found.');
    }

    if (!subordinate.primaryComplaintId || !subordinate.primaryComplaint) {
      throw new Error('This complaint is not currently linked to a master issue.');
    }

    const masterId = subordinate.primaryComplaintId;
    const master = subordinate.primaryComplaint;

    // Execute atomic unlinking
    const result = await client.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Restore subordinate as an independent master complaint
      const restored = await tx.complaint.update({
        where: { id: subordinate.id },
        data: {
          primaryComplaintId: null,
          isDuplicate: false,
          isMaster: true,
          duplicateConfidence: null,
          consolidationReason: null,
          consolidatedAt: null,
        },
      });

      // 2. Remove row in complaint_duplicate_links
      await tx.complaintDuplicateLink.deleteMany({
        where: {
          primaryComplaintId: masterId,
          duplicateComplaintId: subordinate.id,
        },
      });

      // 3. Recalculate master counts
      const remainingSubordinates = await tx.complaint.findMany({
        where: { primaryComplaintId: masterId },
        select: { citizenId: true },
      });

      const uniqueCitizens = new Set<string>();
      if (master.citizenId) uniqueCitizens.add(master.citizenId);
      for (const sub of remainingSubordinates) {
        if (sub.citizenId) uniqueCitizens.add(sub.citizenId);
      }

      const updatedAffectedCount = Math.max(1, remainingSubordinates.length + 1);
      const updatedDistinctReporterCount = Math.max(1, uniqueCitizens.size);

      await tx.complaint.update({
        where: { id: masterId },
        data: {
          affectedReportCount: updatedAffectedCount,
          distinctReporterCount: updatedDistinctReporterCount,
        },
      });

      // 4. Record audit events on both records
      await tx.auditEvent.create({
        data: {
          entityType: 'COMPLAINT',
          entityId: subordinate.id,
          action: 'COMPLAINT_CONSOLIDATION_SEPARATED',
          actorId: params.officialUser.id,
          details: {
            masterComplaintId: masterId,
            masterTrackingId: master.trackingId,
            separationReason: params.separationReason,
            officialName: params.officialUser.name,
            officialRole: params.officialUser.role,
          },
        },
      });

      await tx.auditEvent.create({
        data: {
          entityType: 'COMPLAINT',
          entityId: masterId,
          action: 'SUBORDINATE_REPORT_SEPARATED',
          actorId: params.officialUser.id,
          details: {
            separatedComplaintId: subordinate.id,
            separatedTrackingId: subordinate.trackingId,
            separationReason: params.separationReason,
            newAffectedCount: updatedAffectedCount,
            newDistinctReporterCount: updatedDistinctReporterCount,
            officialName: params.officialUser.name,
          },
        },
      });

      return {
        restored,
        masterId,
        newAffectedCount: updatedAffectedCount,
      };
    });

    return result;
  }
}

