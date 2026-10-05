import React from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Fix default marker icons not loading under Vite bundling
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

export default function MapView({ lat, lng, title, height = "300px" }) {
  if (!lat || !lng) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center bg-gray-100 rounded-lg text-gray-400 text-sm"
      >
        Location not available on map
      </div>
    );
  }

  return (
    <div style={{ height }}>
      <MapContainer center={[lat, lng]} zoom={14} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[lat, lng]}>
          <Popup>{title || "Property location"}</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
