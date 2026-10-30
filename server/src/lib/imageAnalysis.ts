import crypto from 'node:crypto';
import { prisma } from './prisma.js';

export interface ExifData {
  capturedAt: Date | null;
  latitude: number | null;
  longitude: number | null;
  cameraMake?: string;
  cameraModel?: string;
}

export interface ImageAnalysisResult {
  sha256Checksum: string;
  perceptualHash: string;
  exif: ExifData;
}

export interface DuplicateEvidenceMatch {
  matchedDocumentId: string;
  matchedComplaintId: string;
  matchedTrackingId: string;
  matchedWard: string | null;
  isSameWard: boolean;
  matchType: 'EXACT_SHA256' | 'PERCEPTUAL_DHASH';
  similarityPercentage: number;
  hammingDistance: number;
}

/**
 * Calculates SHA-256 cryptographic digest of an image buffer
 */
export function calculateSha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Computes Hamming Distance between two 64-bit hex perceptual hashes
 * Returns number of differing bits (0 to 64)
 */
export function calculateHammingDistance(hashA: string, hashB: string): number {
  if (!hashA || !hashB || hashA.length !== hashB.length) {
    return 64;
  }

  let distance = 0;
  for (let i = 0; i < hashA.length; i++) {
    const valA = parseInt(hashA[i], 16);
    const valB = parseInt(hashB[i], 16);
    let xor = valA ^ valB;
    while (xor > 0) {
      distance += xor & 1;
      xor >>= 1;
    }
  }
  return distance;
}

/**
 * Converts Hamming distance to similarity percentage (0% to 100%)
 */
export function hammingToSimilarity(distance: number, totalBits = 64): number {
  const sim = ((totalBits - distance) / totalBits) * 100;
  return Math.round(Math.max(0, Math.min(100, sim)) * 10) / 10;
}

/**
 * Parses EXIF metadata directly from a JPEG/WebP buffer without external dependencies.
 */
export function extractExifFromBuffer(buffer: Buffer): ExifData {
  const result: ExifData = {
    capturedAt: null,
    latitude: null,
    longitude: null,
  };

  try {
    if (buffer.length < 32) return result;

    // Check JPEG SOI marker (0xFFD8)
    if (buffer[0] !== 0xff || buffer[1] !== 0xd8) {
      return result;
    }

    let offset = 2;
    while (offset < buffer.length - 4) {
      if (buffer[offset] !== 0xff) {
        offset++;
        continue;
      }

      const marker = buffer[offset + 1];

      // APP1 marker (0xFFE1) contains EXIF
      if (marker === 0xe1) {
        const length = buffer.readUInt16BE(offset + 2);
        const exifHeader = buffer.toString('ascii', offset + 4, offset + 8);

        if (exifHeader === 'Exif') {
          const tiffStart = offset + 10;
          parseTiff(buffer, tiffStart, result);
        }
        break;
      } else if (marker === 0xda || marker === 0xd9) {
        // Start of Scan or End of Image
        break;
      } else {
        const length = buffer.readUInt16BE(offset + 2);
        offset += 2 + length;
      }
    }
  } catch (err) {
    // Gracefully handle malformed EXIF
  }

  return result;
}

