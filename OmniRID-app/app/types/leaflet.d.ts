export interface LeafletLatLng { lat: number, lng: number }
export type LeafletLatLngExpression = LeafletLatLng | [number, number]
export type LeafletLatLngBounds = object
export type LeafletIcon = object

export interface LeafletLayer {
  addTo(map: LeafletMap): LeafletLayer
  on?(event: string, fn: (...args: any[]) => void): LeafletLayer
}

export interface LeafletMarker {
  on?(event: string, fn: (...args: any[]) => void): LeafletMarker
  off?(event?: string, fn?: (...args: any[]) => void): LeafletMarker
  addTo(map: LeafletMap): LeafletMarker
  setLatLng(latlng: LeafletLatLngExpression): LeafletMarker
  setIcon(icon: LeafletIcon): LeafletMarker
  bindPopup(html: string, options?: Record<string, unknown>): LeafletMarker
}

export interface LeafletPolyline {
  addTo(map: LeafletMap): LeafletPolyline
  setLatLngs(points: LeafletLatLngExpression[]): LeafletPolyline
  setStyle(style: Record<string, unknown>): LeafletPolyline
}

export interface LeafletMap {
  hasLayer(layer: unknown): boolean
  addLayer(layer: unknown): LeafletMap
  getBounds?(): any
  setView(center: LeafletLatLngExpression, zoom?: number, options?: Record<string, unknown>): LeafletMap
  panTo(center: LeafletLatLngExpression, options?: Record<string, unknown>): LeafletMap
  getZoom(): number
  fitBounds(bounds: LeafletLatLngBounds, options?: Record<string, unknown>): LeafletMap
  removeLayer(layer: unknown): LeafletMap
  remove(): void
  invalidateSize(options?: Record<string, unknown>): LeafletMap
  on(type: string, fn: (...args: never[]) => void): LeafletMap
  addControl?(control: any): LeafletMap
}

export interface LeafletStatic {
  control?: any
  MeasureControl?: any
  markerClusterGroup?: (options?: Record<string, unknown>) => any
  geoJSON?: (geojson: any, options?: Record<string, unknown>) => any
  map(element: HTMLElement, options?: Record<string, unknown>): LeafletMap
  tileLayer(url: string, options?: Record<string, unknown>): LeafletLayer
  divIcon(options?: Record<string, unknown>): LeafletIcon
  marker(latlng: LeafletLatLngExpression, options?: Record<string, unknown>): LeafletMarker
  polyline(points: LeafletLatLngExpression[], options?: Record<string, unknown>): LeafletPolyline
  latLng(latitude: number, longitude: number, altitude?: number): LeafletLatLng
  latLngBounds(corner1: LeafletLatLngExpression, corner2: LeafletLatLngExpression): LeafletLatLngBounds
}

declare global {
  interface Window {
    L?: LeafletStatic
  }
}

export {}
