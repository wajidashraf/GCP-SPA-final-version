export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <span className="footer-brand">
          GCP <span className="accent">Nexus</span>
        </span>
        <span className="footer-meta">
          © {new Date().getFullYear()} GCP Nexus. All rights reserved.
        </span>
      </div>
    </footer>
  );
}
