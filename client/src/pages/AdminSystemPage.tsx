import { useState, useEffect, useCallback } from 'react';
import { Container } from '../components/layout/Container';
import { PageHeading } from '../components/ui/PageHeading';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Alert } from '../components/ui/Alert';
import { LoadingIndicator } from '../components/ui/LoadingIndicator';
import { MetricCard } from '../components/ui/MetricCard';
import { TextInput } from '../components/ui/TextInput';
import { TextArea } from '../components/ui/TextArea';
import { Select } from '../components/ui/Select';
import { EmptyState } from '../components/ui/EmptyState';
import {
  ShieldCheckIcon,
  RefreshCwIcon,
  ClockIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  InfoIcon,
  SettingsIcon,
  UsersIcon,
  ActivityIcon,
  ServerIcon,
  DownloadIcon,
  SearchIcon,
  PlusIcon,
  EyeIcon,
} from '../components/ui/icons';
import { useAuth } from '../context/useAuth';
import { useRouter } from '../router';
import { useTranslation } from '../context/useTranslation';

// Type definitions matching backend models
interface PublicHealthData {
  status: string;
  service: string;
  version: string;
  timestamp: string;
  data: {
    api: string;
    database: string;
    latencyMs: number | null;
  };
}

interface ReadinessData {
  status: string;
  timestamp: string;
  checks: {
    database: { status: string; latencyMs: number | null };
    memory: { status: string; heapUsedMb: number };
  };
}

interface AdminDiagnosticsData {
  service: string;
  version: string;
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
  nodeVersion: string;
  platform: string;
  memory: {
    rssMb: number;
    heapTotalMb: number;
    heapUsedMb: number;
  };
  database: {
    status: string;
    latencyMs: number | null;
  };
  metrics: {
    complaintsCount: number;
    usersCount: number;
    departmentsCount: number;
    slaPoliciesCount: number;
    activeEscalationsCount: number;
    openIncidentsCount: number;
  };
}

interface DashboardOverviewData {
  metrics: {
    totalUsers: number;
    activeUsers: number;
    usersByRole: {
      CITIZEN: number;
      OFFICIAL: number;
      ADMIN: number;
      CONTRACTOR: number;
    };
    totalComplaints: number;
    complaintsAwaitingAction: number;
    complaintsInProgress: number;
    complaintsResolved: number;
    complaintsRejected: number;
    complaintsOverdue: number;
    openIncidents: number;
    recentAuditActionsCount: number;
  };
  recentAuditEvents: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    createdAt: string;
    actor: { id: string; name: string; email: string } | null;
  }>;
  recentIncidents: Array<{
    id: string;
    incidentNumber: string;
    title: string;
    severity: string;
    status: string;
    createdAt: string;
  }>;
}

interface PlatformSettingItem {
  key: string;
  value: string;
  category: 'GENERAL' | 'MAINTENANCE' | 'WORKFLOW' | 'SECURITY';
  description: string;
  isPublic: boolean;
  updatedAt: string;
  updatedBy: { id: string; name: string; email: string } | null;
}

interface ConfigHistoryItem {
  id: string;
  key: string;
  previousValue: string;
  newValue: string;
  reason: string | null;
  createdAt: string;
  changedBy: { id: string; name: string; email: string };
}

interface AdminUserItem {
  id: string;
  name: string;
  email: string;
  role: 'CITIZEN' | 'GOVERNMENT_OFFICIAL' | 'ADMIN' | 'CONTRACTOR';
  status: 'ACTIVE' | 'SUSPENDED';
  isVerified: boolean;
  departmentId?: string | null;
  department?: {
    id: string;
    code: string;
    name: string;
  } | null;
  createdAt: string;
  lastLoginAt: string | null;
  _count: {
    complaints: number;
    auditEvents: number;
  };
}

interface ContractorApplicationItem {
  id: string;
  name: string;
  registrationNumber: string | null;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'BLACKLISTED';
  businessAddress: string | null;
  operatingRegion: string | null;
  licenseClass: string | null;
  panOrTaxId: string | null;
  workCategories: string[];
  isVerified: boolean;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  verifiedBy: {
    id: string;
    name: string;
    email: string;
  } | null;
  users: Array<{
    id: string;
    name: string;
    email: string;
    phone: string | null;
    role: string;
    accountStatus: string;
    createdAt: string;
  }>;
}

interface AuditLogItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorId: string | null;
  createdAt: string;
  details: Record<string, unknown>;
  actor: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
}

interface OperationalIncidentItem {
  id: string;
  incidentNumber: string;
  title: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  subsystem: string;
  status: 'OPEN' | 'INVESTIGATING' | 'MONITORING' | 'RESOLVED';
  resolutionNotes: string | null;
  createdAt: string;
  resolvedAt: string | null;
  reportedBy: { id: string; name: string; email: string };
  resolvedBy: { id: string; name: string; email: string } | null;
}

type TabType = 'overview' | 'config' | 'users' | 'contractors' | 'health' | 'audit' | 'incidents' | 'reports';

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

