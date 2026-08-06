import { useState, useEffect } from 'react';
import { Layout, Dropdown, Button, Space, Modal, App } from 'antd';
import { UserOutlined, LogoutOutlined, DownOutlined, SettingOutlined, SafetyOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../stores/auth';
import { siteApi } from '../api/site';
import type { ReactNode } from 'react';

const { Header, Content, Footer } = Layout;

interface AppLayoutProps {
  children: ReactNode;
  /** Extra header content (e.g. view switcher, import/export buttons) */
  headerExtra?: ReactNode;
  /** Left side of header (e.g. navigation) */
  headerLeft?: ReactNode;
}

export default function AppLayout({ children, headerExtra, headerLeft }: AppLayoutProps) {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { message } = App.useApp();
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [icpNumber, setIcpNumber] = useState('');
  const [publicSecurityNumber, setPublicSecurityNumber] = useState('');

  useEffect(() => {
    siteApi.getInfo().then((info) => {
      setIcpNumber(info.icp_number);
      setPublicSecurityNumber(info.public_security_number);
    }).catch(() => {});
  }, []);

  const handleLogout = async () => {
    await logout();
    message.success('已退出登录');
  };

  const menuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人信息',
      onClick: () => navigate('/profile'),
    },
    ...(isAdmin
      ? [
          { type: 'divider' as const },
          {
            key: 'admin',
            icon: <SafetyOutlined />,
            label: '管理后台',
            onClick: () => navigate('/admin'),
          },
        ]
      : []),
    { type: 'divider' as const },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      danger: true,
      onClick: () => setLogoutModalOpen(true),
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        className="app-header"
        style={{
          background: '#fff',
          borderBottom: '1px solid #e5e7eb',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}
      >
        <div className="app-header-left" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <span
            style={{ fontSize: 20, fontWeight: 700, color: '#4A90D9', cursor: 'pointer', whiteSpace: 'nowrap' }}
            onClick={() => navigate('/')}
          >
            日历视图
          </span>
          {headerLeft}
        </div>

        <div className="app-header-right" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {headerExtra}
          <Dropdown menu={{ items: menuItems }} trigger={['click']}>
            <Button type="text">
              <Space>
                <UserOutlined />
                <span className="app-username">{user?.display_name || user?.username || '用户'}</span>
                <DownOutlined style={{ fontSize: 10 }} />
              </Space>
            </Button>
          </Dropdown>
        </div>
      </Header>

      <Content className="app-content" style={{ padding: '20px 24px' }}>
        <div style={{ maxWidth: 1300, margin: '0 auto' }}>{children}</div>
      </Content>

      <Footer style={{ textAlign: 'center', padding: '16px 24px', background: '#f5f5f5', borderTop: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 13, color: '#9ca3af' }}>日历视图 © {new Date().getFullYear()}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
            {icpNumber && (
              <a
                href="https://beian.miit.gov.cn/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 12, color: '#9ca3af', textDecoration: 'none' }}
              >
                {icpNumber}
              </a>
            )}
            {publicSecurityNumber && (
              <a
                href="http://www.beian.gov.cn/portal/registerSystemInfo"
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 12, color: '#9ca3af', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <img src="https://www.beian.gov.cn/img/ghs.png" alt="" style={{ width: 14, height: 14 }} />
                {publicSecurityNumber}
              </a>
            )}
          </div>
        </div>
      </Footer>

      <Modal
        title="确认退出"
        open={logoutModalOpen}
        onOk={handleLogout}
        onCancel={() => setLogoutModalOpen(false)}
        okText="确认退出"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <p>确定要退出登录吗？</p>
      </Modal>
    </Layout>
  );
}
