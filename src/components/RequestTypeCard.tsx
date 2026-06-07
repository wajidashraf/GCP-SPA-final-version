import { useNavigate } from 'react-router-dom';
import { toFormCode } from '../data/matterChoices';

interface Props {
  label: string;
  code: string;
  channel: 'gcp' | 'gcpc';
}

export default function RequestTypeCard({ label, code, channel }: Props) {
  const navigate = useNavigate();
  const goto = () => navigate(`/submit/${channel}/${toFormCode(code)}`);
  return (
    <button
      className={`request-card ${channel}`}
      onClick={goto}
      aria-label={`Open form for ${label}`}
    >
      <p className="label mb-0">{label} <span className="code ms-2">{code}</span></p>
      
    </button>
  );
}
