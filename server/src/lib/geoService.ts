import crypto from 'node:crypto';

export interface KnownLocality {
  name: string;
  wardNumber: string;
  wardName: string;
  zone: string;
  latitude: number;
  longitude: number;
  aliases: string[];
}

/**
 * Predefined dictionary of Bengaluru municipal wards and localities
 * Serves as an offline, zero-dependency reference for validation, autocomplete, and geocoding.
 */
export const BENGALURU_LOCALITIES: KnownLocality[] = [
  {
    name: 'Indira Nagar',
    wardNumber: 'Ward 82',
    wardName: 'Hoysala Nagar',
    zone: 'East Zone',
    latitude: 12.9784,
    longitude: 77.6408,
    aliases: ['Indiranagar', '100ft Road', '12th Main', 'CMH Road'],
  },
  {
    name: 'HSR Layout',
    wardNumber: 'Ward 174',
    wardName: 'HSR Layout',
    zone: 'Bommanahalli Zone',
    latitude: 12.9116,
    longitude: 77.6389,
    aliases: ['HSR', 'Sector 1', 'Sector 2', 'Sector 3', 'Sector 5', 'Agara'],
  },
  {
    name: 'Koramangala',
    wardNumber: 'Ward 151',
    wardName: 'Koramangala',
    zone: 'South Zone',
    latitude: 12.9345,
    longitude: 77.6253,
    aliases: ['Koramangala 3rd Block', 'Koramangala 4th Block', 'Koramangala 5th Block', 'Sony World Junction'],
  },
  {
    name: 'Bellandur',
    wardNumber: 'Ward 150',
    wardName: 'Bellandur',
    zone: 'Mahadevapura Zone',
    latitude: 12.926,
    longitude: 77.6762,
    aliases: ['Outer Ring Road', 'Bellandur Lake', 'Ecospace', 'Green Glen Layout'],
  },
  {
    name: 'Central Ward',
    wardNumber: 'Ward 111',
    wardName: 'Shantala Nagar',
    zone: 'East Zone',
    latitude: 12.9756,
    longitude: 77.6066,
    aliases: ['MG Road', 'Brigade Road', 'Church Street', 'Residency Road', 'Ashok Nagar'],
  },
  {
    name: 'Whitefield',
    wardNumber: 'Ward 84',
    wardName: 'Hagadur',
    zone: 'Mahadevapura Zone',
    latitude: 12.9698,
    longitude: 77.7499,
    aliases: ['ITPL', 'Hope Farm', 'Kadugodi', 'EPIP Zone'],
  },
  {
    name: 'Jayanagar',
    wardNumber: 'Ward 169',
    wardName: 'Byrasandra',
    zone: 'South Zone',
    latitude: 12.9299,
    longitude: 77.5824,
    aliases: ['Jayanagar 4th Block', 'Jayanagar 9th Block', 'South End Circle'],
  },
  {
    name: 'Malleshwaram',
    wardNumber: 'Ward 45',
    wardName: 'Malleshwaram',
    zone: 'West Zone',
    latitude: 13.0031,
    longitude: 77.5643,
    aliases: ['Malleswaram', 'Margosa Road', 'Sampige Road', '8th Cross'],
  },
  {
    name: 'Electronic City',
    wardNumber: 'Ward 192',
    wardName: 'Begur',
    zone: 'Bommanahalli Zone',
    latitude: 12.8399,
    longitude: 77.677,
    aliases: ['ECity', 'Phase 1', 'Phase 2', 'Velankani Drive'],
  },
  {
    name: 'BTM Layout',
    wardNumber: 'Ward 176',
    wardName: 'BTM Layout',
    zone: 'South Zone',
    latitude: 12.9166,
    longitude: 77.6101,
    aliases: ['BTM 1st Stage', 'BTM 2nd Stage', 'Udupi Garden'],
  },
  {
    name: 'Hebbal',
    wardNumber: 'Ward 21',
    wardName: 'Hebbal',
    zone: 'Yelahanka Zone',
    latitude: 13.0358,
    longitude: 77.597,
    aliases: ['Hebbal Flyover', 'Kempapura', 'Hebbal Lake'],
  },
  {
    name: 'Marathahalli',
    wardNumber: 'Ward 85',
    wardName: 'Doddanekkundi',
    zone: 'Mahadevapura Zone',
    latitude: 12.9591,
    longitude: 77.6974,
    aliases: ['Marathahalli Bridge', 'Spice Garden', 'Kalamandir'],
  },
  {
    name: 'Domlur',
    wardNumber: 'Ward 112',
    wardName: 'Domlur',
    zone: 'East Zone',
    latitude: 12.9609,
    longitude: 77.6387,
    aliases: ['Domlur Layout', 'Embassy Golf Links', 'EGL', 'Old Airport Road'],
  },
  {
    name: 'Rajajinagar',
    wardNumber: 'Ward 98',
    wardName: 'Prakash Nagar',
    zone: 'West Zone',
    latitude: 12.9982,
    longitude: 77.553,
    aliases: ['Rajajinagar 1st Block', 'Navrang Circle', 'Dr Rajkumar Road'],
  },
];

