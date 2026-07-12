export interface FieldUpdateBody {
  layerCode: string
  featureId?: number | string | null
  lng: number
  lat: number
  attributes: Record<string, any>
  clientUuid: string
  note?: string
}

export interface FieldUpdateResult {
  id: number
  layerCode: string
  featureId: number | string | null
  status: 'created' | 'updated' | 'duplicated'
  duplicated?: boolean
  createdAt?: string
}

export interface MobileSyncParams {
  since?: string
}

export interface MobileSyncData {
  updates: FieldUpdateResult[]
  serverTime: string
}