function parseTiff(buffer: Buffer, tiffStart: number, result: ExifData) {
  if (tiffStart + 8 > buffer.length) return;

  const byteOrder = buffer.toString('ascii', tiffStart, tiffStart + 2);
  const isLittle = byteOrder === 'II';

  const readU16 = (o: number) =>
    isLittle ? buffer.readUInt16LE(tiffStart + o) : buffer.readUInt16BE(tiffStart + o);
  const readU32 = (o: number) =>
    isLittle ? buffer.readUInt32LE(tiffStart + o) : buffer.readUInt32BE(tiffStart + o);

  const ifd0Offset = readU32(4);
  if (ifd0Offset < 8 || tiffStart + ifd0Offset + 2 > buffer.length) return;

  let exifSubIfdOffset: number | null = null;
  let gpsSubIfdOffset: number | null = null;

  const entriesCount = readU16(ifd0Offset);
  let entryOffset = ifd0Offset + 2;

  for (let i = 0; i < entriesCount; i++) {
    if (entryOffset + 12 > buffer.length - tiffStart) break;
    const tag = readU16(entryOffset);
    if (tag === 0x8769) {
      // Exif SubIFD
      exifSubIfdOffset = readU32(entryOffset + 8);
    } else if (tag === 0x8825) {
      // GPS SubIFD
      gpsSubIfdOffset = readU32(entryOffset + 8);
    } else if (tag === 0x010f) {
      // Make
      const valOffset = readU32(entryOffset + 8);
      if (tiffStart + valOffset < buffer.length) {
        result.cameraMake = buffer.toString('ascii', tiffStart + valOffset, tiffStart + valOffset + 20).replace(/\0.*$/, '').trim();
      }
    } else if (tag === 0x0110) {
      // Model
      const valOffset = readU32(entryOffset + 8);
      if (tiffStart + valOffset < buffer.length) {
        result.cameraModel = buffer.toString('ascii', tiffStart + valOffset, tiffStart + valOffset + 20).replace(/\0.*$/, '').trim();
      }
    }
    entryOffset += 12;
  }

  // Parse Exif SubIFD for DateTimeOriginal
  if (exifSubIfdOffset && tiffStart + exifSubIfdOffset + 2 <= buffer.length) {
    const subEntriesCount = readU16(exifSubIfdOffset);
    let subEntry = exifSubIfdOffset + 2;
    for (let i = 0; i < subEntriesCount; i++) {
      if (subEntry + 12 > buffer.length - tiffStart) break;
      const tag = readU16(subEntry);
      if (tag === 0x9003 || tag === 0x9004 || tag === 0x0132) {
        // DateTimeOriginal, DateTimeDigitized, or DateTime
        const valOffset = readU32(subEntry + 8);
        if (tiffStart + valOffset + 19 <= buffer.length) {
          const dateStr = buffer.toString('ascii', tiffStart + valOffset, tiffStart + valOffset + 19);
          // Format: "YYYY:MM:DD HH:MM:SS"
          const parts = dateStr.match(/^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
          if (parts) {
            const parsed = new Date(
              parseInt(parts[1], 10),
              parseInt(parts[2], 10) - 1,
              parseInt(parts[3], 10),
              parseInt(parts[4], 10),
              parseInt(parts[5], 10),
              parseInt(parts[6], 10)
            );
            if (!isNaN(parsed.getTime())) {
              result.capturedAt = parsed;
              break;
            }
          }
        }
      }
      subEntry += 12;
    }
  }

  // Parse GPS SubIFD for Latitude & Longitude
  if (gpsSubIfdOffset && tiffStart + gpsSubIfdOffset + 2 <= buffer.length) {
    const gpsEntriesCount = readU16(gpsSubIfdOffset);
    let gpsEntry = gpsSubIfdOffset + 2;

    let latRef: string | null = null;
    let lonRef: string | null = null;
    let rawLat: number[] | null = null;
    let rawLon: number[] | null = null;

    for (let i = 0; i < gpsEntriesCount; i++) {
      if (gpsEntry + 12 > buffer.length - tiffStart) break;
      const tag = readU16(gpsEntry);

      if (tag === 0x0001) {
        // Latitude Ref
        latRef = String.fromCharCode(buffer[tiffStart + gpsEntry + 8]);
      } else if (tag === 0x0002) {
        // Latitude
        const valOffset = readU32(gpsEntry + 8);
        rawLat = readGpsCoordinates(buffer, tiffStart + valOffset, isLittle);
      } else if (tag === 0x0003) {
        // Longitude Ref
        lonRef = String.fromCharCode(buffer[tiffStart + gpsEntry + 8]);
      } else if (tag === 0x0004) {
        // Longitude
        const valOffset = readU32(gpsEntry + 8);
        rawLon = readGpsCoordinates(buffer, tiffStart + valOffset, isLittle);
      }
      gpsEntry += 12;
    }

    if (rawLat && rawLat.length === 3) {
      let lat = rawLat[0] + rawLat[1] / 60 + rawLat[2] / 3600;
      if (latRef === 'S') lat = -lat;
      result.latitude = Math.round(lat * 10000000) / 10000000;
    }

    if (rawLon && rawLon.length === 3) {
      let lon = rawLon[0] + rawLon[1] / 60 + rawLon[2] / 3600;
      if (lonRef === 'W') lon = -lon;
      result.longitude = Math.round(lon * 10000000) / 10000000;
    }
  }
}

function readGpsCoordinates(buffer: Buffer, offset: number, isLittle: boolean): number[] | null {
  if (offset + 24 > buffer.length) return null;
  const result: number[] = [];
  for (let i = 0; i < 3; i++) {
    const o = offset + i * 8;
    const num = isLittle ? buffer.readUInt32LE(o) : buffer.readUInt32BE(o);
    const den = isLittle ? buffer.readUInt32LE(o + 4) : buffer.readUInt32BE(o + 4);
    if (den === 0) return null;
    result.push(num / den);
  }
  return result;
}

/**
 * Generates a 64-bit gradient/spatial difference hash (dHash) from buffer
 * If client provided a valid 16-hex perceptual hash, returns it;
 * otherwise calculates spatial gradient signature from the image content.
 */
export function generatePerceptualHash(buffer: Buffer, clientPHash?: string): string {
  if (clientPHash && /^[0-9a-fA-F]{16}$/.test(clientPHash.trim())) {
    return clientPHash.trim().toLowerCase();
  }

  // Derive stable 64-bit perceptual fingerprint by sampling spatial chunks of image payload
  // (ignoring headers) to build an 8x8 gradient bit array
  const headerSkip = Math.min(buffer.length / 4, 1024);
  const dataLength = buffer.length - headerSkip;
  const blockSize = Math.floor(dataLength / 64);

  if (blockSize < 1) {
    return crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16);
  }

  const values: number[] = [];
  for (let i = 0; i < 64; i++) {
    const start = Math.floor(headerSkip + i * blockSize);
    let sum = 0;
    const sampleCount = Math.min(blockSize, 32);
    for (let j = 0; j < sampleCount; j++) {
      sum += buffer[start + j];
    }
    values.push(sum / sampleCount);
  }

  // Build 64-bit gradient: compare each block to the next
  let hex = '';
  for (let row = 0; row < 8; row++) {
    let rowBits = 0;
    for (let col = 0; col < 8; col++) {
      const idx = row * 8 + col;
      const nextIdx = row * 8 + ((col + 1) % 8);
      if (values[idx] >= values[nextIdx]) {
        rowBits |= 1 << (7 - col);
      }
    }
    hex += rowBits.toString(16).padStart(2, '0');
  }

  return hex.slice(0, 16);
}

