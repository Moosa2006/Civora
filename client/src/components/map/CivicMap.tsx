import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { GeoComplaintMarker } from '../../types';

interface CivicMapProps {
  markers: GeoComplaintMarker[];
  selectedMarkerId?: string | null;
  onSelectMarker?: (marker: GeoComplaintMarker) => void;
  onBoundsChange?: (bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }) => void;
  loading?: boolean;
  center?: [number, number];
  zoom?: number;
  height?: string;
  interactive?: boolean;
  onMapClick?: (coords: { lat: number; lng: number }) => void;
  pickedCoords?: { lat: number; lng: number } | null;
}

export const CivicMap: React.FC<CivicMapProps> = ({
  markers,
  selectedMarkerId,
  onSelectMarker,
  onBoundsChange,
  loading = false,
  center = [12.9716, 77.5946], // Default Bengaluru central coordinates
  zoom = 12,
  height = '560px',
  interactive = true,
  onMapClick,
  pickedCoords,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const pickedMarkerRef = useRef<L.Marker | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center,
      zoom,
      zoomControl: interactive,
      dragging: interactive,
      scrollWheelZoom: interactive,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
    }).addTo(map);

    const markersGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = markersGroup;
    mapInstanceRef.current = map;

    // Viewport bounds change handler
    if (onBoundsChange) {
      map.on('moveend', () => {
        const bounds = map.getBounds();
        onBoundsChange({
          minLat: bounds.getSouth(),
          maxLat: bounds.getNorth(),
          minLng: bounds.getWest(),
          maxLng: bounds.getEast(),
        });
      });
    }

    // Map click for location picking
    if (onMapClick) {
      map.on('click', (e: L.LeafletMouseEvent) => {
        onMapClick({ lat: Number(e.latlng.lat.toFixed(5)), lng: Number(e.latlng.lng.toFixed(5)) });
      });
    }

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update picked coordinates pin (Location Picker mode)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (pickedMarkerRef.current) {
      pickedMarkerRef.current.remove();
      pickedMarkerRef.current = null;
    }

    if (pickedCoords) {
      const pinIcon = L.divIcon({
        className: 'custom-picked-pin',
        html: `
          <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%, -100%);">
            <div style="background:#3b82f6;color:white;padding:4px 8px;border-radius:9999px;font-size:11px;font-weight:bold;box-shadow:0 4px 12px rgba(59,130,246,0.5);border:2px solid white;white-space:nowrap;">
              Pinned Location
            </div>
            <div style="width:16px;height:16px;background:#2563eb;border:3px solid white;border-radius:50%;margin-top:2px;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>
          </div>
        `,
        iconSize: [24, 32],
        iconAnchor: [12, 32],
      });

      pickedMarkerRef.current = L.marker([pickedCoords.lat, pickedCoords.lng], {
        icon: pinIcon,
      }).addTo(map);

      map.flyTo([pickedCoords.lat, pickedCoords.lng], Math.max(map.getZoom(), 14), {
        duration: 0.8,
      });
    }
  }, [pickedCoords]);

  // Render Complaint Markers
  useEffect(() => {
    if (!markersLayerRef.current || !mapInstanceRef.current) return;

    const layerGroup = markersLayerRef.current;
    layerGroup.clearLayers();

    markers.forEach((marker) => {
      // Determine marker color based on status
      let colorBg = '#3b82f6'; // blue default
      let ringColor = 'rgba(59,130,246,0.4)';

      if (marker.status === 'RESOLVED' || marker.status === 'VERIFIED') {
        colorBg = '#10b981'; // green
        ringColor = 'rgba(16,185,129,0.4)';
      } else if (marker.status === 'IN_PROGRESS') {
        colorBg = '#6366f1'; // indigo
        ringColor = 'rgba(99,102,241,0.4)';
      } else if (marker.status === 'ASSIGNED' || marker.status === 'UNDER_REVIEW') {
        colorBg = '#f59e0b'; // amber
        ringColor = 'rgba(245,158,11,0.4)';
      } else if (marker.priority === 'URGENT' || marker.status === 'REOPENED') {
        colorBg = '#ef4444'; // red
        ringColor = 'rgba(239,68,68,0.5)';
      }

      const isSelected = selectedMarkerId === marker.id;
      const markerSize = isSelected ? 32 : 24;

      const html = `
        <div style="
          width:${markerSize}px;
          height:${markerSize}px;
          background:${colorBg};
          border:2px solid white;
          border-radius:50%;
          box-shadow:0 0 0 4px ${ringColor}, 0 4px 8px rgba(0,0,0,0.3);
          display:flex;
          align-items:center;
          justify-content:center;
          cursor:pointer;
          transition:transform 0.2s;
          ${isSelected ? 'transform: scale(1.25); z-index: 1000;' : ''}
        ">
          <div style="width:6px;height:6px;background:white;border-radius:50%;"></div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'civora-marker-icon',
        html,
        iconSize: [markerSize, markerSize],
        iconAnchor: [markerSize / 2, markerSize / 2],
      });

      const leafletMarker = L.marker([marker.latitude, marker.longitude], {
        icon: customIcon,
      });

      // Accessible popup
      const popupContent = document.createElement('div');
      popupContent.style.padding = '8px';
      popupContent.style.fontFamily = 'inherit';
      popupContent.style.color = 'var(--color-text-primary)';
      popupContent.style.maxWidth = '260px';

      popupContent.innerHTML = `
        <div style="font-size:11px;font-weight:bold;color:var(--color-text-secondary);margin-bottom:2px;display:flex;justify-content:space-between;">
          <span>${marker.trackingId}</span>
          <span style="color:var(--color-text-link);">${marker.category?.name || 'Grievance'}</span>
        </div>
        <div style="font-size:13px;font-weight:700;line-height:1.25;margin-bottom:6px;color:var(--color-text-primary);">
          ${escapeHtml(marker.title)}
        </div>
        <div style="font-size:11px;color:var(--color-text-muted);margin-bottom:8px;">
          📍 ${escapeHtml(marker.locality)}${marker.ward ? ` (${escapeHtml(marker.ward)})` : ''}
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <span style="font-size:10px;padding:2px 6px;border-radius:9999px;font-weight:600;background:var(--color-surface-muted);color:var(--color-text-secondary);border:1px solid var(--color-border);">
            ${marker.status}
          </span>
          <span style="font-size:10px;color:var(--color-text-muted);">
            ${new Date(marker.createdAt).toLocaleDateString()}
          </span>
        </div>
        <a href="/track?id=${marker.trackingId}" style="
          display:block;
          text-align:center;
          background:var(--color-brand);
          color:white;
          text-decoration:none;
          font-size:11px;
          font-weight:600;
          padding:6px 10px;
          border-radius:6px;
        ">
          Inspect Case Timeline &rarr;
        </a>
      `;

      leafletMarker.bindPopup(popupContent);

      leafletMarker.on('click', () => {
        onSelectMarker?.(marker);
      });

      layerGroup.addLayer(leafletMarker);
    });
  }, [markers, selectedMarkerId, onSelectMarker]);

  const handleResetView = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo(center, zoom, { duration: 0.8 });
    }
  };

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-[#E5E7EB] dark:border-[#374151] bg-white dark:bg-[#1F2937] shadow-xs">
      {/* Map Element */}
      <div
        ref={mapContainerRef}
        style={{ height, width: '100%', zIndex: 10 }}
        className="focus:outline-none"
      />

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-white/75 dark:bg-[#111827]/70 backdrop-blur-xs flex items-center justify-center z-20">
          <div className="flex items-center space-x-3 px-4 py-2 bg-white dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] rounded-xl text-[#111827] dark:text-[#F9FAFB] text-xs font-medium shadow-md">
            <span className="w-4 h-4 border-2 border-[#0B3D2E] dark:border-[#34D399] border-t-transparent rounded-full animate-spin"></span>
            <span>Querying civic coordinates...</span>
          </div>
        </div>
      )}

      {/* Floating Controls: Reset & Legend */}
      <div className="absolute top-3 right-3 z-20 flex flex-col items-end gap-2">
        <button
          type="button"
          onClick={handleResetView}
          className="civora-liquid-btn civora-liquid-btn--secondary px-3 py-1.5 text-xs font-medium rounded-lg gap-1.5"
          title="Reset map to central city overview"
        >
          <svg className="w-3.5 h-3.5 text-[#0B6640] dark:text-[#34D399]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Reset View
        </button>
      </div>

      {/* Privacy Notice in Bottom Left */}
      <div className="absolute bottom-2 left-2 z-20 pointer-events-none">
        <div className="px-2.5 py-1 bg-white/95 dark:bg-[#1F2937]/95 border border-[#E5E7EB] dark:border-[#374151] rounded-md text-[11px] text-[#374151] dark:text-[#D1D5DB] flex items-center gap-1.5 shadow-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-[#0B6640] dark:bg-[#34D399]"></span>
          <span>Public coordinates generalized to ~110m for resident privacy</span>
        </div>
      </div>
    </div>
  );
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
