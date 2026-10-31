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
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeading
          title={t('civicMap.title')}
          description={t('civicMap.subtitle')}
          badge={
            <Badge variant="info" size="md" hasDot>
              {t('nav.civicMap')}
            </Badge>
          }
        />

        {/* View Mode Switcher */}
        <div className="flex items-center space-x-2 bg-[#ECE7DB] dark:bg-[#1D2A25] border border-[#DED8CB] dark:border-[#283931] p-1 rounded-xl self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('map')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'map'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-[#54625A] dark:text-[#C5D4C9] hover:text-[#202522] dark:hover:text-[#E8F0EC]'
            }`}
          >
            <MapPinIcon className="w-3.5 h-3.5" />
            {t('civicMap.mapViewToggle')}
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'list'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-[#54625A] dark:text-[#C5D4C9] hover:text-[#202522] dark:hover:text-[#E8F0EC]'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            {t('civicMap.listViewToggle')} ({markers.length})
          </button>
        </div>
      </div>

      {/* Privacy Notice Banner */}
      <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 flex items-start gap-3">
        <div className="p-1.5 bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 rounded-lg shrink-0 mt-0.5">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <div className="text-xs text-[#3E4B44] dark:text-[#C5D4C9] leading-relaxed">
          <span className="font-semibold text-[#202522] dark:text-[#F5F2EA]">Privacy Protection Guarantee: </span>
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
                  leftIcon={<MapPinIcon className="w-4 h-4 text-blue-400" />}
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
                    variant="ghost"
                    size="sm"
                    onClick={handleClearNearby}
                    className="cursor-pointer text-xs text-red-400"
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
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#DED8CB] dark:border-[#283931] text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[#54625A] dark:text-[#C5D4C9] font-medium">
                Found <strong className="text-[#202522] dark:text-[#F5F2EA]">{markers.length}</strong> complaints
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
                className="text-xs text-[#235C52] dark:text-[#7BC4B2] hover:underline font-medium cursor-pointer"
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
        <Card className="border-[#4F9B8B]/40 shadow-xs animate-fade-in">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm">Geographic Issue Hotspots (Ward-level Aggregation)</CardTitle>
              <p className="text-xs text-[#54625A] dark:text-[#C5D4C9] mt-0.5">
                Identifies areas with the highest complaint concentration, recurring issues, and overdue rates.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowHotspotsDrawer(false)}
              className="text-[#54625A] hover:text-[#202522] dark:text-[#C5D4C9] dark:hover:text-[#E8F0EC] p-1 rounded-md text-xs cursor-pointer"
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
                  className="p-3 rounded-xl bg-[#ECE7DB]/50 dark:bg-[#1D2A25]/50 hover:bg-[#DED8CB]/60 dark:hover:bg-[#283931]/60 border border-[#DED8CB] dark:border-[#283931] cursor-pointer transition-all hover:border-[#173D32]/40 dark:hover:border-[#7BC4B2]/40"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-[#202522] dark:text-[#F5F2EA] truncate">{h.name}</span>
                    <Badge variant={h.overdueComplaints > 0 ? 'warning' : 'info'} size="sm">
                      {h.totalComplaints} cases
                    </Badge>
                  </div>
                  <div className="text-[11px] text-[#54625A] dark:text-[#C5D4C9] flex items-center justify-between">
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
              <Card className="border-blue-500/30 sticky top-20 shadow-xl animate-fade-in">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono font-bold text-blue-400">
                      {selectedMarker.trackingId}
                    </span>
                    <Badge variant="info" size="sm">
                      {selectedMarker.status}
                    </Badge>
                  </div>
                  <CardTitle className="text-base text-[#202522] dark:text-[#F5F2EA] leading-snug">
                    {selectedMarker.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-xs">
                  <div className="p-3 rounded-xl bg-[#ECE7DB]/50 dark:bg-[#1D2A25]/50 border border-[#DED8CB] dark:border-[#283931] space-y-2">
                    <div className="flex justify-between">
                      <span className="text-[#54625A] dark:text-[#C5D4C9]">Category:</span>
                      <span className="font-semibold text-[#202522] dark:text-[#E8F0EC]">
                        {selectedMarker.category?.name || 'Grievance'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#54625A] dark:text-[#C5D4C9]">Locality:</span>
                      <span className="font-semibold text-[#202522] dark:text-[#E8F0EC]">{selectedMarker.locality}</span>
                    </div>
                    {selectedMarker.ward && (
                      <div className="flex justify-between">
                        <span className="text-[#54625A] dark:text-[#C5D4C9]">Ward:</span>
                        <span className="font-semibold text-[#202522] dark:text-[#E8F0EC]">{selectedMarker.ward}</span>
                      </div>
                    )}
                    {selectedMarker.distanceKm !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-[#54625A] dark:text-[#C5D4C9]">Distance from you:</span>
                        <span className="font-bold text-blue-700 dark:text-blue-400">
                          {selectedMarker.distanceKm.toFixed(2)} km away
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-[#54625A] dark:text-[#C5D4C9]">Reported On:</span>
                      <span className="text-[#3E4B44] dark:text-[#C5D4C9]">
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
                      className="w-full text-[#54625A] dark:text-[#C5D4C9] cursor-pointer"
                    >
                      Clear Selection
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-[#DED8CB] dark:border-[#283931] text-center p-6 space-y-3">
                <div className="w-12 h-12 rounded-full bg-[#ECE7DB] dark:bg-[#1D2A25] flex items-center justify-center mx-auto text-[#54625A] dark:text-[#C5D4C9]">
                  <MapPinIcon className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-semibold text-[#202522] dark:text-[#F5F2EA]">Select a Marker on the Map</h4>
                <p className="text-xs text-[#54625A] dark:text-[#C5D4C9]">
                  Click on any complaint pin to view details, distance from your location, and direct tracking link.
                </p>
                <div className="pt-3 border-t border-[#DED8CB] dark:border-[#283931] text-[11px] text-[#54625A] dark:text-[#C5D4C9] text-left space-y-1.5">
                  <div className="font-semibold text-[#3E4B44] dark:text-[#C5D4C9] mb-1">Marker Legend:</div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0"></span>
                    <span>Green: Resolved & Verified</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-indigo-500 shrink-0"></span>
                    <span>Indigo: Work In Progress</span>
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
          <CardContent className="divide-y divide-[#DED8CB] dark:divide-[#283931] p-0">
            {markers.length === 0 ? (
              <div className="p-8 text-center text-[#54625A] dark:text-[#C5D4C9] text-xs">
                No complaints found matching current filters. Try zooming out or clearing filters.
              </div>
            ) : (
              markers.map((m) => (
                <div
                  key={m.id}
                  className="p-4 hover:bg-[#ECE7DB]/40 dark:hover:bg-[#1D2A25]/40 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold text-blue-700 dark:text-blue-400">{m.trackingId}</span>
                      <Badge variant="info" size="sm">
                        {m.status}
                      </Badge>
                      <span className="text-xs text-[#54625A] dark:text-[#C5D4C9] font-medium">
                        {m.category?.name || 'General'}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-[#202522] dark:text-[#F5F2EA]">{m.title}</div>
                    <div className="text-xs text-[#54625A] dark:text-[#C5D4C9] flex items-center gap-3">
                      <span>📍 {m.locality}{m.ward ? ` (${m.ward})` : ''}</span>
                      {m.distanceKm !== undefined && (
                        <span className="text-blue-700 dark:text-blue-400 font-medium">
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
