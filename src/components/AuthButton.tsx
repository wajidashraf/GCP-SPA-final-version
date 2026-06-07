import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import SignInModal from './SignInModal';

type AuthButtonProps = {
  className?: string;
};

const AuthButton = ({ className = '' }: AuthButtonProps) => {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (isLoading) {
    return <span className={`text-muted ${className}`}>…</span>;
  }

  if (!isAuthenticated || !user) {
    return (
      <>
        <button className={`btn-login ${className}`} onClick={() => setShowModal(true)}>
          Sign In
        </button>
        <SignInModal show={showModal} onHide={() => setShowModal(false)} />
      </>
    );
  }

  return (
    <div className={`user-menu ${className}`} ref={ref}>
      <div className="user-meta">
        <span className="user-name">{user.name}</span>
        {user.roles.length > 0 ? (
          <span className="user-role">{user.roles[0]}</span>
        ) : null}
      </div>
      <button
        className="avatar"
        aria-label="User menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {user.initials}
      </button>
      {open && (
        <div className="dropdown" role="menu">
          <Link to="/profile" onClick={() => setOpen(false)}>
            Profile
          </Link>
          <button
            onClick={() => {
              setOpen(false);
              logout();
            }}
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
};

export default AuthButton;
export { AuthButton };
