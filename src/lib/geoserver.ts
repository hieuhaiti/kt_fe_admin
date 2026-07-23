const DEFAULT_WORKSPACE = 'kontum'

function getLayerParts(layerFqn: string): [string, string] {
  const value = String(layerFqn || '').trim()
  if (value.includes(':')) {
    const [workspace, ...nameParts] = value.split(':')
    return [workspace, nameParts.join(':')]
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

export function buildGeoserverPreviewUrl(layerFqn: string): string {
  const service = buildServiceEndpoint(layerFqn, 'wms')
  if (!service) return '#'

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
  if (!layerFqn) return null
  const service = buildServiceEndpoint(layerFqn, 'wcs')
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
  if (!response.ok) throw new Error(`GeoServer trả lỗi HTTP ${response.status}.`)

  const blob = await response.blob()
  if (!blob.size) throw new Error('Tệp raster tải về rỗng.')

  const bytes = new Uint8Array(await blob.slice(0, 4).arrayBuffer())
  const extension = detectRasterExtension(bytes)
  if (!extension) throw new Error('GeoServer không trả về tệp GeoTIFF hợp lệ.')

  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = withExtension(filename, extension)
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(objectUrl), 5000)
}
