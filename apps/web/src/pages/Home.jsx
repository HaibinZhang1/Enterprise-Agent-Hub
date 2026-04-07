import React from 'react';
import { Row, Col, Card, Typography, Statistic } from 'antd';
import { Store, Inbox, Users } from 'lucide-react';
import { useAuthStore } from '../stores/useAuthStore';

const { Title, Text } = Typography;

export default function Home() {
  const { actor } = useAuthStore();

  return (
    <div>
      <div className="page-header">
        <Title level={2} className="page-title">Welcome back, {actor?.username}</Title>
        <Text className="page-subtitle">Here is what's happening with your workspace today.</Text>
      </div>

      <Row gutter={[24, 24]}>
        <Col span={8}>
          <Card bordered={false}>
            <Statistic 
              title="Pending Reviews" 
              value={4} 
              prefix={<Inbox size={18} color="#0066cc" style={{ marginRight: 8 }} />} 
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card bordered={false}>
             <Statistic 
              title="Active Agents" 
              value={12} 
              prefix={<Store size={18} color="#34c759" style={{ marginRight: 8 }} />} 
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card bordered={false}>
             <Statistic 
              title="Total Users" 
              value={3} 
              prefix={<Users size={18} color="#ff9500" style={{ marginRight: 8 }} />} 
            />
          </Card>
        </Col>
      </Row>
      
      <div style={{ marginTop: 24 }}>
        <Card bordered={false} title="Quick Actions">
           <Text>No immediate actions required.</Text>
        </Card>
      </div>
    </div>
  );
}
