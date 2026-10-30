/**
 * Client-side Civic Image Verification Utilities
 * Extracts EXIF metadata, computes cryptographic SHA-256, computes 64-bit perceptual dHash,
 * and handles browser geolocation consent.
 */

export interface ClientImageAnalysis {
  file: File;
  previewUrl: string;
  sha256: string;
  perceptualHash: string;
  capturedAt: Date | null;
  exifLatitude: number | null;
  exifLongitude: number | null;
  browserCapturedAt: Date;
  browserLatitude?: number | null;
  browserLongitude?: number | null;
  browserAccuracy?: number | null;
}

/**
 * Computes SHA-256 digest using Web Cryptography API
 */
export async function computeClientSha256(file: File): Promise<string> {
  try {
    const buffer = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(digest));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return '';
  }
}

/**
 * Computes 64-bit perceptual difference hash (dHash) using HTMLCanvasElement
 * Resizes down to 9x8 grayscale, compares adjacent columns across 8 rows.
 */
export async function computeClientDHash(file: File): Promise<string> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 9;
          canvas.height = 8;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) {
            resolve('0000000000000000');
            return;
          }

          ctx.drawImage(img, 0, 0, 9, 8);
          const imageData = ctx.getImageData(0, 0, 9, 8).data;

          // Convert to grayscale values (9 cols x 8 rows = 72 values)
          const grays: number[] = [];
          for (let i = 0; i < imageData.length; i += 4) {
            const gray = Math.round(
              0.299 * imageData[i] + 0.587 * imageData[i + 1] + 0.114 * imageData[i + 2]
            );
            grays.push(gray);
          }

          // Compute 64-bit difference hash (8 rows x 8 comparisons)
          let hex = '';
          for (let row = 0; row < 8; row++) {
            let rowBits = 0;
            for (let col = 0; col < 8; col++) {
              const left = grays[row * 9 + col];
              const right = grays[row * 9 + col + 1];
              if (left >= right) {
                rowBits |= 1 << (7 - col);
              }
            }
            hex += rowBits.toString(16).padStart(2, '0');
          }

          resolve(hex.slice(0, 16));
        } catch {
          resolve('0000000000000000');
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve('0000000000000000');
      };

      img.src = objectUrl;
    } catch {
      resolve('0000000000000000');
    }
  });
}

/**
 * Extracts EXIF DateTimeOriginal and GPS coordinates from JPEG/WebP files
 */
export async function extractClientExif(file: File): Promise<{
  capturedAt: Date | null;
  latitude: number | null;
  longitude: number | null;
}> {
  const result: {
    capturedAt: Date | null;
    latitude: number | null;
    longitude: number | null;
  } = {
    capturedAt: null,
    latitude: null,
    longitude: null,
  };

  try {
    const buffer = await file.slice(0, 128 * 1024).arrayBuffer();
    const view = new DataView(buffer);

    // Verify JPEG SOI marker (0xFFD8)
    if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) {
      return result;
    }

    let offset = 2;
    while (offset < view.byteLength - 4) {
      if (view.getUint8(offset) !== 0xff) {
        offset++;
        continue;
      }

      const marker = view.getUint8(offset + 1);
      // APP1 marker (0xFFE1)
      if (marker === 0xe1) {
        // "Exif\0\0"
        if (
          view.getUint32(offset + 4) === 0x45786966 &&
          view.getUint16(offset + 8) === 0x0000
        ) {
          const tiffStart = offset + 10;
          parseClientTiff(view, tiffStart, result);
        }
        break;
      } else if (marker === 0xda || marker === 0xd9) {
        break;
      } else {
        const length = view.getUint16(offset + 2);
        offset += 2 + length;
      }
    }
  } catch {
    // Graceful error fallback
  }

  return result;
}

