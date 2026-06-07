import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { InlineMessage, LoadingState } from '../components/ui';

export default function Profile() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <section className="section">
        <div className="container">
          <LoadingState message="Loading your profile…" />
        </div>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="section">
        <div className="container">
          <div className="page-header">
            <h1>Profile</h1>
          </div>
          <InlineMessage tone="info" title="You’re not signed in" className="mb-3">
            Sign in to view your account information.
          </InlineMessage>
          <Link to="/" className="btn btn-secondary">
            Go to Home
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="section">
      <div className="container">
        <div className="page-header">
          <h1>Profile</h1>
          <p>Your account information.</p>
        </div>
        <div className="profile-card">
          <div className="profile-row">
            <span className="k">Name</span>
            <span className="v">{user.name}</span>
          </div>
          <div className="profile-row">
            <span className="k">Roles</span>
            <span className="v">{user.roles.join(', ') || '—'}</span>
          </div>
          <div className="profile-row">
            <span className="k">Company</span>
            <span className="v">{user.company}</span>
          </div>
          <div className="profile-row">
            <span className="k">Email</span>
            <span className="v">{user.email}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
