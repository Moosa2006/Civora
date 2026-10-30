import { prisma } from './prisma.js';

export interface SettingDefinition {
  key: string;
  category: 'GENERAL' | 'MAINTENANCE' | 'WORKFLOW' | 'SECURITY';
  defaultValue: string;
  description: string;
  isPublic: boolean;
  validate: (val: string) => { valid: boolean; error?: string };
}

export const PLATFORM_SETTING_DEFINITIONS: Record<string, SettingDefinition> = {
  platform_name: {
    key: 'platform_name',
    category: 'GENERAL',
    defaultValue: 'Civora Civic Accountability Platform',
    description: 'Public name of the civic grievance and transparency portal',
    isPublic: true,
    validate: (val: string) => {
      const trimmed = val.trim();
      if (trimmed.length < 2 || trimmed.length > 100) {
        return { valid: false, error: 'Platform name must be between 2 and 100 characters.' };
      }
      return { valid: true };
    },
  },
  support_email: {
    key: 'support_email',
    category: 'GENERAL',
    defaultValue: 'support@civora.gov.in',
    description: 'Official municipal support contact email address displayed to citizens',
    isPublic: true,
    validate: (val: string) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(val.trim())) {
        return { valid: false, error: 'Must be a valid email address.' };
      }
      return { valid: true };
    },
  },
  maintenance_mode: {
    key: 'maintenance_mode',
    category: 'MAINTENANCE',
    defaultValue: 'false',
    description: 'When enabled, write operations for non-administrators are suspended with a 503 notice',
    isPublic: true,
    validate: (val: string) => {
      const lower = val.trim().toLowerCase();
      if (lower !== 'true' && lower !== 'false') {
        return { valid: false, error: 'Maintenance mode must be "true" or "false".' };
      }
      return { valid: true };
    },
  },
  maintenance_message: {
    key: 'maintenance_message',
    category: 'MAINTENANCE',
    defaultValue: 'Civora is currently undergoing scheduled platform maintenance. Write operations are temporarily suspended. Please try again shortly.',
    description: 'Notice displayed to citizens during platform maintenance windows',
    isPublic: true,
    validate: (val: string) => {
      const trimmed = val.trim();
      if (trimmed.length < 5 || trimmed.length > 500) {
        return { valid: false, error: 'Maintenance notice must be between 5 and 500 characters.' };
      }
      return { valid: true };
    },
  },
  allowed_languages: {
    key: 'allowed_languages',
    category: 'GENERAL',
    defaultValue: 'en,hi,pa',
    description: 'Comma-separated ISO language codes enabled across the application (e.g. en,hi,pa)',
    isPublic: true,
    validate: (val: string) => {
      const codes = val.split(',').map((c) => c.trim().toLowerCase());
      if (codes.length === 0 || codes.some((c) => !/^[a-z]{2,5}$/.test(c))) {
        return { valid: false, error: 'Allowed languages must be comma-separated 2-letter codes.' };
      }
      return { valid: true };
    },
  },
  max_evidence_files_per_complaint: {
    key: 'max_evidence_files_per_complaint',
    category: 'WORKFLOW',
    defaultValue: '5',
    description: 'Maximum supporting evidence documents permitted per complaint lodging',
    isPublic: false,
    validate: (val: string) => {
      const num = parseInt(val, 10);
      if (isNaN(num) || num < 1 || num > 20) {
        return { valid: false, error: 'Must be an integer between 1 and 20.' };
      }
      return { valid: true };
    },
  },
  evidence_file_size_limit_mb: {
    key: 'evidence_file_size_limit_mb',
    category: 'WORKFLOW',
    defaultValue: '10',
    description: 'Maximum upload file size allowed per document in Megabytes',
    isPublic: false,
    validate: (val: string) => {
      const num = parseInt(val, 10);
      if (isNaN(num) || num < 1 || num > 50) {
        return { valid: false, error: 'Must be an integer between 1 and 50 MB.' };
      }
      return { valid: true };
    },
  },
  sla_warning_threshold_hours: {
    key: 'sla_warning_threshold_hours',
    category: 'WORKFLOW',
    defaultValue: '24',
    description: 'Hours before SLA deadline to trigger warning notification to officials',
    isPublic: false,
    validate: (val: string) => {
      const num = parseInt(val, 10);
      if (isNaN(num) || num < 1 || num > 168) {
        return { valid: false, error: 'Must be an integer between 1 and 168 hours (7 days).' };
      }
      return { valid: true };
    },
  },
  public_registration_enabled: {
    key: 'public_registration_enabled',
    category: 'SECURITY',
    defaultValue: 'true',
    description: 'Whether new citizen public registrations are actively accepted',
    isPublic: true,
    validate: (val: string) => {
      const lower = val.trim().toLowerCase();
      if (lower !== 'true' && lower !== 'false') {
        return { valid: false, error: 'Must be "true" or "false".' };
      }
      return { valid: true };
    },
  },
  audit_export_max_rows: {
    key: 'audit_export_max_rows',
    category: 'SECURITY',
    defaultValue: '1000',
    description: 'Maximum rows returned in a single administrative CSV audit export',
    isPublic: false,
    validate: (val: string) => {
      const num = parseInt(val, 10);
      if (isNaN(num) || num < 50 || num > 5000) {
        return { valid: false, error: 'Must be an integer between 50 and 5000.' };
      }
      return { valid: true };
    },
  },
};

