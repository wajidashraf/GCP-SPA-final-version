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
            {showDashboard ? (
              <>
                <NavLink to="/dashboard">Dashboard</NavLink>
                <NavLink to="/admin">Manage</NavLink>
              </>
            ) : null}
            <NavLink to="/" end>
              Home
            </NavLink>
            <NavLink to="/requests">Requests</NavLink>
          </nav>
        </RequireAuth>
        <AuthButton />
      </div>
    </header>
  );
}
