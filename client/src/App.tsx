import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import Layout from './components/Layout';
import { useAuth } from './hooks/useAuth';

// Pages
import Login from './pages/Login';

// Admin pages
import ClientsList from './pages/admin/ClientsList';
import ClientDetail from './pages/admin/ClientDetail';
import NewClient from './pages/admin/NewClient';
import TicketDetail from './pages/admin/TicketDetail';
import TaskDetail from './pages/admin/TaskDetail';
import NewTicket from './pages/admin/NewTicket';
import NewInvoice from './pages/admin/NewInvoice';
import ServicesList from './pages/admin/ServicesList';
import AdminProfile from './pages/admin/AdminProfile';

// Client pages
import Dashboard from './pages/client/Dashboard';
import ClientTicketDetailComponent from './pages/client/TicketDetail';
import ClientNewTicketComponent from './pages/client/NewTicket';
import TicketsList from './pages/client/TicketsList';
import InvoicesList from './pages/client/InvoicesList';

// Specialist pages
import SpecialistClientsListComponent from './pages/specialist/ClientsList';
import SpecialistTicketDetailComponent from './pages/specialist/TicketDetail';

const HomeRedirect = () => {
  const { user } = useAuth();
  if (user?.role === 'admin') {
    return <Navigate to="/admin/clients" replace />;
  } else if (user?.role === 'specialist') {
    return <Navigate to="/specialist" replace />;
  } else if (user?.role === 'client') {
    return <Navigate to="/client" replace />;
  }
  return <Navigate to="/login" replace />;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            {/* Admin routes */}
            <Route
              path="/admin/clients"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <ClientsList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/clients/new"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <NewClient />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/clients/:id"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <ClientDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/specialist/clients/:id"
              element={
                <ProtectedRoute allowedRoles={['specialist']}>
                  <ClientDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/tickets/:id"
              element={
                <ProtectedRoute allowedRoles={['admin', 'specialist']}>
                  <TicketDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/tasks/:id"
              element={
                <ProtectedRoute allowedRoles={['admin', 'specialist']}>
                  <TaskDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/tickets/new"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <NewTicket />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/invoices/new/:clientId"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <NewInvoice />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/services"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <ServicesList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/profile"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminProfile />
                </ProtectedRoute>
              }
            />

            {/* Client routes */}
            <Route
              path="/client"
              element={
                <ProtectedRoute allowedRoles={['client']}>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/client/tickets/:id"
              element={
                <ProtectedRoute allowedRoles={['client']}>
                  <ClientTicketDetailComponent />
                </ProtectedRoute>
              }
            />
            <Route
              path="/client/tickets/new"
              element={
                <ProtectedRoute allowedRoles={['client']}>
                  <ClientNewTicketComponent />
                </ProtectedRoute>
              }
            />
            <Route
              path="/client/tickets/all"
              element={
                <ProtectedRoute allowedRoles={['client']}>
                  <TicketsList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/client/invoices/all"
              element={
                <ProtectedRoute allowedRoles={['client']}>
                  <InvoicesList />
                </ProtectedRoute>
              }
            />

            {/* Specialist routes */}
            <Route
              path="/specialist"
              element={
                <ProtectedRoute allowedRoles={['specialist']}>
                  <SpecialistClientsListComponent />
                </ProtectedRoute>
              }
            />
            <Route
              path="/specialist/tickets/:id"
              element={
                <ProtectedRoute allowedRoles={['specialist']}>
                  <SpecialistTicketDetailComponent />
                </ProtectedRoute>
              }
            />

            {/* Default redirect */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <HomeRedirect />
                </ProtectedRoute>
              }
            />
          </Routes>
        </Layout>
      </Router>
    </AuthProvider>
  );
}

export default App;
