/**
 * Rijksdriehoek (RD) to WGS84 coordinate conversion utilities
 * Based on official Kadaster transformation parameters
 */

interface RDCoordinates {
  x: number; // Rijksdriehoek X coordinate
  y: number; // Rijksdriehoek Y coordinate
}

interface WGS84Coordinates {
  lat: number; // WGS84 latitude
  lng: number; // WGS84 longitude
}

// Transformation parameters from Kadaster
const X0 = 155000;
const Y0 = 463000;
const PHI0 = 52.15517440;
const LAM0 = 5.38720621;

// Coefficients for RD to WGS84 transformation
const COEFFS = {
  // For latitude calculation
  Kp: [
    [0, 1, 3235.65389],
    [2, 0, -32.58297],
    [0, 2, -0.24750],
    [2, 1, -0.84978],
    [0, 3, -0.06550],
    [2, 2, -0.01709],
    [1, 0, -0.00738],
    [4, 0, 0.00530],
    [2, 3, -0.00039],
    [4, 1, 0.00033],
    [1, 1, -0.00012]
  ],
  // For longitude calculation
  Kl: [
    [1, 0, 5260.52916],
    [1, 1, 105.94684],
    [1, 2, 2.45656],
    [3, 0, -0.81885],
    [1, 3, 0.05594],
    [3, 1, -0.05607],
    [0, 1, 0.01199],
    [3, 2, -0.00256],
    [1, 4, 0.00128],
    [0, 2, 0.00022],
    [2, 0, -0.00022],
    [5, 0, 0.00026]
  ]
};

/**
 * Convert Rijksdriehoek coordinates to WGS84
 */
export function rdToWgs84(rd: RDCoordinates): WGS84Coordinates {
  const dX = (rd.x - X0) * 1e-5;
  const dY = (rd.y - Y0) * 1e-5;
  
  let sumLat = 0;
  let sumLng = 0;
  
  // Calculate latitude
  for (const [p, q, coeff] of COEFFS.Kp) {
    sumLat += coeff * Math.pow(dX, p) * Math.pow(dY, q);
  }
  
  // Calculate longitude  
  for (const [p, q, coeff] of COEFFS.Kl) {
    sumLng += coeff * Math.pow(dX, p) * Math.pow(dY, q);
  }
  
  const lat = PHI0 + sumLat / 3600;
  const lng = LAM0 + sumLng / 3600;
  
  return {
    lat: Math.round(lat * 1000000) / 1000000, // Round to 6 decimal places
    lng: Math.round(lng * 1000000) / 1000000
  };
}

/**
 * Validate Rijksdriehoek coordinates
 * Valid range for Netherlands: X: 10000-280000, Y: 300000-620000
 */
export function validateRDCoordinates(rd: RDCoordinates): boolean {
  return (
    rd.x >= 10000 && rd.x <= 280000 &&
    rd.y >= 300000 && rd.y <= 620000
  );
}

/**
 * Parse RD coordinates from various input formats
 * Supports: "123456,456789", "123456 456789", "X:123456 Y:456789"
 */
export function parseRDCoordinates(input: string): RDCoordinates | null {
  if (!input || typeof input !== 'string') {
    return null;
  }
  
  // Clean input: remove extra spaces, convert to lowercase
  const cleaned = input.trim().toLowerCase().replace(/\s+/g, ' ');
  
  // Try different formats
  let x: number | undefined = undefined, y: number | undefined = undefined;
  
  // Format: "123456,456789"
  if (cleaned.includes(',')) {
    const parts = cleaned.split(',');
    if (parts.length === 2) {
      x = parseFloat(parts[0].trim());
      y = parseFloat(parts[1].trim());
    }
  }
  // Format: "x:123456 y:456789" or "123456 456789"
  else if (cleaned.includes(' ')) {
    const parts = cleaned.split(' ');
    if (parts.length === 2) {
      // Simple space-separated format
      x = parseFloat(parts[0]);
      y = parseFloat(parts[1]);
    } else {
      // x:123456 y:456789 format
      const xMatch = cleaned.match(/x[:\s]*(\d+(?:\.\d+)?)/);
      const yMatch = cleaned.match(/y[:\s]*(\d+(?:\.\d+)?)/);
      if (xMatch && yMatch) {
        x = parseFloat(xMatch[1]);
        y = parseFloat(yMatch[1]);
      }
    }
  }
  // Single string with 12 digits (assuming first 6 are X, last 6 are Y)
  else if (/^\d{12}$/.test(cleaned)) {
    x = parseFloat(cleaned.substring(0, 6));
    y = parseFloat(cleaned.substring(6, 12));
  }
  
  // Validate parsed coordinates
  if (x === undefined || y === undefined || isNaN(x) || isNaN(y)) {
    return null;
  }
  
  const coordinates = { x, y };
  return validateRDCoordinates(coordinates) ? coordinates : null;
}

/**
 * Format RD coordinates for display
 */
export function formatRDCoordinates(rd: RDCoordinates): string {
  return `${Math.round(rd.x)}, ${Math.round(rd.y)}`;
}

/**
 * Calculate distance between two WGS84 points in meters using Haversine formula
 */
export function calculateDistance(coord1: WGS84Coordinates, coord2: WGS84Coordinates): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
  const dLng = (coord2.lng - coord1.lng) * Math.PI / 180;
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(coord1.lat * Math.PI / 180) * Math.cos(coord2.lat * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}