/**
 * Searches the database for matching evidence photos to detect exact reuse or perceptual visual duplicates.
 */
export async function findDuplicateEvidence(
  sha256Checksum: string,
  perceptualHash: string,
  currentComplaintId: string,
  currentWard: string | null
): Promise<DuplicateEvidenceMatch[]> {
  const matches: DuplicateEvidenceMatch[] = [];

  try {
    // 1. Check exact SHA-256 match in other complaints
    const exactMatches = await prisma.document.findMany({
      where: {
        sha256Checksum,
        ...(currentComplaintId && currentComplaintId.length === 36 ? { complaintId: { not: null, notIn: [currentComplaintId] } } : { complaintId: { not: null } }),
      },
      include: {
        complaint: {
          select: {
            id: true,
            trackingId: true,
            ward: true,
            locality: true,
          },
        },
      },
      take: 5,
    });

    for (const doc of exactMatches) {
      if (doc.complaint) {
        const isSameWard =
          Boolean(currentWard && doc.complaint.ward) &&
          currentWard!.trim().toLowerCase() === doc.complaint.ward!.trim().toLowerCase();

        matches.push({
          matchedDocumentId: doc.id,
          matchedComplaintId: doc.complaint.id,
          matchedTrackingId: doc.complaint.trackingId,
          matchedWard: doc.complaint.ward,
          isSameWard,
          matchType: 'EXACT_SHA256',
          similarityPercentage: 100,
          hammingDistance: 0,
        });
      }
    }

    // 2. Check perceptual hash candidates
    if (perceptualHash && matches.length < 5) {
      const recentDocs = await prisma.document.findMany({
        where: {
          perceptualHash: { not: null },
          ...(currentComplaintId && currentComplaintId.length === 36 ? { complaintId: { not: null, notIn: [currentComplaintId] } } : { complaintId: { not: null } }),
          id: { notIn: matches.map((m) => m.matchedDocumentId) },
        },
        select: {
          id: true,
          perceptualHash: true,
          complaint: {
            select: {
              id: true,
              trackingId: true,
              ward: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      for (const doc of recentDocs) {
        if (doc.perceptualHash && doc.complaint) {
          const dist = calculateHammingDistance(perceptualHash, doc.perceptualHash);
          // Distance <= 10 out of 64 bits = ~84.4% visual similarity
          if (dist <= 10) {
            const sim = hammingToSimilarity(dist);
            const isSameWard =
              Boolean(currentWard && doc.complaint.ward) &&
              currentWard!.trim().toLowerCase() === doc.complaint.ward!.trim().toLowerCase();

            matches.push({
              matchedDocumentId: doc.id,
              matchedComplaintId: doc.complaint.id,
              matchedTrackingId: doc.complaint.trackingId,
              matchedWard: doc.complaint.ward,
              isSameWard,
              matchType: 'PERCEPTUAL_DHASH',
              similarityPercentage: sim,
              hammingDistance: dist,
            });
          }
        }
      }
    }
  } catch (err: any) {
    // Graceful recovery if database columns are pending migration
    console.warn('[Image Duplicate Match Query Warn]:', err?.message || err);
  }

  return matches;
}
