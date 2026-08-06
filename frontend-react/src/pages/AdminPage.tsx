import { useState, useEffect, useCallback } from 'react';
import { Card, Tabs, Table, Button, Form, Input, Select, Tag, Space, Modal, App, Spin } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import AppLayout from '../components/AppLayout';
import { usersApi } from '../api/users';
import { auditApi } from '../api/audit';
import type { User, AuditLog, LoginLog } from '../types';
import type { ColumnsType } from 'antd/es/table';

export default function AdminPage() {
  const { message } = App.useApp();
  const [activeTab, setActiveTab] = useState('users');
  const [loading, setLoading] = useState(false);

  // Users state
  const [users, setUsers] = useState<User[]>([]);
  const [createForm] = Form.useForm();
  const [creating, setCreating] = useState(false);

  // Logs state
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loginLogs, setLoginLogs] = useState<LoginLog[]>([]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await usersApi.list();
      setUsers(data);
    } catch {
      // handled by interceptor
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAuditLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await auditApi.getAuditLog();
      setAuditLogs(data);
    } catch {
      // handled by interceptor
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLoginLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await auditApi.getLoginLog();
      setLoginLogs(data);
    } catch {
      // handled by interceptor
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'users') loadUsers();
    else if (activeTab === 'audit') loadAuditLogs();
    else if (activeTab === 'login') loadLoginLogs();
  }, [activeTab, loadUsers, loadAuditLogs, loadLoginLogs]);

  const handleCreate = async (values: { username: string; password: string; display_name: string; role: string }) => {
    setCreating(true);
    try {
      const res = await usersApi.create(values);
      if (res.success !== false) {
        message.success('用户已创建');
        createForm.resetFields();
        await loadUsers();
      } else {
        message.error(res.error || '创建失败');
      }
    } catch {
      // handled by interceptor
    } finally {
      setCreating(false);
    }
  };

  const handleToggleEnabled = async (user: User) => {
    try {
      await usersApi.update(user.id, { enabled: !user.enabled });
      message.success(!user.enabled ? '已启用' : '已禁用');
      await loadUsers();
    } catch {
      // handled by interceptor
    }
  };

  const handleResetPassword = (user: User) => {
    let newPwd = '';
    Modal.confirm({
      title: `重置 ${user.username} 的密码`,
      content: (
        <Input.Password
          placeholder="输入新密码（≥6位）"
          onChange={(e) => { newPwd = e.target.value; }}
          style={{ marginTop: 8 }}
        />
      ),
      onOk: async () => {
        if (newPwd.length < 6) {
          message.error('密码至少6位');
          return Promise.reject();
        }
        try {
          await usersApi.resetPassword(user.id, newPwd);
          message.success('密码已重置');
        } catch {
          // handled by interceptor
        }
      },
    });
  };

  const handleDelete = (user: User) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除用户"${user.username}"吗？该用户的所有事件将一并删除。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await usersApi.delete(user.id);
          message.success('用户已删除');
          await loadUsers();
        } catch {
          // handled by interceptor
        }
      },
    });
  };

  // Table columns
  const userColumns: ColumnsType<User> = [
    { title: 'ID', dataIndex: 'id', width: 50 },
    { title: '用户名', dataIndex: 'username', width: 100 },
    { title: '显示名', dataIndex: 'display_name', width: 100 },
    {
      title: '角色', dataIndex: 'role', width: 80,
      render: (role: string) => (
        <Tag color={role === 'admin' ? 'red' : 'blue'}>
          {role === 'admin' ? '管理员' : '普通用户'}
        </Tag>
      ),
    },
    {
      title: '状态', dataIndex: 'enabled', width: 80,
      render: (enabled: boolean) => (
        <Tag color={enabled ? 'green' : 'default'}>
          {enabled ? '启用' : '禁用'}
        </Tag>
      ),
    },
    { title: '创建时间', dataIndex: 'created_at', width: 160 },
    {
      title: '操作', key: 'actions', width: 220,
      render: (_, record) => (
        <Space size="small">
          <Button size="small" onClick={() => handleToggleEnabled(record)}>
            {record.enabled ? '禁用' : '启用'}
          </Button>
          <Button size="small" onClick={() => handleResetPassword(record)}>
            重置密码
          </Button>
          {record.role !== 'admin' && (
            <Button size="small" danger onClick={() => handleDelete(record)}>
              删除
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const auditColumns: ColumnsType<AuditLog> = [
    { title: '时间', dataIndex: 'created_at', width: 160 },
    { title: '管理员', dataIndex: 'admin', width: 100 },
    { title: '操作', dataIndex: 'action', width: 120 },
    { title: '目标用户', dataIndex: 'target', width: 100 },
    { title: '详情', dataIndex: 'details' },
  ];

  const loginColumns: ColumnsType<LoginLog> = [
    { title: '时间', dataIndex: 'attempted_at', width: 160 },
    { title: '用户名', dataIndex: 'username', width: 120 },
    { title: 'IP地址', dataIndex: 'ip_address', width: 140 },
    {
      title: '结果', dataIndex: 'success', width: 80,
      render: (success: boolean) => (
        <Tag color={success ? 'green' : 'red'}>
          {success ? '成功' : '失败'}
        </Tag>
      ),
    },
  ];

  return (
    <AppLayout>
      <Card variant="borderless" style={{ borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'users',
              label: '用户管理',
              children: (
                <Spin spinning={loading}>
                  <Card size="small" style={{ marginBottom: 16 }}>
                    <Form
                      form={createForm}
                      layout="inline"
                      onFinish={handleCreate}
                      initialValues={{ role: 'user' }}
                    >
                      <Form.Item name="username" rules={[{ required: true, message: '用户名' }]}>
                        <Input placeholder="用户名" style={{ width: 120 }} />
                      </Form.Item>
                      <Form.Item name="password" rules={[{ required: true, message: '密码' }, { min: 6, message: '≥6位' }]}>
                        <Input.Password placeholder="密码(≥6位)" style={{ width: 130 }} />
                      </Form.Item>
                      <Form.Item name="display_name">
                        <Input placeholder="显示名称" style={{ width: 120 }} />
                      </Form.Item>
                      <Form.Item name="role">
                        <Select style={{ width: 100 }}>
                          <Select.Option value="user">普通用户</Select.Option>
                        </Select>
                      </Form.Item>
                      <Form.Item>
                        <Button type="primary" htmlType="submit" loading={creating} icon={<PlusOutlined />}>
                          新增用户
                        </Button>
                      </Form.Item>
                    </Form>
                  </Card>
                  <Table
                    columns={userColumns}
                    dataSource={users}
                    rowKey="id"
                    size="small"
                    pagination={{ pageSize: 20, showSizeChanger: false }}
                    scroll={{ x: 800 }}
                  />
                </Spin>
              ),
            },
            {
              key: 'audit',
              label: '审计日志',
              children: (
                <Spin spinning={loading}>
                  <div style={{ marginBottom: 12, textAlign: 'right' }}>
                    <Button icon={<ReloadOutlined />} onClick={loadAuditLogs}>刷新</Button>
                  </div>
                  <Table
                    columns={auditColumns}
                    dataSource={auditLogs}
                    rowKey="id"
                    size="small"
                    pagination={{ pageSize: 20, showSizeChanger: false }}
                    scroll={{ x: 600 }}
                  />
                </Spin>
              ),
            },
            {
              key: 'login',
              label: '登录日志',
              children: (
                <Spin spinning={loading}>
                  <div style={{ marginBottom: 12, textAlign: 'right' }}>
                    <Button icon={<ReloadOutlined />} onClick={loadLoginLogs}>刷新</Button>
                  </div>
                  <Table
                    columns={loginColumns}
                    dataSource={loginLogs}
                    rowKey="id"
                    size="small"
                    pagination={{ pageSize: 20, showSizeChanger: false }}
                    scroll={{ x: 500 }}
                  />
                </Spin>
              ),
            },
          ]}
        />
      </Card>
    </AppLayout>
  );
}
