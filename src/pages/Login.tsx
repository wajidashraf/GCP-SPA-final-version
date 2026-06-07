import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import SignInModal from '../components/SignInModal';

type FromState = { from?: { pathname?: string } };

export default function Login() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Where to send the user after a successful sign-in: the page they were
  // trying to reach, falling back to home.
  const from = (location.state as FromState | null)?.from?.pathname ?? '/';

  // Already signed in (or signed in just now) → bounce to the origin page.
  if (!isLoading && isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  // The sign-in modal is the login page itself: shown immediately and not
  // dismissible (there's no welcome screen behind it to return to).
  return (
    <section className="login-page">
      <SignInModal show onHide={() => {}} returnUrl={from} dismissible={false} />
    </section>
  );
}
