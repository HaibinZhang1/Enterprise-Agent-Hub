import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from './stores/useAuthStore';
import AppLayout from './layouts/AppLayout';

// View Imports
import Login from './pages/Login';
import Home from './pages/Home';
import Market from './pages/Market';
import MySkill from './pages/MySkill';
import Review from './pages/Review';
import Notifications from './pages/Notifications';
import UserManagement from './pages/UserManagement';
import SkillManagement from './pages/SkillManagement';
import Placeholder from './pages/Placeholder';

const ProtectedRoute = () => {
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* Protected Routes inside AppLayout */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<Home />} />
          <Route path="/market" element={<Market />} />
          <Route path="/my-skill" element={<MySkill />} />
          <Route path="/review" element={<Review />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/user-management" element={<UserManagement />} />
          <Route path="/skill-management" element={<SkillManagement />} />
          <Route path="/department-management" element={<Placeholder title="Department Management" />} />
          <Route path="/tools" element={<Placeholder title="Tools" />} />
          <Route path="/projects" element={<Placeholder title="Projects" />} />
          <Route path="/settings" element={<Placeholder title="Settings" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
