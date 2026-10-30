import multer from 'multer';
import type { Request, Response, NextFunction } from 'express';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES, MAX_FILES_PER_BATCH } from '../lib/storageService.js';

// Memory storage keeps file buffers accessible for in-memory signature validation and checksum hashing
const storage = multer.memoryStorage();

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const isAllowedMime = ALLOWED_MIME_TYPES.includes(file.mimetype as any);

  // Check file extension
  const ext = file.originalname.split('.').pop()?.toLowerCase();
  const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];
  const isAllowedExt = ext ? allowedExts.includes(ext) : false;

  if (isAllowedMime && isAllowedExt) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Unsupported file type '${file.mimetype}'. Only JPEG, PNG, WebP images and PDF documents are permitted.`
      )
    );
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: MAX_FILES_PER_BATCH,
  },
  fileFilter,
});

/**
 * Middleware handling single file upload on field 'file'
 */
export function uploadSingleEvidence(req: Request, res: Response, next: NextFunction) {
  const handler = upload.single('file');
  handler(req, res, (err: unknown) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            success: false,
            error: {
              code: 'FILE_TOO_LARGE',
              message: 'Uploaded file exceeds the maximum allowed size of 10MB.',
            },
          });
        }
        return res.status(400).json({
          success: false,
          error: {
            code: 'UPLOAD_ERROR',
            message: err.message,
          },
        });
      }
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_FILE_TYPE',
          message: err instanceof Error ? err.message : 'Invalid file upload.',
        },
      });
    }
    next();
  });
}

/**
 * Middleware handling multiple files upload on field 'files' (max 5)
 */
export function uploadMultipleEvidence(req: Request, res: Response, next: NextFunction) {
  const handler = upload.array('files', MAX_FILES_PER_BATCH);
  handler(req, res, (err: unknown) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            success: false,
            error: {
              code: 'FILE_TOO_LARGE',
              message: 'One or more uploaded files exceed the maximum allowed size of 10MB.',
            },
          });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            success: false,
            error: {
              code: 'TOO_MANY_FILES',
              message: `Cannot upload more than ${MAX_FILES_PER_BATCH} files in a single request.`,
            },
          });
        }
        return res.status(400).json({
          success: false,
          error: {
            code: 'UPLOAD_ERROR',
            message: err.message,
          },
        });
      }
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_FILE_TYPE',
          message: err instanceof Error ? err.message : 'Invalid file upload.',
        },
      });
    }
    next();
  });
}

/**
 * Flexible middleware handling file uploads from either 'file' or 'files' field
 */
export function uploadEvidenceFiles(req: Request, res: Response, next: NextFunction) {
  const handler = upload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'files', maxCount: MAX_FILES_PER_BATCH },
  ]);
  handler(req, res, (err: unknown) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            success: false,
            error: {
              code: 'FILE_TOO_LARGE',
              message: 'Uploaded file exceeds the maximum allowed size of 10MB.',
            },
          });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            success: false,
            error: {
              code: 'TOO_MANY_FILES',
              message: `Cannot upload more than ${MAX_FILES_PER_BATCH} files in a single request.`,
            },
          });
        }
        return res.status(400).json({
          success: false,
          error: {
            code: 'UPLOAD_ERROR',
            message: err.message,
          },
        });
      }
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_FILE_TYPE',
          message: err instanceof Error ? err.message : 'Invalid file upload.',
        },
      });
    }

    // Normalize incoming files into req.files or req.file for downstream controller
    if (req.files && typeof req.files === 'object' && !Array.isArray(req.files)) {
      const filesMap = req.files as { [fieldname: string]: Express.Multer.File[] };
      const aggregated: Express.Multer.File[] = [];
      if (filesMap.file && filesMap.file.length > 0) {
        aggregated.push(...filesMap.file);
      }
      if (filesMap.files && filesMap.files.length > 0) {
        aggregated.push(...filesMap.files);
      }
      req.files = aggregated;
      if (aggregated.length === 1) {
        req.file = aggregated[0];
      }
    }

    next();
  });
}

