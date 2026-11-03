import { prisma } from './prisma.js';

export interface BaselineDepartmentDef {
  code: string;
  name: string;
  description: string;
}

export interface BaselineCategoryDef {
  code: string;
  name: string;
  description: string;
  departmentCode: string;
}

export const BASELINE_DEPARTMENTS: BaselineDepartmentDef[] = [
  {
    code: 'PWD',
    name: 'Public Works Department',
    description: 'Roads, bridges, public infrastructure, and civic construction works.',
  },
  {
    code: 'WSSB',
    name: 'Water Supply & Sewerage Board',
    description: 'Drinking water distribution, pipeline maintenance, and sewage disposal.',
  },
  {
    code: 'SAN',
    name: 'Sanitation & Waste Management',
    description: 'Solid waste management, garbage clearance, and public hygiene.',
  },
  {
    code: 'ESL',
    name: 'Electricity & Street Lighting',
    description: 'Streetlights, electrical safety, transformers, and civic lighting infrastructure.',
  },
  {
    code: 'TPI',
    name: 'Town Planning & Infrastructure',
    description: 'Urban planning, park maintenance, encroachment control, and municipal assets.',
  },
];

export const BASELINE_CATEGORIES: BaselineCategoryDef[] = [
  {
    code: 'ROADS_POTHOLES',
    name: 'Roads, Potholes & Footpaths',
    description: 'Potholes, damaged asphalt, missing pavers, open trenches, and broken sidewalks.',
    departmentCode: 'PWD',
  },
  {
    code: 'DRAINAGE_OVERFLOW',
    name: 'Drainage & Sewage Overflow',
    description: 'Blocked stormwater drains, overflowing manholes, and sewage backflow in public areas.',
    departmentCode: 'WSSB',
  },
  {
    code: 'GARBAGE_DUMPING',
    name: 'Garbage & Solid Waste Dumping',
    description: 'Uncollected community waste, overflowing dumpsters, and illegal solid waste disposal.',
    departmentCode: 'SAN',
  },
  {
    code: 'STREETLIGHT_OUTAGE',
    name: 'Streetlights & Electrical Outage',
    description: 'Non-functional streetlights, exposed live wires, damaged utility poles, and dark corridors.',
    departmentCode: 'ESL',
  },
  {
    code: 'INFRASTRUCTURE_DAMAGE',
    name: 'Public Infrastructure Damage',
    description: 'Damaged civic structures, vandalized bus shelters, collapsed public fencing, and unsafe structures.',
    departmentCode: 'TPI',
  },
];

let inFlightBootstrap: Promise<{ seeded: boolean; departments: number; categories: number }> | null = null;

async function executeBootstrap(): Promise<{ seeded: boolean; departments: number; categories: number }> {
  try {
    const existingCatCount = await prisma.complaintCategory.count({ where: { isActive: true } });
    const existingDeptCount = await prisma.department.count({ where: { isActive: true } });

    if (existingCatCount > 0 && existingDeptCount > 0) {
      return { seeded: false, departments: existingDeptCount, categories: existingCatCount };
    }

    // 1. Seed or update departments
    const deptMap = new Map<string, string>();
    for (const d of BASELINE_DEPARTMENTS) {
      const dept = await prisma.department.upsert({
        where: { code: d.code },
        update: {
          name: d.name,
          description: d.description,
          isActive: true,
        },
        create: {
          code: d.code,
          name: d.name,
          description: d.description,
          isActive: true,
        },
      });
      deptMap.set(d.code, dept.id);
    }

    // 2. Seed or update categories
    let seededCategories = 0;
    for (const c of BASELINE_CATEGORIES) {
      const departmentId = deptMap.get(c.departmentCode);
      if (!departmentId) {
        console.warn(`[Civora Metadata Bootstrap] Missing departmentId for code ${c.departmentCode}`);
        continue;
      }

      await prisma.complaintCategory.upsert({
        where: { code: c.code },
        update: {
          name: c.name,
          description: c.description,
          departmentId,
          isActive: true,
        },
        create: {
          code: c.code,
          name: c.name,
          description: c.description,
          departmentId,
          isActive: true,
        },
      });
      seededCategories++;
    }

    console.log(
      `[Civora Metadata Bootstrap] Baseline metadata ensured: ${deptMap.size} departments, ${seededCategories} categories.`
    );

    return {
      seeded: true,
      departments: deptMap.size,
      categories: seededCategories,
    };
  } catch (err: any) {
    if (err?.message?.includes('42P05') || err?.message?.includes('prepared statement')) {
      console.error(
        '[Civora Metadata Bootstrap Critical] PostgreSQL 42P05 detected: Prepared statement collision on connection pooler. Ensure pgbouncer=true is present in DATABASE_URL.'
      );
    }
    console.error('[Civora Metadata Bootstrap] Failed to ensure baseline metadata:', err);
    throw err;
  }
}

/**
 * Ensures baseline municipal departments and complaint categories are present in the database.
 * Idempotent & Concurrency-Safe: Multiple concurrent callers await the same in-flight operation.
 */
export async function ensureBaselineMetadata(): Promise<{ seeded: boolean; departments: number; categories: number }> {
  if (inFlightBootstrap) {
    return inFlightBootstrap;
  }

  inFlightBootstrap = executeBootstrap().finally(() => {
    inFlightBootstrap = null;
  });

  return inFlightBootstrap;
}
