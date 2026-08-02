'use client'

import { useEffect, useRef, useState } from 'react'
import { MapPin, Loader2 } from 'lucide-react'
import 'leaflet/dist/leaflet.css'

// Agadir bounding box — the map is locked to this area.
const AGADIR_BOUNDS: [[number, number], [number, number]] = [
  [30.30, -9.70], // SW
  [30.55, -9.45], // NE
]
const AGADIR_CENTER: [number, number] = [30.4278, -9.5981]

export interface PickedLocation {
  lat: number
  lng: number
  label: string
}

interface Props {
  value: PickedLocation | null
  onChange: (location: PickedLocation) => void
}

// Pulls the most specific human-readable name out of a Nominatim response.
function extractPlaceName(data: any): string | null {
  const a = data?.address
  if (a) {
    const specific =
      a.neighbourhood ||
      a.suburb ||
      a.quarter ||
      a.residential ||
      a.hamlet ||
      a.road ||
      a.city_district ||
      a.town ||
      a.village ||
      null
    if (specific) return specific
  }
  if (data?.display_name) {
    return data.display_name.split(',')[0].trim()
  }
  return null
}

export default function ZoneMapPicker({ value, onChange }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const leafletRef = useRef<any>(null)
  const [loadingMap, setLoadingMap] = useState(true)
  const [mapError, setMapError] = useState<string | null>(null)
  const [geocoding, setGeocoding] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        const L = (await import('leaflet')).default
        if (cancelled || !mapContainerRef.current || mapRef.current) return

        leafletRef.current = L

        delete (L.Icon.Default.prototype as any)._getIconUrl
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        })

        const map = L.map(mapContainerRef.current, {
          center: AGADIR_CENTER,
          zoom: 13,
          minZoom: 12,
          maxZoom: 18,
          maxBounds: AGADIR_BOUNDS,
          maxBoundsViscosity: 1.0,
        })

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map)

        map.on('click', (e: any) => {
          const { lat, lng } = e.latlng
          handlePick(lat, lng)
        })

        mapRef.current = map
        setTimeout(() => map.invalidateSize(), 100)
        setLoadingMap(false)
      } catch (err) {
        console.error('Failed to initialize map:', err)
        if (!cancelled) {
          setMapError('Map failed to load. Try refreshing the page.')
          setLoadingMap(false)
        }
      }
    }

    init()
    return () => {
      cancelled = true
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function placePin(lat: number, lng: number, label: string) {
    const L = leafletRef.current
    const map = mapRef.current
    if (!L || !map) return

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng])
    } else {
      markerRef.current = L.marker([lat, lng]).addTo(map)
    }
    markerRef.current
      .bindPopup(`<strong>${label}</strong>`, { autoPan: false })
      .openPopup()
  }

  async function handlePick(lat: number, lng: number) {
    setGeocoding(true)

    // The label is the actual thing that gets saved and shown — the real
    // picked place.
    let label = `${lat.toFixed(5)}, ${lng.toFixed(5)}`
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: { Accept: 'application/json' } }
      )
      const data = await res.json()
      label = extractPlaceName(data) || label
    } catch {
      // keep the coordinate fallback if geocoding fails
    } finally {
      setGeocoding(false)
      placePin(lat, lng, label)
      onChange({ lat, lng, label })
    }
  }

  return (
    <div className="space-y-2">
      <div className="relative rounded-lg overflow-hidden border border-border">
        <div ref={mapContainerRef} className="w-full h-64" />
        {loadingMap && (
          <div className="absolute inset-0 flex items-center justify-center bg-card">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {mapError && (
          <div className="absolute inset-0 flex items-center justify-center bg-card px-4 text-center">
            <p className="text-sm text-red-400">{mapError}</p>
          </div>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Tap the map to drop a pin at your location.
      </p>

      {(geocoding || value) && (
        <div className="flex items-center gap-3 bg-muted/50 rounded-lg px-4 py-3">
          <MapPin className="w-5 h-5 text-primary shrink-0" />
          {geocoding ? (
            <p className="text-sm text-muted-foreground">Locating…</p>
          ) : (
            <p className="text-lg font-bold text-foreground truncate">{value?.label}</p>
          )}
        </div>
      )}
    </div>
  )
}