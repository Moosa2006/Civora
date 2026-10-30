import { isValidWard, normalizeWard, MUNICIPAL_WARDS } from '../config/wards.js';
import { createComplaintSchema } from '../validation/complaint.validation.js';
import {
  calculateSha256,
  calculateHammingDistance,
  hammingToSimilarity,
  generatePerceptualHash,
  extractExifFromBuffer,
} from '../lib/imageAnalysis.js';
import {
  verifyComplaintWithAi,
  isGeminiConfigured,
} from '../services/gemini.service.js';

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    passedCount++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    failedCount++;
    console.error(`  ✗ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log(' CIVORA AI VERIFICATION & FRAUD DETECTION TEST SUITE');
  console.log('======================================================\n');

  // Test 1: Municipal Ward Configuration & Validation
  console.log('1. Municipal Ward Dictionary & Validation');
  assert(MUNICIPAL_WARDS.length >= 20, 'Ward dictionary contains at least 20 municipal wards');
  assert(isValidWard('Ward 174'), 'Ward 174 is recognized as a valid municipal ward');
  assert(isValidWard('WARD-82'), 'WARD-82 is recognized as a valid code');
  assert(!isValidWard('InvalidNonExistentWard999'), 'Non-existent ward is rejected');
  const normalized = normalizeWard('ward 82');
  assert(normalized.includes('Hoysala Nagar'), 'Normalizes ward number to canonical standard label');

  // Test 2: Mandatory Ward in Complaint Validation Schema
  console.log('\n2. Mandatory Ward Zod Validation');
  const missingWardResult = createComplaintSchema.safeParse({
    title: 'Severe road pothole causing traffic jam',
    description: 'A deep pothole has appeared near the main junction causing water stagnation and safety risk.',
    categoryId: 'a0000000-0000-4000-8000-000000000001',
    locality: 'Indiranagar 2nd Stage',
    locationAddress: '100ft Road opposite Metro station',
    // ward omitted
  });
  assert(!missingWardResult.success, 'Rejects complaint submission when ward is missing');

  const validWardResult = createComplaintSchema.safeParse({
    title: 'Severe road pothole causing traffic jam',
    description: 'A deep pothole has appeared near the main junction causing water stagnation and safety risk.',
    categoryId: 'a0000000-0000-4000-8000-000000000001',
    locality: 'Indiranagar 2nd Stage',
    ward: 'Ward 82 - Hoysala Nagar (Indira Nagar)',
    locationAddress: '100ft Road opposite Metro station',
  });
  if (!validWardResult.success) {
    console.error('Validation failure issues:', validWardResult.error.issues);
  }
  assert(validWardResult.success, 'Accepts complaint submission when valid ward is provided');

  // Test 3: Cryptographic & Perceptual Hashing (dHash)
  console.log('\n3. Image Cryptographic & Perceptual Hashing');
  const dummyBufferA = Buffer.from('civora_test_image_payload_alpha_pothole_evidence_2026');
  const dummyBufferB = Buffer.from('civora_test_image_payload_alpha_pothole_evidence_2026');
  const dummyBufferC = Buffer.from('civora_test_image_payload_beta_completely_different_image');

  const shaA = calculateSha256(dummyBufferA);
  const shaB = calculateSha256(dummyBufferB);
  const shaC = calculateSha256(dummyBufferC);

  assert(shaA === shaB, 'Exact SHA-256 match for identical payloads');
  assert(shaA !== shaC, 'Distinct SHA-256 digests for different payloads');
  assert(shaA.length === 64, 'SHA-256 digest is 64 hexadecimal characters');

  const hash1 = 'a1b2c3d4e5f60718';
  const hash2 = 'a1b2c3d4e5f60718';
  const hash3 = 'a1b2c3d4e5f60719'; // 1 bit different
  const hash4 = 'ffffffffffffffff';

  assert(calculateHammingDistance(hash1, hash2) === 0, 'Identical perceptual hashes have distance 0');
  assert(hammingToSimilarity(0) === 100, 'Distance 0 equals 100% similarity');
  const dist3 = calculateHammingDistance(hash1, hash3);
  assert(dist3 === 1, 'Single bit difference results in Hamming distance 1');
  assert(hammingToSimilarity(dist3) > 98, 'Single bit difference has >98% visual similarity');
  assert(calculateHammingDistance(hash1, hash4) > 20, 'Completely different hashes have high distance');

  const pHash = generatePerceptualHash(dummyBufferA);
  assert(pHash.length === 16, 'Generated perceptual dHash is 16 hexadecimal characters (64-bit)');

  // Test 4: EXIF Extraction Robustness
  console.log('\n4. EXIF Parser Robustness');
  const nonJpegBuffer = Buffer.from('not_a_valid_jpeg_stream');
  const emptyExif = extractExifFromBuffer(nonJpegBuffer);
  assert(emptyExif.capturedAt === null, 'Safely returns null capturedAt for non-JPEG without crashing');
  assert(emptyExif.latitude === null, 'Safely returns null latitude for non-JPEG without crashing');

  // Test 5: Gemini AI Verification Service & Graceful Fallback
  console.log('\n5. Gemini AI Service Graceful Fallback');
  const hasKey = isGeminiConfigured();
  console.log(`     Gemini API Key configured: ${hasKey}`);

  const aiResult = await verifyComplaintWithAi({
    complaintId: '00000000-0000-0000-0000-000000000001',
    title: 'Severe road pothole causing traffic jam',
    description: 'A deep pothole has appeared near the main junction causing water stagnation and safety risk.',
    categoryName: 'Roads & Infrastructure',
    ward: 'Ward 82 - Hoysala Nagar (Indira Nagar)',
    locality: 'Indiranagar 2nd Stage',
    locationAddress: '100ft Road opposite Metro station',
    reportedLat: 12.9784,
    reportedLng: 77.6408,
    imageBuffer: dummyBufferA,
    imageMimeType: 'image/jpeg',
    sha256Checksum: shaA,
    perceptualHash: pHash,
  });

  assert(
    aiResult.status === 'COMPLETED' || aiResult.status === 'SKIPPED_NO_API_KEY',
    `AI verification returns valid status (${aiResult.status})`
  );
  assert(['LOW', 'MEDIUM', 'HIGH', 'NEEDS_REVIEW'].includes(aiResult.riskLevel), 'Assigns a valid risk triage level');
  assert(typeof aiResult.riskScore === 'number' && aiResult.riskScore >= 0 && aiResult.riskScore <= 100, 'Calculates bounded risk score (0-100)');
  assert(Boolean(aiResult.findings), 'Returns structured findings payload');

  // Test 6: Cross-Ward & Location Discrepancy Detection
  console.log('\n6. Cross-Ward & Location Discrepancy Detection');
  const discrepancyResult = await verifyComplaintWithAi({
    complaintId: '00000000-0000-0000-0000-000000000002',
    title: 'Garbage accumulation',
    description: 'Piles of uncollected waste near community park.',
    categoryName: 'Solid Waste Management',
    ward: 'Ward 82',
    locality: 'Indiranagar',
    locationAddress: '12th Main Road',
    reportedLat: 12.9784,
    reportedLng: 77.6408,
    captureLat: 13.5000, // ~60km away
    captureLng: 77.9000,
  });
  assert(
    discrepancyResult.findings.exifDiscrepancy === true,
    'Flags location discrepancy when evidence photo is taken >10km from reported complaint'
  );
  assert(
    discrepancyResult.riskLevel === 'NEEDS_REVIEW' || discrepancyResult.riskLevel === 'HIGH',
    'Escalates risk triage level when location discrepancy is detected'
  );

  console.log('\n------------------------------------------------------');
  console.log(` SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('------------------------------------------------------\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
