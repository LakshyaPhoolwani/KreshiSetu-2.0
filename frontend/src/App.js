import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { Protected } from '@/components/Protected';
import AppLayout from '@/components/AppLayout';
import SathiChat from '@/components/SathiChat';
import VoiceCall from '@/components/VoiceCall';
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
import QualityDashboard from '@/pages/quality/QualityDashboard';
import LogisticsDashboard from '@/pages/logistics/LogisticsDashboard';
import '@/App.css';

function RoleDashboard(props) {
  const { user } = useAuth();
  if (!user) return null;
  if (user.role === 'FARMER') return <FarmerDashboard {...props} />;
  if (user.role === 'BUYER') return <BuyerDashboard {...props} />;
  if (user.role === 'FPO') return <FPODashboard {...props} />;
  if (user.role === 'ADMIN') return <AdminDashboard {...props} />;
  if (user.role === 'QUALITY_ASSESSOR') return <QualityDashboard {...props} />;
  if (user.role === 'LOGISTICS_PROVIDER') return <LogisticsDashboard {...props} />;
  return <div>Role {user.role} is not yet supported.</div>;
}

function AppShell() {
  const [chatOpen, setChatOpen] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const openChat = () => setChatOpen(true);
  const openCall = () => setCallOpen(true);
  return (
    <AppLayout onOpenChat={openChat} onOpenCall={openCall}>
      <Routes>
        <Route path="/" element={<RoleDashboard onOpenChat={openChat} onOpenCall={openCall} />} />
        <Route path="/sell" element={<Protected roles={['FARMER']}><SellingJourney onOpenChat={openChat} /></Protected>} />
        <Route path="/lots" element={<Protected roles={['FARMER', 'FPO', 'ADMIN']}><FarmerLots /></Protected>} />
        <Route path="/lots/:id" element={<LotDetail onOpenChat={openChat} />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/demands" element={<Protected roles={['BUYER']}><BuyerDemands /></Protected>} />
        <Route path="/matches" element={<Protected roles={['BUYER']}><BuyerDashboard onOpenChat={openChat} /></Protected>} />
        <Route path="/offers" element={<Protected roles={['BUYER', 'ADMIN']}><BuyerOffers /></Protected>} />
        <Route path="/farmers" element={<Protected roles={['FPO', 'ADMIN']}><FPODashboard /></Protected>} />
        <Route path="/users" element={<Protected roles={['ADMIN']}><AdminDashboard /></Protected>} />
        <Route path="/quality" element={<Protected roles={['QUALITY_ASSESSOR', 'ADMIN']}><QualityDashboard /></Protected>} />
        <Route path="/logistics" element={<Protected roles={['LOGISTICS_PROVIDER', 'ADMIN']}><LogisticsDashboard /></Protected>} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
      {chatOpen && <SathiChat onClose={() => setChatOpen(false)} onStartCall={openCall} />}
      {callOpen && <VoiceCall onClose={() => setCallOpen(false)} />}
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
