import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./CrimeMap.css";

// Fix leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const DEFAULT_CENTER = [15.3173, 75.7139];

const KARNATAKA_DISTRICTS = {
  Bengaluru: { lat: 12.9716, lng: 77.5946 },
  "Bengaluru Urban": { lat: 12.9716, lng: 77.5946 },
  "Bengaluru Rural": { lat: 13.2841, lng: 77.6078 },
  Mysuru: { lat: 12.2958, lng: 75.7139 },
  Hubballi: { lat: 15.3647, lng: 75.0891 },
  Dharwad: { lat: 15.4589, lng: 75.0078 },
  Mangaluru: { lat: 12.8656, lng: 74.8449 },
  Belagavi: { lat: 15.8497, lng: 74.4977 },
  Shivamogga: { lat: 13.7339, lng: 75.5589 },
  Tumakuru: { lat: 13.3187, lng: 77.114 },
  Kolar: { lat: 13.1458, lng: 78.1294 },
  Chikkaballapur: { lat: 13.4329, lng: 77.7233 },
  Raichur: { lat: 16.206, lng: 77.3569 },
};

const DISTRICT_ALIASES = {
  bangalore: "Bengaluru",
  bengaluru: "Bengaluru",
  "bangalore urban": "Bengaluru Urban",
  "bengaluru urban": "Bengaluru Urban",
  "bangalore rural": "Bengaluru Rural",
  "bengaluru rural": "Bengaluru Rural",
};

function getSeverityColor(severity) {
  switch (severity) {
    case "high":
      return "#ef4444";
    case "medium":
      return "#f59e0b";
    case "low":
      return "#10b981";
    default:
      return "#3b82f6";
  }
}

function parseCoordinate(value) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function resolveDistrictCoordinates(name) {
  const normalizedName = String(name || "")
    .trim()
    .toLowerCase();
  const canonicalName = DISTRICT_ALIASES[normalizedName] || name;

  return KARNATAKA_DISTRICTS[canonicalName] || KARNATAKA_DISTRICTS.Bengaluru;
}

function createHeatmapLayer(map, districtData) {
  districtData.forEach((district) => {
    const radius = Math.sqrt(district.crimes) * 2200;
    const circle = L.circle([district.lat, district.lng], {
      color: getSeverityColor(district.severity),
      fill: true,
      fillColor: getSeverityColor(district.severity),
      fillOpacity: 0.12,
      weight: 2,
      radius,
    });
    circle.bindPopup(`<strong>${district.name}</strong><br/>Crimes: ${district.crimes}`);
    circle.addTo(map);
  });
}

function buildDistrictData(rows = []) {
  const grouped = rows.reduce((acc, row) => {
    const district = String(row?.district || "Unknown").trim() || "Unknown";
    const latitude = parseCoordinate(row?.latitude);
    const longitude = parseCoordinate(row?.longitude);
    const group = acc[district] || {
      name: district,
      crimes: 0,
      latitudeTotal: 0,
      longitudeTotal: 0,
      coordinateCount: 0,
    };

    group.crimes += 1;

    if (latitude !== null && longitude !== null) {
      group.latitudeTotal += latitude;
      group.longitudeTotal += longitude;
      group.coordinateCount += 1;
    }

    acc[district] = group;
    return acc;
  }, {});

  return Object.values(grouped)
    .map((district) => {
      const fallbackCoordinates = resolveDistrictCoordinates(district.name);
      const severity =
        district.crimes >= 18 ? "high" : district.crimes >= 10 ? "medium" : "low";

      return {
        name: district.name,
        crimes: district.crimes,
        severity,
        lat:
          district.coordinateCount > 0
            ? district.latitudeTotal / district.coordinateCount
            : fallbackCoordinates?.lat || DEFAULT_CENTER[0],
        lng:
          district.coordinateCount > 0
            ? district.longitudeTotal / district.coordinateCount
            : fallbackCoordinates?.lng || DEFAULT_CENTER[1],
      };
    })
    .sort((left, right) => right.crimes - left.crimes)
    .slice(0, 10);
}

export default function CrimeMap({ data = [] }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const districtData = useMemo(() => buildDistrictData(data), [data]);

  useEffect(() => {
    if (!mapContainer.current) return;

    if (map.current) {
      map.current.remove();
      map.current = null;
    }

    map.current = L.map(mapContainer.current).setView(DEFAULT_CENTER, 7);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map.current);

    districtData.forEach((district) => {
      const color = getSeverityColor(district.severity);
      const customIcon = L.divIcon({
        html: `<div style="background-color: ${color}; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">!</div>`,
        className: "crime-marker",
        iconSize: [32, 32],
      });

      const marker = L.marker([district.lat, district.lng], {
        icon: customIcon,
      });
      marker.bindPopup(
        `<div class="crime-popup">
          <h3>${district.name}</h3>
          <p><strong>Total Crimes:</strong> ${district.crimes}</p>
          <p><strong>Severity:</strong> <span style="color: ${color}; font-weight: bold;">${district.severity.toUpperCase()}</span></p>
        </div>`
      );
      marker.addTo(map.current);
    });

    createHeatmapLayer(map.current, districtData);

    if (districtData.length) {
      const bounds = L.latLngBounds(
        districtData.map((district) => [district.lat, district.lng])
      );

      map.current.fitBounds(bounds, {
        padding: [30, 30],
        maxZoom: districtData.length === 1 ? 10 : 8,
      });
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [districtData]);

  return (
    <div className="crime-map-container">
      {districtData.length ? (
        <div ref={mapContainer} className="crime-map" />
      ) : (
        <div className="empty-state">No matching records found</div>
      )}
      <div className="map-legend">
        <div className="legend-title">Crime Severity</div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: "#ef4444" }}></div>
          <span>High Risk</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: "#f59e0b" }}></div>
          <span>Medium Risk</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: "#10b981" }}></div>
          <span>Low Risk</span>
        </div>
      </div>
    </div>
  );
}
