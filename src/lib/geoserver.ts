const DEFAULT_WORKSPACE = 'kontum'
// Earth Engine only documents these URLs as lasting "a few hours", without a
// guaranteed TTL. Four hours is deliberately conservative so the UI does not
// offer a preview/download that is likely to fail.
const GEE_TEMPORARY_URL_MAX_AGE_MS = 4 * 60 * 60 * 1000

export type TemporaryRasterUrlStatus = 'available' | 'expired' | 'invalid' | 'missing'

export function normalizeGeoserverLayer(layerFqn?: string | null): string | null {
  const value = String(layerFqn || '').trim()
  if (!value || value === '#' || /^https?:\/\//i.test(value)) return null

  if (!value.includes(':')) return value

  const [workspace, ...nameParts] = value.split(':')
  const layerName = nameParts.join(':').trim()
  if (!workspace.trim() || !layerName) return null

  return `${workspace.trim()}:${layerName}`
}

function normalizeHttpUrl(value?: string | null): string | null {
  const url = String(value || '').trim()
  if (!url || !/^https?:\/\/\S+$/i.test(url)) return null

  try {
    const parsed = new URL(url)
    return parsed.hostname ? url : null
  } catch {
    return null
  }
}

/**
 * GEE map/download URLs are temporary. `generatedAt` is the URL generation
 * timestamp when the API exposes it; callers may fall back to the snapshot
 * completion timestamp because the URL is created immediately before the
 * snapshot becomes completed.
 */
export function getTemporaryRasterUrlStatus(
  value?: string | null,
  generatedAt?: string | null
): TemporaryRasterUrlStatus {
  const rawValue = String(value || '').trim()
  if (!rawValue) return 'missing'
  if (!normalizeHttpUrl(rawValue)) return 'invalid'

  if (generatedAt) {
    const generatedMs = Date.parse(generatedAt)
    if (Number.isFinite(generatedMs) && Date.now() - generatedMs >= GEE_TEMPORARY_URL_MAX_AGE_MS) {
      return 'expired'
    }
  }

  return 'available'
}

export function getUsableTemporaryRasterUrl(
  value?: string | null,
  generatedAt?: string | null
): string | null {
  if (getTemporaryRasterUrlStatus(value, generatedAt) !== 'available') return null
  return normalizeHttpUrl(value)
}

function getLayerParts(layerFqn: string): [string, string] {
  const value = normalizeGeoserverLayer(layerFqn)
  if (!value) return ['', '']

  if (value.includes(':')) {
    const [workspace, ...nameParts] = value.split(':')
    return [workspace.trim(), nameParts.join(':').trim()]
  }

  return [import.meta.env.VITE_GEOSERVER_WORKSPACE || DEFAULT_WORKSPACE, value]
}

function getGeoserverRoot(workspace: string): string {
  const configuredUrl = (import.meta.env.VITE_GEOSERVER_URL as string | undefined) || ''
  return configuredUrl
    .trim()
    .replace(/\/+$/, '')
    .replace(new RegExp(`/${workspace}/(?:wms|wcs)$`, 'i'), '')
    .replace(/\/(?:wms|wcs)$/i, '')
}

function buildServiceEndpoint(layerFqn: string, service: 'wms' | 'wcs') {
  const [workspace, layerName] = getLayerParts(layerFqn)
  const root = getGeoserverRoot(workspace)
  if (!root || !workspace || !layerName) return null

  return {
    endpoint: `${root}/${workspace}/${service}`,
    workspace,
    layerName,
  }
}

export function buildGeoserverRasterTileUrl(
  layerFqns: Array<string | null | undefined>
): string | null {
  const layers = Array.from(
    new Set(
      layerFqns
        .map((layer) => normalizeGeoserverLayer(layer))
        .filter((layer): layer is string => Boolean(layer))
    )
  )
  if (!layers.length) return null

  const layerParts = layers.map((layer) => getLayerParts(layer))
  const workspace = layerParts[0][0]
  if (!workspace || layerParts.some(([candidate]) => candidate !== workspace)) return null

  const service = buildServiceEndpoint(layers[0], 'wms')
  if (!service) return null

  const params = new URLSearchParams({
    service: 'WMS',
    version: '1.3.0',
    request: 'GetMap',
    layers: layerParts
      .map(([candidateWorkspace, name]) => `${candidateWorkspace}:${name}`)
      .join(','),
    styles: '',
    width: '256',
    height: '256',
    crs: 'EPSG:3857',
    format: 'image/png',
    transparent: 'true',
    tiled: 'true',
  })

  return `${service.endpoint}?${params.toString()}&bbox={bbox-epsg-3857}`
}

export function buildGeoserverPreviewUrl(layerFqn?: string | null): string | null {
  const layer = normalizeGeoserverLayer(layerFqn)
  if (!layer) return null

  const service = buildServiceEndpoint(layer, 'wms')
  if (!service) return null

  const params = new URLSearchParams({
    service: 'WMS',
    version: '1.1.0',
    request: 'GetMap',
    layers: `${service.workspace}:${service.layerName}`,
    bbox: '107.35,13.83,108.87,15.55',
    width: '768',
    height: '768',
    srs: 'EPSG:4326',
    styles: '',
    format: 'application/openlayers',
  })

  return `${service.endpoint}?${params.toString()}`
}

export function buildGeoserverDownloadUrl(layerFqn?: string | null): string | null {
  const layer = normalizeGeoserverLayer(layerFqn)
  if (!layer) return null

  const service = buildServiceEndpoint(layer, 'wcs')
  if (!service) return null

  const params = new URLSearchParams({
    service: 'WCS',
    version: '2.0.1',
    request: 'GetCoverage',
    coverageId: `${service.workspace}__${service.layerName}`,
    format: 'image/tiff',
  })

  return `${service.endpoint}?${params.toString()}`
}

function detectRasterExtension(bytes: Uint8Array): 'tif' | 'zip' | null {
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return 'zip'

  const littleEndianTiff =
    bytes[0] === 0x49 &&
    bytes[1] === 0x49 &&
    (bytes[2] === 0x2a || bytes[2] === 0x2b) &&
    bytes[3] === 0x00
  const bigEndianTiff =
    bytes[0] === 0x4d &&
    bytes[1] === 0x4d &&
    bytes[2] === 0x00 &&
    (bytes[3] === 0x2a || bytes[3] === 0x2b)

  return littleEndianTiff || bigEndianTiff ? 'tif' : null
}

function withExtension(filename: string, extension: 'tif' | 'zip') {
  return /\.[^.]+$/.test(filename)
    ? filename.replace(/\.[^.]+$/, `.${extension}`)
    : `${filename}.${extension}`
}

export async function downloadRasterFile(url: string, filename: string): Promise<void> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Nguồn dữ liệu trả lỗi HTTP ${response.status}.`)

  const blob = await response.blob()
  if (!blob.size) throw new Error('Tệp ảnh tải về rỗng.')

  const bytes = new Uint8Array(await blob.slice(0, 4).arrayBuffer())
  const extension = detectRasterExtension(bytes)
  if (!extension) throw new Error('Nguồn dữ liệu không trả về ảnh bản đồ hợp lệ.')

  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = withExtension(filename, extension)
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(objectUrl), 5000)
}