export class GeoService {
  /**
   * Earth's mean radius in kilometers
   */
  private static readonly EARTH_RADIUS_KM = 6371.0;

  /**
   * Calculates the great-circle distance between two geographic coordinates
   * using the Haversine formula.
   */
  public static haversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const rLat1 = toRad(lat1);
    const rLat2 = toRad(lat2);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Number((this.EARTH_RADIUS_KM * c).toFixed(2));
  }

  /**
   * Generalizes coordinates for public map discovery to prevent exposing exact
   * residential or private locations.
   *
   * Strategy:
   * 1. Round to 3 decimal places (~110m resolution).
   * 2. Apply deterministic pseudo-random micro-jitter based on complaint ID hash
   *    so the marker is stable across re-renders but offset from private doorstep.
   */
  public static generalizeCoordinates(
    latitude: number,
    longitude: number,
    seedId?: string
  ): { lat: number; lng: number } {
    // 3 decimal places is roughly 110m at the equator
    const baseLat = Number(latitude.toFixed(3));
    const baseLng = Number(longitude.toFixed(3));

    if (!seedId) {
      return { lat: baseLat, lng: baseLng };
    }

    // Deterministic offset between -0.0004 and +0.0004 deg (~40m jitter)
    const hash = crypto.createHash('sha256').update(seedId).digest();
    const offsetLat = ((hash[0] - 128) / 128) * 0.0004;
    const offsetLng = ((hash[1] - 128) / 128) * 0.0004;

    return {
      lat: Number((baseLat + offsetLat).toFixed(4)),
      lng: Number((baseLng + offsetLng).toFixed(4)),
    };
  }

  /**
   * Validates if latitude and longitude are within standard geographical boundaries.
   */
  public static isValidCoordinate(lat: unknown, lng: unknown): boolean {
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return false;
    }
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return false;
    }
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  }

  /**
   * Looks up matching known localities from the internal database.
   */
  public static findLocalities(query?: string): KnownLocality[] {
    if (!query || !query.trim()) {
      return BENGALURU_LOCALITIES;
    }

    const cleanQuery = query.trim().toLowerCase();

    return BENGALURU_LOCALITIES.filter((loc) => {
      if (loc.name.toLowerCase().includes(cleanQuery)) return true;
      if (loc.wardName.toLowerCase().includes(cleanQuery)) return true;
      if (loc.wardNumber.toLowerCase().includes(cleanQuery)) return true;
      if (loc.zone.toLowerCase().includes(cleanQuery)) return true;
      return loc.aliases.some((alias) => alias.toLowerCase().includes(cleanQuery));
    });
  }

  /**
   * Best-effort geocoding using offline reference points.
   * If input matches a known locality, returns its canonical coordinates.
   */
  public static geocodeOffline(addressOrLocality: string): {
    found: boolean;
    latitude: number;
    longitude: number;
    locality: string;
    ward: string;
    confidence: number;
  } | null {
    if (!addressOrLocality || !addressOrLocality.trim()) return null;

    const matches = this.findLocalities(addressOrLocality);
    if (matches.length > 0) {
      const best = matches[0];
      return {
        found: true,
        latitude: best.latitude,
        longitude: best.longitude,
        locality: best.name,
        ward: `${best.wardNumber} (${best.wardName})`,
        confidence: 0.9,
      };
    }

    return null;
  }
}
