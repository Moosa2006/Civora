import { GoogleGenAI } from '@google/genai';
import { prisma } from '../lib/prisma.js';
import { findDuplicateEvidence, calculateSha256, type DuplicateEvidenceMatch } from '../lib/imageAnalysis.js';
import { findPotentialDuplicates, type DuplicateCandidate } from '../lib/duplicateDetector.js';

export interface AiVerificationResult {
  status: 'COMPLETED' | 'SKIPPED_NO_API_KEY' | 'FAILED';
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'NEEDS_REVIEW';
  riskScore: number;
  isDuplicate: boolean;
  duplicateConfidence: number | null;
  primaryComplaintId: string | null;
  findings: {
    isConsistent?: boolean;
    relevanceScore?: number;
    visualCategory?: string;
    verificationSummary?: string;
    fraudIndicators?: string[];
    evidenceMatches?: DuplicateEvidenceMatch[];
    duplicateCandidates?: DuplicateCandidate[];
    exifDiscrepancy?: boolean;
    locationDiscrepancyKm?: number | null;
    timeDeltaHours?: number | null;
    rawAiResponse?: any;
    error?: string;
  };
}

export interface VerificationContext {
  complaintId: string;
  title: string;
  description: string;
  categoryName: string;
  ward: string | null;
  locality: string;
  locationAddress: string;
  reportedLat: number | null;
  reportedLng: number | null;
  imageBuffer?: Buffer | null;
  imageMimeType?: string | null;
  sha256Checksum?: string | null;
  perceptualHash?: string | null;
  capturedAt?: Date | null;
  browserCaptureTimestamp?: Date | null;
  captureLat?: number | null;
  captureLng?: number | null;
}

/**
 * Checks if Gemini API is configured in the environment
 */
export function isGeminiConfigured(): boolean {
  const key = process.env.GEMINI_API_KEY;
  return Boolean(key && key.trim().length > 0 && key !== 'placeholder' && key !== 'your_gemini_api_key_here');
}

/**
 * Initializes Gemini client safely
 */
function getGeminiClient(): GoogleGenAI | null {
  if (!isGeminiConfigured()) return null;
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY!.trim() });
}

/**
 * Core analysis engine: Evaluates civic evidence validity, duplicate probability, and fraud risk.
 */
