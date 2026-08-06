import { useState } from 'react';
import { Modal, Upload, Button, Alert, Typography, App } from 'antd';
import { InboxOutlined, DownloadOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd';
import { eventsApi } from '../api/events';

const { Dragger } = Upload;
const { Text, Link } = Typography;

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

export default function ImportModal({ open, onClose, onImported }: ImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const { message } = App.useApp();

  const handleImport = async () => {
    if (!file) {
      message.warning('请先选择文件');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await eventsApi.importExcel(file);
      const msg = res.message || res.error || '导入完成';
      setResult({
        type: res.success !== false ? 'success' : 'error',
        message: msg,
      });
      if (res.success !== false) {
        onImported();
      }
    } catch {
      setResult({ type: 'error', message: '导入失败，请检查文件格式' });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setResult(null);
    onClose();
  };

  return (
    <Modal
      title="导入事件"
      open={open}
      onCancel={handleClose}
      width={440}
      footer={
        <div style={{ textAlign: 'right' }}>
          <Button onClick={handleClose} style={{ marginRight: 8 }}>取消</Button>
          <Button type="primary" onClick={handleImport} loading={loading}>
            开始导入
          </Button>
        </div>
      }
    >
      <div style={{ marginBottom: 12 }}>
        <Text type="secondary" style={{ fontSize: 13 }}>
          选择导出的 Excel 日历文件进行导入。已存在的事件将自动跳过，不会产生重复。
        </Text>
      </div>

      <div style={{ marginBottom: 12 }}>
        <Link href={eventsApi.getTemplateUrl()} download="calendar-template.xlsx">
          <DownloadOutlined /> 下载空白模板
        </Link>
        <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>(按模板填写后导入)</Text>
      </div>

      <Dragger
        accept=".xlsx"
        maxCount={1}
        beforeUpload={(file) => {
          setFile(file);
          setResult(null);
          return false; // Prevent auto upload
        }}
        onRemove={() => {
          setFile(null);
          setResult(null);
        }}
        fileList={file ? [{ uid: '-1', name: file.name, status: 'done' } as UploadFile] : []}
        style={{ marginBottom: 12 }}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
        <p className="ant-upload-hint">仅支持 .xlsx 格式文件</p>
      </Dragger>

      {result && (
        <Alert
          type={result.type}
          message={result.message}
          showIcon
          style={{ marginTop: 8 }}
        />
      )}
    </Modal>
  );
}
