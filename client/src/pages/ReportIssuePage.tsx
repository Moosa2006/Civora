import { useState, useEffect, useRef, useCallback } from 'react';
import { Container } from '../components/layout/Container';
import { PageHeading } from '../components/ui/PageHeading';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { FormField } from '../components/ui/FormField';
import { TextInput } from '../components/ui/TextInput';
import { TextArea } from '../components/ui/TextArea';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import {
  MapPinIcon,
  ShieldCheckIcon,
  CheckCircleIcon,
  CameraIcon,
  CloseIcon,
} from '../components/ui/icons';
import { useAuth } from '../context/useAuth';
import { useRouter } from '../router';
import { LocationPickerModal } from '../components/map/LocationPickerModal';
import { useTranslation } from '../context/useTranslation';
import { announceToScreenReader } from '../components/ui/LiveAnnouncer';
import type { ComplaintCategory, ComplaintPriority } from '../types/complaint';
import type { DuplicateCandidate } from '../types/moderation';

export function ReportIssuePage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { navigate } = useRouter();
  const { t } = useTranslation();

  // Category list loaded from backend
  const [categories, setCategories] = useState<ComplaintCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  // Form State
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [priority, setPriority] = useState<ComplaintPriority>('MEDIUM');
  const [locality, setLocality] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [ward, setWard] = useState('');
  const [description, setDescription] = useState('');
  const [latitude, setLatitude] = useState<string>('');
  const [longitude, setLongitude] = useState<string>('');

  // Evidence attachments state (Module 12)
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // UI / Submission state
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [locationStatus, setLocationStatus] = useState<string | null>(null);
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);
  const [locationSource, setLocationSource] = useState<'GPS_DEVICE' | 'MAP_PICKER' | 'MANUAL_ENTRY'>('MANUAL_ENTRY');
  const [isLocationPublic, setIsLocationPublic] = useState(true);

  // Module 14: Duplicate detection advisory state
  const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateCandidate[]>([]);
  const [duplicateWarningDismissed, setDuplicateWarningDismissed] = useState(false);

  // Success state
  const [submittedData, setSubmittedData] = useState<{
    trackingId: string;
    title: string;
    status: string;
    createdAt: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Module 15: Draft persistence & offline resilience
  const DRAFT_STORAGE_KEY = 'civora_complaint_draft';
  const [draftRestoredBanner, setDraftRestoredBanner] = useState(false);

  // Restore draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.title || parsed.description) {
          setTitle(parsed.title || '');
          if (parsed.categoryId) setCategoryId(parsed.categoryId);
          if (parsed.priority) setPriority(parsed.priority);
          setLocality(parsed.locality || '');
          setLocationAddress(parsed.locationAddress || '');
          setWard(parsed.ward || '');
          setDescription(parsed.description || '');
          setLatitude(parsed.latitude || '');
          setLongitude(parsed.longitude || '');
          setIsLocationPublic(parsed.isLocationPublic !== false);
          setDraftRestoredBanner(true);
          announceToScreenReader(t('complaints.draftRestored'));
        }
      }
    } catch {
      // Ignore parse failure
    }
  }, [t]);

  // Debounced auto-save draft
  useEffect(() => {
    if (!title && !description && !locality) return;
    const timer = setTimeout(() => {
      try {
        const draft = {
          title,
          categoryId,
          priority,
          locality,
          locationAddress,
          ward,
          description,
          latitude,
          longitude,
          isLocationPublic,
          savedAt: new Date().toISOString(),
        };
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
      } catch {
        // Storage full/unavailable
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [title, categoryId, priority, locality, locationAddress, ward, description, latitude, longitude, isLocationPublic]);

  const handleDiscardDraft = () => {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {}
    setDraftRestoredBanner(false);
    handleResetForm();
    announceToScreenReader('Draft discarded.');
  };

  // Fetch active categories on mount
  const loadCategories = useCallback(async () => {
    setLoadingCategories(true);
    try {
      const res = await fetch('/api/meta/categories');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setCategories(json.data);
        if (json.data.length > 0) {
          setCategoryId((prev) => prev || json.data[0].id);
        }
      }
    } catch {
      setErrorMsg('Failed to load categories. Please check your internet connection.');
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  // Module 14: Debounced duplicate detection
  useEffect(() => {
    if (title.trim().length < 5 || description.trim().length < 8 || !categoryId) {
      setDuplicateCandidates([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/moderation/duplicates/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim(),
            categoryId,
            locality: locality.trim() || undefined,
            ward: ward.trim() || undefined,
            latitude: latitude ? parseFloat(latitude) : undefined,
            longitude: longitude ? parseFloat(longitude) : undefined,
          }),
        });
        const data = await res.json();
        if (data.success && data.data?.candidates?.length > 0) {
          setDuplicateCandidates(data.data.candidates);
        } else {
          setDuplicateCandidates([]);
        }
      } catch {
        // Non-blocking duplicate check
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [title, description, categoryId, locality, ward, latitude, longitude]);

  // Geolocation handler (requested explicitly by user click)
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('Geolocation is not supported by your browser.');
      return;
    }

    setLocationStatus('Locating device...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        setLatitude(lat);
        setLongitude(lng);
        setLocationSource('GPS_DEVICE');
        setLocationStatus(`Acquired via GPS: ${lat}, ${lng}`);
      },
      (err) => {
        setLocationStatus(`Could not acquire location: ${err.message}`);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleConfirmPickedLocation = (coords: {
    latitude: number;
    longitude: number;
    locality?: string;
    ward?: string;
    source: 'GPS_DEVICE' | 'MAP_PICKER' | 'MANUAL_ENTRY';
  }) => {
    setLatitude(coords.latitude.toFixed(5));
    setLongitude(coords.longitude.toFixed(5));
    setLocationSource(coords.source);
    if (coords.locality && !locality.trim()) setLocality(coords.locality);
    if (coords.ward && !ward.trim()) setWard(coords.ward);
    setLocationStatus(
      `Selected via ${coords.source === 'MAP_PICKER' ? 'Interactive Map' : 'Device GPS'}: ${coords.latitude}, ${coords.longitude}`
    );
  };

  const handleCopyTrackingId = async () => {
    if (!submittedData?.trackingId) return;
    try {
      await navigator.clipboard.writeText(submittedData.trackingId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEvidenceError(null);
    if (!e.target.files) return;

    const selected = Array.from(e.target.files);
    if (selected.length + evidenceFiles.length > 5) {
      setEvidenceError('Maximum 5 files can be attached during initial filing.');
      return;
    }

    const allowed = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];
    const valid: File[] = [];
    for (const f of selected) {
      const ext = f.name.split('.').pop()?.toLowerCase();
      if (!ext || !allowed.includes(ext)) {
        setEvidenceError(`Unsupported format for '${f.name}'. Allowed: JPG, PNG, WebP, PDF.`);
        return;
      }
      if (f.size > 10 * 1024 * 1024) {
        setEvidenceError(`File '${f.name}' exceeds the 10MB limit.`);
        return;
      }
      valid.push(f);
    }

    setEvidenceFiles((prev) => [...prev, ...valid]);
  };

  const handleRemoveFile = (index: number) => {
    setEvidenceFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setFieldErrors({});

    // Client-side quick checks
    if (title.trim().length < 5) {
      setErrorMsg('Issue title must be at least 5 characters long.');
      return;
    }
    if (!categoryId) {
      setErrorMsg('Please select a civic category.');
      return;
    }
    if (locality.trim().length < 2) {
      setErrorMsg('Please specify a locality or landmark (at least 2 characters).');
      return;
    }
    if (locationAddress.trim().length < 3) {
      setErrorMsg('Please provide a street address or location description.');
      return;
    }
    if (description.trim().length < 10) {
      setErrorMsg('Detailed description must be at least 10 characters long.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        title: title.trim(),
        categoryId,
        priority,
        locality: locality.trim(),
        locationAddress: locationAddress.trim(),
        description: description.trim(),
      };

      if (ward.trim()) {
        payload.ward = ward.trim();
      }

      if (latitude && !isNaN(Number(latitude))) {
        payload.latitude = parseFloat(latitude);
        payload.locationSource = locationSource;
        payload.isLocationPublic = isLocationPublic;
      }
      if (longitude && !isNaN(Number(longitude))) {
        payload.longitude = parseFloat(longitude);
      }

      const res = await fetch('/api/complaints', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        if (json.error?.details) {
          setFieldErrors(json.error.details);
        }
        setErrorMsg(json.error?.message || 'Failed to submit complaint. Please check your inputs.');
        setSubmitting(false);
        return;
      }

      // If initial evidence files were attached, upload them immediately to Module 12 endpoint
      if (evidenceFiles.length > 0 && json.data?.complaint?.id) {
        try {
          const formData = new FormData();
          evidenceFiles.forEach((file) => formData.append('files', file));
          formData.append('evidencePurpose', 'CITIZEN_SUPPORTING');
          formData.append(
            'description',
            'Initial photograph/document evidence submitted during complaint filing.'
          );

          await fetch(`/api/evidence/complaints/${json.data.complaint.id}/upload`, {
            method: 'POST',
            credentials: 'include',
            body: formData,
          });
        } catch (uploadErr) {
          console.warn('[Evidence Upload Error during complaint lodging]:', uploadErr);
        }
      }

      // Success
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
        setDraftRestoredBanner(false);
      } catch {}
      setSubmittedData({
        trackingId: json.data.trackingId,
        title: json.data.complaint.title,
        status: json.data.complaint.status,
        createdAt: json.data.complaint.createdAt,
      });
      announceToScreenReader(t('complaints.successTitle'));
      window.scrollTo(0, 0);
    } catch {
      setErrorMsg(t('complaints.networkErrorNotice'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setTitle('');
    if (categories.length > 0) setCategoryId(categories[0].id);
    setPriority('MEDIUM');
    setLocality('');
    setLocationAddress('');
    setWard('');
    setDescription('');
    setLatitude('');
    setLongitude('');
    setEvidenceFiles([]);
    setEvidenceError(null);
    setLocationStatus(null);
    setSubmittedData(null);
    setFieldErrors({});
  };

  // If not authenticated, prompt sign-in
  if (!authLoading && !isAuthenticated) {
    return (
      <Container size="md" className="py-12 space-y-6">
        <PageHeading
          title="Report a Civic Issue"
          description="Log damaged roads, broken streetlights, water leakages, or sanitation problems."
        />

        <Card>
          <CardHeader>
            <div className="w-12 h-12 rounded-xl bg-[#173D32]/10 border border-[#173D32]/20 dark:bg-[#215748]/30 dark:border-[#4F9B8B]/30 flex items-center justify-center text-[#173D32] dark:text-[#7BC4B2] mb-3">
              <ShieldCheckIcon className="w-6 h-6" />
            </div>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>
              To maintain accountability and prevent duplicate or spam filings, civic complaints must be linked to a verified citizen account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-[#3E4B44] dark:text-[#C5D4C9]">
              Please sign in with your citizen credentials or register a free account. Once signed in, you will be able to lodge issues, receive live progress updates, and verify municipal resolution.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button variant="primary" onClick={() => navigate('/login')}>
                Sign In to Report
              </Button>
              <Button variant="outline" onClick={() => navigate('/register')}>
                Register New Account
              </Button>
            </div>
          </CardContent>
        </Card>
      </Container>
    );
  }

  // Success Screen
  if (submittedData) {
    return (
      <Container size="md" className="py-10 space-y-8">
        <Card className="border-[#1E6B52]/30 bg-white dark:bg-[#16201C] shadow-sm">
          <CardContent className="pt-8 text-center space-y-6">
            <div className="w-16 h-16 mx-auto rounded-full bg-[#1E6B52]/10 border border-[#1E6B52]/25 flex items-center justify-center text-[#1E6B52] dark:text-[#78C7AE]">
              <CheckCircleIcon className="w-9 h-9" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-heading font-bold tracking-tight text-[#202522] dark:text-[#F5F2EA]">
                Complaint Lodged Successfully!
              </h2>
              <p className="text-sm text-[#3E4B44] dark:text-[#C5D4C9] max-w-lg mx-auto">
                Your civic issue has been officially registered with the municipal grievance portal. A unique tracking identifier has been generated.
              </p>
            </div>

            {/* Tracking ID Callout */}
            <div className="p-5 rounded-xl bg-[#FAF8F5] dark:bg-[#141C18] border border-[#DED8CB] dark:border-[#283931] max-w-md mx-auto space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#3E4B44] dark:text-[#C5D4C9] block">
                Official Tracking Identifier
              </span>
              <div className="flex items-center justify-center gap-3">
                <span className="text-2xl sm:text-3xl font-mono font-extrabold text-[#173D32] dark:text-[#7BC4B2] tracking-wider">
                  {submittedData.trackingId}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyTrackingId}
                  className="cursor-pointer"
                >
                  {copied ? 'Copied!' : 'Copy ID'}
                </Button>
              </div>
              <p className="text-xs text-[#54625A] dark:text-[#889B90]">
                Keep this ID handy. You can use it anytime on the tracking page to check review status and field inspection notes.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2">
              <span className="text-xs text-[#4A5750] dark:text-[#B0C0B6]">Initial Status:</span>
              <Badge variant="info" size="sm" hasDot>
                {submittedData.status}
              </Badge>
            </div>

            <div className="pt-4 border-t border-[#EAE5D9] dark:border-[#283931] flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                variant="primary"
                onClick={() => navigate(`/track?id=${submittedData.trackingId}`)}
              >
                Track Live Status
              </Button>
              <Button variant="secondary" onClick={() => navigate('/my-complaints')}>
                View My Complaints
              </Button>
              <Button variant="ghost" onClick={handleResetForm}>
                Report Another Issue
              </Button>
            </div>
          </CardContent>
        </Card>
      </Container>
    );
  }

  // Active Form View
  return (
    <Container size="lg" className="space-y-8">
      {/* Draft Restored Banner */}
      {draftRestoredBanner && (
        <div className="flex items-center justify-between p-3.5 bg-[#EDF5F7] dark:bg-[#122329] border border-[#B7D8DE] dark:border-[#224550] rounded-xl text-xs text-[#1D515E] dark:text-[#8FD0DE]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#173D32] dark:bg-[#4F9B8B]" />
            <span>{t('complaints.draftRestored')}</span>
          </div>
          <button
            type="button"
            onClick={handleDiscardDraft}
            className="text-xs text-[#173D32] dark:text-[#7BC4B2] hover:underline cursor-pointer p-1 font-semibold"
          >
            {t('complaints.discardDraft')}
          </button>
        </div>
      )}

      {/* Page Header */}
      <PageHeading
        title={t('complaints.reportHeading')}
        description={t('complaints.reportSubheading')}
        badge={
          <Badge variant="info" size="md" hasDot>
            Civic Grievance Desk
          </Badge>
        }
      />

      {errorMsg && (
        <Alert variant="error" title="Submission Error">
          {errorMsg}
        </Alert>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Form Inputs */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Complaint Details</CardTitle>
                <CardDescription>
                  Provide clear, accurate information to facilitate swift municipal inspection and resolution.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-5">
                {/* Title */}
                <FormField
                  id="issue-title"
                  label={t('complaints.titleLabel')}
                  required
                  helperText="Provide a brief summary (5-255 characters)"
                  error={fieldErrors.title?.[0]}
                >
                  <TextInput
                    id="issue-title"
                    placeholder={t('complaints.titlePlaceholder')}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={255}
                    required
                  />
                </FormField>

                {/* Category & Priority */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    id="issue-category"
                    label={t('complaints.categoryLabel')}
                    required
                    helperText="Assigned to the responsible department"
                    error={fieldErrors.categoryId?.[0]}
                  >
                    <Select
                      id="issue-category"
                      placeholder={loadingCategories ? 'Loading categories...' : t('complaints.categoryPlaceholder')}
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      options={categories.map((c) => ({
                        value: c.id,
                        label: c.name,
                      }))}
                      disabled={loadingCategories}
                    />
                    {!loadingCategories && categories.length === 0 && (
                      <div className="mt-2 flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        <span>Municipal complaint categories are initializing...</span>
                        <button
                          type="button"
                          onClick={() => void loadCategories()}
                          className="font-semibold text-emerald-700 underline hover:text-emerald-900"
                        >
                          Retry
                        </button>
                      </div>
                    )}
                  </FormField>

                  <FormField
                    id="issue-priority"
                    label="Citizen Urgency Assessment"
                    helperText="Assists municipal triage priority"
                  >
                    <Select
                      id="issue-priority"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as ComplaintPriority)}
                      options={[
                        { value: 'LOW', label: 'Low — General maintenance' },
                        { value: 'MEDIUM', label: 'Medium — Normal attention' },
                        { value: 'HIGH', label: 'High — Immediate hazard' },
                        { value: 'URGENT', label: 'Urgent — Safety/structural emergency' },
                      ]}
                    />
                  </FormField>
                </div>

                {/* Locality & Ward */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    id="issue-locality"
                    label="Locality / Landmark"
                    required
                    helperText="Neighborhood, sector, or prominent landmark"
                    error={fieldErrors.locality?.[0]}
                  >
                    <TextInput
                      id="issue-locality"
                      placeholder="e.g. Indiranagar 2nd Stage"
                      value={locality}
                      onChange={(e) => setLocality(e.target.value)}
                      required
                    />
                  </FormField>

                  <FormField
                    id="issue-ward"
                    label="Ward Number / Name"
                    helperText="Optional municipal ward identifier"
                    error={fieldErrors.ward?.[0]}
                  >
                    <TextInput
                      id="issue-ward"
                      placeholder="e.g. Ward 112 (Domlur)"
                      value={ward}
                      onChange={(e) => setWard(e.target.value)}
                    />
                  </FormField>
                </div>

                {/* Exact Address */}
                <FormField
                  id="issue-address"
                  label="Street Address / Exact Location"
                  required
                  helperText="Nearest building number, road name, or cross intersection"
                  error={fieldErrors.locationAddress?.[0]}
                >
                  <TextInput
                    id="issue-address"
                    placeholder="e.g. Opposite Metro Pillar 145, 12th Main Road"
                    value={locationAddress}
                    onChange={(e) => setLocationAddress(e.target.value)}
                    required
                  />
                </FormField>

                {/* Detailed Description */}
                <FormField
                  id="issue-description"
                  label="Detailed Description"
                  required
                  helperText={`Provide specific observations (min 10 chars). Length: ${description.length}/3000`}
                  error={fieldErrors.description?.[0]}
                >
                  <TextArea
                    id="issue-description"
                    placeholder="Describe the nature of the issue, severity, how long it has persisted, and any impact on pedestrians or vehicles..."
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={3000}
                    required
                  />
                </FormField>

                {/* Geolocation Section */}
                <div className="p-4 rounded-xl bg-[#ECE7DB]/50 dark:bg-[#1D2A25]/50 border border-[#DED8CB] dark:border-[#283931] space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-semibold text-[#202522] dark:text-[#E8F0EC] block">
                        GPS Coordinates (Optional)
                      </span>
                      <span className="text-[11px] text-[#54625A] dark:text-[#C5D4C9]">
                        Pins exact location for field engineers
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setIsMapPickerOpen(true)}
                        leftIcon={<MapPinIcon className="w-4 h-4 text-[#185541] dark:text-[#78C7AE]" />}
                        className="cursor-pointer"
                      >
                        Pick on Map
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleGetLocation}
                        leftIcon={<MapPinIcon className="w-4 h-4 text-[#173D32] dark:text-[#7BC4B2]" />}
                        className="cursor-pointer"
                      >
                        Use GPS
                      </Button>
                    </div>
                  </div>

                  {locationStatus && (
                    <p className="text-xs text-[#1D584D] dark:text-[#7BC4B2] font-mono font-semibold">{locationStatus}</p>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <TextInput
                      id="issue-latitude"
                      placeholder="Latitude (e.g. 12.9784)"
                      value={latitude}
                      onChange={(e) => setLatitude(e.target.value)}
                    />
                    <TextInput
                      id="issue-longitude"
                      placeholder="Longitude (e.g. 77.6408)"
                      value={longitude}
                      onChange={(e) => setLongitude(e.target.value)}
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1 text-xs text-[#3E4B44] dark:text-[#C5D4C9]">
                    <input
                      type="checkbox"
                      id="is-location-public"
                      checked={isLocationPublic}
                      onChange={(e) => setIsLocationPublic(e.target.checked)}
                      className="rounded border-[#DED8CB] dark:border-[#283931] bg-[#ECE7DB] dark:bg-[#1D2A25] text-[#173D32] focus:ring-[#173D32]"
                    />
                    <label htmlFor="is-location-public" className="cursor-pointer">
                      Display generalized location on public discovery map (uncheck to keep coordinates private)
                    </label>
                  </div>
                </div>

                {/* Supporting Photographic & Document Evidence (Module 12) */}
                <div className="p-4 rounded-xl bg-[#ECE7DB]/50 dark:bg-[#1D2A25]/50 border border-[#DED8CB] dark:border-[#283931] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-[#202522] dark:text-[#E8F0EC] block flex items-center gap-1.5">
                        <CameraIcon className="w-4 h-4 text-[#185541] dark:text-[#78C7AE]" />
                        Supporting Photographs & Documents (Optional)
                      </span>
                      <span className="text-[11px] text-[#54625A] dark:text-[#C5D4C9]">
                        Attach road, garbage, or streetlight photos (JPG, PNG, WebP, PDF • Max 10MB each)
                      </span>
                    </div>
                  </div>

                  {evidenceError && <Alert variant="error">{evidenceError}</Alert>}

                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-[#C2BAA8] dark:border-[#3D5449] hover:border-[#173D32] dark:hover:border-[#7BC4B2] rounded-xl p-4 text-center cursor-pointer transition-colors bg-[#ECE7DB]/30 dark:bg-[#1D2A25]/30"
                  >
                    <CameraIcon className="w-6 h-6 text-[#54625A] dark:text-[#C5D4C9] mx-auto mb-1.5" />
                    <p className="text-xs text-[#202522] dark:text-[#F5F2EA] font-semibold">Click to attach supporting files</p>
                    <p className="text-[11px] text-[#54625A] dark:text-[#C5D4C9] mt-0.5">Up to 5 files per complaint submission</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </div>

                  {evidenceFiles.length > 0 && (
                    <div className="space-y-1.5 bg-[#ECE7DB]/50 dark:bg-[#1D2A25]/50 p-2.5 rounded-lg border border-[#DED8CB] dark:border-[#283931]">
                      <span className="text-[11px] font-semibold text-[#202522] dark:text-[#F5F2EA] block mb-1">
                        Files ready to attach ({evidenceFiles.length}):
                      </span>
                      {evidenceFiles.map((file, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-xs text-[#202522] dark:text-[#F5F2EA] bg-white dark:bg-[#16201C] px-2.5 py-1 rounded border border-[#DED8CB] dark:border-[#283931]"
                        >
                          <span className="truncate max-w-[280px]">{file.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-[#54625A] dark:text-[#C5D4C9] font-mono">
                              {Math.round(file.size / 1024)} KB
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveFile(idx)}
                              className="text-[#9C3B2D] hover:text-[#832E22]"
                            >
                              <CloseIcon className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Module 14: Duplicate Complaint Advisory Banner */}
                {duplicateCandidates.length > 0 && !duplicateWarningDismissed && (
                  <div className="p-4 rounded-xl bg-[#FDF6ED] dark:bg-[#281D0E] border border-[#F2D7A5] dark:border-[#533916] text-[#854F0B] dark:text-[#F3BA6C] text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[#854F0B] dark:text-[#F3BA6C] flex items-center gap-1.5">
                        Notice: Similar civic reports found in this area
                      </span>
                      <button
                        type="button"
                        onClick={() => setDuplicateWarningDismissed(true)}
                        className="text-[#854F0B] dark:text-[#F3BA6C] hover:underline text-xs font-semibold cursor-pointer"
                      >
                        Dismiss Notice
                      </button>
                    </div>
                    <p className="text-[#3E4B44] dark:text-[#C5D4C9] leading-relaxed">
                      We detected {duplicateCandidates.length} existing public complaint(s) with matching details. Multiple reports reinforce community demand and accelerate resolution! If your issue adds fresh details or photos, you are encouraged to submit.
                    </p>
                    <div className="space-y-1.5 pt-1">
                      {duplicateCandidates.slice(0, 2).map((dc) => (
                        <div
                          key={dc.id}
                          className="p-2 rounded bg-white dark:bg-[#16201C] border border-[#F2D7A5] dark:border-[#533916] flex items-center justify-between"
                        >
                          <span className="font-medium text-[#202522] dark:text-[#E8F0EC] truncate pr-2">{dc.title}</span>
                          <span className="text-[11px] text-[#854F0B] dark:text-[#F3BA6C] font-mono shrink-0">
                            {dc.trackingId} &bull; {Math.round(dc.similarityScore * 100)}% match
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Submission CTA */}
                <div className="pt-4 flex items-center justify-end gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleResetForm}
                    disabled={submitting}
                  >
                    Clear Form
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={submitting || loadingCategories}
                    className="cursor-pointer"
                  >
                    {submitting ? t('complaints.submittingBtn') : t('complaints.submitBtn')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Guidelines Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Filing Guidelines</CardTitle>
                <CardDescription>
                  How Civora processes and routes civic grievances
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs text-[#3E4B44] dark:text-[#C5D4C9]">
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#173D32]/10 text-[#173D32] dark:bg-[#215748]/30 dark:text-[#E8F0EC] font-bold flex items-center justify-center shrink-0">
                    1
                  </div>
                  <div>
                    <strong className="text-[#202522] dark:text-[#E8F0EC] block mb-0.5">Tracking ID Generation</strong>
                    A cryptographic identifier is assigned immediately upon receipt.
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#B26A15]/15 text-[#854F0B] dark:bg-[#3D280B] dark:text-[#F3B768] font-bold flex items-center justify-center shrink-0">
                    2
                  </div>
                  <div>
                    <strong className="text-[#202522] dark:text-[#E8F0EC] block mb-0.5">Department Triage</strong>
                    The nodal municipal officer inspects the filing and dispatches the ward crew.
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#1E6B52]/15 text-[#185541] dark:bg-[#183B2E] dark:text-[#78C7AE] font-bold flex items-center justify-center shrink-0">
                    3
                  </div>
                  <div>
                    <strong className="text-[#202522] dark:text-[#E8F0EC] block mb-0.5">Transparent Resolution</strong>
                    Work progress notes and timestamped audit logs are recorded permanently.
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#DED8CB] dark:border-[#283931]">
              <CardContent className="pt-6 space-y-2">
                <div className="flex items-center gap-2 text-[#202522] dark:text-[#E8F0EC] text-xs font-semibold">
                  <ShieldCheckIcon className="w-4 h-4 text-[#185541] dark:text-[#78C7AE]" />
                  Public Accountability Standard
                </div>
                <p className="text-[11px] text-[#54625A] dark:text-[#C5D4C9] leading-relaxed">
                  Complaints are distinct from capital civic work projects. All actions by officers are auditable and subject to citizen review.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>

      {/* Location Picker Modal */}
      <LocationPickerModal
        isOpen={isMapPickerOpen}
        onClose={() => setIsMapPickerOpen(false)}
        onConfirm={handleConfirmPickedLocation}
        initialLat={latitude ? parseFloat(latitude) : undefined}
        initialLng={longitude ? parseFloat(longitude) : undefined}
      />
    </Container>
  );
}
