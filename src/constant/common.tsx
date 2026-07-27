import {
  AlertTriangle,
  Bell,
  Cloud,
  FileText,
  Flame,
  Key,
  LayoutDashboard,
  Map,
  MessageSquare,
  Newspaper,
  Ruler,
  Image,
  Trees,
  Users,
} from 'lucide-react'
import type { NavItem } from '@/types/common/index'

export const navConfig: NavItem[] = [
  {
    icon: <LayoutDashboard />,
    name: 'Tổng quan',
    path: '/dashboard',
    subpath: '/',
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
      {
        name: 'Nhập file GIS',
        path: '/map-layers/import-geojson',
        permission: 'map-layers:import',
      },
    ],
  },
  {
    icon: <Key />,
    name: 'API bản đồ',
    path: '/map-apis',
    permission: 'map-apis:view',
  },

  {
    icon: <Image />,
    name: 'Ảnh bản đồ',
    path: '/map-images',
    permission: 'pdf-maps:view',
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
    icon: <Ruler />,
    name: 'Đo đạc thực địa',
    path: '/field-measurements',
    permission: 'field-measurements:view',
    subItems: [
      {
        name: 'Phiên đo thực địa',
        path: '/field-measurements',
        permission: 'field-measurements:view',
      },
      {
        name: 'Khu vực theo dõi',
        path: '/monitored-areas',
        permission: 'field-measurements:view',
      },
    ],
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
    icon: <MessageSquare />,
    name: 'Tài liệu hệ thống',
    path: 'http://103.163.119.247:8881/uploads/dl_hdsd_admin.docx',
  },
]