export async function verifyComplaintWithAi(ctx: VerificationContext): Promise<AiVerificationResult> {
  const findings: AiVerificationResult['findings'] = {
    fraudIndicators: [],
  };

  let riskScore = 10; // Baseline low risk
  let riskLevel: AiVerificationResult['riskLevel'] = 'LOW';
  let isDuplicate = false;
  let duplicateConfidence: number | null = null;
  let primaryComplaintId: string | null = null;

  // 1. Check for Duplicate Evidence across Database (SHA-256 and dHash)
  if (ctx.sha256Checksum && ctx.perceptualHash) {
    try {
      const evidenceMatches = await findDuplicateEvidence(
        ctx.sha256Checksum,
        ctx.perceptualHash,
        ctx.complaintId,
        ctx.ward
      );

      if (evidenceMatches.length > 0) {
        findings.evidenceMatches = evidenceMatches;
        const topMatch = evidenceMatches[0];

        if (topMatch.isSameWard) {
          // Same ward match -> Likely duplicate reporting of same civic issue
          isDuplicate = true;
          duplicateConfidence = topMatch.matchType === 'EXACT_SHA256' ? 0.95 : 0.85;
          primaryComplaintId = topMatch.matchedComplaintId;
          findings.fraudIndicators?.push('REUSED_IMAGE_SAME_WARD_DUPLICATE');
        } else {
          // Different ward match -> Strong fraud/spam signal (reused photo in another ward)
          riskScore = Math.max(riskScore, 75);
          riskLevel = 'HIGH';
          findings.fraudIndicators?.push('CROSS_WARD_IMAGE_REUSE_FRAUD');
          findings.verificationSummary = `Evidence image was previously submitted in ${topMatch.matchedWard || 'another ward'} (Complaint #${topMatch.matchedTrackingId}).`;
        }
      }
    } catch (dbMatchErr) {
      console.warn('[Image Match Lookup Warn]:', dbMatchErr);
    }
  }

  // 2. Check Textual & Geospatial Heuristic Duplicates
  try {
    const textDuplicates = await findPotentialDuplicates({
      title: ctx.title,
      description: ctx.description,
      categoryId: '',
      locality: ctx.locality,
      ward: ctx.ward,
      latitude: ctx.reportedLat,
      longitude: ctx.reportedLng,
      excludeComplaintId: ctx.complaintId,
      limit: 3,
    });

    if (textDuplicates.length > 0) {
      findings.duplicateCandidates = textDuplicates;
      const best = textDuplicates[0];
      if (best.similarityScore >= 0.7) {
        isDuplicate = true;
        duplicateConfidence = Math.max(duplicateConfidence || 0, best.similarityScore);
        if (!primaryComplaintId) {
          primaryComplaintId = best.id;
        }
      }
    }
  } catch (textDupErr) {
    console.warn('[Text Duplicate Lookup Warn]:', textDupErr);
  }

  // 3. Check Location Discrepancy (Reported vs EXIF/GPS)
  if (ctx.reportedLat && ctx.reportedLng && ctx.captureLat && ctx.captureLng) {
    const dLat = (ctx.captureLat - ctx.reportedLat) * 111.32;
    const dLng = (ctx.captureLng - ctx.reportedLng) * 111.32 * Math.cos((ctx.reportedLat * Math.PI) / 180);
    const distKm = Math.round(Math.sqrt(dLat * dLat + dLng * dLng) * 10) / 10;
    findings.locationDiscrepancyKm = distKm;

    if (distKm > 10.0) {
      findings.exifDiscrepancy = true;
      findings.fraudIndicators?.push(`LOCATION_MISMATCH_${distKm}KM_AWAY`);
      riskScore = Math.max(riskScore, 60);
      if (riskLevel !== 'HIGH') riskLevel = 'NEEDS_REVIEW';
    }
  }

  // 4. Check Capture Time Discrepancy
  if (ctx.capturedAt) {
    const now = new Date();
    const diffHours = Math.round(Math.abs(now.getTime() - ctx.capturedAt.getTime()) / (1000 * 60 * 60));
    findings.timeDeltaHours = diffHours;

    if (diffHours > 24 * 60) {
      // Photo is older than 60 days
      findings.fraudIndicators?.push('HISTORICAL_ARCHIVED_PHOTO_OVER_60D');
      riskScore = Math.max(riskScore, 40);
      if (riskLevel === 'LOW') riskLevel = 'MEDIUM';
    }
  }

  // 5. Invoke Google Gemini Multimodal API if configured
  if (!isGeminiConfigured() || !ctx.imageBuffer) {
    // Graceful fallback when API key is missing
    return {
      status: isGeminiConfigured() ? 'COMPLETED' : 'SKIPPED_NO_API_KEY',
      riskLevel,
      riskScore,
      isDuplicate,
      duplicateConfidence,
      primaryComplaintId,
      findings: {
        ...findings,
        verificationSummary:
          findings.verificationSummary ||
          (isGeminiConfigured()
            ? 'Deterministic integrity verification completed.'
            : 'Gemini API key not configured. Heuristic verification applied.'),
      },
    };
  }

  try {
    const ai = getGeminiClient();
    if (!ai) {
      return {
        status: 'SKIPPED_NO_API_KEY',
        riskLevel,
        riskScore,
        isDuplicate,
        duplicateConfidence,
        primaryComplaintId,
        findings,
      };
    }

    const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const base64Data = ctx.imageBuffer.toString('base64');
    const mimeType = ctx.imageMimeType || 'image/jpeg';

    const prompt = `You are the Civora Public Civic Issue Integrity & Verification Auditor.
Analyze this civic complaint submission and attached photographic evidence.

COMPLAINT DETAILS:
- Title: ${ctx.title}
- Description: ${ctx.description}
- Category: ${ctx.categoryName}
- Ward: ${ctx.ward || 'Not specified'}
- Locality: ${ctx.locality}
- Address: ${ctx.locationAddress}

EVIDENCE CONTEXT:
- Reused Image Matches Found: ${findings.evidenceMatches?.length || 0}
- Existing Duplicate Reports Found: ${findings.duplicateCandidates?.length || 0}
- Capture vs Reported Location Distance: ${findings.locationDiscrepancyKm !== undefined ? findings.locationDiscrepancyKm + ' km' : 'N/A'}

YOUR TASK:
1. Validate visual consistency: Does the photo actually show the reported civic problem (e.g. pothole, garbage, street light, drainage, water leakage) in an outdoor public space?
2. Detect fraud / suspicious indicators: Stock photos, computer/phone screen photos, selfies, indoor photos for road complaints, AI-generated synthetic images, or irrelevant graphics.
3. Assess civic urgency and risk:
   - "LOW": Genuine, relevant civic issue photograph matching description.
   - "MEDIUM": Partially unclear, blurry, or low detail photo.
   - "HIGH": Obvious fraud, screen capture, stock photo, or completely unrelated image.
   - "NEEDS_REVIEW": Mismatch between category and visual evidence.

Return ONLY a valid JSON object matching this exact structure:
{
  "isConsistent": true,
  "relevanceScore": 90,
  "visualCategory": "ROAD_INFRASTRUCTURE",
  "aiRiskLevel": "LOW",
  "aiRiskScore": 15,
  "fraudIndicators": [],
  "verificationSummary": "Clear photograph of asphalt road pothole matching the reported description."
}`;

    const response = await ai.models.generateContent({
      model: modelName,
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text || '';
    let parsedJson: any = {};
    try {
      parsedJson = JSON.parse(responseText);
    } catch {
      const match = responseText.match(/\{[\s\S]*\}/);
      if (match) {
        parsedJson = JSON.parse(match[0]);
      }
    }

    findings.isConsistent = parsedJson.isConsistent ?? true;
    findings.relevanceScore = parsedJson.relevanceScore ?? 80;
    findings.visualCategory = parsedJson.visualCategory || ctx.categoryName;
    findings.verificationSummary = parsedJson.verificationSummary || 'AI analysis completed.';

    if (Array.isArray(parsedJson.fraudIndicators) && parsedJson.fraudIndicators.length > 0) {
      findings.fraudIndicators?.push(...parsedJson.fraudIndicators);
    }

    // Merge AI risk score with heuristic score
    const aiScore = typeof parsedJson.aiRiskScore === 'number' ? parsedJson.aiRiskScore : 10;
    riskScore = Math.min(100, Math.max(riskScore, aiScore));

    // Determine final risk level
    if (parsedJson.aiRiskLevel === 'HIGH' || riskScore >= 70) {
      riskLevel = 'HIGH';
    } else if (parsedJson.aiRiskLevel === 'NEEDS_REVIEW' || riskScore >= 45) {
      riskLevel = 'NEEDS_REVIEW';
    } else if (parsedJson.aiRiskLevel === 'MEDIUM' || riskScore >= 25) {
      riskLevel = 'MEDIUM';
    } else {
      riskLevel = 'LOW';
    }

    return {
      status: 'COMPLETED',
      riskLevel,
      riskScore,
      isDuplicate,
      duplicateConfidence,
      primaryComplaintId,
      findings,
    };
  } catch (apiErr: any) {
    console.error('[Gemini AI Verification Error]:', apiErr?.message || apiErr);
    return {
      status: 'FAILED',
      riskLevel,
      riskScore,
      isDuplicate,
      duplicateConfidence,
      primaryComplaintId,
      findings: {
        ...findings,
        error: apiErr?.message || 'Gemini API call failed',
        verificationSummary: 'Heuristic checks applied; automated visual model timed out or encountered an error.',
      },
    };
  }
}

/**
 * Background non-blocking execution wrapper for complaint AI verification.
 * Runs asynchronously after complaint submission so citizen experience is never delayed.
 */
export async function triggerComplaintAiVerification(
  complaintId: string,
  imageBuffer?: Buffer | null,
  imageMimeType?: string | null,
  documentMetadata?: {
    sha256Checksum?: string | null;
    perceptualHash?: string | null;
    capturedAt?: Date | null;
    browserCaptureTimestamp?: Date | null;
    captureLat?: number | null;
    captureLng?: number | null;
  }
): Promise<void> {
  // Execute asynchronously without blocking the caller
  setImmediate(async () => {
    try {
      const complaint = await prisma.complaint.findUnique({
        where: { id: complaintId },
        include: {
          category: { select: { name: true } },
        },
      });

      if (!complaint) return;

      const result = await verifyComplaintWithAi({
        complaintId: complaint.id,
        title: complaint.title,
        description: complaint.description,
        categoryName: complaint.category.name,
        ward: complaint.ward,
        locality: complaint.locality,
        locationAddress: complaint.locationAddress,
        reportedLat: complaint.latitude ? Number(complaint.latitude) : null,
        reportedLng: complaint.longitude ? Number(complaint.longitude) : null,
        imageBuffer,
        imageMimeType,
        sha256Checksum: documentMetadata?.sha256Checksum,
        perceptualHash: documentMetadata?.perceptualHash,
        capturedAt: documentMetadata?.capturedAt,
        browserCaptureTimestamp: documentMetadata?.browserCaptureTimestamp,
        captureLat: documentMetadata?.captureLat,
        captureLng: documentMetadata?.captureLng,
      });

      // Update complaint with verification outcome
      await prisma.complaint.update({
        where: { id: complaintId },
        data: {
          aiAnalysisStatus: result.status,
          aiRiskLevel: result.riskLevel,
          aiRiskScore: result.riskScore,
          aiFindings: result.findings as any,
          aiAnalyzedAt: new Date(),
          isDuplicate: result.isDuplicate,
          duplicateConfidence: result.duplicateConfidence,
          primaryComplaintId: result.primaryComplaintId,
        },
      });
    } catch (err) {
      console.error(`[Background AI Verification Failed for Complaint ${complaintId}]:`, err);
    }
  });
}

