/**
 * Minimal structural types for the subset of the Leaflet API used by
 * `DroneMap.vue`. Leaflet is loaded at runtime from `/vendor/leaflet`, so we
 * model only the members we call instead of adding the full `@types/leaflet`
 * package (which would also type the plugins we load by hand).
 */

export interface LeafletLatLng { lat: number, lng: number }

export type LeafletLatLngExpression = LeafletLatLng | [number, number]

export type LeafletIcon = object

export type LeafletEventHandler = (...args: unknown[]) => void

export interface LeafletLatLngBounds {
  getSouthWest(): LeafletLatLng
  getNorthEast(): LeafletLatLng
}

export interface LeafletControl {
  addTo(map: LeafletMap): LeafletControl
}

export interface LeafletLayer {
  addTo(map: LeafletMap): this
  on?(event: string, fn: LeafletEventHandler): this
  off?(event?: string, fn?: LeafletEventHandler): this
}

export interface LeafletMarker extends LeafletLayer {
  setLatLng(latlng: LeafletLatLngExpression): this
  setIcon(icon: LeafletIcon): this
  bindPopup(html: string, options?: Record<string, unknown>): this
  setPopupContent(content: string): this
}

export interface LeafletPolyline extends LeafletLayer {
  setLatLngs(points: LeafletLatLngExpression[]): this
  setStyle(style: Record<string, unknown>): this
}

export interface LeafletMarkerCluster extends LeafletLayer {
  addLayer(layer: LeafletMarker): this
  removeLayer(layer: LeafletMarker): this
  clearLayers(): this
}

export type LeafletGeoJSONLayer = LeafletLayer

export interface LeafletMap {
  hasLayer(layer: unknown): boolean
  addLayer(layer: unknown): LeafletMap
  getBounds(): LeafletLatLngBounds
  getCenter(): LeafletLatLng
  setView(center: LeafletLatLngExpression, zoom?: number, options?: Record<string, unknown>): LeafletMap
  panTo(center: LeafletLatLngExpression, options?: Record<string, unknown>): LeafletMap
  getZoom(): number
  fitBounds(
    bounds: LeafletLatLngBounds | LeafletLatLngExpression[],
    options?: Record<string, unknown>
  ): LeafletMap
  removeLayer(layer: unknown): LeafletMap
  remove(): void
  invalidateSize(options?: Record<string, unknown>): LeafletMap
  on(type: string, fn: LeafletEventHandler): LeafletMap
  addControl(control: LeafletControl): LeafletMap
  setBearing?(degrees: number): LeafletMap
  setRotation?(degrees: number): LeafletMap
  /** Internal flag: the airspace `moveend` handler has been attached. */
  _airspaceBound?: boolean
}

/** Leaflet core controls plus the measure plugin controls. */
export interface LeafletControlFactory {
  zoom(options?: Record<string, unknown>): LeafletControl
  scale(options?: Record<string, unknown>): LeafletControl
  polylineMeasure?(options?: Record<string, unknown>): LeafletControl
}

export interface LeafletMeasureControlConstructor {
  new (options?: Record<string, unknown>): LeafletControl
}

export interface LeafletStatic {
  control?: LeafletControlFactory
  MeasureControl?: LeafletMeasureControlConstructor
  markerClusterGroup?: (options?: Record<string, unknown>) => LeafletMarkerCluster
  geoJSON?: (geojson: unknown, options?: Record<string, unknown>) => LeafletGeoJSONLayer
  map(element: HTMLElement, options?: Record<string, unknown>): LeafletMap
  tileLayer(url: string, options?: Record<string, unknown>): LeafletLayer
  divIcon(options?: Record<string, unknown>): LeafletIcon
  marker(latlng: LeafletLatLngExpression, options?: Record<string, unknown>): LeafletMarker
  polyline(points: LeafletLatLngExpression[], options?: Record<string, unknown>): LeafletPolyline
  latLng(latitude: number, longitude: number, altitude?: number): LeafletLatLng
  latLngBounds(
    corners: LeafletLatLngExpression[] | LeafletLatLngExpression,
    corner2?: LeafletLatLngExpression
  ): LeafletLatLngBounds
}

declare global {
  interface Window {
    L?: LeafletStatic
  }
}

export {}
