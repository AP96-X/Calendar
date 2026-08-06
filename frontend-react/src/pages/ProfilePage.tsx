import { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Descriptions, App, Spin } from 'antd';
import AppLayout from '../components/AppLayout';
import { profileApi } from '../api/profile';
import { useAuth } from '../stores/auth';
import type { Profile } from '../types';

export default function ProfilePage() {
  const { user, refresh } = useAuth();
  const { message } = App.useApp();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingName, setSavingName] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);
  const [nameForm] = Form.useForm();
  const [pwdForm] = Form.useForm();

  useEffect(() => {
    profileApi.get()
      .then((data) => {
        setProfile(data);
        nameForm.setFieldsValue({ display_name: data.display_name });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [nameForm]);

  const handleSaveName = async (values: { display_name: string }) => {
    setSavingName(true);
    try {
      const res = await profileApi.update(values.display_name);
      if (res.success !== false) {
        message.success('个人信息已更新');
        await refresh();
      } else {
        message.error(res.error || '操作失败');
      }
    } catch {
      // handled by interceptor
    } finally {
      setSavingName(false);
    }
  };

  const handleChangePwd = async (values: { old_password: string; new_password: string; confirm_password: string }) => {
    if (values.new_password !== values.confirm_password) {
      message.error('两次输入的新密码不一致');
      return;
    }
    setSavingPwd(true);
    try {
      const res = await profileApi.changePassword(values.old_password, values.new_password);
      if (res.success !== false) {
        message.success(res.message || '密码已修改');
        pwdForm.resetFields();
      } else {
        message.error(res.error || '操作失败');
      }
    } catch {
      // handled by interceptor
    } finally {
      setSavingPwd(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <Spin size="large" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <Card title="个人信息" style={{ marginBottom: 16 }}>
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="用户名">{profile?.username}</Descriptions.Item>
            <Descriptions.Item label="角色">{profile?.role === 'admin' ? '管理员' : '普通用户'}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{profile?.created_at || '-'}</Descriptions.Item>
          </Descriptions>

          <Form
            form={nameForm}
            layout="vertical"
            onFinish={handleSaveName}
            style={{ marginTop: 20 }}
          >
            <Form.Item
              name="display_name"
              label="显示名称"
              rules={[{ required: true, message: '请输入显示名称' }]}
            >
              <Input placeholder="输入显示名称" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={savingName}>
                保存
              </Button>
            </Form.Item>
          </Form>
        </Card>

        <Card title="修改密码">
          <Form
            form={pwdForm}
            layout="vertical"
            onFinish={handleChangePwd}
          >
            <Form.Item
              name="old_password"
              label="旧密码"
              rules={[{ required: true, message: '请输入旧密码' }]}
            >
              <Input.Password placeholder="输入旧密码" />
            </Form.Item>
            <Form.Item
              name="new_password"
              label="新密码（至少6位）"
              rules={[
                { required: true, message: '请输入新密码' },
                { min: 6, message: '密码至少6位' },
              ]}
            >
              <Input.Password placeholder="输入新密码" />
            </Form.Item>
            <Form.Item
              name="confirm_password"
              label="确认新密码"
              rules={[{ required: true, message: '请确认新密码' }]}
            >
              <Input.Password placeholder="再次输入新密码" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={savingPwd}>
                确认修改
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </AppLayout>
  );
}
