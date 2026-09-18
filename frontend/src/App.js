import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { Protected } from '@/components/Protected';
import AppLayout from '@/components/AppLayout';
import SathiChat from '@/components/SathiChat';
import Landing from '@/pages/Landing';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import FarmerDashboard from '@/pages/farmer/FarmerDashboard';
import SellingJourney from '@/pages/farmer/SellingJourney';
import FarmerLots from '@/pages/farmer/FarmerLots';
import LotDetail from '@/pages/farmer/LotDetail';
import Transactions from '@/pages/Transactions';
import BuyerDashboard from '@/pages/buyer/BuyerDashboard';
import BuyerDemands from '@/pages/buyer/BuyerDemands';
import BuyerOffers from '@/pages/buyer/BuyerOffers';
import FPODashboard from '@/pages/fpo/FPODashboard';
import AdminDashboard from '@/pages/admin/AdminDashboard';
import '@/App.css';

function RoleDashboard(props) {
  const { user } = useAuth();
  if (!user) return null;
  if (user.role === 'FARMER') return <FarmerDashboard {...props} />;
  if (user.role === 'BUYER') return <BuyerDashboard {...props} />;
  if (user.role === 'FPO') return <FPODashboard {...props} />;
  if (user.role === 'ADMIN') return <AdminDashboard {...props} />;
  return <div>Role {user.role} is not yet supported in the P0 slice.</div>;
}

function AppShell() {
  const [chatOpen, setChatOpen] = useState(false);
  return (
    <AppLayout onOpenChat={() => setChatOpen(true)}>
      <Routes>
        <Route path="/" element={<RoleDashboard onOpenChat={() => setChatOpen(true)} />} />
        <Route path="/sell" element={<SellingJourney onOpenChat={() => setChatOpen(true)} />} />
        <Route path="/lots" element={<FarmerLots />} />
        <Route path="/lots/:id" element={<LotDetail onOpenChat={() => setChatOpen(true)} />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/demands" element={<BuyerDemands />} />
        <Route path="/matches" element={<BuyerDashboard onOpenChat={() => setChatOpen(true)} />} />
        <Route path="/offers" element={<BuyerOffers />} />
        <Route path="/farmers" element={<FPODashboard />} />
        <Route path="/users" element={<AdminDashboard />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
      {chatOpen && <SathiChat onClose={() => setChatOpen(false)} />}
    </AppLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/app/*" element={<Protected><AppShell /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
