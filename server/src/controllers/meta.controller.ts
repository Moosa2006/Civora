import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';

export async function getDepartments(_req: Request, res: Response, next: NextFunction) {
  try {
    const departments = await prisma.department.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
      },
      orderBy: { name: 'asc' },
    });

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
    const categories = await prisma.complaintCategory.findMany({
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
