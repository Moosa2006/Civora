import crypto from 'node:crypto';
import type { PrismaClient } from '@prisma/client';

const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // 32 characters, no ambiguous chars (0, 1, I, O)

export function generateRandomCode(length = 5): string {
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return result;
}

export function generateTrackingIdFormat(year = new Date().getFullYear()): string {
  const code = generateRandomCode(5);
  return `CIV-${year}-${code}`;
}

export async function generateUniqueTrackingId(
  prisma: PrismaClient | any,
  year = new Date().getFullYear(),
  maxRetries = 5
): Promise<string> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const candidateId = generateTrackingIdFormat(year);
    const existing = await prisma.complaint.findUnique({
      where: { trackingId: candidateId },
      select: { id: true },
    });

    if (!existing) {
      return candidateId;
    }
  }

  // Fallback with higher entropy in the astronomical chance of repeated collisions
  const highEntropyCode = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `CIV-${year}-${highEntropyCode}`;
}

export function generateProposalTrackingIdFormat(year = new Date().getFullYear()): string {
  const code = generateRandomCode(5);
  return `PROP-${year}-${code}`;
}

export async function generateUniqueProposalTrackingId(
  prisma: PrismaClient | any,
  year = new Date().getFullYear(),
  maxRetries = 5
): Promise<string> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const candidateId = generateProposalTrackingIdFormat(year);
    const existing = await prisma.communityProposal.findUnique({
      where: { trackingId: candidateId },
      select: { id: true },
    });

    if (!existing) {
      return candidateId;
    }
  }

  const highEntropyCode = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `PROP-${year}-${highEntropyCode}`;
}

export async function generateUniqueTenderNumber(
  prisma: PrismaClient | any,
  year = new Date().getFullYear()
): Promise<string> {
  const lastTender = await prisma.tender.findFirst({
    where: { tenderNumber: { startsWith: `TND-${year}-` } },
    orderBy: { createdAt: 'desc' },
    select: { tenderNumber: true },
  });
  let nextSeq = 1;
  if (lastTender?.tenderNumber) {
    const parts = lastTender.tenderNumber.split('-');
    const parsed = parseInt(parts[2], 10);
    if (!isNaN(parsed)) {
      nextSeq = parsed + 1;
    }
  }
  for (let i = 0; i < 50; i++) {
    const candidate = `TND-${year}-${String(nextSeq + i).padStart(4, '0')}`;
    const exists = await prisma.tender.findUnique({
      where: { tenderNumber: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
  }
  return `TND-${year}-${Date.now().toString().slice(-6)}`;
}

export async function generateUniqueBidNumber(
  prisma: PrismaClient | any,
  year = new Date().getFullYear()
): Promise<string> {
  const lastBid = await prisma.tenderBid.findFirst({
    where: { bidNumber: { startsWith: `BID-${year}-` } },
    orderBy: { createdAt: 'desc' },
    select: { bidNumber: true },
  });
  let nextSeq = 1;
  if (lastBid?.bidNumber) {
    const parts = lastBid.bidNumber.split('-');
    const parsed = parseInt(parts[2], 10);
    if (!isNaN(parsed)) {
      nextSeq = parsed + 1;
    }
  }
  for (let i = 0; i < 50; i++) {
    const candidate = `BID-${year}-${String(nextSeq + i).padStart(4, '0')}`;
    const exists = await prisma.tenderBid.findUnique({
      where: { bidNumber: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
  }
  return `BID-${year}-${Date.now().toString().slice(-6)}`;
}

export async function generateUniqueWorkOrderNumber(
  prisma: PrismaClient | any,
  year = new Date().getFullYear()
): Promise<string> {
  const lastWo = await prisma.workOrder.findFirst({
    where: { workOrderNumber: { startsWith: `WO-${year}-` } },
    orderBy: { createdAt: 'desc' },
    select: { workOrderNumber: true },
  });
  let nextSeq = 1;
  if (lastWo?.workOrderNumber) {
    const parts = lastWo.workOrderNumber.split('-');
    const parsed = parseInt(parts[2], 10);
    if (!isNaN(parsed)) {
      nextSeq = parsed + 1;
    }
  }
  for (let i = 0; i < 50; i++) {
    const candidate = `WO-${year}-${String(nextSeq + i).padStart(4, '0')}`;
    const exists = await prisma.workOrder.findUnique({
      where: { workOrderNumber: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
  }
  return `WO-${year}-${Date.now().toString().slice(-6)}`;
}

export function isValidUuid(val: unknown): val is string {
  if (!val || typeof val !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
}

export async function generateUniqueDefectTrackingId(
  prisma: PrismaClient | any,
  year = new Date().getFullYear()
): Promise<string> {
  const lastDefect = await prisma.defectWarrantyRequest.findFirst({
    where: { trackingId: { startsWith: `DEF-${year}-` } },
    orderBy: { createdAt: 'desc' },
    select: { trackingId: true },
  });
  let nextSeq = 1;
  if (lastDefect?.trackingId) {
    const parts = lastDefect.trackingId.split('-');
    const parsed = parseInt(parts[2], 10);
    if (!isNaN(parsed)) {
      nextSeq = parsed + 1;
    }
  }
  for (let i = 0; i < 50; i++) {
    const candidate = `DEF-${year}-${String(nextSeq + i).padStart(4, '0')}`;
    const exists = await prisma.defectWarrantyRequest.findUnique({
      where: { trackingId: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
  }
  return `DEF-${year}-${Date.now().toString().slice(-6)}`;
}

