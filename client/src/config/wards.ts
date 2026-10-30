/**
 * Civora Municipal Ward Master Configuration (Frontend)
 * Standardized municipal ward dictionary for citizen complaint reporting and municipal triage.
 */

export interface MunicipalWard {
  code: string;
  number: string;
  name: string;
  zone: string;
}

export const MUNICIPAL_WARDS: MunicipalWard[] = [
  { code: 'WARD-21', number: 'Ward 21', name: 'Hebbal', zone: 'Yelahanka Zone' },
  { code: 'WARD-45', number: 'Ward 45', name: 'Malleshwaram', zone: 'West Zone' },
  { code: 'WARD-75', number: 'Ward 75', name: 'Yeshwanthpur', zone: 'West Zone' },
  { code: 'WARD-82', number: 'Ward 82', name: 'Hoysala Nagar (Indira Nagar)', zone: 'East Zone' },
  { code: 'WARD-84', number: 'Ward 84', name: 'Hagadur (Whitefield)', zone: 'Mahadevapura Zone' },
  { code: 'WARD-85', number: 'Ward 85', name: 'Doddanekkundi (Marathahalli)', zone: 'Mahadevapura Zone' },
  { code: 'WARD-98', number: 'Ward 98', name: 'Prakash Nagar (Rajajinagar)', zone: 'West Zone' },
  { code: 'WARD-111', number: 'Ward 111', name: 'Shantala Nagar (Central/MG Road)', zone: 'East Zone' },
  { code: 'WARD-112', number: 'Ward 112', name: 'Domlur', zone: 'East Zone' },
  { code: 'WARD-120', number: 'Ward 120', name: 'Kalyan Nagar', zone: 'East Zone' },
  { code: 'WARD-132', number: 'Ward 132', name: 'Attiguppe', zone: 'South Zone' },
  { code: 'WARD-150', number: 'Ward 150', name: 'Bellandur', zone: 'Mahadevapura Zone' },
  { code: 'WARD-151', number: 'Ward 151', name: 'Koramangala', zone: 'South Zone' },
  { code: 'WARD-160', number: 'Ward 160', name: 'Rajarajeshwari Nagar', zone: 'RR Nagar Zone' },
  { code: 'WARD-169', number: 'Ward 169', name: 'Byrasandra (Jayanagar)', zone: 'South Zone' },
  { code: 'WARD-174', number: 'Ward 174', name: 'HSR Layout', zone: 'Bommanahalli Zone' },
  { code: 'WARD-176', number: 'Ward 176', name: 'BTM Layout', zone: 'South Zone' },
  { code: 'WARD-180', number: 'Ward 180', name: 'Banashankari', zone: 'South Zone' },
  { code: 'WARD-192', number: 'Ward 192', name: 'Begur (Electronic City)', zone: 'Bommanahalli Zone' },
  { code: 'WARD-198', number: 'Ward 198', name: 'Hemmigepura', zone: 'RR Nagar Zone' },
];

/**
 * Normalizes user or system ward input to canonical standard label: "Ward <Number> - <Name>"
 */
export function normalizeWard(wardInput: string): string {
  if (!wardInput) return '';
  const clean = wardInput.trim().toLowerCase();
  const matched = MUNICIPAL_WARDS.find(
    (w) =>
      w.number.toLowerCase() === clean ||
      w.code.toLowerCase() === clean ||
      clean.includes(w.number.toLowerCase()) ||
      clean.includes(w.name.toLowerCase())
  );
  if (matched) {
    return `${matched.number} - ${matched.name}`;
  }
  return wardInput.trim();
}

