import React from 'react';
import { Typography, Empty } from 'antd';

const { Title, Text } = Typography;

export default function Placeholder({ title }) {
  return (
    <div>
      <div className="page-header">
        <Title level={2} className="page-title">{title}</Title>
        <Text className="page-subtitle">Coming soon</Text>
      </div>

      <div style={{ 
        height: '60vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#fff',
        borderRadius: 16,
        padding: 40
      }}>
        <Empty description={<span>{title} module is currently under development.</span>} />
      </div>
    </div>
  );
}
