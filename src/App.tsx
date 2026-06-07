import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import RequireRole from './components/RequireRole';
import { useDocumentTitle } from './hooks/useDocumentTitle';
import Home from './pages/Home';
import Login from './pages/Login';
import Submit from './pages/Submit';
import SubmitForm from './pages/SubmitForm';
import Requests from './pages/Requests';
import RequestDetail from './pages/RequestDetail';
import VerifyData from './pages/VerifyData';
import RequestReview from './pages/RequestReview';
import Engagement from './pages/Engagement';
import HocAcceptance from './pages/HocAcceptance';
import EndorseReview from './pages/EndorseReview';
import LetterPage from './pages/LetterPage';
import Admin from './pages/Admin';
import UserRoleManagement from './pages/UserRoleManagement';
import SlotManagement from './pages/SlotManagement';
import EngagementManagement from './pages/EngagementManagement';
import SignatoryManagement from './pages/SignatoryManagement';
import EmailTemplateManagement from './pages/EmailTemplateManagement';
import Profile from './pages/Profile';
import Dashboard from './pages/Dashboard';

export default function App() {
  useDocumentTitle();

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        {/* Only the Requestor role may create requests (mirrors the
            Request - Owner Access table permission, which is Requestor-only
            create). Other roles are redirected to the requests list. */}
        <Route
          path="/submit"
          element={
            <RequireRole roles={['Requestor']} fallback={<Navigate to="/requests" replace />}>
              <Submit />
            </RequireRole>
          }
        />
        <Route
          path="/submit/:channel/:formCode"
          element={
            <RequireRole roles={['Requestor']} fallback={<Navigate to="/requests" replace />}>
              <SubmitForm />
            </RequireRole>
          }
        />
        <Route path="/requests" element={<Requests />} />
        <Route path="/requests/:id" element={<RequestDetail />} />
        <Route path="/requests/:id/verify-data" element={<VerifyData />} />
        <Route path="/requests/:id/review" element={<RequestReview />} />
        <Route path="/requests/:id/engagement" element={<Engagement />} />
        <Route path="/requests/:id/hoc-acceptance" element={<HocAcceptance />} />
        <Route path="/requests/:id/endorse" element={<EndorseReview />} />
        <Route path="/requests/:id/ack-letter" element={<LetterPage />} />
        <Route path="/requests/:id/endorsement-letter" element={<LetterPage />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/admin/user-roles" element={<UserRoleManagement />} />
        <Route path="/admin/slots" element={<SlotManagement />} />
        <Route path="/admin/engagements" element={<EngagementManagement />} />
        <Route path="/admin/signatories" element={<SignatoryManagement />} />
        <Route path="/admin/email-templates" element={<EmailTemplateManagement />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </Layout>
  );
}
