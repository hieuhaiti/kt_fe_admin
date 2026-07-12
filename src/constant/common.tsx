import {
  AlertTriangle,
  Bell,
  ClipboardList,
  Cloud,
  Compass,
  FileText,
  Flame,
  Key,
  LayoutDashboard,
  LineChart,
  Map,
  MessageSquare,
  Newspaper,
  Satellite,
  Smartphone,
  Trees,
  Users,
} from 'lucide-react'
import type { NavItem } from '@/types/common/index'
import { ROLES } from '@/lib/permissions'

export const navConfig: NavItem[] = [
  {
    icon: <LayoutDashboard />,
    name: 'Tổng quan',
    path: '/dashboard',
    subpath: '/',
    permission: 'stats:view',
  },
  {
    icon: <LineChart />,
    name: 'Thống kê',
    path: '/statistics',
    permission: 'stats:view',
  },

  // ── GIS ──
  {
    icon: <Map />,
    name: 'Lớp bản đồ',
    path: '/map-layers',
    permission: 'map-layers:view',
    subItems: [
      { name: 'Quản lý lớp dữ liệu', path: '/map-layers', permission: 'map-layers:view' },
      { name: 'Nhập file GIS', path: '/map-layers/import-geojson', permission: 'map-layers:import' },
      { name: 'Nhập Excel (legacy)', path: '/map-layers/import-excel', permission: 'map-layers:import' },
    ],
  },
  {
    icon: <Key />,
    name: 'API bản đồ',
    path: '/map-apis',
    permission: 'map-apis:view',
  },

  // ── Ảnh vệ tinh & viễn thám ──
  {
    icon: <Satellite />,
    name: 'Ảnh vệ tinh',
    path: '/satellite',
    subItems: [
      { name: 'Theo yêu cầu (GEE)', path: '/satellite', permission: 'satellite:run' },
      { name: 'Viễn thám (COG)', path: '/remote-sensing', permission: 'remote-sensing:view' },
      { name: 'Bản đồ PDF', path: '/map-images', permission: 'pdf-maps:view' },
    ],
  },
  {
    icon: <Trees />,
    name: 'Phân loại rừng',
    path: '/forest-classification',
    permission: 'forest-classification:view',
  },
  {
    icon: <Flame />,
    name: 'Cảnh báo cháy rừng',
    path: '/fire-risk',
    permission: 'fire-risk:view',
  },
  {
    icon: <Cloud />,
    name: 'Thời tiết',
    path: '/weather',
    permission: 'weather:view',
  },
  {
    icon: <Compass />,
    name: 'Phân tích không gian',
    path: '/spatial',
    permission: 'spatial:view',
  },

  // ── Nội dung ──
  {
    icon: <Newspaper />,
    name: 'Tin tức',
    path: '/news',
    permission: 'news:view',
    subItems: [
      { name: 'Tin tức', path: '/news', permission: 'news:view' },
      { name: 'Bình luận', path: '/news-comments', permission: 'news:moderate-comments' },
    ],
  },
  {
    icon: <FileText />,
    name: 'Báo cáo / Văn bản',
    path: '/documents',
    permission: 'documents:view',
  },

  // ── Vận hành ──
  {
    icon: <AlertTriangle />,
    name: 'Phản ánh hiện trường',
    path: '/feedbacks',
    permission: 'feedback:view',
  },
  {
    icon: <Smartphone />,
    name: 'Cập nhật MobileGIS',
    path: '/field-updates',
    permission: 'mobile:view',
  },
  {
    icon: <Bell />,
    name: 'Gửi thông báo',
    path: '/notifications/send',
    permission: 'notifications:send',
  },

  // ── Quản trị ──
  {
    icon: <Users />,
    name: 'Người dùng',
    path: '/users',
    permission: 'users:view',
  },
  {
    icon: <ClipboardList />,
    name: 'Nhật ký cảnh báo',
    path: '/cron-alert-logs',
    roles: [ROLES.SYSTEM_ADMIN],
  },
  {
    icon: <MessageSquare />,
    name: 'Tài liệu hệ thống',
    path: 'http://103.163.119.247:8881/uploads/dl_hdsd_admin.docx',
  },
]
