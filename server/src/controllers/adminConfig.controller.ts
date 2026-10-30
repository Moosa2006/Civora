import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import {
  PLATFORM_SETTING_DEFINITIONS,
  getAllSettingsMap,
  updatePlatformSetting,
} from '../lib/configService.js';

export async function getAdminConfig(_req: Request, res: Response) {
  try {
    const settingsMap = await getAllSettingsMap();
    const settingsList = Object.values(PLATFORM_SETTING_DEFINITIONS).map((def) => ({
      key: def.key,
      category: def.category,
      value: settingsMap[def.key] ?? def.defaultValue,
      defaultValue: def.defaultValue,
      description: def.description,
      isPublic: def.isPublic,
    }));

    return res.json({
      success: true,
      data: {
        settings: settingsList,
      },
    });
  } catch (err: unknown) {
    console.error('[Admin Config Error]:', err);
    return res.status(500).json({
      success: false,
      error: {
        code: 'CONFIG_FETCH_FAILED',
        message: 'Failed to retrieve platform configuration settings.',
      },
    });
  }
}

export async function updateAdminConfig(req: Request, res: Response) {
  try {
    const key = req.params.key as string;
    const { value, reason } = req.body;

    if (typeof value !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_VALUE',
          message: 'Configuration value must be provided as a string.',
        },
      });
    }

    const actorId = req.user?.id;
    const ipAddress = req.ip || '127.0.0.1';
    const userAgent = (req.get('user-agent') as string) || undefined;

    const result = await updatePlatformSetting(
      key,
      value,
      typeof reason === 'string' ? reason : undefined,
      actorId,
      ipAddress,
      userAgent
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CONFIG_VALIDATION_ERROR',
          message: result.error || 'Failed to update configuration setting.',
        },
      });
    }

    return res.json({
      success: true,
      message: `Setting '${key}' updated successfully.`,
      data: result.setting,
    });
  } catch (err: unknown) {
    console.error('[Admin Config Update Error]:', err);
    return res.status(500).json({
      success: false,
      error: {
        code: 'CONFIG_UPDATE_FAILED',
        message: 'An error occurred while updating platform configuration.',
      },
    });
  }
}

export async function getAdminConfigHistory(_req: Request, res: Response) {
  try {
    const history = await prisma.configurationChangeLog.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: {
        changedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return res.json({
      success: true,
      data: {
        history: history.map((h) => ({
          id: h.id,
          key: h.key,
          previousValue: h.previousValue,
          newValue: h.newValue,
          reason: h.reason,
          createdAt: h.createdAt.toISOString(),
          changedBy: h.changedBy
            ? {
                id: h.changedBy.id,
                name: h.changedBy.name,
                email: h.changedBy.email,
                role: h.changedBy.role,
              }
            : null,
        })),
      },
    });
  } catch (err: unknown) {
    console.error('[Admin Config History Error]:', err);
    return res.status(500).json({
      success: false,
      error: {
        code: 'HISTORY_FETCH_FAILED',
        message: 'Failed to retrieve configuration change history.',
      },
    });
  }
}
