import React, { useState } from 'react';
import { Card, Typography, Input, List, Tag, Button, Empty } from 'antd';
import { Search, Store, Download } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../stores/useAuthStore';
import { mockService } from '../adapters/mockService';

const { Title, Text } = Typography;

export default function Market() {
  const { actor } = useAuthStore();
  const [query, setQuery] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['market', actor?.userId, query],
    queryFn: () => mockService.getMarketSkills(actor, query),
    enabled: !!actor,
  });

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={2} className="page-title">Agent Market</Title>
          <Text className="page-subtitle">Discover and install powerful agents.</Text>
        </div>
        <Input 
          placeholder="Search agents..." 
          prefix={<Search size={16} color="#86868b" />} 
          style={{ width: 300, borderRadius: 20 }}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {data?.state === 'permission-denied' ? (
        <Card>
          <Empty description="You do not have permission to view the market." />
        </Card>
      ) : (
        <List
          grid={{ gutter: 24, xs: 1, sm: 2, md: 3, lg: 3, xl: 4, xxl: 4 }}
          dataSource={data?.results || []}
          loading={isLoading}
          renderItem={(item) => (
            <List.Item>
              <Card 
                hoverable 
                style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
                actions={[
                  <Button type="text" icon={<Download size={16} />}>Install</Button>
                ]}
              >
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ 
                    width: 48, height: 48, borderRadius: 12, 
                    backgroundColor: '#e5f0fa', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginRight: 12
                  }}>
                    <Store size={24} color="#0066cc" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 16 }}>{item.title}</div>
                    <div style={{ fontSize: 13, color: '#86868b' }}>v{item.version}</div>
                  </div>
                </div>
                <div style={{ flexGrow: 1 }}>
                  <Text type="secondary" ellipsis={{ tooltip: true }}>
                    {item.summary || 'No description available for this agent.'}
                  </Text>
                </div>
                <div style={{ marginTop: 16 }}>
                  <Tag color="blue">{item.visibility}</Tag>
                </div>
              </Card>
            </List.Item>
          )}
        />
      )}
    </div>
  );
}
