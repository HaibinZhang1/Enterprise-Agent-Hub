import React from 'react';
import { Layout, Menu, Button, Avatar, Dropdown, Space } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Store,
  Box,
  Inbox,
  Bell,
  Users,
  Briefcase,
  Settings,
  Wrench,
  FolderKanban,
  Building,
  LogOut,
  User
} from 'lucide-react';
import { useAuthStore } from '../stores/useAuthStore';

const { Header, Sider, Content } = Layout;

export default function AppLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { actor, logout } = useAuthStore();

  const handleMenuClick = (e) => {
    navigate(`/${e.key}`);
  };

  const currentKey = location.pathname.split('/')[1] || 'home';

  const items = [
    { key: 'home', icon: <LayoutDashboard size={18} />, label: 'Home' },
    { key: 'market', icon: <Store size={18} />, label: 'Market' },
    { key: 'my-skill', icon: <Box size={18} />, label: 'My Skills' },
    { key: 'review', icon: <Inbox size={18} />, label: 'Review' },
    { key: 'notifications', icon: <Bell size={18} />, label: 'Notifications' },
    { type: 'divider' },
    { key: 'user-management', icon: <Users size={18} />, label: 'Users' },
    { key: 'skill-management', icon: <Briefcase size={18} />, label: 'Manage Skills' },
    { key: 'department-management', icon: <Building size={18} />, label: 'Departments' },
    { type: 'divider' },
    { key: 'tools', icon: <Wrench size={18} />, label: 'Tools' },
    { key: 'projects', icon: <FolderKanban size={18} />, label: 'Projects' },
    { key: 'settings', icon: <Settings size={18} />, label: 'Settings' },
  ];

  const userMenuItems = [
    {
      key: 'profile',
      label: 'Profile',
      icon: <User size={16} />
    },
    { type: 'divider' },
    {
      key: 'logout',
      label: 'Log out',
      icon: <LogOut size={16} />,
      onClick: () => {
        logout();
        navigate('/login');
      }
    }
  ];

  return (
    <div className="app-container">
      {/* Sidebar */}
      <div className="app-sidebar glass-sidebar">
        <div style={{ height: 56, display: 'flex', alignItems: 'center', padding: '0 24px' }}>
          <div style={{ fontWeight: 600, fontSize: 18, color: '#1d1d1f' }}>Agent Hub</div>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[currentKey]}
          items={items}
          onClick={handleMenuClick}
          style={{ background: 'transparent', borderRight: 0, padding: '0 12px' }}
          className="mac-list"
        />
      </div>

      {/* Main Area */}
      <div className="app-main">
        {/* Top bar */}
        <header className="app-header glass-panel" style={{ justifyContent: 'flex-end', background: 'rgba(255, 255, 255, 0.4)' }}>
           <Space size="large">
             <Button type="text" icon={<Bell size={20} color="#86868b" />} onClick={() => navigate('/notifications')} />
             <Dropdown menu={{ items: userMenuItems }} trigger={['click']} placement="bottomRight">
                <Button type="text" style={{ padding: '0 8px', height: 'auto' }}>
                  <Space>
                    <Avatar style={{ backgroundColor: '#0066cc' }}>{actor?.username?.charAt(0)?.toUpperCase() || 'U'}</Avatar>
                    <span style={{ fontWeight: 500, color: '#1d1d1f' }}>{actor?.username}</span>
                  </Space>
                </Button>
             </Dropdown>
           </Space>
        </header>

        {/* Content */}
        <main className="app-content">
          {children}
        </main>
      </div>
    </div>
  );
}
