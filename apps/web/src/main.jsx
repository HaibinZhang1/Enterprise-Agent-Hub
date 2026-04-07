import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider } from 'antd';
import App from './App.jsx';
import { themeConfig } from './styles/theme.js';
import './styles/global.css';

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ConfigProvider theme={themeConfig}>
        <App />
      </ConfigProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
