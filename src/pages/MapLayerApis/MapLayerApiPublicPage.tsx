import { useSearchParams } from 'react-router-dom'
import PageLayout from '@/layout/pageLayout'
import PublicSlugTester from '@/components/map-layer-apis/PublicSlugTester'
import { StatusDotBadge } from '@/components/common/StatusDotBadge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const tabValues = ['tester', 'guide'] as const
type PublicTab = (typeof tabValues)[number]

function toValidTab(value: string | null): PublicTab {
  if (!value) return 'tester'
  return (tabValues.includes(value as PublicTab) ? value : 'tester') as PublicTab
}

export default function MapLayerApiPublicPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const currentTab = toValidTab(searchParams.get('tab'))

  return (
    <PageLayout
      title="Kiểm tra Map Data API"
      description="Kiểm tra endpoint consumer /map-data/layer và /map-data/features bằng X-Map-Api-Key"
    >
      <Tabs
        value={currentTab}
        onValueChange={(tab) => {
          setSearchParams({ tab })
        }}
      >
        <TabsList>
          <TabsTrigger value="tester">Test API</TabsTrigger>
          <TabsTrigger value="guide">Hướng dẫn</TabsTrigger>
        </TabsList>

        <TabsContent value="tester">
          <PublicSlugTester />
        </TabsContent>

        <TabsContent value="guide">
          <Card>
            <CardHeader className="space-y-2">
              <CardTitle className="text-xl">Cách dùng Map Data API</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <StatusDotBadge
                  label="GET /map-data/layer"
                  badgeClass="bg-secondary text-secondary-foreground border border-secondary"
                  dotClass="bg-secondary-foreground"
                />
                <StatusDotBadge
                  label="GET /map-data/features"
                  badgeClass="border border-input bg-background text-foreground"
                  dotClass="bg-foreground"
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="bg-muted/30 rounded-md border p-3">
                <p className="font-medium">Bước 1</p>
                <p className="text-muted-foreground mt-1">
                  Tạo khóa truy cập trong màn Quản lý kết nối bản đồ và lưu lại mã đầy đủ
                  vì hệ thống chỉ hiển thị một lần.
                </p>
              </div>

              <div className="bg-muted/30 rounded-md border p-3">
                <p className="font-medium">Bước 2</p>
                <p className="text-muted-foreground mt-1">
                  Gọi endpoint consumer với header <b>X-Map-Api-Key</b>. Bỏ trống bbox để kiểm tra metadata layer.
                </p>
              </div>

              <div className="bg-muted/30 rounded-md border p-3">
                <p className="font-medium">Bước 3</p>
                <p className="text-muted-foreground mt-1">
                  Khi gọi features, truyền bbox dạng <b>minLng,minLat,maxLng,maxLat</b> và limit phù hợp với scope của key.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageLayout>
  )
}
