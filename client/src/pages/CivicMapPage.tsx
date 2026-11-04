import React, { useState, useEffect, useCallback } from 'react';
import { Container } from '../components/layout/Container';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { PageHeading } from '../components/ui/PageHeading';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { TextInput } from '../components/ui/TextInput';
import { Select } from '../components/ui/Select';
import { Alert } from '../components/ui/Alert';
import { CivicMap } from '../components/map/CivicMap';
import { MapPinIcon } from '../components/ui/icons';
import { useRouter } from '../router';
import { useTranslation } from '../context/useTranslation';
import type { GeoComplaintMarker, GeoHotspot, KnownLocality } from '../types';

export const CivicMapPage: React.FC = () => {
  const { navigate } = useRouter();
  const { t } = useTranslation();

  // View state: 'map' | 'list'
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');

  // Filter states
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('');
  const [selectedLocality, setSelectedLocality] = useState('');

  // Nearby mode
  const [isNearbyActive, setIsNearbyActive] = useState(false);
  const [nearbyRadius, setNearbyRadius] = useState('5');
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [nearbyStatus, setNearbyStatus] = useState<string | null>(null);

  // Data states
  const [markers, setMarkers] = useState<GeoComplaintMarker[]>([]);
  const [hotspots, setHotspots] = useState<GeoHotspot[]>([]);
  const [localities, setLocalities] = useState<KnownLocality[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedMarker, setSelectedMarker] = useState<GeoComplaintMarker | null>(null);
  const [showHotspotsDrawer, setShowHotspotsDrawer] = useState(false);

  // Status indicators
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load Categories & Localities on Mount
  useEffect(() => {
    async function fetchInitialMeta() {
      try {
        const [catRes, locRes, hotRes] = await Promise.all([
          fetch('/api/meta/categories'),
          fetch('/api/geo/localities'),
          fetch('/api/geo/hotspots?groupBy=ward'),
        ]);

        if (catRes.ok) {
          const catJson = await catRes.json();
          if (catJson.success) setCategories(catJson.data.categories || []);
        }

        if (locRes.ok) {
          const locJson = await locRes.json();
          if (locJson.success) setLocalities(locJson.data.localities || []);
        }

        if (hotRes.ok) {
          const hotJson = await hotRes.json();
          if (hotJson.success) setHotspots(hotJson.data.hotspots || []);
        }
      } catch (err) {
        console.error('Failed to load initial map metadata', err);
      }
    }
    fetchInitialMeta();
  }, []);

  // Fetch Complaints (Map Viewport or Nearby)
  const fetchComplaints = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (isNearbyActive && userCoords) {
        // Query nearby endpoint
        const params = new URLSearchParams({
          lat: String(userCoords.lat),
          lng: String(userCoords.lng),
          radiusKm: nearbyRadius,
          limit: '100',
        });
        if (selectedCategory) params.append('categoryId', selectedCategory);
        if (selectedStatus) params.append('status', selectedStatus);
        if (selectedPriority) params.append('priority', selectedPriority);
        if (search.trim()) params.append('search', search.trim());

        const res = await fetch(`/api/geo/nearby?${params.toString()}`);
        const json = await res.json();
        if (json.success) {
          setMarkers(json.data.complaints || []);
        } else {
          setError(json.error?.message || 'Failed to query nearby complaints.');
        }
      } else {
        // Query citywide / viewport complaints
        const params = new URLSearchParams({
          minLat: '12.80',
          maxLat: '13.15',
          minLng: '77.45',
          maxLng: '77.85',
          limit: '200',
        });
        if (selectedCategory) params.append('categoryId', selectedCategory);
        if (selectedStatus) params.append('status', selectedStatus);
        if (selectedPriority) params.append('priority', selectedPriority);
        if (selectedLocality) params.append('locality', selectedLocality);
        if (search.trim()) params.append('search', search.trim());

        const res = await fetch(`/api/geo/complaints?${params.toString()}`);
        const json = await res.json();
        if (json.success) {
          setMarkers(json.data.markers || []);
        } else {
          setError(json.error?.message || 'Failed to query map complaints.');
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Network error querying civic map.');
    } finally {
      setLoading(false);
    }
  }, [
    isNearbyActive,
    userCoords,
    nearbyRadius,
    selectedCategory,
    selectedStatus,
    selectedPriority,
    selectedLocality,
    search,
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchComplaints();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchComplaints]);

  // Activate Nearby Discovery
  const handleActivateNearby = () => {
    if (!navigator.geolocation) {
      setNearbyStatus('Geolocation is not supported by your browser.');
      return;
    }

    setNearbyStatus('Acquiring device GPS coordinates...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(5));
        const lng = Number(pos.coords.longitude.toFixed(5));
        setUserCoords({ lat, lng });
        setIsNearbyActive(true);
        setNearbyStatus(`Showing issues within ${nearbyRadius}km of your location`);
      },
      (err) => {
        setNearbyStatus(`Location error: ${err.message}. Using default city center.`);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleClearNearby = () => {
    setIsNearbyActive(false);
    setUserCoords(null);
    setNearbyStatus(null);
  };

  const handleResetFilters = () => {
    setSearch('');
    setSelectedCategory('');
    setSelectedStatus('');
    setSelectedPriority('');
    setSelectedLocality('');
    handleClearNearby();
  };

  const handleSelectHotspot = (h: GeoHotspot) => {
    setSelectedLocality(h.name);
    setShowHotspotsDrawer(false);
  };

  return (
    <Container size="xl" className="space-y-6">
      {/* Standardized Page Header */}
      <PageHeading
        title={t('civicMap.title')}
        description={t('civicMap.subtitle')}
        className="mb-0"
        badge={
          <Badge variant="info" size="md" hasDot>
            {t('nav.civicMap')}
          </Badge>
        }
        actions={
          <div className="flex items-center gap-1.5 bg-[#F3F4F6]/80 dark:bg-[#273548]/80 border border-[#E5E7EB] dark:border-[#374151] p-1 rounded-xl">
            <button
              type="button"
              data-active={viewMode === 'map'}
              onClick={() => setViewMode('map')}
              className={`civora-liquid-tab px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 ${
                viewMode === 'map' ? '' : 'text-[#4B5563] dark:text-[#D1D5DB]'
              }`}
            >
              <MapPinIcon className="w-3.5 h-3.5" />
              {t('civicMap.mapViewToggle')}
            </button>
            <button
              type="button"
              data-active={viewMode === 'list'}
              onClick={() => setViewMode('list')}
              className={`civora-liquid-tab px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 ${
                viewMode === 'list' ? '' : 'text-[#4B5563] dark:text-[#D1D5DB]'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              {t('civicMap.listViewToggle')} ({markers.length})
            </button>
          </div>
        }
      />

      {/* Privacy Notice Banner */}
      <div className="p-3.5 rounded-xl bg-[#F9FAFB] dark:bg-[#182230] border border-[#E5E7EB] dark:border-[#374151] flex items-start gap-3">
        <div className="p-1.5 bg-[#E5ECE8] dark:bg-[#34D399]/15 text-[#0B3D2E] dark:text-[#34D399] rounded-lg shrink-0 mt-0.5">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <div className="text-xs text-[#4B5563] dark:text-[#D1D5DB] leading-relaxed">
          <span className="font-semibold text-[#111827] dark:text-[#F9FAFB]">Privacy Protection Guarantee: </span>
          All complaint coordinates on the public map are generalized to ~110m resolution. Complainant names, phone numbers, and private residential doorsteps are strictly protected and never publicly pinpointed.
        </div>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Search Input */}
            <div className="lg:col-span-1">
              <TextInput
                id="geo-search"
                placeholder="Search title, locality, ward..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Category Select */}
            <div>
              <Select
                id="geo-cat"
                placeholder="All Categories"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                options={[
                  { value: '', label: 'All Categories' },
                  ...categories.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
            </div>

            {/* Status Select */}
            <div>
              <Select
                id="geo-status"
                placeholder="All Statuses"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                options={[
                  { value: '', label: 'All Statuses' },
                  { value: 'SUBMITTED', label: 'Submitted (New)' },
                  { value: 'UNDER_REVIEW', label: 'Under Review' },
                  { value: 'ASSIGNED', label: 'Assigned' },
                  { value: 'IN_PROGRESS', label: 'In Progress' },
                  { value: 'RESOLVED', label: 'Resolved' },
                  { value: 'VERIFIED', label: 'Verified' },
                  { value: 'REOPENED', label: 'Reopened' },
                ]}
              />
            </div>

            {/* Locality Select */}
            <div>
              <Select
                id="geo-loc"
                placeholder="All Localities"
                value={selectedLocality}
                onChange={(e) => setSelectedLocality(e.target.value)}
                options={[
                  { value: '', label: 'All Localities' },
                  ...localities.map((l) => ({ value: l.name, label: `${l.name} (${l.wardNumber})` })),
                ]}
              />
            </div>

            {/* Nearby & Hotspot Actions */}
            <div className="flex items-center gap-2">
              {!isNearbyActive ? (
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={handleActivateNearby}
                  leftIcon={<MapPinIcon className="w-4 h-4 text-[#0B6640] dark:text-[#34D399]" />}
                  className="w-full cursor-pointer text-xs"
                >
                  Near Me
                </Button>
              ) : (
                <div className="flex items-center gap-1.5 w-full">
                  <Select
                    id="geo-radius"
                    value={nearbyRadius}
                    onChange={(e) => setNearbyRadius(e.target.value)}
                    options={[
                      { value: '1', label: '1 km' },
                      { value: '2', label: '2 km' },
                      { value: '5', label: '5 km' },
                      { value: '10', label: '10 km' },
                    ]}
                  />
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={handleClearNearby}
                    className="text-xs px-2.5"
                    title="Clear nearby radius"
                  >
                    ✕
                  </Button>
                </div>
              )}

              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => setShowHotspotsDrawer(!showHotspotsDrawer)}
                className="cursor-pointer text-xs whitespace-nowrap"
              >
                Hotspots ({hotspots.length})
              </Button>
            </div>
          </div>

          {/* Active Filter Chips & Clear */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#E5E7EB] dark:border-[#374151] text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[#6B7280] dark:text-[#D1D5DB] font-medium">
                Found <strong className="text-[#111827] dark:text-[#F9FAFB]">{markers.length}</strong> complaints
              </span>
              {nearbyStatus && (
                <Badge variant="info" size="sm">
                  📍 {nearbyStatus}
                </Badge>
              )}
              {selectedLocality && (
                <Badge variant="neutral" size="sm">
                  Area: {selectedLocality}
                </Badge>
              )}
            </div>

            {(search || selectedCategory || selectedStatus || selectedPriority || selectedLocality || isNearbyActive) && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="civora-liquid-btn civora-liquid-btn--text px-2.5 py-1 rounded-md text-xs font-medium"
              >
                Clear All Filters
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="error" title="Search Error">
          {error}
        </Alert>
      )}

      {/* Hotspots Quick Drawer / Bar */}
      {showHotspotsDrawer && (
        <Card className="border-[#0B3D2E]/25 dark:border-[#34D399]/35 shadow-xs animate-fade-in">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm">Geographic Issue Hotspots (Ward-level Aggregation)</CardTitle>
              <p className="text-xs text-[#6B7280] dark:text-[#D1D5DB] mt-0.5">
                Identifies areas with the highest complaint concentration, recurring issues, and overdue rates.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowHotspotsDrawer(false)}
              className="civora-liquid-btn civora-liquid-btn--ghost px-2.5 py-1 rounded-md text-xs font-medium"
            >
              ✕ Close
            </button>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {hotspots.slice(0, 8).map((h) => (
                <div
                  key={h.name}
                  onClick={() => handleSelectHotspot(h)}
                  className="p-3 rounded-xl bg-[#F9FAFB] dark:bg-[#182230] hover:bg-[#E5E7EB]/60 dark:hover:bg-[#273548]/70 border border-[#E5E7EB] dark:border-[#374151] cursor-pointer transition-all hover:border-[#0B3D2E]/40 dark:hover:border-[#34D399]/50"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-[#111827] dark:text-[#F9FAFB] truncate">{h.name}</span>
                    <Badge variant={h.overdueComplaints > 0 ? 'warning' : 'info'} size="sm">
                      {h.totalComplaints} cases
                    </Badge>
                  </div>
                  <div className="text-[11px] text-[#6B7280] dark:text-[#D1D5DB] flex items-center justify-between">
                    <span>Top: {h.topCategory}</span>
                    <span>Res: {h.resolutionRate}%</span>
                  </div>
                  {h.overdueComplaints > 0 && (
                    <div className="text-[10px] text-amber-800 dark:text-amber-400 font-medium mt-1">
                      ⚠️ {h.overdueComplaints} overdue cases
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Display: Map View or Accessible List View */}
      {viewMode === 'map' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Map Container */}
          <div className="lg:col-span-2">
            <CivicMap
              markers={markers}
              selectedMarkerId={selectedMarker?.id}
              onSelectMarker={(m) => setSelectedMarker(m)}
              loading={loading}
              height="600px"
            />
          </div>

          {/* Selected Complaint Inspector Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            {selectedMarker ? (
              <Card className="border-[#0B3D2E]/30 sticky top-20 shadow-lg animate-fade-in">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono font-bold text-[#0B3D2E] dark:text-[#34D399]">
                      {selectedMarker.trackingId}
                    </span>
                    <Badge variant="info" size="sm">
                      {selectedMarker.status}
                    </Badge>
                  </div>
                  <CardTitle className="text-base text-[#111827] dark:text-[#F9FAFB] leading-snug">
                    {selectedMarker.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-xs">
                  <div className="p-3 rounded-xl bg-[#F9FAFB] dark:bg-[#182230] border border-[#E5E7EB] dark:border-[#374151] space-y-2">
                    <div className="flex justify-between">
                      <span className="text-[#6B7280] dark:text-[#D1D5DB]">Category:</span>
                      <span className="font-semibold text-[#111827] dark:text-[#F9FAFB]">
                        {selectedMarker.category?.name || 'Grievance'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#6B7280] dark:text-[#D1D5DB]">Locality:</span>
                      <span className="font-semibold text-[#111827] dark:text-[#F9FAFB]">{selectedMarker.locality}</span>
                    </div>
                    {selectedMarker.ward && (
                      <div className="flex justify-between">
                        <span className="text-[#6B7280] dark:text-[#D1D5DB]">Ward:</span>
                        <span className="font-semibold text-[#111827] dark:text-[#F9FAFB]">{selectedMarker.ward}</span>
                      </div>
                    )}
                    {selectedMarker.distanceKm !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-[#6B7280] dark:text-[#D1D5DB]">Distance from you:</span>
                        <span className="font-bold text-[#0B6640] dark:text-[#34D399]">
                          {selectedMarker.distanceKm.toFixed(2)} km away
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-[#6B7280] dark:text-[#D1D5DB]">Reported On:</span>
                      <span className="text-[#374151] dark:text-[#D1D5DB]">
                        {new Date(selectedMarker.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 flex flex-col gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => navigate(`/track?id=${selectedMarker.trackingId}`)}
                      className="w-full cursor-pointer"
                    >
                      Inspect Case Timeline
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedMarker(null)}
                      className="w-full text-[#6B7280] dark:text-[#D1D5DB] cursor-pointer"
                    >
                      Clear Selection
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-[#E5E7EB] dark:border-[#374151] text-center p-6 space-y-3">
                <div className="w-12 h-12 rounded-full bg-[#F3F4F6] dark:bg-[#273548] flex items-center justify-center mx-auto text-[#0B3D2E] dark:text-[#D1D5DB]">
                  <MapPinIcon className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-semibold text-[#111827] dark:text-[#F9FAFB]">Select a Marker on the Map</h4>
                <p className="text-xs text-[#6B7280] dark:text-[#D1D5DB]">
                  Click on any complaint pin to view details, distance from your location, and direct tracking link.
                </p>
                <div className="pt-3 border-t border-[#E5E7EB] dark:border-[#374151] text-[11px] text-[#6B7280] dark:text-[#D1D5DB] text-left space-y-1.5">
                  <div className="font-semibold text-[#374151] dark:text-[#D1D5DB] mb-1">Marker Legend:</div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0"></span>
                    <span>Green: Resolved & Verified</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#0B3D2E] dark:bg-[#0D7A58] shrink-0"></span>
                    <span>Forest Green: Work In Progress</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0"></span>
                    <span>Amber: Assigned / Under Review</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-red-500 shrink-0"></span>
                    <span>Red: Urgent or Reopened</span>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      ) : (
        /* Accessible List View */
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Grievance Results ({markers.length})</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-[#E5E7EB] dark:divide-[#374151] p-0">
            {markers.length === 0 ? (
              <div className="p-8 text-center text-[#6B7280] dark:text-[#D1D5DB] text-xs">
                No complaints found matching current filters. Try zooming out or clearing filters.
              </div>
            ) : (
              markers.map((m) => (
                <div
                  key={m.id}
                  className="p-4 hover:bg-[#F9FAFB] dark:hover:bg-[#273548]/60 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold text-[#0B3D2E] dark:text-[#34D399]">{m.trackingId}</span>
                      <Badge variant="info" size="sm">
                        {m.status}
                      </Badge>
                      <span className="text-xs text-[#6B7280] dark:text-[#D1D5DB] font-medium">
                        {m.category?.name || 'General'}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-[#111827] dark:text-[#F9FAFB]">{m.title}</div>
                    <div className="text-xs text-[#6B7280] dark:text-[#D1D5DB] flex items-center gap-3">
                      <span>📍 {m.locality}{m.ward ? ` (${m.ward})` : ''}</span>
                      {m.distanceKm !== undefined && (
                        <span className="text-[#0B6640] dark:text-[#34D399] font-medium">
                          {m.distanceKm.toFixed(2)} km away
                        </span>
                      )}
                      <span>📅 {new Date(m.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/track?id=${m.trackingId}`)}
                    className="shrink-0 cursor-pointer"
                  >
                    Track Progress
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}
    </Container>
  );
};
