import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Allowed MIME types and extensions
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_FILES_PER_BATCH = 5;

// Magic byte signatures for supported binary formats
const MAGIC_SIGNATURES: Record<string, { bytes: number[]; offset?: number }> = {
  'image/jpeg': { bytes: [0xff, 0xd8, 0xff] },
  'image/png': { bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  'application/pdf': { bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
};

// Storage directory: outside public web root in server/uploads/evidence
const BASE_STORAGE_DIR = path.resolve(process.cwd(), 'uploads', 'evidence');

// Ensure base upload directory exists
if (!fs.existsSync(BASE_STORAGE_DIR)) {
  fs.mkdirSync(BASE_STORAGE_DIR, { recursive: true });
}

export interface StoredFileResult {
  storageKey: string;
  sha256Checksum: string;
  fileSize: number;
  mimeType: string;
  sanitizedFileName: string;
}

export class StorageService {
  /**
   * Validates file buffer magic bytes against declared MIME type to prevent MIME spoofing.
   */
  public static validateMagicBytes(buffer: Buffer, declaredMimeType: string): boolean {
    if (declaredMimeType === 'image/webp') {
      // WebP check: RIFF header (0-3) and WEBP marker (8-11)
      if (buffer.length < 12) return false;
      const isRiff = buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46;
      const isWebp = buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
      return isRiff && isWebp;
    }

    const sig = MAGIC_SIGNATURES[declaredMimeType];
    if (!sig) return false;

    if (buffer.length < sig.bytes.length) return false;

    const offset = sig.offset || 0;
    for (let i = 0; i < sig.bytes.length; i++) {
      if (buffer[offset + i] !== sig.bytes[i]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Sanitizes user-supplied filenames, stripping path separators and illegal characters.
   */
  public static sanitizeFileName(rawName: string): string {
    const base = path.basename(rawName).trim();
    // Replace dangerous shell or path characters
    return base.replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  /**
   * Computes SHA-256 hexadecimal checksum of a buffer for data integrity audit.
   */
  public static computeSha256(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Securely saves an evidence file buffer to disk outside the public web root.
   */
  public static async saveFile(
    buffer: Buffer,
    originalFileName: string,
    complaintId: string,
    declaredMimeType: string
  ): Promise<StoredFileResult> {
    if (!buffer || buffer.length === 0) {
      throw new Error('File payload is empty.');
    }

    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      throw new Error(`File size (${buffer.length} bytes) exceeds maximum limit of 10MB.`);
    }

    const sanitizedName = this.sanitizeFileName(originalFileName);
    const ext = path.extname(sanitizedName).toLowerCase() || '.dat';

    // Verify magic bytes
    if (!this.validateMagicBytes(buffer, declaredMimeType)) {
      throw new Error(
        `File signature mismatch: File content does not match declared MIME type ${declaredMimeType}.`
      );
    }

    // Generate random UUID key
    const uniqueKey = crypto.randomUUID();
    const storageSubdir = path.join(BASE_STORAGE_DIR, 'complaints', complaintId);

    if (!fs.existsSync(storageSubdir)) {
      fs.mkdirSync(storageSubdir, { recursive: true });
    }

    const storageFileName = `${uniqueKey}${ext}`;
    const fullDiskPath = path.join(storageSubdir, storageFileName);

    // Write file to disk
    await fs.promises.writeFile(fullDiskPath, buffer);

    const checksum = this.computeSha256(buffer);
    const storageKey = `complaints/${complaintId}/${storageFileName}`;

    return {
      storageKey,
      sha256Checksum: checksum,
      fileSize: buffer.length,
      mimeType: declaredMimeType,
      sanitizedFileName: sanitizedName,
    };
  }

  /**
   * Resolves safe physical path on disk for a given storageKey, preventing directory traversal.
   */
  public static resolveDiskPath(storageKey: string): string {
    // Normalization check to prevent path traversal
    const safeKey = storageKey.replace(/\.\./g, '').replace(/^\/+/, '');
    const fullPath = path.resolve(BASE_STORAGE_DIR, safeKey);

    if (!fullPath.startsWith(BASE_STORAGE_DIR)) {
      throw new Error('Path traversal attempt detected.');
    }

    return fullPath;
  }

  /**
   * Checks if an evidence file exists on disk.
   */
  public static fileExists(storageKey: string): boolean {
    try {
      const p = this.resolveDiskPath(storageKey);
      return fs.existsSync(p);
    } catch {
      return false;
    }
  }

  /**
   * Returns a readable stream for authorized streaming download.
   */
  public static getFileStream(storageKey: string): fs.ReadStream {
    const diskPath = this.resolveDiskPath(storageKey);
    if (!fs.existsSync(diskPath)) {
      throw new Error('Stored evidence file not found on disk.');
    }
    return fs.createReadStream(diskPath);
  }

  /**
   * Returns complete file buffer for metadata processing or EXIF stripping.
   */
  public static async getFileBuffer(storageKey: string): Promise<Buffer> {
    const diskPath = this.resolveDiskPath(storageKey);
    if (!fs.existsSync(diskPath)) {
      throw new Error('Stored evidence file not found on disk.');
    }
    return fs.promises.readFile(diskPath);
  }

  /**
   * Deletes an evidence file from disk.
   */
  public static async deleteFile(storageKey: string): Promise<boolean> {
    try {
      const diskPath = this.resolveDiskPath(storageKey);
      if (fs.existsSync(diskPath)) {
        await fs.promises.unlink(diskPath);
        return true;
      }
      return false;
    } catch (err) {
      console.error(`[StorageService.deleteFile Error] Key: ${storageKey}`, err);
      return false;
    }
  }
}