function parseClientTiff(
  view: DataView,
  tiffStart: number,
  result: { capturedAt: Date | null; latitude: number | null; longitude: number | null }
) {
  if (tiffStart + 8 > view.byteLength) return;

  const endianChar = view.getUint16(tiffStart);
  const isLittle = endianChar === 0x4949; // "II"

  const ifd0Offset = view.getUint32(tiffStart + 4, isLittle);
  if (ifd0Offset < 8 || tiffStart + ifd0Offset + 2 > view.byteLength) return;

  let exifSubOffset: number | null = null;
  let gpsSubOffset: number | null = null;

  const entriesCount = view.getUint16(tiffStart + ifd0Offset, isLittle);
  let entry = tiffStart + ifd0Offset + 2;

  for (let i = 0; i < entriesCount; i++) {
    if (entry + 12 > view.byteLength) break;
    const tag = view.getUint16(entry, isLittle);
    if (tag === 0x8769) {
      exifSubOffset = view.getUint32(entry + 8, isLittle);
    } else if (tag === 0x8825) {
      gpsSubOffset = view.getUint32(entry + 8, isLittle);
    }
    entry += 12;
  }

  // Parse DateTimeOriginal
  if (exifSubOffset && tiffStart + exifSubOffset + 2 <= view.byteLength) {
    const subCount = view.getUint16(tiffStart + exifSubOffset, isLittle);
    let subEntry = tiffStart + exifSubOffset + 2;
    for (let i = 0; i < subCount; i++) {
      if (subEntry + 12 > view.byteLength) break;
      const tag = view.getUint16(subEntry, isLittle);
      if (tag === 0x9003 || tag === 0x9004 || tag === 0x0132) {
        const valOffset = view.getUint32(subEntry + 8, isLittle);
        if (tiffStart + valOffset + 19 <= view.byteLength) {
          let str = '';
          for (let c = 0; c < 19; c++) {
            str += String.fromCharCode(view.getUint8(tiffStart + valOffset + c));
          }
          const parts = str.match(/^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
          if (parts) {
            const dt = new Date(
              parseInt(parts[1], 10),
              parseInt(parts[2], 10) - 1,
              parseInt(parts[3], 10),
              parseInt(parts[4], 10),
              parseInt(parts[5], 10),
              parseInt(parts[6], 10)
            );
            if (!isNaN(dt.getTime())) {
              result.capturedAt = dt;
              break;
            }
          }
        }
      }
      subEntry += 12;
    }
  }

  // Parse GPS
  if (gpsSubOffset && tiffStart + gpsSubOffset + 2 <= view.byteLength) {
    const gpsCount = view.getUint16(tiffStart + gpsSubOffset, isLittle);
    let gpsEntry = tiffStart + gpsSubOffset + 2;

    let latRef = 'N';
    let lonRef = 'E';
    let rawLat: number[] | null = null;
    let rawLon: number[] | null = null;

    for (let i = 0; i < gpsCount; i++) {
      if (gpsEntry + 12 > view.byteLength) break;
      const tag = view.getUint16(gpsEntry, isLittle);
      if (tag === 0x0001) {
        latRef = String.fromCharCode(view.getUint8(gpsEntry + 8));
      } else if (tag === 0x0002) {
        const valOffset = view.getUint32(gpsEntry + 8, isLittle);
        rawLat = readClientGpsCoord(view, tiffStart + valOffset, isLittle);
      } else if (tag === 0x0003) {
        lonRef = String.fromCharCode(view.getUint8(gpsEntry + 8));
      } else if (tag === 0x0004) {
        const valOffset = view.getUint32(gpsEntry + 8, isLittle);
        rawLon = readClientGpsCoord(view, tiffStart + valOffset, isLittle);
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

function readClientGpsCoord(view: DataView, offset: number, isLittle: boolean): number[] | null {
  if (offset + 24 > view.byteLength) return null;
  const coords: number[] = [];
  for (let i = 0; i < 3; i++) {
    const o = offset + i * 8;
    const num = view.getUint32(o, isLittle);
    const den = view.getUint32(o + 4, isLittle);
    if (den === 0) return null;
    coords.push(num / den);
  }
  return coords;
}

/**
 * Requests device GPS coordinates with user consent
 */
export async function getBrowserGeolocation(): Promise<{
  latitude: number;
  longitude: number;
  accuracy: number;
} | null> {
  if (!navigator.geolocation) return null;

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: Math.round(pos.coords.latitude * 10000000) / 10000000,
          longitude: Math.round(pos.coords.longitude * 10000000) / 10000000,
          accuracy: Math.round(pos.coords.accuracy * 10) / 10,
        });
      },
      () => {
        resolve(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  });
}
