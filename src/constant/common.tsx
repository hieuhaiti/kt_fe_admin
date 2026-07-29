import {
  AlertTriangle,
  Bell,
  Cloud,
  FileText,
  Flame,
  History,
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
    permission: { resource: 'statistics', action: 'dashboard' },
  },
  // ── GIS ──
  {
    icon: <Map />,
    name: 'Lớp bản đồ',
    path: '/map-layers',
    permission: { resource: 'map_layers', action: 'read' },
    subItems: [
      {
        name: 'Quản lý lớp dữ liệu',
        path: '/map-layers',
        permission: { resource: 'map_layers', action: 'read' },
      },
      {
        name: 'Nhập file GIS',
        path: '/map-layers/import-geojson',
        permission: { resource: 'map_layers', action: 'create' },
      },
    ],
  },
  {
    icon: <History />,
    name: 'Ảnh theo thời gian',
    path: '/layer-series',
    permission: { resource: 'map_layers', action: 'read' },
  },
  {
    icon: <Key />,
    name: 'API bản đồ',
    path: '/map-apis',
    permission: { resource: 'map_apis', action: 'read' },
  },

  {
    icon: <Image />,
    name: 'Ảnh bản đồ',
    path: '/map-images',
    permission: { resource: 'pdf_maps', action: 'read' },
  },
  {
    icon: <Trees />,
    name: 'Phân loại rừng',
    path: '/forest-classification',
    permission: { resource: 'forest_classification', action: 'read' },
  },
  {
    icon: <Flame />,
    name: 'Cảnh báo cháy rừng',
    path: '/fire-risk',
    permission: { resource: 'fire_risk', action: 'read' },
  },
  {
    icon: <Cloud />,
    name: 'Thời tiết',
    path: '/weather',
    permission: { resource: 'weather', action: 'read' },
  },
  // ── Nội dung ──
  {
    icon: <Newspaper />,
    name: 'Tin tức',
    path: '/news',
    permission: { resource: 'news', action: 'read' },
    subItems: [
      { name: 'Tin tức', path: '/news', permission: { resource: 'news', action: 'read' } },
      {
        name: 'Bình luận',
        path: '/news-comments',
        permission: { resource: 'comments', action: 'approve' },
      },
    ],
  },
  {
    icon: <FileText />,
    name: 'Báo cáo / Văn bản',
    path: '/documents',
    permission: { resource: 'documents', action: 'read' },
  },

  // ── Vận hành ──
  {
    icon: <AlertTriangle />,
    name: 'Phản ánh hiện trường',
    path: '/feedbacks',
    permission: { resource: 'feedback', action: 'read' },
  },
  {
    icon: <Ruler />,
    name: 'Đo đạc thực địa',
    path: '/field-measurements',
    permission: { resource: 'field_measurements', action: 'read' },
    subItems: [
      {
        name: 'Phiên đo thực địa',
        path: '/field-measurements',
        permission: { resource: 'field_measurements', action: 'read' },
      },
      {
        name: 'Khu vực theo dõi',
        path: '/monitored-areas',
        permission: { resource: 'field_measurements', action: 'read' },
      },
    ],
  },
  {
    icon: <Bell />,
    name: 'Gửi thông báo',
    path: '/notifications/send',
    permission: { resource: 'notifications', action: 'send' },
  },

  // ── Quản trị ──
  {
    icon: <Users />,
    name: 'Người dùng',
    path: '/users',
    permission: { resource: 'users', action: 'read' },
  },
  {
    icon: <MessageSquare />,
    name: 'Tài liệu hệ thống',
    path: 'http://103.163.119.247:8881/uploads/dl_hdsd_admin.docx',
  },
]
