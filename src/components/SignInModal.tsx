import Modal from 'react-bootstrap/Modal';
import { useAuth } from '../context/AuthContext';

type SignInModalProps = {
  show: boolean;
  onHide: () => void;
  /** Optional path to return to after login. Defaults to the current URL. */
  returnUrl?: string;
  /**
   * When false, the modal can't be dismissed via backdrop click or ESC — used
   * on the dedicated login page where the modal *is* the page. Defaults to true.
   */
  dismissible?: boolean;
};

// Inline Microsoft logo (4 colored squares) — official brand mark, avoids an
// extra asset round-trip.
const MicrosoftLogo = ({ size = 21 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 23 23"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <rect x="1" y="1" width="10" height="10" fill="#F25022" />
    <rect x="12" y="1" width="10" height="10" fill="#7FBA00" />
    <rect x="1" y="12" width="10" height="10" fill="#00A4EF" />
    <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
  </svg>
);

const SignInModal = ({
  show,
  onHide,
  returnUrl,
  dismissible = true,
}: SignInModalProps) => {
  const { login } = useAuth();

  const handleSignIn = async () => {
    await login(returnUrl);
    // login() navigates the browser via form POST — modal close is moot,
    // but call it anyway in case we're on localhost (mock mode).
    onHide();
  };

  return (
    <Modal
      show={show}
      onHide={onHide}
      centered
      backdrop={dismissible ? true : 'static'}
      keyboard={dismissible}
      dialogClassName="ms-signin-dialog"
      aria-labelledby="signin-modal-title"
    >
      <div className="ms-signin">
        <div className="ms-signin-brand">
          <MicrosoftLogo size={24} />
          <span>Microsoft</span>
        </div>

        <h2 id="signin-modal-title" className="ms-signin-title">
          Sign in
        </h2>
        <p className="ms-signin-sub">
          Use your organisation account to access GCP Central.
        </p>

        <button
          type="button"
          className="ms-signin-btn"
          onClick={handleSignIn}
        >
          <MicrosoftLogo size={21} />
          <span>Sign in with Microsoft</span>
        </button>

        <p className="ms-signin-foot">
          You'll be redirected to Microsoft to sign in securely.
        </p>
      </div>
    </Modal>
  );
};

export default SignInModal;
export { SignInModal };
