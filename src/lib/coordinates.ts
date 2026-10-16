/** Inverse UTM zone 48N (WGS 84), Snyder section 8. Input: meters; output: degrees. */
const UTM48N_ZONE = 48
const UTM_A = 6378137
const UTM_E2 = 0.00669437999014
const UTM_K0 = 0.9996

export function utm48nToLngLat(easting: number, northing: number): { lng: number; lat: number } {
  const x = easting - 500000
  const y = northing // UTM 48N bắc bán cầu → không cần offset 10_000_000
  const e1 = (1 - Math.sqrt(1 - UTM_E2)) / (1 + Math.sqrt(1 - UTM_E2))
  const eSq = UTM_E2 / (1 - UTM_E2)

  const M = y / UTM_K0
  const mu = M / (UTM_A * (1 - UTM_E2 / 4 - (3 * UTM_E2 ** 2) / 64 - (5 * UTM_E2 ** 3) / 256))
  const phi1 =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
    ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu)

  const sinPhi1 = Math.sin(phi1)
  const cosPhi1 = Math.cos(phi1)
  const tanPhi1 = Math.tan(phi1)
  const N1 = UTM_A / Math.sqrt(1 - UTM_E2 * sinPhi1 ** 2)
  const T1 = tanPhi1 ** 2
  const C1 = eSq * cosPhi1 ** 2
  const R1 = (UTM_A * (1 - UTM_E2)) / (1 - UTM_E2 * sinPhi1 ** 2) ** 1.5
  const D = x / (N1 * UTM_K0)

  const latRad =
    phi1 -
    ((N1 * tanPhi1) / R1) *
      (D ** 2 / 2 -
        ((5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * eSq) * D ** 4) / 24 +
        ((61 + 90 * T1 + 298 * C1 + 45 * T1 ** 2 - 252 * eSq - 3 * C1 ** 2) * D ** 6) / 720)
  const lngRad =
    (D -
      ((1 + 2 * T1 + C1) * D ** 3) / 6 +
      ((5 - 2 * C1 + 28 * T1 - 3 * C1 ** 2 + 8 * eSq + 24 * T1 ** 2) * D ** 5) / 120) /
    cosPhi1

  const lng0Rad = (((UTM48N_ZONE - 1) * 6 - 180 + 3) * Math.PI) / 180
  return {
    lng: ((lng0Rad + lngRad) * 180) / Math.PI,
    lat: (latRad * 180) / Math.PI,
  }
}

