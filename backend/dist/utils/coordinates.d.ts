/**
 * Rijksdriehoek (RD) to WGS84 coordinate conversion utilities
 * Based on official Kadaster transformation parameters
 */
interface RDCoordinates {
    x: number;
    y: number;
}
interface WGS84Coordinates {
    lat: number;
    lng: number;
}
/**
 * Convert Rijksdriehoek coordinates to WGS84
 */
export declare function rdToWgs84(rd: RDCoordinates): WGS84Coordinates;
/**
 * Validate Rijksdriehoek coordinates
 * Valid range for Netherlands: X: 10000-280000, Y: 300000-620000
 */
export declare function validateRDCoordinates(rd: RDCoordinates): boolean;
/**
 * Parse RD coordinates from various input formats
 * Supports: "123456,456789", "123456 456789", "X:123456 Y:456789"
 */
export declare function parseRDCoordinates(input: string): RDCoordinates | null;
/**
 * Format RD coordinates for display
 */
export declare function formatRDCoordinates(rd: RDCoordinates): string;
/**
 * Calculate distance between two WGS84 points in meters using Haversine formula
 */
export declare function calculateDistance(coord1: WGS84Coordinates, coord2: WGS84Coordinates): number;
export {};
//# sourceMappingURL=coordinates.d.ts.map