import React, { useState } from 'react';
import { CivicMap } from './CivicMap';
import { Button } from '../ui/Button';
import { MapPinIcon } from '../ui/icons';

interface LocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (coords: {
    latitude: number;
    longitude: number;
    locality?: string;
    ward?: string;
    source: 'GPS_DEVICE' | 'MAP_PICKER' | 'MANUAL_ENTRY';
    accuracy?: number;
  }) => void;
  initialLat?: number;
  initialLng?: number;
}

const QUICK_LANDMARKS = [
  { name: 'Indira Nagar', ward: 'Ward 82', lat: 12.9784, lng: 77.6408 },
  { name: 'HSR Layout', ward: 'Ward 174', lat: 12.9116, lng: 77.6389 },
  { name: 'Koramangala', ward: 'Ward 151', lat: 12.9345, lng: 77.6253 },
  { name: 'Bellandur', ward: 'Ward 150', lat: 12.926, lng: 77.6762 },
  { name: 'MG Road (Central)', ward: 'Ward 111', lat: 12.9756, lng: 77.6066 },
  { name: 'Whitefield', ward: 'Ward 84', lat: 12.9698, lng: 77.7499 },
];

export const LocationPickerModal: React.FC<LocationPickerModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  initialLat = 12.9716,
  initialLng = 77.5946,
}) => {
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(
    initialLat && initialLng ? { lat: initialLat, lng: initialLng } : null
  );
  const [detectedLocality, setDetectedLocality] = useState<string>('');
  const [detectedWard, setDetectedWard] = useState<string>('');
  const [geoStatus, setGeoStatus] = useState<string | null>(null);
  const [accuracy, setAccuracy] = useState<number | undefined>(undefined);
  const [source, setSource] = useState<'GPS_DEVICE' | 'MAP_PICKER' | 'MANUAL_ENTRY'>('MAP_PICKER');

  if (!isOpen) return null;

  const handleMapClick = (coords: { lat: number; lng: number }) => {
    setSelectedCoords(coords);
    setSource('MAP_PICKER');
    setGeoStatus(`Pinned on map: ${coords.lat}, ${coords.lng}`);
  };

  const handleDeviceLocation = () => {
    if (!navigator.geolocation) {
      setGeoStatus('Device geolocation is not supported by your browser.');
      return;
    }

    setGeoStatus('Requesting device GPS coordinates...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(5));
        const lng = Number(pos.coords.longitude.toFixed(5));
        const acc = Number(pos.coords.accuracy.toFixed(1));
        setSelectedCoords({ lat, lng });
        setAccuracy(acc);
        setSource('GPS_DEVICE');
        setGeoStatus(`GPS Acquired: ${lat}, ${lng} (Accuracy: ±${acc}m)`);
      },
      (err) => {
        setGeoStatus(`Could not acquire location: ${err.message}. You can click directly on the map.`);
      },
      { timeout: 12000, enableHighAccuracy: true }
    );
  };

  const handleSelectQuickLandmark = (item: (typeof QUICK_LANDMARKS)[0]) => {
    setSelectedCoords({ lat: item.lat, lng: item.lng });
    setDetectedLocality(item.name);
    setDetectedWard(item.ward);
    setSource('MAP_PICKER');
    setGeoStatus(`Selected landmark: ${item.name} (${item.ward})`);
  };

  const handleSave = () => {
    if (!selectedCoords) return;
    onConfirm({
      latitude: selectedCoords.lat,
      longitude: selectedCoords.lng,
      locality: detectedLocality || undefined,
      ward: detectedWard || undefined,
      source,
      accuracy,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-4xl bg-white dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-[#E5E7EB] dark:border-[#374151] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-[#E5ECE8] text-[#0B3D2E] dark:bg-[#273548] dark:text-[#34D399] rounded-xl border border-[#0B3D2E]/20 dark:border-[#374151]">
              <MapPinIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#111827] dark:text-[#F9FAFB]">Pin Complaint Location</h3>
              <p className="text-xs text-[#6B7280] dark:text-[#D1D5DB]">
                Click anywhere on the map or use your device GPS to set precise incident coordinates.
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close location picker"
            onClick={onClose}
            className="civora-liquid-btn civora-liquid-btn--ghost p-1.5 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {/* Quick Actions & Status */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDeviceLocation}
              leftIcon={<MapPinIcon className="w-4 h-4 text-[#0B3D2E] dark:text-[#34D399]" />}
            >
              Use My Device Location
            </Button>

            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-[#6B7280] dark:text-[#D1D5DB]">Quick Areas:</span>
              {QUICK_LANDMARKS.slice(0, 4).map((item) => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => handleSelectQuickLandmark(item)}
                  className="civora-liquid-btn civora-liquid-btn--secondary px-2.5 py-1 rounded-md text-[11px]"
                >
                  {item.name}
                </button>
              ))}
            </div>
          </div>

          {geoStatus && (
            <div className="p-2.5 rounded-lg bg-[#E5ECE8]/60 dark:bg-[#273548] border border-[#0B3D2E]/20 dark:border-[#374151] text-xs text-[#0B3D2E] dark:text-[#D1D5DB] font-mono flex items-center justify-between">
              <span>{geoStatus}</span>
              {selectedCoords && (
                <span className="font-bold text-[#0B3D2E] dark:text-[#34D399]">
                  {selectedCoords.lat}, {selectedCoords.lng}
                </span>
              )}
            </div>
          )}

          {/* Interactive Map */}
          <CivicMap
            markers={[]}
            height="380px"
            interactive={true}
            onMapClick={handleMapClick}
            pickedCoords={selectedCoords}
          />

          <p className="text-[11px] text-[#6B7280] dark:text-[#D1D5DB] text-center">
            Tip: Click anywhere on the map to drop or reposition the pin. Field engineers will use these coordinates during physical site inspection.
          </p>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[#E5E7EB] dark:border-[#374151] flex items-center justify-end gap-3 bg-[#F9FAFB] dark:bg-[#182230]">
          <Button variant="ghost" onClick={onClose} size="sm">
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={!selectedCoords}
            size="sm"
            leftIcon={<MapPinIcon className="w-4 h-4" />}
          >
            Confirm Location Coordinates
          </Button>
        </div>
      </div>
    </div>
  );
};
