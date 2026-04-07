import React, { useState } from 'react';
import { Card, Typography, Button, Table, Tag, Modal, Form, Input, message } from 'antd';
import { Box, Upload as UploadIcon, Plus } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/useAuthStore';
import { mockService } from '../adapters/mockService';

const { Title, Text } = Typography;

export default function MySkill() {
  const { actor } = useAuthStore();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ['my-skills', actor?.userId],
    queryFn: () => mockService.getMySkills(actor),
  });

  const publishMutation = useMutation({
    mutationFn: (values) => {
      const packageId = `pkg_${Date.now()}`;
      return mockService.publishSkill({
        actor,
        packageId,
        skillId: values.skillId,
        reviewerId: 'admin', // mocked
        visibility: 'detail_public',
        manifest: {
          skillId: values.skillId,
          version: values.version,
          title: values.title,
          summary: 'Published from web MVP',
        },
        files: [{ path: 'main.py', size: 1024 }]
      });
    },
    onSuccess: () => {
      message.success('Agent published successfully');
      setIsModalOpen(false);
      form.resetFields();
      queryClient.invalidateQueries(['my-skills']);
    },
    onError: (error) => {
      message.error(error.message || 'Failed to publish');
    }
  });

  const columns = [
    { title: 'Skill ID', dataIndex: 'skillId', key: 'skillId' },
    { title: 'Visibility', dataIndex: 'visibility', key: 'visibility', render: (val) => <Tag color="blue">{val}</Tag> },
    { title: 'Status', dataIndex: 'state', key: 'state' },
  ];

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={2} className="page-title">My Skills</Title>
          <Text className="page-subtitle">Manage the agents you own.</Text>
        </div>
        <Button 
          type="primary" 
          icon={<Plus size={16} />} 
          onClick={() => setIsModalOpen(true)}
        >
          Publish Agent
        </Button>
      </div>

      <Card bordered={false}>
        <Table 
          columns={columns} 
          dataSource={data?.skills || []} 
          rowKey="skillId"
          loading={isLoading}
          pagination={false}
        />
      </Card>

      <Modal
        title="Publish New Agent"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        okText="Submit for Review"
        okButtonProps={{ loading: publishMutation.isPending }}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={(val) => publishMutation.mutate(val)}>
          <Form.Item name="skillId" label="Skill ID" rules={[{ required: true }]}>
             <Input placeholder="e.g. org.my.agent" />
          </Form.Item>
          <Form.Item name="title" label="Title" rules={[{ required: true }]}>
             <Input placeholder="Cool Agent" />
          </Form.Item>
          <Form.Item name="version" label="Version" rules={[{ required: true }]} initialValue="1.0.0">
             <Input placeholder="1.0.0" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
