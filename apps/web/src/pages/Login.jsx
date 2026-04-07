import React, { useState } from 'react';
import { Card, Input, Button, Form, Typography, message } from 'antd';
import { User, Lock, ArrowRight } from 'lucide-react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import { mockService } from '../adapters/mockService';

const { Title, Text } = Typography;

export default function Login() {
  const [loading, setLoading] = useState(false);
  const { login, isLoggedIn } = useAuthStore();
  const navigate = useNavigate();

  if (isLoggedIn) {
    return <Navigate to="/home" replace />;
  }

  const onFinish = async (values) => {
    setLoading(true);
    try {
      // Because we start empty, we can just login directly with what we bootstrapped: admin / <any_pw>
      const res = await mockService.login(values.username, values.password);
      if (res.state === 'ready' && res.user) {
        login(res.user);
        message.success('Logged in successfully');
        navigate('/home');
      } else {
        message.error('Unexpected auth response');
      }
    } catch (e) {
      message.error(e.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      height: '100vh',
      width: '100vw',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundImage: 'url("https://images.unsplash.com/photo-1557683311-eac922347aa1?auto=format&fit=crop&w=2800&q=80")',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }}>
      <Card
        style={{ width: 380, padding: 24, paddingBottom: 12 }}
        className="glass-panel"
        bordered={false}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ 
            width: 56, 
            height: 56, 
            background: 'linear-gradient(135deg, #0066cc 0%, #00d4ff 100%)',
            borderRadius: 16,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16
          }}>
            <User color="white" size={28} />
          </div>
          <Title level={3} style={{ margin: 0, fontWeight: 600 }}>Sign in</Title>
          <Text style={{ color: '#86868b' }}>to Enterprise Agent Hub</Text>
        </div>

        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item name="username" rules={[{ required: true, message: 'Please input your username' }]}>
            <Input 
              prefix={<User size={16} color="#86868b" />} 
              placeholder="Username (Try: admin)" 
              size="large"
            />
          </Form.Item>

          <Form.Item name="password" rules={[{ required: true, message: 'Please input your password' }]}>
             <Input.Password 
              prefix={<Lock size={16} color="#86868b" />} 
              placeholder="Password (Any text)" 
              size="large"
            />
          </Form.Item>

          <Form.Item style={{ marginTop: 24 }}>
            <Button 
              type="primary" 
              htmlType="submit" 
              block 
              size="large" 
              loading={loading}
              icon={<ArrowRight size={16} />}
              style={{ fontWeight: 500 }}
            >
              Continue
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
