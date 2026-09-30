import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { apiRequest } from '../utils/api';
import 'leaflet/dist/leaflet.css';

export default function Hotspots() {
  const [hotspots, setHotspots] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHotspots();
  }, []);

  async function loadHotspots() {
    try {
      const data = await apiRequest('/api/stats/hotspots');
      setHotspots(data.hotspots);
    } catch (error) {
      console.error('Failed to load hotspots:', error);
    } finally {
      setLoading(false);
    }
  }

  const center = [21.1458, 79.0882]; // Default to Library

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Lost Item Hotspots</h1>

      {loading ? (
        <div className="text-center py-12">Loading...</div>
      ) : hotspots.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No data available</div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="h-96 rounded overflow-hidden">
              <MapContainer
                center={center}
                zoom={15}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {hotspots.map((hotspot) => (
                  <CircleMarker
                    key={hotspot.location_name}
                    center={[parseFloat(hotspot.lat), parseFloat(hotspot.lng)]}
                    radius={Math.max(10, hotspot.count * 5)}
                    fillColor="red"
                    fillOpacity={0.5}
                    color="darkred"
                    weight={2}
                  >
                    <Popup>
                      <div>
                        <div className="font-semibold">{hotspot.location_name}</div>
                        <div className="text-sm">{hotspot.count} lost items</div>
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Location Stats</h2>
            <div className="space-y-2">
              {hotspots.map((hotspot) => (
                <div
                  key={hotspot.location_name}
                  className="flex justify-between items-center p-3 bg-gray-50 rounded"
                >
                  <span className="font-medium">{hotspot.location_name}</span>
                  <span className="px-3 py-1 bg-red-100 text-red-800 rounded font-semibold">
                    {hotspot.count} items
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