export function AdminSystemPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { navigate } = useRouter();
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [evaluatingSla, setEvaluatingSla] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Platform departments for official assignment
  const [departments, setDepartments] = useState<Array<{ id: string; code: string; name: string }>>([]);

  // Core telemetry state
  const [health, setHealth] = useState<PublicHealthData | null>(null);
  const [readiness, setReadiness] = useState<ReadinessData | null>(null);
  const [diagnostics, setDiagnostics] = useState<AdminDiagnosticsData | null>(null);
  const [overview, setOverview] = useState<DashboardOverviewData | null>(null);

  // Configuration state
  const [settings, setSettings] = useState<PlatformSettingItem[]>([]);
  const [configHistory, setConfigHistory] = useState<ConfigHistoryItem[]>([]);
  const [editingSetting, setEditingSetting] = useState<PlatformSettingItem | null>(null);
  const [editSettingValue, setEditSettingValue] = useState('');
  const [editSettingReason, setEditSettingReason] = useState('');
  const [savingSetting, setSavingSetting] = useState(false);
  const [syncingSchema, setSyncingSchema] = useState(false);

  // Maintenance confirmation modal
  const [maintenanceModalOpen, setMaintenanceModalOpen] = useState(false);
  const [maintenanceTargetValue, setMaintenanceTargetValue] = useState<boolean>(false);
  const [maintenanceReason, setMaintenanceReason] = useState('');

  // Users state
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [userPage, setUserPage] = useState(1);
  const [userTotalPages, setUserTotalPages] = useState(1);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('ALL');
  const [userStatusFilter, setUserStatusFilter] = useState('ALL');
  const [selectedUserForRole, setSelectedUserForRole] = useState<AdminUserItem | null>(null);
  const [selectedUserForStatus, setSelectedUserForStatus] = useState<AdminUserItem | null>(null);
  const [newUserRole, setNewUserRole] = useState<'CITIZEN' | 'GOVERNMENT_OFFICIAL' | 'ADMIN' | 'CONTRACTOR'>('CITIZEN');
  const [newDepartmentId, setNewDepartmentId] = useState('');
  const [roleChangeReason, setRoleChangeReason] = useState('');
  const [statusChangeReason, setStatusChangeReason] = useState('');
  const [actionInProgress, setActionInProgress] = useState(false);

  // Create Official Modal State
  const [createOfficialModalOpen, setCreateOfficialModalOpen] = useState(false);
  const [newOfficialName, setNewOfficialName] = useState('');
  const [newOfficialEmail, setNewOfficialEmail] = useState('');
  const [newOfficialPhone, setNewOfficialPhone] = useState('');
  const [newOfficialDepartmentId, setNewOfficialDepartmentId] = useState('');
  const [newOfficialPassword, setNewOfficialPassword] = useState('');
  const [newOfficialShowPassword, setNewOfficialShowPassword] = useState(false);
  const [creatingOfficial, setCreatingOfficial] = useState(false);

  // Contractor Applications State
  const [contractorApps, setContractorApps] = useState<ContractorApplicationItem[]>([]);
  const [contractorAppPage, setContractorAppPage] = useState(1);
  const [contractorAppTotalPages, setContractorAppTotalPages] = useState(1);
  const [contractorAppStatusFilter, setContractorAppStatusFilter] = useState('ALL');
  const [contractorAppSearch, setContractorAppSearch] = useState('');
  const [loadingContractors, setLoadingContractors] = useState(false);
  const [selectedContractorForApprove, setSelectedContractorForApprove] = useState<ContractorApplicationItem | null>(null);
  const [approveNotes, setApproveNotes] = useState('');
  const [approvingContractor, setApprovingContractor] = useState(false);
  const [selectedContractorForReject, setSelectedContractorForReject] = useState<ContractorApplicationItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingContractor, setRejectingContractor] = useState(false);


  // Audit state
  const [auditEvents, setAuditEvents] = useState<AuditLogItem[]>([]);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [auditActionFilter, setAuditActionFilter] = useState('ALL');
  const [auditSearch, setAuditSearch] = useState('');
  const [inspectAuditItem, setInspectAuditItem] = useState<AuditLogItem | null>(null);

  // Incidents state
  const [incidents, setIncidents] = useState<OperationalIncidentItem[]>([]);
  const [incidentSeverityFilter, setIncidentSeverityFilter] = useState('ALL');
  const [incidentStatusFilter, setIncidentStatusFilter] = useState('ALL');
  const [createIncidentModalOpen, setCreateIncidentModalOpen] = useState(false);
  const [incidentTitle, setIncidentTitle] = useState('');
  const [incidentDesc, setIncidentDesc] = useState('');
  const [incidentSeverity, setIncidentSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [incidentSubsystem, setIncidentSubsystem] = useState('Core Platform');
  const [savingIncident, setSavingIncident] = useState(false);
  const [selectedIncidentForUpdate, setSelectedIncidentForUpdate] = useState<OperationalIncidentItem | null>(null);
  const [updateIncidentStatus, setUpdateIncidentStatus] = useState<'OPEN' | 'INVESTIGATING' | 'MONITORING' | 'RESOLVED'>('INVESTIGATING');
  const [incidentResolutionNotes, setIncidentResolutionNotes] = useState('');

  // Export progress
  const [exportingReport, setExportingReport] = useState<string | null>(null);

  // Helper to attach authorization headers for cross-device & cross-origin compatibility
  const getAuthHeaders = useCallback((extra: Record<string, string> = {}) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('civora_token') : null;
    const headers: Record<string, string> = { ...extra };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }, []);

  // Initial Fetcher
  const fetchDashboardData = useCallback(async () => {
    try {
      setErrorMsg(null);
      const [healthRes, readyRes, diagRes, overviewRes] = await Promise.all([
        fetch('/api/health'),
        fetch('/api/health/ready'),
        fetch('/api/health/diagnostics', {
          headers: getAuthHeaders({ Accept: 'application/json' }),
          credentials: 'include',
        }),
        fetch('/api/admin/dashboard/overview', {
          headers: getAuthHeaders({ Accept: 'application/json' }),
          credentials: 'include',
        }),
      ]);

      if (healthRes.ok) {
        setHealth(await healthRes.json());
      }
      if (readyRes.ok) {
        setReadiness(await readyRes.json());
      }
      if (diagRes.ok) {
        const diagData = await diagRes.json();
        if (diagData.success) setDiagnostics(diagData.data);
      }
      if (overviewRes.ok) {
        const ovData = await overviewRes.json();
        if (ovData.success && ovData.data) {
          const raw = ovData.data || {};
          const rawMetrics = raw.metrics || {};
          const rawUsers = raw.users || {};
          const rawComplaints = raw.complaints || {};
          const rawIncidents = raw.incidents || {};
          const normalized: DashboardOverviewData = {
            ...raw,
            metrics: {
              totalUsers: Number(rawMetrics.totalUsers ?? rawUsers.total ?? 0),
              activeUsers: Number(rawMetrics.activeUsers ?? rawUsers.active ?? 0),
              usersByRole: {
                CITIZEN: Number(rawMetrics.usersByRole?.CITIZEN ?? rawUsers.citizens ?? 0),
                OFFICIAL: Number(rawMetrics.usersByRole?.OFFICIAL ?? rawUsers.officials ?? 0),
                ADMIN: Number(rawMetrics.usersByRole?.ADMIN ?? rawUsers.admins ?? 0),
                CONTRACTOR: Number(rawMetrics.usersByRole?.CONTRACTOR ?? rawUsers.contractors ?? 0),
              },
              totalComplaints: Number(rawMetrics.totalComplaints ?? rawComplaints.total ?? 0),
              complaintsAwaitingAction: Number(rawMetrics.complaintsAwaitingAction ?? rawComplaints.awaitingAction ?? 0),
              complaintsInProgress: Number(rawMetrics.complaintsInProgress ?? rawComplaints.activeBacklog ?? 0),
              complaintsResolved: Number(rawMetrics.complaintsResolved ?? rawComplaints.resolved ?? 0),
              complaintsRejected: Number(rawMetrics.complaintsRejected ?? rawComplaints.rejected ?? 0),
              complaintsOverdue: Number(rawMetrics.complaintsOverdue ?? rawComplaints.overdue ?? 0),
              openIncidents: Number(rawMetrics.openIncidents ?? rawIncidents.openCount ?? 0),
              recentAuditActionsCount: Number(rawMetrics.recentAuditActionsCount ?? (Array.isArray(raw.recentAuditEvents) ? raw.recentAuditEvents.length : 0)),
            },
            recentAuditEvents: Array.isArray(raw.recentAuditEvents) ? raw.recentAuditEvents : [],
            recentIncidents: Array.isArray(raw.recentIncidents) ? raw.recentIncidents : [],
          };
          setOverview(normalized);
        }
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to query diagnostics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getAuthHeaders]);

  // Fetch Config
  const fetchConfig = useCallback(async () => {
    try {
      const [cfgRes, histRes] = await Promise.all([
        fetch('/api/admin/config', {
          headers: getAuthHeaders({ Accept: 'application/json' }),
          credentials: 'include',
        }),
        fetch('/api/admin/config/history', {
          headers: getAuthHeaders({ Accept: 'application/json' }),
          credentials: 'include',
        }),
      ]);
      if (cfgRes.ok) {
        const cfgData = await cfgRes.json();
        if (cfgData.success) setSettings(cfgData.data.settings);
      }
      if (histRes.ok) {
        const histData = await histRes.json();
        if (histData.success) setConfigHistory(histData.data.history);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load configuration');
    }
  }, [getAuthHeaders]);

  // Fetch Users
  const fetchUsers = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: userPage.toString(),
        limit: '15',
      });
      if (userSearch.trim()) params.append('search', userSearch.trim());
      if (userRoleFilter !== 'ALL') params.append('role', userRoleFilter);
      if (userStatusFilter !== 'ALL') params.append('status', userStatusFilter);

      const res = await fetch(`/api/admin/users?${params.toString()}`, {
        headers: getAuthHeaders({ Accept: 'application/json' }),
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setUsers(data.data.users);
          setUserTotalPages(data.data.pagination.pages || 1);
        }
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load users');
    }
  }, [userPage, userSearch, userRoleFilter, userStatusFilter, getAuthHeaders]);

  // Fetch Audit Logs
  const fetchAuditLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: auditPage.toString(),
        limit: '20',
      });
      if (auditActionFilter !== 'ALL') params.append('action', auditActionFilter);
      if (auditSearch.trim()) params.append('search', auditSearch.trim());

      const res = await fetch(`/api/admin/audit?${params.toString()}`, {
        headers: getAuthHeaders({ Accept: 'application/json' }),
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setAuditEvents(data.data.events);
          setAuditTotalPages(data.data.pagination.pages || 1);
        }
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load audit logs');
    }
  }, [auditPage, auditActionFilter, auditSearch, getAuthHeaders]);

  // Fetch Incidents
  const fetchIncidents = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (incidentSeverityFilter !== 'ALL') params.append('severity', incidentSeverityFilter);
      if (incidentStatusFilter !== 'ALL') params.append('status', incidentStatusFilter);

      const res = await fetch(`/api/admin/incidents?${params.toString()}`, {
        headers: getAuthHeaders({ Accept: 'application/json' }),
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setIncidents(data.data.incidents);
        }
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load operational incidents');
    }
  }, [incidentSeverityFilter, incidentStatusFilter, getAuthHeaders]);

  // Fetch Departments
  const fetchDepartments = useCallback(async () => {
    try {
      const res = await fetch('/api/meta/departments', {
        headers: getAuthHeaders({ Accept: 'application/json' }),
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setDepartments(json.data);
        }
      }
    } catch {
      // Non-blocking
    }
  }, [getAuthHeaders]);

  // Fetch Contractor Applications
  const fetchContractorApps = useCallback(async () => {
    setLoadingContractors(true);
    try {
      const params = new URLSearchParams({
        page: contractorAppPage.toString(),
        limit: '15',
      });
      if (contractorAppStatusFilter !== 'ALL') params.append('status', contractorAppStatusFilter);
      if (contractorAppSearch.trim()) params.append('q', contractorAppSearch.trim());

      const res = await fetch(`/api/admin/contractor-applications?${params.toString()}`, {
        headers: getAuthHeaders({ Accept: 'application/json' }),
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setContractorApps(json.data.applications);
          setContractorAppTotalPages(json.data.pagination.totalPages || 1);
        }
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load contractor applications');
    } finally {
      setLoadingContractors(false);
    }
  }, [contractorAppPage, contractorAppStatusFilter, contractorAppSearch, getAuthHeaders]);

  // Initial load
  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated || user?.role !== 'ADMIN') {
        setLoading(false);
        return;
      }
      fetchDashboardData();
      fetchDepartments();
    }
  }, [authLoading, isAuthenticated, user, fetchDashboardData, fetchDepartments]);

  // Tab change handlers
  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'ADMIN') return;
    if (activeTab === 'config') fetchConfig();
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'contractors') fetchContractorApps();
    if (activeTab === 'audit') fetchAuditLogs();
    if (activeTab === 'incidents') fetchIncidents();
  }, [activeTab, isAuthenticated, user, fetchConfig, fetchUsers, fetchContractorApps, fetchAuditLogs, fetchIncidents]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    await fetchDepartments();
    if (activeTab === 'config') await fetchConfig();
    if (activeTab === 'users') await fetchUsers();
    if (activeTab === 'contractors') await fetchContractorApps();
    if (activeTab === 'audit') await fetchAuditLogs();
    if (activeTab === 'incidents') await fetchIncidents();
  };

  const handleSyncSchema = async () => {
    setSyncingSchema(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/admin/system/sync-schema', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Database schema synchronization failed.');
      }
      setSuccessMsg(`Database schema successfully synchronized (${data.data.statementsExecuted} statements verified in ${data.data.durationMs}ms).`);
      handleRefresh();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Database schema synchronization failed.');
    } finally {
      setSyncingSchema(false);
    }
  };


  const handleTriggerSlaEvaluation = async () => {
    setEvaluatingSla(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/sla/evaluate-all', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
      setSuccessMsg(
        `SLA batch evaluation completed: ${data.data?.evaluatedCount ?? 0} complaints checked (${data.data?.updatedCount ?? 0} updated, ${data.data?.escalatedCount ?? 0} escalated).`
      );
      await fetchDashboardData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to execute SLA evaluation');
    } finally {
      setEvaluatingSla(false);
    }
  };

  // Setting edit submission
  const handleSaveSetting = async () => {
    if (!editingSetting) return;
    setSavingSetting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/admin/config/${encodeURIComponent(editingSetting.key)}`, {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({
          value: editSettingValue,
          reason: editSettingReason.trim() || 'Admin manual update',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || `Failed to update ${editingSetting.key}`);
      }
      setSuccessMsg(`Setting '${editingSetting.key}' successfully updated.`);
      setEditingSetting(null);
      await fetchConfig();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update setting');
    } finally {
      setSavingSetting(false);
    }
  };

  // Maintenance mode confirmation submit
  const handleConfirmMaintenanceMode = async () => {
    setSavingSetting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/admin/config/maintenance_mode_enabled', {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({
          value: maintenanceTargetValue ? 'true' : 'false',
          reason: maintenanceReason.trim() || (maintenanceTargetValue ? 'Enabling maintenance window' : 'Disabling maintenance window'),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to update maintenance mode');
      }
      setSuccessMsg(
        maintenanceTargetValue
          ? 'Platform Maintenance Mode is now ACTIVE. Non-admin write operations are suspended.'
          : 'Platform Maintenance Mode is now INACTIVE. Standard citizen and official operations restored.'
      );
      setMaintenanceModalOpen(false);
      setMaintenanceReason('');
      await fetchConfig();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update maintenance mode');
    } finally {
      setSavingSetting(false);
    }
  };

  // Role update submit
  const handleUpdateRole = async () => {
    if (!selectedUserForRole) return;
    setActionInProgress(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/admin/users/${selectedUserForRole.id}/role`, {
        method: 'PATCH',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({
          role: newUserRole,
          departmentId: newUserRole === 'GOVERNMENT_OFFICIAL' ? newDepartmentId || undefined : undefined,
          reason: roleChangeReason.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Role change failed');
      }
      setSuccessMsg(`User ${selectedUserForRole.name}'s role changed to ${newUserRole}.`);
      setSelectedUserForRole(null);
      setRoleChangeReason('');
      setNewDepartmentId('');
      await fetchUsers();
      await fetchDashboardData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setActionInProgress(false);
    }
  };

  // Contractor Application Actions
  const handleApproveContractor = async () => {
    if (!selectedContractorForApprove) return;
    setApprovingContractor(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/admin/contractors/${selectedContractorForApprove.id}/approve`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ notes: approveNotes.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to approve contractor');
      }
      setSuccessMsg(`Contractor '${selectedContractorForApprove.name}' approved successfully.`);
      setSelectedContractorForApprove(null);
      setApproveNotes('');
      await fetchContractorApps();
      await fetchDashboardData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Contractor approval failed');
    } finally {
      setApprovingContractor(false);
    }
  };

  const handleRejectContractor = async () => {
    if (!selectedContractorForReject) return;
    if (!rejectReason.trim() || rejectReason.trim().length < 5) {
      setErrorMsg('A rejection reason of at least 5 characters is required.');
      return;
    }
    setRejectingContractor(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/admin/contractors/${selectedContractorForReject.id}/reject`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to reject contractor');
      }
      setSuccessMsg(`Contractor '${selectedContractorForReject.name}' application rejected.`);
      setSelectedContractorForReject(null);
      setRejectReason('');
      await fetchContractorApps();
      await fetchDashboardData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Contractor rejection failed');
    } finally {
      setRejectingContractor(false);
    }
  };

  // Create Official Submit
  const handleCreateOfficial = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newOfficialName.trim() || !newOfficialEmail.trim() || !newOfficialPassword || !newOfficialDepartmentId) {
      setErrorMsg('Name, email, password, and department assignment are required to onboard an official.');
      return;
    }
    setCreatingOfficial(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/admin/officials', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({
          name: newOfficialName.trim(),
          email: newOfficialEmail.trim().toLowerCase(),
          password: newOfficialPassword,
          departmentId: newOfficialDepartmentId,
          phone: newOfficialPhone.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to onboard official');
      }
      setSuccessMsg(`Official '${data.data.user.name}' successfully onboarded and activated.`);
      setCreateOfficialModalOpen(false);
      setNewOfficialName('');
      setNewOfficialEmail('');
      setNewOfficialPassword('');
      setNewOfficialPhone('');
      setNewOfficialDepartmentId('');
      await fetchUsers();
      await fetchDashboardData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Official onboarding failed');
    } finally {
      setCreatingOfficial(false);
    }
  };


  // Status update submit
  const handleUpdateStatus = async () => {
    if (!selectedUserForStatus) return;
    if (!statusChangeReason.trim()) {
      setErrorMsg('A valid justification reason is required to change an account status.');
      return;
    }
    setActionInProgress(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    const newStatus = selectedUserForStatus.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      const res = await fetch(`/api/admin/users/${selectedUserForStatus.id}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({
          status: newStatus,
          reason: statusChangeReason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Status update failed');
      }
      setSuccessMsg(`User ${selectedUserForStatus.name} has been set to ${newStatus}.`);
      setSelectedUserForStatus(null);
      setStatusChangeReason('');
      await fetchUsers();
      await fetchDashboardData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to change user status');
    } finally {
      setActionInProgress(false);
    }
  };

  // Incident creation submit
  const handleCreateIncident = async () => {
    if (!incidentTitle.trim() || !incidentDesc.trim()) {
      setErrorMsg('Title and description are required for an operational incident.');
      return;
    }
    setSavingIncident(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/admin/incidents', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({
          title: incidentTitle.trim(),
          description: incidentDesc.trim(),
          severity: incidentSeverity,
          subsystem: incidentSubsystem.trim() || 'Core Platform',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to record incident');
      }
      setSuccessMsg(`Operational Incident ${data.data.incident.incidentNumber} created.`);
      setCreateIncidentModalOpen(false);
      setIncidentTitle('');
      setIncidentDesc('');
      await fetchIncidents();
      await fetchDashboardData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create incident');
    } finally {
      setSavingIncident(false);
    }
  };

  // Incident status update submit
  const handleUpdateIncidentStatus = async () => {
    if (!selectedIncidentForUpdate) return;
    if (updateIncidentStatus === 'RESOLVED' && !incidentResolutionNotes.trim()) {
      setErrorMsg('Resolution summary notes are mandatory when marking an incident as RESOLVED.');
      return;
    }
    setSavingIncident(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/admin/incidents/${selectedIncidentForUpdate.id}`, {
        method: 'PATCH',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({
          status: updateIncidentStatus,
          resolutionNotes: incidentResolutionNotes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to update incident');
      }
      setSuccessMsg(`Incident ${selectedIncidentForUpdate.incidentNumber} updated to ${updateIncidentStatus}.`);
      setSelectedIncidentForUpdate(null);
      setIncidentResolutionNotes('');
      await fetchIncidents();
      await fetchDashboardData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update incident');
    } finally {
      setSavingIncident(false);
    }
  };

  // CSV Report Exporter with Formula Injection Defense Check
  const handleExportCsv = async (endpoint: string, filename: string, label: string) => {
    setExportingReport(label);
    setErrorMsg(null);
    try {
      const res = await fetch(endpoint, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error?.message || `Export failed with HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
      setSuccessMsg(`Export '${filename}' generated and downloaded successfully.`);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExportingReport(null);
    }
  };

  if (authLoading || (loading && !health)) {
    return (
      <Container size="lg" className="py-12">
        <div className="flex flex-col items-center justify-center min-h-[350px]">
          <LoadingIndicator label="Initializing centralized administration console..." size="lg" />
        </div>
      </Container>
    );
  }

  if (!isAuthenticated || user?.role !== 'ADMIN') {
    return (
      <Container size="lg" className="py-12 space-y-6">
        <PageHeading
          title={t('adminSystem.title')}
          description={t('adminSystem.subtitle')}
        />
        <Alert variant="error" title="Access Restricted">
          Platform administration, operational health monitoring, configuration management, and audit logs are restricted exclusively to authorized platform Administrators.
        </Alert>
        <div>
          <Button variant="primary" onClick={() => navigate(isAuthenticated ? '/' : '/login')}>
            {isAuthenticated ? 'Return to Home' : 'Sign in as Administrator'}
          </Button>
        </div>
      </Container>
    );
  }

  const isDbConnected = health?.data?.database === 'connected';
  const isReady = readiness?.status === 'ready';
  const maintenanceModeSetting = settings.find((s) => s.key === 'maintenance_mode_enabled');
  const isMaintenanceActive = maintenanceModeSetting?.value === 'true';

  const tabButtons: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: t('adminSystem.tabOverview'), icon: <ActivityIcon className="w-4 h-4" /> },
    { id: 'config', label: t('adminSystem.tabConfig'), icon: <SettingsIcon className="w-4 h-4" /> },
    { id: 'users', label: t('adminSystem.tabUsers'), icon: <UsersIcon className="w-4 h-4" /> },
    { id: 'contractors', label: 'Contractor Apps', icon: <ShieldCheckIcon className="w-4 h-4 text-emerald-400" /> },
    { id: 'health', label: 'Operational Health', icon: <ServerIcon className="w-4 h-4" /> },
    { id: 'audit', label: t('adminSystem.tabAudit'), icon: <ShieldCheckIcon className="w-4 h-4" /> },
    { id: 'incidents', label: t('adminSystem.tabIncidents'), icon: <AlertTriangleIcon className="w-4 h-4" /> },
    { id: 'reports', label: t('adminSystem.tabReports'), icon: <DownloadIcon className="w-4 h-4" /> },
  ];


  return (
    <Container size="lg" className="space-y-6 py-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <PageHeading
            title={t('adminSystem.title')}
            description={t('adminSystem.subtitle')}
          />
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
            isLoading={refreshing}
            leftIcon={<RefreshCwIcon className="w-4 h-4" />}
          >
            {t('adminSystem.refreshBtn')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleTriggerSlaEvaluation}
            isLoading={evaluatingSla}
            leftIcon={<ClockIcon className="w-4 h-4" />}
          >
            {t('adminSystem.runSlaBtn')}
          </Button>
        </div>
      </div>

      {/* Global Alerts */}
      {errorMsg && <Alert variant="error" title="Administrative Alert" onDismiss={() => setErrorMsg(null)}>{errorMsg}</Alert>}
      {successMsg && <Alert variant="success" title="Success" onDismiss={() => setSuccessMsg(null)}>{successMsg}</Alert>}

      {/* Maintenance Mode Warning Banner */}
      {isMaintenanceActive && (
        <Alert variant="warning" title="Platform Maintenance Mode is Currently ACTIVE">
          Non-admin write operations are actively rejected with HTTP 503. Citizen complaint reporting and official workflows are suspended. Authorized administrators retain emergency recovery access.
        </Alert>
      )}

      {/* Primary Status Banner */}
      <Card variant="subtle" className={`border-l-4 ${isDbConnected && isReady ? 'border-l-emerald-500' : 'border-l-amber-500'}`}>
        <CardContent className="py-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-3.5 h-3.5 rounded-full shrink-0 ${isDbConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
              <div>
                <h2 className="text-sm font-semibold text-[#202522] dark:text-[#F5F2EA]">
                  Platform Core: {health?.status?.toUpperCase() || 'UNKNOWN'}
                  <span className="ml-2 text-xs font-normal text-[#54625A] dark:text-[#C5D4C9]">
                    (Readiness: <strong className={isReady ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}>{readiness?.status?.toUpperCase() ?? 'CHECKING'}</strong>)
                  </span>
                </h2>
                <p className="text-xs text-[#54625A] dark:text-[#C5D4C9]">
                  Backend: <code className="text-[#3E4B44] dark:text-[#C5D4C9]">{health?.service}</code> (v{health?.version}) &bull; Latency: {health?.data?.latencyMs != null ? `${health.data.latencyMs}ms` : 'N/A'} &bull; Uptime: {diagnostics ? formatUptime(diagnostics.uptimeSeconds) : '...'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant={isDbConnected ? 'success' : 'danger'} size="sm" hasDot>
                Database: {health?.data?.database ?? 'Unknown'}
              </Badge>
              <Badge variant={isMaintenanceActive ? 'warning' : 'neutral'} size="sm">
                Maintenance: {isMaintenanceActive ? 'Active' : 'Off'}
              </Badge>
              <Badge variant="info" size="sm">
                Env: {diagnostics?.environment ?? 'Production'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tab Navigation */}
      <nav aria-label="Administrative Navigation Tabs" className="flex border-b border-[#DED8CB] dark:border-[#283931] gap-1 overflow-x-auto pb-px">
        {tabButtons.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-t-lg ${
                isActive
                  ? 'border-[#173D32] dark:border-[#7BC4B2] text-[#173D32] dark:text-[#7BC4B2] font-semibold bg-[#ECE7DB] dark:bg-[#1D2A25]'
                  : 'border-transparent text-[#54625A] dark:text-[#C5D4C9] hover:text-[#202522] dark:hover:text-[#E8F0EC] hover:bg-[#ECE7DB]/50 dark:hover:bg-[#1D2A25]/50'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.id === 'incidents' && (overview?.metrics?.openIncidents ?? 0) > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {overview?.metrics?.openIncidents}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label={t('adminSystem.registeredUsers')}
              value={overview?.metrics?.totalUsers ?? diagnostics?.metrics?.usersCount ?? 0}
              subtext={`${overview?.metrics?.activeUsers ?? 0} registered accounts (non-suspended)`}
              accentColor="blue"
              icon={<UsersIcon className="w-5 h-5 text-blue-400" />}
            />
            <MetricCard
              label={t('adminSystem.totalComplaints')}
              value={overview?.metrics?.totalComplaints ?? diagnostics?.metrics?.complaintsCount ?? 0}
              subtext={`${overview?.metrics?.complaintsAwaitingAction ?? 0} awaiting assignment`}
              accentColor="purple"
              icon={<ActivityIcon className="w-5 h-5 text-purple-400" />}
            />
            <MetricCard
              label={t('adminSystem.overdueCases')}
              value={overview?.metrics?.complaintsOverdue ?? 0}
              subtext="Beyond target SLA resolution window"
              accentColor="rose"
              icon={<AlertTriangleIcon className="w-5 h-5 text-rose-400" />}
            />
            <MetricCard
              label={t('adminSystem.openIncidents')}
              value={overview?.metrics?.openIncidents ?? 0}
              subtext="Active system alerts & degradations"
              accentColor="amber"
              icon={<ShieldCheckIcon className="w-5 h-5 text-amber-400" />}
            />
          </div>

          {/* Workflow Queue Health & Status Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle as="h3">Complaints Queue Health Breakdown</CardTitle>
                <CardDescription>Live state distribution across citizen grievance workflows</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                  <div className="p-3 rounded-lg bg-[#ECE7DB]/50 dark:bg-[#1D2A25]/50 border border-[#DED8CB] dark:border-[#283931]">
                    <p className="text-xs text-[#54625A] dark:text-[#C5D4C9]">Awaiting Action</p>
                    <p className="text-xl font-bold text-amber-300 mt-1">{overview?.metrics?.complaintsAwaitingAction ?? 0}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-[#ECE7DB]/50 dark:bg-[#1D2A25]/50 border border-[#DED8CB] dark:border-[#283931]">
                    <p className="text-xs text-[#54625A] dark:text-[#C5D4C9]">In Progress</p>
                    <p className="text-xl font-bold text-sky-300 mt-1">{overview?.metrics?.complaintsInProgress ?? 0}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-[#ECE7DB]/50 dark:bg-[#1D2A25]/50 border border-[#DED8CB] dark:border-[#283931]">
                    <p className="text-xs text-[#54625A] dark:text-[#C5D4C9]">Resolved Cases</p>
                    <p className="text-xl font-bold text-emerald-300 mt-1">{overview?.metrics?.complaintsResolved ?? 0}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-[#ECE7DB]/50 dark:bg-[#1D2A25]/50 border border-[#DED8CB] dark:border-[#283931]">
                    <p className="text-xs text-[#54625A] dark:text-[#C5D4C9]">Overdue (SLA)</p>
                    <p className="text-xl font-bold text-rose-400 mt-1">{overview?.metrics?.complaintsOverdue ?? 0}</p>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3 items-center justify-between border-t border-[#DED8CB] dark:border-[#283931] pt-4">
                  <span className="text-xs text-[#54625A] dark:text-[#C5D4C9]">
                    User demographics: <strong>{overview?.metrics?.usersByRole?.CITIZEN ?? 0} Citizens</strong>,{' '}
                    <strong>{overview?.metrics?.usersByRole?.OFFICIAL ?? 0} Officials</strong>,{' '}
                    <strong>{overview?.metrics?.usersByRole?.CONTRACTOR ?? 0} Contractors</strong>,{' '}
                    <strong>{overview?.metrics?.usersByRole?.ADMIN ?? 0} Administrators</strong>.
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab('users')} rightIcon={<UsersIcon className="w-3.5 h-3.5" />}>
                    Manage Users
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions & System Controls */}
            <Card>
              <CardHeader>
                <CardTitle as="h3">Operational Controls</CardTitle>
                <CardDescription>Safe platform maintenance triggers</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 rounded-lg bg-[#ECE7DB]/50 dark:bg-[#1D2A25]/50 border border-[#DED8CB] dark:border-[#283931] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[#3E4B44] dark:text-[#C5D4C9]">Maintenance Window</span>
                    <Badge variant={isMaintenanceActive ? 'warning' : 'neutral'} size="sm">
                      {isMaintenanceActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-[#54625A] dark:text-[#C5D4C9]">
                    {isMaintenanceActive
                      ? 'Platform writes are currently suspended for non-admin citizens.'
                      : 'Platform is operating normally for all citizens and officials.'}
                  </p>
                  <Button
                    variant={isMaintenanceActive ? 'primary' : 'secondary'}
                    size="sm"
                    className="w-full mt-1"
                    onClick={() => {
                      setMaintenanceTargetValue(!isMaintenanceActive);
                      setMaintenanceModalOpen(true);
                    }}
                  >
                    {isMaintenanceActive ? 'Disable Maintenance Mode' : 'Enable Maintenance Mode'}
                  </Button>
                </div>

                <div className="p-3 rounded-lg bg-[#ECE7DB]/50 dark:bg-[#1D2A25]/50 border border-[#DED8CB] dark:border-[#283931] space-y-2">
                  <span className="text-xs font-medium text-[#3E4B44] dark:text-[#C5D4C9] block">SLA Policy Evaluation</span>
                  <p className="text-[11px] text-[#54625A] dark:text-[#C5D4C9]">
                    Force an immediate recalculation of overdue complaint milestones and automatic supervisory escalations.
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={handleTriggerSlaEvaluation}
                    isLoading={evaluatingSla}
                  >
                    Run SLA Evaluation Job
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Audit & Incidents Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle as="h3">Recent Administrative Actions</CardTitle>
                  <CardDescription>Latest governance and security records</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setActiveTab('audit')}>
                  View All
                </Button>
              </CardHeader>
              <CardContent>
                {overview?.recentAuditEvents && overview.recentAuditEvents.length > 0 ? (
                  <div className="divide-y divide-[#DED8CB] dark:divide-[#283931] text-xs">
                    {overview.recentAuditEvents.slice(0, 5).map((evt) => (
                      <div key={evt.id} className="py-2.5 flex items-center justify-between gap-2">
                        <div>
                          <span className="font-semibold text-[#202522] dark:text-[#E8F0EC] block">{evt.action}</span>
                          <span className="text-[11px] text-[#54625A] dark:text-[#C5D4C9]">
                            By {evt.actor?.name || 'System'} on {evt.entityType} ({new Date(evt.createdAt).toLocaleTimeString()})
                          </span>
                        </div>
                        <Badge variant="neutral" size="sm">{evt.entityType}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#C5D4C9] dark:text-[#54625A] py-4 text-center">No recent administrative audit records found.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle as="h3">Operational Incidents</CardTitle>
                  <CardDescription>Live service degradations & incident records</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setActiveTab('incidents')}>
                  View All
                </Button>
              </CardHeader>
              <CardContent>
                {overview?.recentIncidents && overview.recentIncidents.length > 0 ? (
                  <div className="divide-y divide-[#DED8CB] dark:divide-[#283931] text-xs">
                    {overview.recentIncidents.slice(0, 5).map((inc) => (
                      <div key={inc.id} className="py-2.5 flex items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] text-sky-400 font-semibold">{inc.incidentNumber}</span>
                            <span className="font-semibold text-[#202522] dark:text-[#E8F0EC]">{inc.title}</span>
                          </div>
                          <span className="text-[11px] text-[#54625A] dark:text-[#C5D4C9]">
                            Logged on {new Date(inc.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <Badge
                          variant={inc.status === 'RESOLVED' ? 'success' : inc.severity === 'CRITICAL' ? 'danger' : 'warning'}
                          size="sm"
                        >
                          {inc.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#C5D4C9] dark:text-[#54625A] py-4 text-center">No open incidents. Systems operating within parameters.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: PLATFORM CONFIGURATION */}
      {activeTab === 'config' && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <CardTitle as="h3">Platform Configuration Management</CardTitle>
                <CardDescription>
                  Controlled platform settings with transactional change history and audit logging. Secrets and environment variables (.env) are never exposed.
                </CardDescription>
              </div>
              <Button
                variant={isMaintenanceActive ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => {
                  setMaintenanceTargetValue(!isMaintenanceActive);
                  setMaintenanceModalOpen(true);
                }}
              >
                {isMaintenanceActive ? 'Disable Maintenance Mode' : 'Toggle Maintenance Window'}
              </Button>
            </CardHeader>
            <CardContent>
              {settings.length === 0 ? (
                <EmptyState
                  title="No Settings Loaded"
                  description="Configuration records could not be retrieved from the server."
                />
              ) : (
                <div className="space-y-8">
                  {(['GENERAL', 'MAINTENANCE', 'WORKFLOW', 'SECURITY'] as const).map((category) => {
                    const catSettings = settings.filter((s) => s.category === category);
                    if (catSettings.length === 0) return null;
                    return (
                      <div key={category} className="space-y-3">
                        <div className="flex items-center gap-2 border-b border-[#DED8CB] dark:border-[#283931] pb-2">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-[#54625A] dark:text-[#C5D4C9]">
                            Category: {category}
                          </h4>
                          <Badge variant="neutral" size="sm">{catSettings.length} settings</Badge>
                        </div>

                        <div className="divide-y divide-[#DED8CB] dark:divide-[#283931] rounded-lg border border-[#DED8CB] dark:border-[#283931] bg-[#ECE7DB]/50 dark:bg-[#1D2A25]/50 overflow-hidden">
                          {catSettings.map((item) => (
                            <div key={item.key} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <code className="text-xs font-semibold text-[#173D32] dark:text-[#7BC4B2] bg-[#ECE7DB] dark:bg-[#1D2A25] border border-[#DED8CB] dark:border-[#283931] px-2 py-0.5 rounded font-mono">
                                    {item.key}
                                  </code>
                                  {item.isPublic && (
                                    <Badge variant="info" size="sm">Public</Badge>
                                  )}
                                </div>
                                <p className="text-xs text-[#3E4B44] dark:text-[#C5D4C9] font-medium">{item.description}</p>
                                <p className="text-[11px] text-[#54625A] dark:text-[#C5D4C9]">
                                  Current value: <strong className="text-[#202522] dark:text-[#F5F2EA] font-mono">{item.value}</strong> &bull; Last updated by {item.updatedBy?.name || 'System'} ({new Date(item.updatedAt).toLocaleDateString()})
                                </p>
                              </div>

                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                  setEditingSetting(item);
                                  setEditSettingValue(item.value);
                                  setEditSettingReason('');
                                }}
                              >
                                {t('adminSystem.saveSettingBtn')}
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Configuration Change History */}
          <Card>
            <CardHeader>
              <CardTitle as="h3">Configuration Change History</CardTitle>
              <CardDescription>Immutable audit trail of setting updates, previous values, reasons, and actors</CardDescription>
            </CardHeader>
            <CardContent>
              {configHistory.length === 0 ? (
                <p className="text-xs text-[#C5D4C9] dark:text-[#54625A] py-4 text-center">No configuration changes logged yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-[#3E4B44] dark:text-[#C5D4C9]">
                    <thead className="border-b border-[#DED8CB] dark:border-[#283931] text-[11px] uppercase tracking-wider text-[#54625A] dark:text-[#C5D4C9] bg-[#ECE7DB]/60 dark:bg-[#1D2A25]/60">
                      <tr>
                        <th className="py-2.5 px-3">Setting Key</th>
                        <th className="py-2.5 px-3">Previous Value</th>
                        <th className="py-2.5 px-3">New Value</th>
                        <th className="py-2.5 px-3">Justification Reason</th>
                        <th className="py-2.5 px-3">Changed By</th>
                        <th className="py-2.5 px-3">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DED8CB] dark:divide-[#283931]">
                      {configHistory.map((item) => (
                        <tr key={item.id} className="hover:bg-[#ECE7DB]/40 dark:hover:bg-[#1D2A25]/40">
                          <td className="py-2.5 px-3 font-mono font-semibold text-sky-400">{item.key}</td>
                          <td className="py-2.5 px-3 font-mono text-[#54625A] dark:text-[#C5D4C9]">{item.previousValue}</td>
                          <td className="py-2.5 px-3 font-mono text-emerald-400">{item.newValue}</td>
                          <td className="py-2.5 px-3 text-[#3E4B44] dark:text-[#C5D4C9]">{item.reason || '—'}</td>
                          <td className="py-2.5 px-3">{item.changedBy?.name}</td>
                          <td className="py-2.5 px-3 text-[#54625A] dark:text-[#C5D4C9]">{new Date(item.createdAt).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 3: USER & ROLE ADMINISTRATION */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle as="h3">User & Role Administration</CardTitle>
                <CardDescription>
                  Manage citizen, official, contractor, and administrator accounts. RBAC safeguards strictly prevent self-modification and demotion of the last active administrator.
                </CardDescription>
              </div>

              {/* Action & Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setCreateOfficialModalOpen(true)}
                  leftIcon={<PlusIcon className="w-4 h-4" />}
                >
                  Onboard Official
                </Button>
                <div className="w-44">
                  <TextInput
                    placeholder="Search name/email..."
                    value={userSearch}
                    onChange={(e) => {
                      setUserSearch(e.target.value);
                      setUserPage(1);
                    }}
                    leftIcon={<SearchIcon className="w-4 h-4 text-[#54625A] dark:text-[#C5D4C9]" />}
                  />
                </div>
                <div className="w-36">
                  <Select
                    value={userRoleFilter}
                    onChange={(e) => {
                      setUserRoleFilter(e.target.value);
                      setUserPage(1);
                    }}
                    options={[
                      { value: 'ALL', label: 'All Roles' },
                      { value: 'CITIZEN', label: 'Citizen' },
                      { value: 'GOVERNMENT_OFFICIAL', label: 'Official' },
                      { value: 'CONTRACTOR', label: 'Contractor' },
                      { value: 'ADMIN', label: 'Admin' },
                    ]}
                  />
                </div>
                <div className="w-32">
                  <Select
                    value={userStatusFilter}
                    onChange={(e) => {
                      setUserStatusFilter(e.target.value);
                      setUserPage(1);
                    }}
                    options={[
                      { value: 'ALL', label: 'All Status' },
                      { value: 'ACTIVE', label: 'Active' },
                      { value: 'SUSPENDED', label: 'Suspended' },
                    ]}
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {users.length === 0 ? (
                <EmptyState
                  title="No Users Found"
                  description="No registered user accounts match the provided search and filter parameters."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-[#3E4B44] dark:text-[#C5D4C9]">
                    <thead className="border-b border-[#DED8CB] dark:border-[#283931] text-[11px] uppercase tracking-wider text-[#54625A] dark:text-[#C5D4C9] bg-[#ECE7DB]/60 dark:bg-[#1D2A25]/60">
                      <tr>
                        <th className="py-2.5 px-3">User</th>
                        <th className="py-2.5 px-3">Role</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Complaints</th>
                        <th className="py-2.5 px-3">Registered</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DED8CB] dark:divide-[#283931]">
                      {users.map((usr) => {
                        const isSelf = usr.id === user?.id;
                        return (
                          <tr key={usr.id} className="hover:bg-[#ECE7DB]/40 dark:hover:bg-[#1D2A25]/40">
                            <td className="py-2.5 px-3">
                              <span className="font-semibold text-[#202522] dark:text-[#F5F2EA] block">
                                {usr.name} {isSelf && <span className="text-[10px] text-blue-700 dark:text-blue-400 font-normal">(You)</span>}
                              </span>
                              <span className="text-[11px] text-[#54625A] dark:text-[#C5D4C9]">{usr.email}</span>
                            </td>
                            <td className="py-2.5 px-3">
                              <Badge
                                variant={
                                  usr.role === 'ADMIN'
                                    ? 'info'
                                    : usr.role === 'GOVERNMENT_OFFICIAL'
                                    ? 'warning'
                                    : usr.role === 'CONTRACTOR'
                                    ? 'success'
                                    : 'neutral'
                                }
                                size="sm"
                              >
                                {usr.role === 'GOVERNMENT_OFFICIAL' ? 'Official' : usr.role}
                              </Badge>
                              {usr.department && (
                                <span className="text-[10px] text-[#54625A] dark:text-[#C5D4C9] block mt-0.5 truncate max-w-[140px]" title={usr.department.name}>
                                  {usr.department.name}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              <Badge
                                variant={usr.status === 'ACTIVE' ? 'success' : 'danger'}
                                size="sm"
                                hasDot
                              >
                                {usr.status}
                              </Badge>
                            </td>
                            <td className="py-2.5 px-3 font-mono">{usr._count?.complaints ?? 0}</td>
                            <td className="py-2.5 px-3 text-[#54625A] dark:text-[#C5D4C9]">{new Date(usr.createdAt).toLocaleDateString()}</td>
                            <td className="py-2.5 px-3 text-right">
                              <div className="inline-flex items-center gap-1.5">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={isSelf}
                                  onClick={() => {
                                    setSelectedUserForRole(usr);
                                    setNewUserRole(usr.role);
                                    setNewDepartmentId(usr.departmentId || '');
                                    setRoleChangeReason('');
                                  }}
                                >
                                  Role
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={isSelf}
                                  className={usr.status === 'ACTIVE' ? 'text-rose-400 hover:text-rose-300' : 'text-emerald-400 hover:text-emerald-300'}
                                  onClick={() => {
                                    setSelectedUserForStatus(usr);
                                    setStatusChangeReason('');
                                  }}
                                >
                                  {usr.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {userTotalPages > 1 && (
                <div className="flex items-center justify-between border-t border-[#DED8CB] dark:border-[#283931] pt-4 mt-4 text-xs text-[#54625A] dark:text-[#C5D4C9]">
                  <span>Page {userPage} of {userTotalPages}</span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={userPage <= 1}
                      onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={userPage >= userTotalPages}
                      onClick={() => setUserPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB: CONTRACTOR ONBOARDING & VERIFICATION */}
      {activeTab === 'contractors' && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle as="h3">Contractor Applications & Onboarding</CardTitle>
                <CardDescription>
                  Review and verify registered contractor applications. Approving an application verifies the contractor entity and activates associated contractor user accounts for bidding and tender participation.
                </CardDescription>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-52">
                  <TextInput
                    placeholder="Search company, reg #, email..."
                    value={contractorAppSearch}
                    onChange={(e) => {
                      setContractorAppSearch(e.target.value);
                      setContractorAppPage(1);
                    }}
                    leftIcon={<SearchIcon className="w-4 h-4 text-[#54625A] dark:text-[#C5D4C9]" />}
                  />
                </div>
                <div className="w-44">
                  <Select
                    value={contractorAppStatusFilter}
                    onChange={(e) => {
                      setContractorAppStatusFilter(e.target.value);
                      setContractorAppPage(1);
                    }}
                    options={[
                      { value: 'ALL', label: 'All Statuses' },
                      { value: 'PENDING_REVIEW', label: 'Pending Review' },
                      { value: 'VERIFIED_ACTIVE', label: 'Verified & Active' },
                      { value: 'INACTIVE_REJECTED', label: 'Inactive / Rejected' },
                    ]}
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {loadingContractors ? (
                <div className="py-12 flex justify-center text-[#54625A] dark:text-[#C5D4C9]">
                  <LoadingIndicator label="Loading contractor applications..." size="md" />
                </div>
              ) : contractorApps.length === 0 ? (
                <EmptyState
                  title="No Contractor Applications Found"
                  description="No contractor applications match the specified status or search filter."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-[#3E4B44] dark:text-[#C5D4C9]">
                    <thead className="border-b border-[#DED8CB] dark:border-[#283931] text-[11px] uppercase tracking-wider text-[#54625A] dark:text-[#C5D4C9] bg-[#ECE7DB]/60 dark:bg-[#1D2A25]/60">
                      <tr>
                        <th className="py-2.5 px-3">Contractor / Company</th>
                        <th className="py-2.5 px-3">Reg #</th>
                        <th className="py-2.5 px-3">Trade / Specialization</th>
                        <th className="py-2.5 px-3">Contact Person</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Applied</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DED8CB] dark:divide-[#283931]">
                      {contractorApps.map((app) => {
                        const primaryUser = app.users?.[0];
                        return (
                          <tr key={app.id} className="hover:bg-[#ECE7DB]/40 dark:hover:bg-[#1D2A25]/40">
                            <td className="py-2.5 px-3">
                              <span className="font-semibold text-[#202522] dark:text-[#F5F2EA] block">{app.name}</span>
                              <span className="text-[11px] text-[#54625A] dark:text-[#C5D4C9]">
                                {app.businessAddress || 'No address provided'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono font-semibold text-sky-700 dark:text-sky-400">
                              {app.registrationNumber}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="bg-[#ECE7DB] dark:bg-[#1D2A25] text-[#3E4B44] dark:text-[#C5D4C9] px-2 py-0.5 rounded text-[11px]">
                                {app.workCategories?.join(', ') || app.licenseClass || 'General'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              {primaryUser ? (
                                <div>
                                  <span className="text-[#202522] dark:text-[#F5F2EA] block font-medium">{primaryUser.name}</span>
                                  <span className="text-[11px] text-[#54625A] dark:text-[#C5D4C9]">{primaryUser.email}</span>
                                </div>
                              ) : (
                                <span className="text-[#54625A] dark:text-[#C5D4C9] italic">No linked user</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex flex-col gap-1">
                                <Badge
                                  variant={
                                    app.isVerified
                                      ? 'success'
                                      : app.status === 'INACTIVE'
                                      ? 'danger'
                                      : 'warning'
                                  }
                                  size="sm"
                                  hasDot
                                >
                                  {app.isVerified
                                    ? 'VERIFIED'
                                    : app.status === 'INACTIVE'
                                    ? 'REJECTED'
                                    : 'PENDING'}
                                </Badge>
                                {app.status === 'INACTIVE' && (
                                  <span className="text-[10px] text-rose-400">Suspended / Rejected</span>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-[#54625A] dark:text-[#C5D4C9]">
                              {new Date(app.createdAt).toLocaleDateString()}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <div className="inline-flex items-center gap-1.5">
                                {!app.isVerified && app.status !== 'INACTIVE' ? (
                                  <>
                                    <Button
                                      variant="primary"
                                      size="sm"
                                      onClick={() => {
                                        setSelectedContractorForApprove(app);
                                        setApproveNotes('');
                                      }}
                                    >
                                      Approve
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-rose-400 hover:text-rose-300"
                                      onClick={() => {
                                        setSelectedContractorForReject(app);
                                        setRejectReason('');
                                      }}
                                    >
                                      Reject
                                    </Button>
                                  </>
                                ) : app.isVerified ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-rose-400 hover:text-rose-300"
                                    onClick={() => {
                                      setSelectedContractorForReject(app);
                                      setRejectReason('');
                                    }}
                                  >
                                    Suspend
                                  </Button>
                                ) : (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedContractorForApprove(app);
                                      setApproveNotes('');
                                    }}
                                  >
                                    Re-Approve
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {contractorAppTotalPages > 1 && (
                <div className="flex items-center justify-between border-t border-[#DED8CB] dark:border-[#283931] pt-4 mt-4 text-xs text-[#54625A] dark:text-[#C5D4C9]">
                  <span>Page {contractorAppPage} of {contractorAppTotalPages}</span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={contractorAppPage <= 1}
                      onClick={() => setContractorAppPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={contractorAppPage >= contractorAppTotalPages}
                      onClick={() => setContractorAppPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 4: OPERATIONAL HEALTH & DIAGNOSTICS */}
      {activeTab === 'health' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label={t('adminSystem.uptime')}
              value={diagnostics ? formatUptime(diagnostics.uptimeSeconds) : 'Checking...'}
              subtext="Platform operational"
              accentColor="blue"
              icon={<ClockIcon className="w-5 h-5 text-blue-400" />}
            />
            {(() => {
              const dbLatency = diagnostics?.database?.latencyMs ?? 0;
              const isDegradedLatency = dbLatency > 1000;
              return (
                <MetricCard
                  label={t('adminSystem.databaseLatency')}
                  value={diagnostics?.database?.latencyMs != null ? `${diagnostics.database.latencyMs} ms` : 'N/A'}
                  subtext={
                    !isDbConnected
                      ? 'Connection degraded'
                      : isDegradedLatency
                      ? `Connection degraded (High Latency: ${dbLatency}ms)`
                      : 'Active connection healthy'
                  }
                  accentColor={!isDbConnected || isDegradedLatency ? 'amber' : 'emerald'}
                  icon={<CheckCircleIcon className="w-5 h-5 text-emerald-400" />}
                />
              );
            })()}
            <MetricCard
              label={t('adminSystem.heapUsed')}
              value={diagnostics?.memory?.heapUsedMb != null ? `${diagnostics.memory.heapUsedMb} MB` : 'Checking...'}
              subtext={diagnostics?.memory?.heapTotalMb != null ? `Total Heap: ${diagnostics.memory.heapTotalMb} MB` : ''}
              accentColor="purple"
              icon={<ServerIcon className="w-5 h-5 text-purple-400" />}
            />
            <MetricCard
              label={t('adminSystem.activeEscalations')}
              value={diagnostics?.metrics?.activeEscalationsCount ?? '0'}
              subtext="Requiring supervisory attention"
              accentColor="amber"
              icon={<AlertTriangleIcon className="w-5 h-5 text-amber-400" />}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle as="h3">Database Records & Entity Volume</CardTitle>
                <CardDescription>Live counts queried from PostgreSQL database storage</CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="divide-y divide-[#DED8CB] dark:divide-[#283931] text-sm">
                  <div className="py-2.5 flex justify-between">
                    <dt className="text-[#54625A] dark:text-[#C5D4C9]">Total Grievance Complaints</dt>
                    <dd className="font-semibold text-[#202522] dark:text-[#F5F2EA] font-mono">{diagnostics?.metrics?.complaintsCount ?? 0}</dd>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <dt className="text-[#54625A] dark:text-[#C5D4C9]">Registered Users</dt>
                    <dd className="font-semibold text-[#202522] dark:text-[#F5F2EA] font-mono">{diagnostics?.metrics?.usersCount ?? 0}</dd>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <dt className="text-[#54625A] dark:text-[#C5D4C9]">Designated Departments</dt>
                    <dd className="font-semibold text-[#202522] dark:text-[#F5F2EA] font-mono">{diagnostics?.metrics?.departmentsCount ?? 0}</dd>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <dt className="text-[#54625A] dark:text-[#C5D4C9]">Active SLA Policies</dt>
                    <dd className="font-semibold text-[#202522] dark:text-[#F5F2EA] font-mono">{diagnostics?.metrics?.slaPoliciesCount ?? 0}</dd>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <dt className="text-[#54625A] dark:text-[#C5D4C9]">Active Supervisory Escalations</dt>
                    <dd className="font-semibold text-amber-700 dark:text-amber-300 font-mono">{diagnostics?.metrics?.activeEscalationsCount ?? 0}</dd>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <dt className="text-[#54625A] dark:text-[#C5D4C9]">Open Operational Incidents</dt>
                    <dd className="font-semibold text-rose-700 dark:text-rose-300 font-mono">{diagnostics?.metrics?.openIncidentsCount ?? 0}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle as="h3">Runtime & Node.js Execution</CardTitle>
                <CardDescription>Host telemetry and execution environment specifications</CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="divide-y divide-[#DED8CB] dark:divide-[#283931] text-sm">
                  <div className="py-2.5 flex justify-between">
                    <dt className="text-[#54625A] dark:text-[#C5D4C9]">Node.js Engine</dt>
                    <dd className="font-mono text-[#202522] dark:text-[#E8F0EC]">{diagnostics?.nodeVersion ?? 'N/A'}</dd>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <dt className="text-[#54625A] dark:text-[#C5D4C9]">Platform OS</dt>
                    <dd className="font-mono text-[#202522] dark:text-[#E8F0EC]">{diagnostics?.platform ?? 'N/A'}</dd>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <dt className="text-[#54625A] dark:text-[#C5D4C9]">Resident Set Size (RSS)</dt>
                    <dd className="font-mono text-[#202522] dark:text-[#E8F0EC]">{diagnostics?.memory?.rssMb ?? 0} MB</dd>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <dt className="text-[#54625A] dark:text-[#C5D4C9]">Public Liveness Probe</dt>
                    <dd className="font-mono text-sky-400 text-xs bg-[#ECE7DB] dark:bg-[#1D2A25] px-1.5 py-0.5 rounded">GET /api/health</dd>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <dt className="text-[#54625A] dark:text-[#C5D4C9]">Readiness Probe</dt>
                    <dd className="font-mono text-emerald-400 text-xs bg-[#ECE7DB] dark:bg-[#1D2A25] px-1.5 py-0.5 rounded">GET /api/health/ready</dd>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <dt className="text-[#54625A] dark:text-[#C5D4C9]">Last Telemetry Check</dt>
                    <dd className="font-mono text-xs text-[#54625A] dark:text-[#C5D4C9]">{health?.timestamp ? new Date(health.timestamp).toLocaleTimeString() : 'N/A'}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </div>

          {/* Database Schema Synchronization & Health */}
          <Card className="border-[#DED8CB] dark:border-[#283931]">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2">
              <div>
                <CardTitle as="h3">Database Schema Synchronization & Migration Integrity</CardTitle>
                <CardDescription>
                  Verify and apply idempotent database schema updates directly across Supabase pooler connections.
                </CardDescription>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSyncSchema}
                disabled={syncingSchema}
                className="shrink-0"
              >
                {syncingSchema ? 'Synchronizing...' : 'Sync Schema Now'}
              </Button>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-[#54625A] dark:text-[#C5D4C9]">
                Ensures all tables, additive columns (AI verification, fraud risk scores, complaint consolidation, contractor extensions), and foreign key indexes are aligned with the Prisma data model without downtime or destructive resets.
              </p>
            </CardContent>
          </Card>

          <Card variant="subtle">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <ShieldCheckIcon className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs text-[#54625A] dark:text-[#C5D4C9] space-y-1">
                  <p className="font-semibold text-[#202522] dark:text-[#E8F0EC]">
                    Security & Data Protection Isolation
                  </p>
                  <p>
                    Diagnostics are strictly separated from citizen-facing interfaces. Secrets, database passwords, environment variables (.env), and internal error stack traces are never exposed over API telemetry endpoints.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 5: AUDIT TRAIL EXPLORER */}
      {activeTab === 'audit' && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle as="h3">Administrative Audit Log Explorer</CardTitle>
                <CardDescription>
                  Server-side filtered and paginated activity records. Sensitive values, passwords, and tokens are permanently redacted.
                </CardDescription>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="w-44">
                  <TextInput
                    placeholder="Search logs..."
                    value={auditSearch}
                    onChange={(e) => {
                      setAuditSearch(e.target.value);
                      setAuditPage(1);
                    }}
                    leftIcon={<SearchIcon className="w-4 h-4 text-[#54625A] dark:text-[#C5D4C9]" />}
                  />
                </div>
                <div className="w-36">
                  <Select
                    value={auditActionFilter}
                    onChange={(e) => {
                      setAuditActionFilter(e.target.value);
                      setAuditPage(1);
                    }}
                    options={[
                      { value: 'ALL', label: 'All Actions' },
                      { value: 'USER_ROLE_UPDATED', label: 'Role Changes' },
                      { value: 'USER_STATUS_UPDATED', label: 'Status Changes' },
                      { value: 'PLATFORM_CONFIG_UPDATED', label: 'Config Changes' },
                      { value: 'OPERATIONAL_INCIDENT_CREATED', label: 'Incident Created' },
                      { value: 'OPERATIONAL_INCIDENT_UPDATED', label: 'Incident Updated' },
                      { value: 'AUDIT_LOG_EXPORTED', label: 'Exports' },
                    ]}
                  />
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleExportCsv('/api/admin/reports/audit-logs/export', `civora-audit-logs-${Date.now()}.csv`, 'Audit CSV')}
                  isLoading={exportingReport === 'Audit CSV'}
                  leftIcon={<DownloadIcon className="w-4 h-4" />}
                >
                  Export CSV
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              {auditEvents.length === 0 ? (
                <EmptyState
                  title="No Audit Records Found"
                  description="No audit events matched the search criteria."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-[#3E4B44] dark:text-[#C5D4C9]">
                    <thead className="border-b border-[#DED8CB] dark:border-[#283931] text-[11px] uppercase tracking-wider text-[#54625A] dark:text-[#C5D4C9] bg-[#ECE7DB]/60 dark:bg-[#1D2A25]/60">
                      <tr>
                        <th className="py-2.5 px-3">Timestamp</th>
                        <th className="py-2.5 px-3">Action</th>
                        <th className="py-2.5 px-3">Entity Type</th>
                        <th className="py-2.5 px-3">Actor</th>
                        <th className="py-2.5 px-3 text-right">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DED8CB] dark:divide-[#283931]">
                      {auditEvents.map((evt) => (
                        <tr key={evt.id} className="hover:bg-[#ECE7DB]/40 dark:hover:bg-[#1D2A25]/40">
                          <td className="py-2.5 px-3 text-[#54625A] dark:text-[#C5D4C9] whitespace-nowrap">
                            {new Date(evt.createdAt).toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-semibold text-[#202522] dark:text-[#F5F2EA]">{evt.action}</span>
                          </td>
                          <td className="py-2.5 px-3">
                            <Badge variant="neutral" size="sm">{evt.entityType}</Badge>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="text-[#202522] dark:text-[#E8F0EC] block">{evt.actor?.name || 'System / Automated'}</span>
                            {evt.actor?.email && <span className="text-[11px] text-[#54625A] dark:text-[#C5D4C9]">{evt.actor.email}</span>}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setInspectAuditItem(evt)}
                              leftIcon={<EyeIcon className="w-3.5 h-3.5" />}
                            >
                              Inspect
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {auditTotalPages > 1 && (
                <div className="flex items-center justify-between border-t border-[#DED8CB] dark:border-[#283931] pt-4 mt-4 text-xs text-[#54625A] dark:text-[#C5D4C9]">
                  <span>Page {auditPage} of {auditTotalPages}</span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={auditPage <= 1}
                      onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={auditPage >= auditTotalPages}
                      onClick={() => setAuditPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 6: OPERATIONAL INCIDENTS */}
      {activeTab === 'incidents' && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle as="h3">Operational Incidents & Degradations</CardTitle>
                <CardDescription>
                  Track system events, service degradations, and operational resolutions. All incident transitions are audited.
                </CardDescription>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="w-36">
                  <Select
                    value={incidentStatusFilter}
                    onChange={(e) => setIncidentStatusFilter(e.target.value)}
                    options={[
                      { value: 'ALL', label: 'All Statuses' },
                      { value: 'OPEN', label: 'Open' },
                      { value: 'INVESTIGATING', label: 'Investigating' },
                      { value: 'MONITORING', label: 'Monitoring' },
                      { value: 'RESOLVED', label: 'Resolved' },
                    ]}
                  />
                </div>
                <div className="w-36">
                  <Select
                    value={incidentSeverityFilter}
                    onChange={(e) => setIncidentSeverityFilter(e.target.value)}
                    options={[
                      { value: 'ALL', label: 'All Severities' },
                      { value: 'LOW', label: 'Low' },
                      { value: 'MEDIUM', label: 'Medium' },
                      { value: 'HIGH', label: 'High' },
                      { value: 'CRITICAL', label: 'Critical' },
                    ]}
                  />
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setCreateIncidentModalOpen(true)}
                  leftIcon={<PlusIcon className="w-4 h-4" />}
                >
                  {t('adminSystem.logIncidentBtn')}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleExportCsv('/api/admin/reports/incidents/export', `civora-incidents-${Date.now()}.csv`, 'Incidents CSV')}
                  isLoading={exportingReport === 'Incidents CSV'}
                  leftIcon={<DownloadIcon className="w-4 h-4" />}
                >
                  Export CSV
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              {incidents.length === 0 ? (
                <EmptyState
                  title="No Operational Incidents"
                  description="No incidents recorded matching the current severity and status criteria."
                />
              ) : (
                <div className="space-y-4">
                  {incidents.map((inc) => (
                    <div
                      key={inc.id}
                      className="p-4 rounded-lg border border-[#DED8CB] dark:border-[#283931] bg-[#ECE7DB]/50 dark:bg-[#1D2A25]/50 space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <code className="text-xs font-mono font-bold text-[#173D32] dark:text-[#7BC4B2] bg-[#ECE7DB] dark:bg-[#1D2A25] border border-[#DED8CB] dark:border-[#283931] px-2 py-0.5 rounded font-mono">
                            {inc.incidentNumber}
                          </code>
                          <h4 className="text-sm font-semibold text-[#202522] dark:text-[#F5F2EA]">{inc.title}</h4>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              inc.severity === 'CRITICAL'
                                ? 'danger'
                                : inc.severity === 'HIGH'
                                ? 'warning'
                                : 'neutral'
                            }
                            size="sm"
                          >
                            Severity: {inc.severity}
                          </Badge>
                          <Badge
                            variant={inc.status === 'RESOLVED' ? 'success' : 'info'}
                            size="sm"
                            hasDot
                          >
                            {inc.status}
                          </Badge>
                        </div>
                      </div>

                      <p className="text-xs text-[#3E4B44] dark:text-[#C5D4C9]">{inc.description}</p>

                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#DED8CB] dark:border-[#283931] pt-3 text-[11px] text-[#54625A] dark:text-[#C5D4C9]">
                        <span>
                          Subsystem: <strong className="text-[#3E4B44] dark:text-[#C5D4C9]">{inc.subsystem}</strong> &bull; Logged by {inc.reportedBy?.name} on {new Date(inc.createdAt).toLocaleString()}
                          {inc.resolvedAt && ` &bull; Resolved on ${new Date(inc.resolvedAt).toLocaleString()}`}
                        </span>

                        <div className="flex items-center gap-2">
                          {inc.status !== 'RESOLVED' && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setSelectedIncidentForUpdate(inc);
                                setUpdateIncidentStatus('RESOLVED');
                                setIncidentResolutionNotes('');
                              }}
                            >
                              Update / Resolve
                            </Button>
                          )}
                        </div>
                      </div>

                      {inc.resolutionNotes && (
                        <div className="p-2.5 rounded bg-[#ECE7DB]/60 dark:bg-[#1D2A25]/60 border border-[#DED8CB] dark:border-[#283931] text-xs text-[#3E4B44] dark:text-[#C5D4C9]">
                          <strong className="text-emerald-400 block mb-1">Resolution Summary:</strong>
                          {inc.resolutionNotes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 7: REPORTS & EXPORTS */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle as="h3">Administrative Reports & Structured Data Exports</CardTitle>
              <CardDescription>
                Download verified platform datasets. All CSV exports are bounded, server-filtered, and defended against CSV formula injection (CWE-1236).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Audit Export Card */}
                <div className="p-4 rounded-xl border border-[#DED8CB] dark:border-[#283931] bg-[#ECE7DB]/50 dark:bg-[#1D2A25]/50 space-y-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center">
                      <ShieldCheckIcon className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm font-semibold text-[#202522] dark:text-[#F5F2EA]">Administrative Audit Trail</h4>
                    <p className="text-xs text-[#54625A] dark:text-[#C5D4C9]">
                      Complete activity logs covering user role modifications, status alterations, platform configuration updates, and operational interventions.
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={() => handleExportCsv('/api/admin/reports/audit-logs/export', `civora-audit-logs-${Date.now()}.csv`, 'Audit CSV')}
                    isLoading={exportingReport === 'Audit CSV'}
                    leftIcon={<DownloadIcon className="w-4 h-4" />}
                  >
                    {t('adminSystem.exportAuditCsv')}
                  </Button>
                </div>

                {/* Workflow Export Card */}
                <div className="p-4 rounded-xl border border-[#DED8CB] dark:border-[#283931] bg-[#ECE7DB]/50 dark:bg-[#1D2A25]/50 space-y-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="w-8 h-8 rounded-lg bg-purple-600/20 text-purple-400 flex items-center justify-center">
                      <ActivityIcon className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm font-semibold text-[#202522] dark:text-[#F5F2EA]">Complaint Workflow & Queue</h4>
                    <p className="text-xs text-[#54625A] dark:text-[#C5D4C9]">
                      Grievance processing dataset including tracking numbers, categories, current status, urgency priority, department assignments, and SLA milestones.
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={() => handleExportCsv('/api/admin/reports/workflow/export', `civora-workflow-${Date.now()}.csv`, 'Workflow CSV')}
                    isLoading={exportingReport === 'Workflow CSV'}
                    leftIcon={<DownloadIcon className="w-4 h-4" />}
                  >
                    {t('adminSystem.exportWorkflowCsv')}
                  </Button>
                </div>

                {/* Incidents Export Card */}
                <div className="p-4 rounded-xl border border-[#DED8CB] dark:border-[#283931] bg-[#ECE7DB]/50 dark:bg-[#1D2A25]/50 space-y-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-600/20 text-amber-400 flex items-center justify-center">
                      <AlertTriangleIcon className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm font-semibold text-[#202522] dark:text-[#F5F2EA]">Operational Incidents Log</h4>
                    <p className="text-xs text-[#54625A] dark:text-[#C5D4C9]">
                      Incident tracking dataset with Crockford identifiers, reported severities, affected subsystems, operational statuses, and logged resolution notes.
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={() => handleExportCsv('/api/admin/reports/incidents/export', `civora-incidents-${Date.now()}.csv`, 'Incidents CSV')}
                    isLoading={exportingReport === 'Incidents CSV'}
                    leftIcon={<DownloadIcon className="w-4 h-4" />}
                  >
                    {t('adminSystem.exportIncidentsCsv')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security & Data Integrity Assurance */}
          <Card variant="subtle">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <ShieldCheckIcon className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs text-[#54625A] dark:text-[#C5D4C9] space-y-1">
                  <p className="font-semibold text-[#202522] dark:text-[#E8F0EC]">
                    CWE-1236 Formula Injection Defense
                  </p>
                  <p>
                    All CSV data fields are automatically sanitized on the backend. Values starting with spreadsheet formula triggers (<code>=</code>, <code>+</code>, <code>-</code>, <code>@</code>) are safely prefixed with an apostrophe to neutralize malicious formula execution in spreadsheet viewers.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* MODAL 1: EDIT CONFIG SETTING */}
      {editingSetting && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#16201C] border border-[#DED8CB] dark:border-[#283931] rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#DED8CB] dark:border-[#283931] pb-3">
              <h3 className="text-base font-bold text-[#202522] dark:text-[#F5F2EA]">Update Platform Setting</h3>
              <button
                type="button"
                onClick={() => setEditingSetting(null)}
                className="text-[#54625A] dark:text-[#C5D4C9] hover:text-[#202522] dark:hover:text-[#F5F2EA]"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-[#54625A] dark:text-[#C5D4C9] block mb-1">Setting Key</label>
                <code className="text-xs font-mono font-semibold text-[#173D32] dark:text-[#7BC4B2] bg-[#ECE7DB] dark:bg-[#1D2A25] border border-[#DED8CB] dark:border-[#283931] px-2 py-1 rounded block font-mono">
                  {editingSetting.key}
                </code>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#54625A] dark:text-[#C5D4C9] block mb-1">Description</label>
                <p className="text-xs text-[#3E4B44] dark:text-[#C5D4C9]">{editingSetting.description}</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#54625A] dark:text-[#C5D4C9] block mb-1">New Value</label>
                <TextInput
                  value={editSettingValue}
                  onChange={(e) => setEditSettingValue(e.target.value)}
                  placeholder="Enter configuration value..."
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#54625A] dark:text-[#C5D4C9] block mb-1">
                  Justification Reason <span className="text-rose-400">*</span>
                </label>
                <TextInput
                  value={editSettingReason}
                  onChange={(e) => setEditSettingReason(e.target.value)}
                  placeholder="Operational justification for audit record..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[#DED8CB] dark:border-[#283931] pt-4">
              <Button variant="ghost" size="sm" onClick={() => setEditingSetting(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveSetting}
                isLoading={savingSetting}
              >
                Save Configuration
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: MAINTENANCE MODE CONFIRMATION */}
      {maintenanceModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#16201C] border border-amber-500/40 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 border-b border-[#DED8CB] dark:border-[#283931] pb-3">
              <AlertTriangleIcon className="w-6 h-6 text-amber-700 dark:text-amber-400" />
              <h3 className="text-base font-bold text-[#202522] dark:text-[#F5F2EA]">
                {maintenanceTargetValue ? 'Enable Maintenance Mode?' : 'Disable Maintenance Mode?'}
              </h3>
            </div>

            <div className="text-xs text-[#3E4B44] dark:text-[#C5D4C9] space-y-2">
              {maintenanceTargetValue ? (
                <p>
                  Activating Maintenance Mode will immediately cause all citizen-facing write operations (issue reporting, evidence upload, voting, comments) to be <strong>suspended with HTTP 503</strong>. Authorized administrators retain full access for recovery.
                </p>
              ) : (
                <p>
                  Disabling Maintenance Mode will restore normal civic services, allowing citizens to file grievances and view public dashboards normally.
                </p>
              )}

              <div>
                <label className="text-xs font-semibold text-[#54625A] dark:text-[#C5D4C9] block mt-3 mb-1">
                  Operational Reason <span className="text-rose-400">*</span>
                </label>
                <TextInput
                  value={maintenanceReason}
                  onChange={(e) => setMaintenanceReason(e.target.value)}
                  placeholder="e.g., Scheduled database index maintenance"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[#DED8CB] dark:border-[#283931] pt-4">
              <Button variant="ghost" size="sm" onClick={() => setMaintenanceModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant={maintenanceTargetValue ? 'primary' : 'secondary'}
                size="sm"
                onClick={handleConfirmMaintenanceMode}
                isLoading={savingSetting}
              >
                {maintenanceTargetValue ? 'Confirm & Enable Maintenance' : 'Confirm & Restore Platform'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: USER ROLE UPDATE */}
      {selectedUserForRole && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#16201C] border border-[#DED8CB] dark:border-[#283931] rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="border-b border-[#DED8CB] dark:border-[#283931] pb-3">
              <h3 className="text-base font-bold text-[#202522] dark:text-[#F5F2EA]">Update User Role</h3>
              <p className="text-xs text-[#54625A] dark:text-[#C5D4C9]">{selectedUserForRole.name} ({selectedUserForRole.email})</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-[#54625A] dark:text-[#C5D4C9] block mb-1">New Role</label>
                <Select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as 'CITIZEN' | 'GOVERNMENT_OFFICIAL' | 'ADMIN' | 'CONTRACTOR')}
                  options={[
                    { value: 'CITIZEN', label: 'Citizen (Standard user)' },
                    { value: 'GOVERNMENT_OFFICIAL', label: 'Official (Departmental operations)' },
                    { value: 'CONTRACTOR', label: 'Contractor (Field & tender operations)' },
                    { value: 'ADMIN', label: 'Administrator (Platform governance)' },
                  ]}
                />
              </div>

              {newUserRole === 'GOVERNMENT_OFFICIAL' && (
                <div>
                  <label className="text-xs font-semibold text-[#54625A] dark:text-[#C5D4C9] block mb-1">
                    Department Assignment <span className="text-rose-400">*</span>
                  </label>
                  <Select
                    value={newDepartmentId}
                    onChange={(e) => setNewDepartmentId(e.target.value)}
                    options={[
                      { value: '', label: '-- Select Department --' },
                      ...departments.map((dept) => ({
                        value: dept.id,
                        label: `${dept.name} (${dept.code})`,
                      })),
                    ]}
                  />
                  {!newDepartmentId && (
                    <span className="text-[10px] text-amber-400 mt-1 block">
                      Officials must be mapped to an authorized civic department.
                    </span>
                  )}
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-[#54625A] dark:text-[#C5D4C9] block mb-1">Justification Reason</label>
                <TextInput
                  value={roleChangeReason}
                  onChange={(e) => setRoleChangeReason(e.target.value)}
                  placeholder="e.g., Promoted to municipal coordinator"
                />
              </div>

              <div className="p-2.5 rounded bg-[#ECE7DB]/50 dark:bg-[#1D2A25]/50 border border-[#DED8CB] dark:border-[#283931] text-[11px] text-[#54625A] dark:text-[#C5D4C9]">
                <InfoIcon className="w-3.5 h-3.5 text-blue-400 inline mr-1" />
                Backend RBAC guarantees that the last remaining platform administrator cannot be demoted.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[#DED8CB] dark:border-[#283931] pt-4">
              <Button variant="ghost" size="sm" onClick={() => setSelectedUserForRole(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleUpdateRole}
                isLoading={actionInProgress}
              >
                Apply Role Change
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: USER STATUS UPDATE (SUSPEND / ACTIVATE) */}
      {selectedUserForStatus && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#16201C] border border-[#DED8CB] dark:border-[#283931] rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="border-b border-[#DED8CB] dark:border-[#283931] pb-3">
              <h3 className="text-base font-bold text-[#202522] dark:text-[#F5F2EA]">
                {selectedUserForStatus.status === 'ACTIVE' ? 'Suspend Account' : 'Reactivate Account'}
              </h3>
              <p className="text-xs text-[#54625A] dark:text-[#C5D4C9]">{selectedUserForStatus.name} ({selectedUserForStatus.email})</p>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-[#3E4B44] dark:text-[#C5D4C9]">
                {selectedUserForStatus.status === 'ACTIVE'
                  ? 'Suspended accounts cannot authenticate or access platform resources.'
                  : 'Reactivating this account will restore standard login access.'}
              </p>

              <div>
                <label className="text-xs font-semibold text-[#54625A] dark:text-[#C5D4C9] block mb-1">
                  Mandatory Audit Reason <span className="text-rose-400">*</span>
                </label>
                <TextInput
                  value={statusChangeReason}
                  onChange={(e) => setStatusChangeReason(e.target.value)}
                  placeholder="Operational justification required..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[#DED8CB] dark:border-[#283931] pt-4">
              <Button variant="ghost" size="sm" onClick={() => setSelectedUserForStatus(null)}>
                Cancel
              </Button>
              <Button
                variant={selectedUserForStatus.status === 'ACTIVE' ? 'primary' : 'secondary'}
                size="sm"
                onClick={handleUpdateStatus}
                isLoading={actionInProgress}
              >
                {selectedUserForStatus.status === 'ACTIVE' ? 'Confirm Suspension' : 'Confirm Reactivation'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: INSPECT AUDIT ITEM */}
      {inspectAuditItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#16201C] border border-[#DED8CB] dark:border-[#283931] rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#DED8CB] dark:border-[#283931] pb-3">
              <div>
                <h3 className="text-base font-bold text-[#202522] dark:text-[#F5F2EA]">Audit Event Details</h3>
                <p className="text-xs text-[#54625A] dark:text-[#C5D4C9]">{inspectAuditItem.action}</p>
              </div>
              <button
                type="button"
                onClick={() => setInspectAuditItem(null)}
                className="text-[#54625A] dark:text-[#C5D4C9] hover:text-[#202522] dark:hover:text-[#F5F2EA]"
              >
                &times;
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2 p-2.5 rounded bg-[#ECE7DB]/50 dark:bg-[#1D2A25]/50 border border-[#DED8CB] dark:border-[#283931]">
                <div>
                  <span className="text-[#54625A] dark:text-[#C5D4C9] block">Entity</span>
                  <span className="text-[#202522] dark:text-[#E8F0EC] font-semibold">{inspectAuditItem.entityType} ({inspectAuditItem.entityId})</span>
                </div>
                <div>
                  <span className="text-[#54625A] dark:text-[#C5D4C9] block">Timestamp</span>
                  <span className="text-[#202522] dark:text-[#E8F0EC]">{new Date(inspectAuditItem.createdAt).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[#54625A] dark:text-[#C5D4C9] block">Actor</span>
                  <span className="text-[#202522] dark:text-[#E8F0EC]">{inspectAuditItem.actor?.name || 'Automated / System'}</span>
                </div>
                <div>
                  <span className="text-[#54625A] dark:text-[#C5D4C9] block">Actor Role</span>
                  <span className="text-[#202522] dark:text-[#E8F0EC]">{inspectAuditItem.actor?.role || 'N/A'}</span>
                </div>
              </div>

              <div>
                <span className="text-[#54625A] dark:text-[#C5D4C9] font-semibold block mb-1">Sanitized Event Details & Payload</span>
                <pre className="p-3 rounded bg-[#ECE7DB]/50 dark:bg-[#1D2A25]/50 border border-[#DED8CB] dark:border-[#283931] text-[11px] font-mono text-[#3E4B44] dark:text-[#C5D4C9] overflow-x-auto max-h-60">
                  {JSON.stringify(inspectAuditItem.details, null, 2)}
                </pre>
              </div>
            </div>

            <div className="flex items-center justify-end border-t border-[#DED8CB] dark:border-[#283931] pt-4">
              <Button variant="secondary" size="sm" onClick={() => setInspectAuditItem(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: LOG OPERATIONAL INCIDENT */}
      {createIncidentModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#16201C] border border-[#DED8CB] dark:border-[#283931] rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#DED8CB] dark:border-[#283931] pb-3">
              <h3 className="text-base font-bold text-[#202522] dark:text-[#F5F2EA]">Log Operational Incident</h3>
              <button
                type="button"
                onClick={() => setCreateIncidentModalOpen(false)}
                className="text-[#54625A] dark:text-[#C5D4C9] hover:text-[#202522] dark:hover:text-[#F5F2EA]"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-[#54625A] dark:text-[#C5D4C9] block mb-1">
                  Incident Title <span className="text-rose-400">*</span>
                </label>
                <TextInput
                  value={incidentTitle}
                  onChange={(e) => setIncidentTitle(e.target.value)}
                  placeholder="e.g., SMTP Notification gateway latency spike"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#54625A] dark:text-[#C5D4C9] block mb-1">Severity</label>
                  <Select
                    value={incidentSeverity}
                    onChange={(e) => setIncidentSeverity(e.target.value as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL')}
                    options={[
                      { value: 'LOW', label: 'Low (Minor cosmetic / non-blocking)' },
                      { value: 'MEDIUM', label: 'Medium (Degraded performance)' },
                      { value: 'HIGH', label: 'High (Partial service failure)' },
                      { value: 'CRITICAL', label: 'Critical (Platform-wide outage)' },
                    ]}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#54625A] dark:text-[#C5D4C9] block mb-1">Affected Subsystem</label>
                  <TextInput
                    value={incidentSubsystem}
                    onChange={(e) => setIncidentSubsystem(e.target.value)}
                    placeholder="e.g., Database, Notifications, Storage"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#54625A] dark:text-[#C5D4C9] block mb-1">
                  Description & Impact <span className="text-rose-400">*</span>
                </label>
                <TextArea
                  rows={3}
                  value={incidentDesc}
                  onChange={(e) => setIncidentDesc(e.target.value)}
                  placeholder="Provide detailed diagnostic observations and observed symptoms..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[#DED8CB] dark:border-[#283931] pt-4">
              <Button variant="ghost" size="sm" onClick={() => setCreateIncidentModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleCreateIncident}
                isLoading={savingIncident}
              >
                Record Incident
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 7: UPDATE INCIDENT STATUS / RESOLUTION */}
      {selectedIncidentForUpdate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#16201C] border border-[#DED8CB] dark:border-[#283931] rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="border-b border-[#DED8CB] dark:border-[#283931] pb-3">
              <h3 className="text-base font-bold text-[#202522] dark:text-[#F5F2EA]">Update Incident Status</h3>
              <p className="text-xs text-[#54625A] dark:text-[#C5D4C9]">
                {selectedIncidentForUpdate.incidentNumber} &bull; {selectedIncidentForUpdate.title}
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-[#54625A] dark:text-[#C5D4C9] block mb-1">Status</label>
                <Select
                  value={updateIncidentStatus}
                  onChange={(e) => setUpdateIncidentStatus(e.target.value as 'OPEN' | 'INVESTIGATING' | 'MONITORING' | 'RESOLVED')}
                  options={[
                    { value: 'OPEN', label: 'Open' },
                    { value: 'INVESTIGATING', label: 'Investigating' },
                    { value: 'MONITORING', label: 'Monitoring' },
                    { value: 'RESOLVED', label: 'Resolved' },
                  ]}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#54625A] dark:text-[#C5D4C9] block mb-1">
                  Resolution Notes {updateIncidentStatus === 'RESOLVED' && <span className="text-rose-400">* (Mandatory for resolution)</span>}
                </label>
                <TextArea
                  rows={3}
                  value={incidentResolutionNotes}
                  onChange={(e) => setIncidentResolutionNotes(e.target.value)}
                  placeholder="Describe root cause and resolution steps implemented..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[#DED8CB] dark:border-[#283931] pt-4">
              <Button variant="ghost" size="sm" onClick={() => setSelectedIncidentForUpdate(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleUpdateIncidentStatus}
                isLoading={savingIncident}
              >
                Update Incident
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 8: ONBOARD GOVERNMENT OFFICIAL */}
      {createOfficialModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#16201C] border border-[#DED8CB] dark:border-[#283931] rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#DED8CB] dark:border-[#283931] pb-3">
              <div>
                <h3 className="text-base font-bold text-[#202522] dark:text-[#F5F2EA]">Onboard Government Official</h3>
                <p className="text-xs text-[#54625A] dark:text-[#C5D4C9]">
                  Provision an official account with departmental grievance processing privileges.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreateOfficialModalOpen(false)}
                className="text-[#54625A] dark:text-[#C5D4C9] hover:text-[#202522] dark:hover:text-[#F5F2EA]"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateOfficial} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-[#54625A] dark:text-[#C5D4C9] block mb-1">
                  Full Name <span className="text-rose-400">*</span>
                </label>
                <TextInput
                  value={newOfficialName}
                  onChange={(e) => setNewOfficialName(e.target.value)}
                  placeholder="e.g., Jane Doe"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#54625A] dark:text-[#C5D4C9] block mb-1">
                  Government / Official Email <span className="text-rose-400">*</span>
                </label>
                <TextInput
                  type="email"
                  value={newOfficialEmail}
                  onChange={(e) => setNewOfficialEmail(e.target.value)}
                  placeholder="e.g., jane.doe@civora.gov"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#54625A] dark:text-[#C5D4C9] block mb-1">Phone Number</label>
                <TextInput
                  type="tel"
                  value={newOfficialPhone}
                  onChange={(e) => setNewOfficialPhone(e.target.value)}
                  placeholder="e.g., +15551234567"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#54625A] dark:text-[#C5D4C9] block mb-1">
                  Department Assignment <span className="text-rose-400">*</span>
                </label>
                <Select
                  value={newOfficialDepartmentId}
                  onChange={(e) => setNewOfficialDepartmentId(e.target.value)}
                  options={[
                    { value: '', label: '-- Select Department --' },
                    ...departments.map((dept) => ({
                      value: dept.id,
                      label: `${dept.name} (${dept.code})`,
                    })),
                  ]}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#54625A] dark:text-[#C5D4C9] block mb-1">
                  Initial Password <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <TextInput
                    type={newOfficialShowPassword ? 'text' : 'password'}
                    value={newOfficialPassword}
                    onChange={(e) => setNewOfficialPassword(e.target.value)}
                    placeholder="Min 8 chars, 1 uppercase, 1 lowercase, 1 number"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setNewOfficialShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#54625A] dark:text-[#C5D4C9] hover:text-[#202522] dark:text-[#E8F0EC] text-xs"
                  >
                    {newOfficialShowPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <span className="text-[10px] text-[#54625A] dark:text-[#C5D4C9] mt-1 block">
                  Password must meet platform security standards (uppercase, lowercase, number).
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[#DED8CB] dark:border-[#283931] pt-4 mt-4">
                <Button variant="ghost" size="sm" type="button" onClick={() => setCreateOfficialModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  type="submit"
                  isLoading={creatingOfficial}
                  disabled={!newOfficialName || !newOfficialEmail || !newOfficialPassword || !newOfficialDepartmentId}
                >
                  Onboard Official
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 9: APPROVE CONTRACTOR APPLICATION */}
      {selectedContractorForApprove && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#16201C] border border-emerald-500/40 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="border-b border-[#DED8CB] dark:border-[#283931] pb-3">
              <h3 className="text-base font-bold text-[#202522] dark:text-[#F5F2EA]">Approve Contractor Application</h3>
              <p className="text-xs text-[#54625A] dark:text-[#C5D4C9]">
                Verify this contractor and activate the applicant account for municipal tenders.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-[#ECE7DB]/50 dark:bg-[#1D2A25]/50 border border-[#DED8CB] dark:border-[#283931] space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-[#54625A] dark:text-[#C5D4C9]">Company Name:</span>
                <span className="text-[#202522] dark:text-[#F5F2EA] font-semibold">{selectedContractorForApprove.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#54625A] dark:text-[#C5D4C9]">Registration Number:</span>
                <span className="font-mono font-semibold text-sky-700 dark:text-sky-400">{selectedContractorForApprove.registrationNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#54625A] dark:text-[#C5D4C9]">Categories / Class:</span>
                <span className="text-[#3E4B44] dark:text-[#C5D4C9]">
                  {selectedContractorForApprove.workCategories?.join(', ') || selectedContractorForApprove.licenseClass || 'General'}
                </span>
              </div>
              {selectedContractorForApprove.users?.[0] && (
                <div className="flex justify-between">
                  <span className="text-[#54625A] dark:text-[#C5D4C9]">Applicant:</span>
                  <span className="text-[#3E4B44] dark:text-[#C5D4C9]">
                    {selectedContractorForApprove.users[0].name} ({selectedContractorForApprove.users[0].email})
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#54625A] dark:text-[#C5D4C9] block">
                Verification Notes / Audit Summary <span className="text-[#54625A] dark:text-[#C5D4C9]">(Optional)</span>
              </label>
              <TextArea
                rows={3}
                value={approveNotes}
                onChange={(e) => setApproveNotes(e.target.value)}
                placeholder="e.g., Verified license against Municipal Registry database. Approved for electrical contracts."
              />
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[#DED8CB] dark:border-[#283931] pt-4">
              <Button variant="ghost" size="sm" onClick={() => setSelectedContractorForApprove(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleApproveContractor}
                isLoading={approvingContractor}
              >
                Confirm Approval & Activate Account
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 10: REJECT CONTRACTOR APPLICATION */}
      {selectedContractorForReject && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#16201C] border border-rose-500/40 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 border-b border-[#DED8CB] dark:border-[#283931] pb-3">
              <AlertTriangleIcon className="w-6 h-6 text-rose-500" />
              <div>
                <h3 className="text-base font-bold text-[#202522] dark:text-[#F5F2EA]">Reject Contractor Application</h3>
                <p className="text-xs text-[#54625A] dark:text-[#C5D4C9]">
                  {selectedContractorForReject.name} ({selectedContractorForReject.registrationNumber})
                </p>
              </div>
            </div>

            <p className="text-xs text-[#3E4B44] dark:text-[#C5D4C9]">
              Rejecting this contractor application will set the contractor entity to <strong>INACTIVE</strong> and suspend the linked applicant account. The rejection reason will be visible when the applicant checks their registration status.
            </p>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#54625A] dark:text-[#C5D4C9] block">
                Mandatory Rejection Reason <span className="text-rose-400">*</span>
              </label>
              <TextArea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Specify reason for rejection (e.g., Expired municipal business license)..."
                required
              />
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[#DED8CB] dark:border-[#283931] pt-4">
              <Button variant="ghost" size="sm" onClick={() => setSelectedContractorForReject(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="bg-rose-600 hover:bg-rose-500 text-white"
                onClick={handleRejectContractor}
                isLoading={rejectingContractor}
                disabled={!rejectReason.trim() || rejectReason.trim().length < 5}
              >
                Confirm Rejection
              </Button>
            </div>
          </div>
        </div>
      )}
    </Container>
  );
}