// In-memory cache with 15-second TTL
let settingsCache: Record<string, string> | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 15000;

export async function initializeDefaultSettings(): Promise<void> {
  for (const def of Object.values(PLATFORM_SETTING_DEFINITIONS)) {
    await prisma.platformSetting.upsert({
      where: { key: def.key },
      update: {},
      create: {
        key: def.key,
        value: def.defaultValue,
        category: def.category,
        description: def.description,
        isPublic: def.isPublic,
      },
    });
  }
}

export async function getAllSettingsMap(): Promise<Record<string, string>> {
  const now = Date.now();
  if (settingsCache && now - lastCacheTime < CACHE_TTL_MS) {
    return settingsCache;
  }

  const settings = await prisma.platformSetting.findMany();
  const map: Record<string, string> = {};

  // Populate from database, fallback to code definitions
  for (const def of Object.values(PLATFORM_SETTING_DEFINITIONS)) {
    map[def.key] = def.defaultValue;
  }
  for (const s of settings) {
    map[s.key] = s.value;
  }

  settingsCache = map;
  lastCacheTime = now;
  return map;
}

export async function getSettingValue(key: string): Promise<string> {
  const map = await getAllSettingsMap();
  if (key in map) return map[key];
  const def = PLATFORM_SETTING_DEFINITIONS[key];
  return def ? def.defaultValue : '';
}

export async function isMaintenanceModeActive(): Promise<boolean> {
  const val = await getSettingValue('maintenance_mode');
  return val.trim().toLowerCase() === 'true';
}

export async function getMaintenanceMessage(): Promise<string> {
  return await getSettingValue('maintenance_message');
}

export async function updatePlatformSetting(
  key: string,
  value: string,
  reason: string | undefined,
  actorId: string | undefined,
  ipAddress?: string,
  userAgent?: string
): Promise<{ success: boolean; setting: unknown; error?: string }> {
  const def = PLATFORM_SETTING_DEFINITIONS[key];
  if (!def) {
    return {
      success: false,
      setting: null,
      error: `Configuration key '${key}' is not a recognized platform setting.`,
    };
  }

  const validation = def.validate(value);
  if (!validation.valid) {
    return {
      success: false,
      setting: null,
      error: validation.error || 'Invalid configuration value.',
    };
  }

  // Fetch current setting
  const existing = await prisma.platformSetting.findUnique({
    where: { key },
  });

  const previousValue = existing ? existing.value : def.defaultValue;

  // Update in database within transaction
  const updated = await prisma.$transaction(async (tx) => {
    const s = await tx.platformSetting.upsert({
      where: { key },
      update: {
        value,
        updatedById: actorId,
      },
      create: {
        key,
        value,
        category: def.category,
        description: def.description,
        isPublic: def.isPublic,
        updatedById: actorId,
      },
    });

    // Record change log
    await tx.configurationChangeLog.create({
      data: {
        settingId: s.id,
        key,
        previousValue,
        newValue: value,
        reason: reason || 'Updated via Administrative Settings Console',
        changedById: actorId,
      },
    });

    // Record AuditEvent
    await tx.auditEvent.create({
      data: {
        action: 'UPDATE_PLATFORM_SETTING',
        entityType: 'PLATFORM_SETTING',
        entityId: s.id,
        actorId,
        ipAddress: ipAddress || '127.0.0.1',
        userAgent: userAgent || 'CivoraAdminConsole',
        details: {
          key,
          previousValue,
          newValue: value,
          reason,
        },
      },
    });

    return s;
  });

  // Invalidate cache immediately
  settingsCache = null;
  lastCacheTime = 0;

  return { success: true, setting: updated };
}
