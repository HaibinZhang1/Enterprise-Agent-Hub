import React from 'react';
import { Card, Typography, List, Alert, Button } from 'antd';
import { Bell } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../stores/useAuthStore';
import { mockService } from '../adapters/mockService';

const { Title, Text } = Typography;

export default function Notifications() {
  const { actor } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', actor?.userId],
    queryFn: () => mockService.getNotifications(actor),
    // Poll every 5 seconds to simulate realtime
    refetchInterval: 5000,
  });

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={2} className="page-title">Notifications</Title>
          <Text className="page-subtitle">Stay updated with system events.</Text>
        </div>
        <Button>Mark All Read</Button>
      </div>

      {data?.reconnectBanner && (
        <Alert
          message="Connection Lost"
          description="We are experiencing realtime connection issues. Data might be delayed."
          type="warning"
          showIcon
          style={{ marginBottom: 24, borderRadius: 12 }}
        />
      )}

      <Card bordered={false}>
        <List
          itemLayout="horizontal"
          dataSource={data?.items || []}
          loading={isLoading}
          renderItem={(item) => (
            <List.Item>
              <List.Item.Meta
                avatar={<div style={{ padding: 8, background: '#f5f5f7', borderRadius: '50%' }}><Bell size={20} color="#0066cc" /></div>}
                title={<a href="#">{item.title || 'System Notification'}</a>}
                description={item.body || 'No details'}
              />
            </List.Item>
          )}
        />
      </Card>
    </div>
  );
}
