import { useState, useEffect, useCallback } from 'react';
import { Card, Tabs, Table, Button, Form, Input, InputNumber, Select, Switch, Tag, Space, Modal, Alert, Divider, App, Spin } from 'antd';
import { PlusOutlined, ReloadOutlined, SaveOutlined, UndoOutlined } from '@ant-design/icons';
import AppLayout from '../components/AppLayout';
import { usersApi } from '../api/users';
import { auditApi } from '../api/audit';
import { settingsApi } from '../api/settings';
import { passwordValidator, passwordStrengthError } from '../utils/password';
import { formatCnTime } from '../utils/time';
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

  // System settings state
  const [settingsForm] = Form.useForm();
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [customized, setCustomized] = useState<Record<string, boolean>>({});
  const [apiKeySet, setApiKeySet] = useState(false);

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

  const loadSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      const data = await settingsApi.get();
      const values = data.values || {};
      setCustomized(data.customized || {});
      setApiKeySet(Boolean(values.AI_API_KEY_set));
      settingsForm.setFieldsValue({
        AI_REPORT_ENABLED: Boolean(values.AI_REPORT_ENABLED),
        AI_PROVIDER: values.AI_PROVIDER,
        AI_API_BASE: values.AI_API_BASE,
        AI_API_KEY: '',
        AI_MODEL: values.AI_MODEL,
        AI_TIMEOUT: values.AI_TIMEOUT,
        AI_MAX_TOKENS: values.AI_MAX_TOKENS,
        AI_MONTHLY_LIMIT: values.AI_MONTHLY_LIMIT,
        ICP_NUMBER: values.ICP_NUMBER,
        PUBLIC_SECURITY_NUMBER: values.PUBLIC_SECURITY_NUMBER,
      });
    } catch {
      // handled by interceptor
    } finally {
      setSettingsLoading(false);
    }
  }, [settingsForm]);

  useEffect(() => {
    if (activeTab === 'users') loadUsers();
    else if (activeTab === 'audit') loadAuditLogs();
    else if (activeTab === 'login') loadLoginLogs();
    else if (activeTab === 'settings') loadSettings();
  }, [activeTab, loadUsers, loadAuditLogs, loadLoginLogs, loadSettings]);

  const handleSaveSettings = async (values: Record<string, unknown>) => {
    setSavingSettings(true);
    try {
      const res = await settingsApi.update(values);
      if (res.success !== false) {
        message.success('系统设置已保存');
        await loadSettings();
      }
    } catch {
      // handled by interceptor
    } finally {
      setSavingSettings(false);
    }
  };

  const handleResetSettings = () => {
    Modal.confirm({
      title: '恢复默认设置',
      content: '将清除管理页面保存的全部设置，回落到 .env 环境变量或内置默认值。是否继续？',
      okText: '恢复默认',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await settingsApi.reset();
          message.success('已恢复默认设置');
          await loadSettings();
        } catch {
          // handled by interceptor
        }
      },
    });
  };

  const renderSettingLabel = (key: string, text: string) => (
    <Space size={6}>
      <span>{text}</span>
      {customized[key] && <Tag color="blue">已自定义</Tag>}
    </Space>
  );

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
          placeholder="输入新密码（≥8位，含大写/小写/数字/特殊字符至少3类）"
          onChange={(e) => { newPwd = e.target.value; }}
          style={{ marginTop: 8 }}
        />
      ),
      onOk: async () => {
        const err = passwordStrengthError(newPwd);
        if (err) {
          message.error(err);
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
    { title: '创建时间', dataIndex: 'created_at', width: 190, render: (v: string) => formatCnTime(v) },
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
    { title: '时间', dataIndex: 'created_at', width: 190, render: (v: string) => formatCnTime(v) },
    { title: '管理员', dataIndex: 'admin', width: 100 },
    { title: '操作', dataIndex: 'action', width: 120 },
    { title: '目标用户', dataIndex: 'target', width: 100 },
    { title: '详情', dataIndex: 'details' },
  ];

  const loginColumns: ColumnsType<LoginLog> = [
    { title: '时间', dataIndex: 'attempted_at', width: 190, render: (v: string) => formatCnTime(v) },
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
                      <Form.Item name="password" rules={[{ required: true, message: '密码' }, { validator: passwordValidator }]}>
                        <Input.Password placeholder="密码(≥8位，含3类字符)" style={{ width: 190 }} />
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
            {
              key: 'settings',
              label: '系统设置',
              children: (
                <Spin spinning={settingsLoading}>
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                    message="本页设置保存在数据库中并立即生效，优先于 .env 环境变量；未自定义的项回落到环境变量或内置默认值。"
                  />
                  <Form
                    form={settingsForm}
                    layout="vertical"
                    onFinish={handleSaveSettings}
                    style={{ maxWidth: 560 }}
                  >
                    <Divider titlePlacement="left" style={{ marginTop: 0 }}>AI 周报 / 月报</Divider>
                    <Form.Item
                      name="AI_REPORT_ENABLED"
                      label={renderSettingLabel('AI_REPORT_ENABLED', '启用 AI 报告')}
                      valuePropName="checked"
                      extra="关闭后所有报告自动降级为统计型报告"
                    >
                      <Switch checkedChildren="启用" unCheckedChildren="关闭" />
                    </Form.Item>
                    <Form.Item name="AI_PROVIDER" label={renderSettingLabel('AI_PROVIDER', '服务类型')}>
                      <Select
                        options={[
                          { value: 'openai-compatible', label: 'OpenAI 兼容协议（OpenAI / DeepSeek / 通义等）' },
                          { value: 'ollama', label: '本地 Ollama' },
                        ]}
                      />
                    </Form.Item>
                    <Form.Item
                      name="AI_API_BASE"
                      label={renderSettingLabel('AI_API_BASE', 'API 地址')}
                      extra="结尾不带 /v1，例如 https://api.deepseek.com/v1"
                      rules={[{
                        validator: (_, value: string) =>
                          (!value || /^https?:\/\//i.test(value))
                            ? Promise.resolve()
                            : Promise.reject(new Error('必须以 http:// 或 https:// 开头')),
                      }]}
                    >
                      <Input placeholder="https://api.openai.com/v1" />
                    </Form.Item>
                    <Form.Item
                      name="AI_API_KEY"
                      label={renderSettingLabel('AI_API_KEY', 'API Key')}
                      extra={apiKeySet ? '已配置：留空表示不修改，输入新值可覆盖' : 'Ollama 可留空'}
                    >
                      <Input.Password
                        placeholder={apiKeySet ? '••••••••（留空不修改）' : '输入 API Key'}
                        autoComplete="new-password"
                      />
                    </Form.Item>
                    <Form.Item name="AI_MODEL" label={renderSettingLabel('AI_MODEL', '模型名')}>
                      <Input placeholder="gpt-4o-mini / deepseek-chat / qwen-plus / llama3.1" />
                    </Form.Item>
                    <Space size={16} align="start" wrap>
                      <Form.Item name="AI_TIMEOUT" label={renderSettingLabel('AI_TIMEOUT', '请求超时（秒）')}>
                        <InputNumber min={1} max={600} style={{ width: 160 }} />
                      </Form.Item>
                      <Form.Item name="AI_MAX_TOKENS" label={renderSettingLabel('AI_MAX_TOKENS', '最大生成长度')}>
                        <InputNumber min={256} max={32768} step={256} style={{ width: 160 }} />
                      </Form.Item>
                      <Form.Item name="AI_MONTHLY_LIMIT" label={renderSettingLabel('AI_MONTHLY_LIMIT', '每用户每月次数')}>
                        <InputNumber min={0} max={100000} style={{ width: 160 }} />
                      </Form.Item>
                    </Space>

                    <Divider titlePlacement="left">备案信息</Divider>
                    <Form.Item name="ICP_NUMBER" label={renderSettingLabel('ICP_NUMBER', 'ICP 备案号')}>
                      <Input placeholder="如：京ICP备XXXXXXXX号-X" />
                    </Form.Item>
                    <Form.Item
                      name="PUBLIC_SECURITY_NUMBER"
                      label={renderSettingLabel('PUBLIC_SECURITY_NUMBER', '公安备案号')}
                    >
                      <Input placeholder="如：京公网安备 XXXXXXXXXXXX号" />
                    </Form.Item>

                    <Form.Item>
                      <Space>
                        <Button
                          type="primary"
                          htmlType="submit"
                          loading={savingSettings}
                          icon={<SaveOutlined />}
                        >
                          保存设置
                        </Button>
                        <Button danger icon={<UndoOutlined />} onClick={handleResetSettings}>
                          恢复默认
                        </Button>
                      </Space>
                    </Form.Item>
                  </Form>
                </Spin>
              ),
            },
          ]}
        />
      </Card>
    </AppLayout>
  );
}
