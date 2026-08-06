import { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Checkbox, Typography, App } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/auth';
import { useAuth } from '../stores/auth';
import { siteApi } from '../api/site';

const { Title } = Typography;

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [icpNumber, setIcpNumber] = useState('');
  const [publicSecurityNumber, setPublicSecurityNumber] = useState('');
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const { message } = App.useApp();

  useEffect(() => {
    siteApi.getInfo().then((info) => {
      setIcpNumber(info.icp_number);
      setPublicSecurityNumber(info.public_security_number);
    }).catch(() => {});
  }, []);

  const onFinish = async (values: { username: string; password: string; remember: boolean }) => {
    setLoading(true);
    try {
      const res = await authApi.login(values);
      if (res.success !== false) {
        message.success('登录成功');
        await refresh();
        navigate('/', { replace: true });
      } else {
        message.error(res.error || '登录失败');
      }
    } catch {
      message.error('登录失败，请检查用户名和密码');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    }}>
      <Card style={{ width: 400, boxShadow: '0 4px 24px rgba(0,0,0,0.15)' }} variant="borderless">
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={2} style={{ color: '#4A90D9', marginBottom: 4 }}>日历视图</Title>
          <Typography.Text type="secondary">请登录以继续</Typography.Text>
        </div>
        <Form
          name="login"
          onFinish={onFinish}
          initialValues={{ remember: true }}
          size="large"
        >
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>
          <Form.Item name="remember" valuePropName="checked">
            <Checkbox>记住我（7天）</Checkbox>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              登录
            </Button>
          </Form.Item>
        </Form>
      </Card>
      <div style={{ position: 'absolute', bottom: 16, textAlign: 'center', width: '100%', display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
        {icpNumber && (
          <a
            href="https://beian.miit.gov.cn/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}
          >
            {icpNumber}
          </a>
        )}
        {publicSecurityNumber && (
          <a
            href="http://www.beian.gov.cn/portal/registerSystemInfo"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <img src="https://www.beian.gov.cn/img/ghs.png" alt="" style={{ width: 14, height: 14 }} />
            {publicSecurityNumber}
          </a>
        )}
      </div>
    </div>
  );
}
