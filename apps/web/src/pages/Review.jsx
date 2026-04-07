import React, { useState } from 'react';
import { Card, Typography, Table, Tag, Button, Space, message, Modal, Input } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/useAuthStore';
import { mockService } from '../adapters/mockService';

const { Title, Text } = Typography;
const { TextArea } = Input;

export default function Review() {
  const { actor } = useAuthStore();
  const queryClient = useQueryClient();
  const [commentModal, setCommentModal] = useState({ open: false, ticketId: null, comment: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['review-queue', actor?.userId],
    queryFn: () => mockService.getReviewQueue(actor),
  });

  const claimMutation = useMutation({
    mutationFn: (ticketId) => mockService.claimReview(actor, ticketId),
    onSuccess: () => {
      message.success('Claimed successfully');
      queryClient.invalidateQueries(['review-queue']);
    }
  });

  const approveMutation = useMutation({
    mutationFn: ({ ticketId, comment }) => mockService.approveReview(actor, ticketId, comment),
    onSuccess: () => {
      message.success('Approved successfully');
      setCommentModal({ open: false, ticketId: null, comment: '' });
      queryClient.invalidateQueries(['review-queue']);
    }
  });

  if (data?.state === 'permission-denied') {
    return <Card><Typography.Text type="danger">You do not have permission to access the review queue.</Typography.Text></Card>;
  }

  const columns = [
    { title: 'Ticket ID', dataIndex: 'ticketId', key: 'ticketId' },
    { title: 'Skill ID', dataIndex: 'skillId', key: 'skillId' },
    { title: 'Reviewer', dataIndex: 'reviewerId', key: 'reviewerId' },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (val) => <Tag color={val === 'done' ? 'green' : val === 'in_progress' ? 'blue' : 'default'}>{val}</Tag> },
    { 
      title: 'Action', 
      key: 'action', 
      render: (_, record) => {
        if (record.status === 'todo') {
          return <Button onClick={() => claimMutation.mutate(record.ticketId)} loading={claimMutation.isPending}>Claim</Button>;
        }
        if (record.status === 'in_progress') {
          return <Button type="primary" onClick={() => setCommentModal({ open: true, ticketId: record.ticketId, comment: '' })}>Approve</Button>;
        }
        return <Text type="secondary">Closed</Text>;
      } 
    },
  ];

  const allTickets = data ? [...data.queue.todo, ...data.queue.inProgress, ...data.queue.done] : [];

  return (
    <div>
      <div className="page-header">
        <Title level={2} className="page-title">Review Queue</Title>
        <Text className="page-subtitle">Manage agent submissions.</Text>
      </div>

      <Card bordered={false}>
        <Table 
          columns={columns} 
          dataSource={allTickets} 
          rowKey="ticketId"
          loading={isLoading}
        />
      </Card>

      <Modal
        title="Approve Ticket"
        open={commentModal.open}
        onCancel={() => setCommentModal({ open: false, ticketId: null, comment: '' })}
        onOk={() => approveMutation.mutate({ ticketId: commentModal.ticketId, comment: commentModal.comment })}
        confirmLoading={approveMutation.isPending}
      >
        <TextArea 
          rows={4} 
          placeholder="Leave a review comment..." 
          value={commentModal.comment}
          onChange={e => setCommentModal(prev => ({ ...prev, comment: e.target.value }))}
        />
      </Modal>
    </div>
  );
}
