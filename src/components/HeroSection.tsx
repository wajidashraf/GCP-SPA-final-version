import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { hasRole } from '../utils/authorization';
import SignInModal from './SignInModal';

export default function HeroSection() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();
  const [showModal, setShowModal] = useState(false);

  return (
    <section className="hero">
      <div className="hero-inner">
        <span className="badge-pill">Contract Procurement Portal</span>
        <h1>Submit and manage GCP / GCPC requests in one place</h1>
        <p>
          Submit, track, and manage contract procurement requests end-to-end from
          initial submission to endorsement.
        </p>
        <div className="hero-cta">
          {isLoading ? null : isAuthenticated ? (
            <>
              {/* Only Requestors can create requests (see Request - Owner Access
                  table permission). Everyone else just reviews/tracks. */}
              {hasRole('Requestor') && (
                <button className="btn btn-primary" onClick={() => navigate('/submit')}>
                  Create Request
                </button>
              )}
              <button className="btn btn-outline" onClick={() => navigate('/requests')}>
                Review Request
              </button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              Sign in to continue
            </button>
          )}
        </div>
      </div>
      <SignInModal show={showModal} onHide={() => setShowModal(false)} returnUrl="/" />
    </section>
  );
}
