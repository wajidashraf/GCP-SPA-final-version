import { Link } from 'react-router-dom';
import { Settings } from 'lucide-react';

export default function Admin() {
  return (
    <section className="section">
      <div className="container">
        {/* Hero header */}
        <div className="rq-header">
          <div className="rq-header-top">
            <Settings size={22} aria-hidden="true" />
            <h1 className="rq-title">Admin</h1>
          </div>
          <p className="rq-subtitle">Manage roles, SLAs, and inventory.</p>
        </div>
        <div className="admin-grid">
          <Link to="/admin/user-roles" className="admin-card admin-card-link">
            <h3>User Role Management</h3>
            <p>Assign and manage user roles across the portal.</p>
          </Link>
          
          <Link to="/admin/slots" className="admin-card admin-card-link">
            <h3>Slot Management</h3>
            <p>Configure and manage available slots across the portal.</p>
          </Link>
          <Link to="/admin/engagements" className="admin-card admin-card-link">
            <h3>Engagement Management</h3>
            <p>Track and manage engagements across the group organisation.</p>
          </Link>
          <Link to="/admin/signatories" className="admin-card admin-card-link">
            <h3>Signatory Groups</h3>
            <p>Manage Prepared and Confirmed signature group members.</p>
          </Link>
          <Link to="/admin/email-templates" className="admin-card admin-card-link">
            <h3>Email Templates</h3>
            <p>Edit the notifications sent at each step of the request lifecycle.</p>
          </Link>
          <div className="admin-card">
            <h3>SLA Configuration</h3>
            <p>Define service-level agreements per request type.</p>
          </div>
          <div className="admin-card">
            <h3>Company Inventory</h3>
            <p>Maintain the list of companies in the group organisation.</p>
          </div>
        </div>
        
        <div className="note">
          Admin features will be configured in a later phase.
        </div>
        
      </div>
    </section>
  );
}
