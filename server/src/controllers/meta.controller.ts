import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { ensureBaselineMetadata } from '../lib/metadataBootstrap.js';

export async function getDepartments(_req: Request, res: Response, next: NextFunction) {
  try {
    let departments = await prisma.department.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
      },
      orderBy: { name: 'asc' },
    });

    // Self-healing: If database has no active departments yet, auto-seed baseline departments
    if (departments.length === 0) {
      try {
        await ensureBaselineMetadata();
        departments = await prisma.department.findMany({
          where: { isActive: true },
          select: {
            id: true,
            code: true,
            name: true,
            description: true,
          },
          orderBy: { name: 'asc' },
        });
      } catch (seedErr) {
        console.error('[Meta Controller] Auto-seeding departments failed:', seedErr);
        return next(seedErr);
      }
    }

    return res.status(200).json({
      success: true,
      data: departments,
    });
  } catch (err) {
    return next(err);
  }
}

export async function getCategories(_req: Request, res: Response, next: NextFunction) {
  try {
    let categories = await prisma.complaintCategory.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        department: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Self-healing: If database has no active categories yet, auto-seed baseline metadata
    if (categories.length === 0) {
      try {
        await ensureBaselineMetadata();
        categories = await prisma.complaintCategory.findMany({
          where: { isActive: true },
          select: {
            id: true,
            code: true,
            name: true,
            description: true,
            department: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
          orderBy: { name: 'asc' },
        });
      } catch (seedErr) {
        console.error('[Meta Controller] Auto-seeding categories failed:', seedErr);
        return next(seedErr);
      }
    }

    return res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (err) {
    return next(err);
  }
}

export async function getSystemStats(_req: Request, res: Response, next: NextFunction) {
  try {
    const [departmentCount, categoryCount, complaintCount, civicWorkCount] =
      await Promise.all([
        prisma.department.count({ where: { isActive: true } }),
        prisma.complaintCategory.count({ where: { isActive: true } }),
        prisma.complaint.count(),
        prisma.civicWork.count(),
      ]);

    return res.status(200).json({
      success: true,
      data: {
        activeDepartments: departmentCount,
        activeCategories: categoryCount,
        totalComplaintsLogged: complaintCount,
        activeCivicWorks: civicWorkCount,
      },
    });
  } catch (err) {
    return next(err);
  }
}
