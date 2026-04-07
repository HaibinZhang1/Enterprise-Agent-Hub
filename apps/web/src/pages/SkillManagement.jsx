import React from 'react';
import { Card, Typography, Table, Tag } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../stores/useAuthStore';
import { mockService } from '../adapters/mockService';

const { Title, Text } = Typography;

export default function SkillManagement() {
  const { actor } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ['manage-skills', actor?.userId],
    queryFn: () => mockService.getManageableSkills(actor),
  });

  if (data?.state === 'permission-denied') {
    return <Card><Typography.Text type="danger">You do not have permission to manage platform skills.</Typography.Text></Card>;
  }

  const columns = [
    { title: 'Skill ID', dataIndex: 'skillId', key: 'skillId' },
    { title: 'Current Version', dataIndex: 'currentVersion', key: 'currentVersion', render: (val) => val || 'None' },
    { 
      title: 'History', 
      key: 'history', 
      render: (_, record) => (
         <Text type="secondary">{record.history?.length || 0} versions</Text>
      )
    },
  ];

  return (
    <div>
      <div className="page-header">
        <Title level={2} className="page-title">Skill Management</Title>
        <Text className="page-subtitle">Platform-wide overview of agent skills.</Text>
      </div>

      <Card bordered={false}>
        <Table 
          columns={columns} 
          dataSource={data?.skills || []} 
          rowKey="skillId"
          loading={isLoading}
        />
      </Card>
    </div>
  );
}
