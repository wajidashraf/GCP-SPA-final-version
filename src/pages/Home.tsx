import { Navigate, useLocation } from 'react-router-dom';
import { ClipboardList, GaugeCircle, ShieldCheck } from 'lucide-react';
import HeroSection from '../components/HeroSection';
import FeatureCard from '../components/FeatureCard';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Wait for auth to resolve before deciding, then gate the page: signed-in
  // users see Home; everyone else is sent to the login page, remembering where
  // they came from so they return here after signing in.
  if (isLoading) return null;
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <>
      <HeroSection />
      <section className="section">
        <div className="container">
          <h2 className="section-title">Built for procurement workflows</h2>
          <p className="section-subtitle">
            Designed for clarity, speed, and accountability across every role.
          </p>
          <div className="feature-grid">
            <FeatureCard
              icon={ClipboardList}
              title="Structured Request Submission"
              description="Standardised forms for every GCP and GCPC request type."
            />
            <FeatureCard
              icon={ShieldCheck}
              title="Role Based Review"
              description="Verifiers, reviewers, and committee members see only what they need."
            />
            <FeatureCard
              icon={GaugeCircle}
              title="Status and SLA Visibility"
              description="Track progress and SLA breaches at a glance."
            />
          </div>
        </div>
      </section>
    </>
  );
}
