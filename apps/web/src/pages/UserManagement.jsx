import React from 'react';
import { Card, Typography, Table, Tag, Button, Space } from 'antd';
import { UserPlus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../stores/useAuthStore';
import { mockService } from '../adapters/mockService';

const { Title, Text } = Typography;

export default function UserManagement() {
  const { actor } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ['users', actor?.userId],
    queryFn: () => mockService.getUsers(actor),
  });

  if (data?.state === 'permission-denied') {
    return <Card><Typography.Text type="danger">You do not have permission to access user management.</Typography.Text></Card>;
  }

  const columns = [
    { title: 'User ID', dataIndex: 'userId', key: 'userId' },
    { title: 'Username', dataIndex: 'username', key: 'username' },
    { 
      title: 'Status', 
      key: 'status', 
      render: (_, record) => {
         const isFrozen = record.flags?.frozen;
         return <Tag color={isFrozen ? 'red' : 'green'}>{isFrozen ? 'Frozen' : 'Active'}</Tag>;
      } 
    },
    { 
      title: 'Actions', 
      key: 'actions', 
      render: () => (
        <Space>
          <Button type="link" size="small">Edit</Button>
          <Button type="link" danger size="small">Freeze</Button>
        </Space>
      )
    },
  ];

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={2} className="page-title">User Management</Title>
          <Text className="page-subtitle">Manage workspace members and permissions.</Text>
        </div>
        <Button type="primary" icon={<UserPlus size={16} />}>Provision User</Button>
      </div>

      <Card bordered={false}>
        <Table 
          columns={columns} 
          dataSource={data?.users || []} 
          rowKey="userId"
          loading={isLoading}
        />
      </Card>
    </div>
  );
}
