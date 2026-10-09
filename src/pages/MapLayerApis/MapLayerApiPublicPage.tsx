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
      title="Kiểm tra API bản đồ"
      description="Kiểm tra thông tin lớp và đối tượng bản đồ bằng khóa API."
    >
      <Tabs
        value={currentTab}
        onValueChange={(tab) => {
          setSearchParams({ tab })
        }}
      >
        <TabsList>
          <TabsTrigger value="tester">Kiểm tra API</TabsTrigger>
          <TabsTrigger value="guide">Hướng dẫn</TabsTrigger>
        </TabsList>

        <TabsContent value="tester">
          <PublicSlugTester />
        </TabsContent>

        <TabsContent value="guide">
          <Card>
            <CardHeader className="space-y-2">
              <CardTitle className="text-xl">Cách dùng API bản đồ</CardTitle>
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
                  Tạo khóa trong “Khóa API bản đồ” và lưu mã ngay. Mã đầy đủ chỉ hiển thị một lần.
                </p>
              </div>

              <div className="bg-muted/30 rounded-md border p-3">
                <p className="font-medium">Bước 2</p>
                <p className="text-muted-foreground mt-1">
                  Gửi yêu cầu với header <b>X-Map-Api-Key</b>. Bỏ trống bbox để xem thông tin lớp.
                </p>
              </div>

              <div className="bg-muted/30 rounded-md border p-3">
                <p className="font-medium">Bước 3</p>
                <p className="text-muted-foreground mt-1">
                  Khi lấy đối tượng, truyền bbox theo thứ tự <b>minLng,minLat,maxLng,maxLat</b> và limit trong giới hạn của khóa.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageLayout>
  )
}
