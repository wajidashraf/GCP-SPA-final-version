import { NavLink } from "react-router-dom";
import AuthButton from "./AuthButton";
import RequireAuth from "./RequireAuth";
import { hasRole, isAdmin } from "../utils/authorization";

export default function Header() {
  const showDashboard = isAdmin();

  return (
    <header className="header">
      <div className="container header-inner">
        <NavLink to="/" className="logo">
          GCP <span className="accent">Nexus</span>
        </NavLink>
        <RequireAuth>
          <nav className="nav" aria-label="Primary">
            <NavLink to="/" end>
              Home
            </NavLink>
            <NavLink to="/requests">Requests</NavLink>
            {showDashboard ? (
              <>
                <NavLink to="/dashboard">Dashboard</NavLink>
                <NavLink to="/admin">Manage</NavLink>
              </>
            ) : null}
          </nav>
        </RequireAuth>
        <AuthButton />
      </div>
    </header>
  );
}
