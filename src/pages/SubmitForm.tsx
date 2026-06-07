import { useNavigate, useParams } from 'react-router-dom';
import { findMatter } from '../data/matterChoices';
import { RtpForm } from '../forms/rtp';
import { PblForm } from '../forms/pbl';
import { JvpForm } from '../forms/jvp';
import { StspForm } from '../forms/stsp';
import { CaaForm } from '../forms/caa';
import { PccaForm } from '../forms/pcca';
import { RpccaForm } from '../forms/rpcca';
import { PpForm } from '../forms/pp';
import { RppForm } from '../forms/rpp';
import { VapForm } from '../forms/vap';
import { OthersForm } from '../forms/others';
import { CprForm } from '../forms/cpr';
import { CiForm } from '../forms/ci';

export default function SubmitForm() {
  const { channel = '', formCode = '' } = useParams();
  const navigate = useNavigate();
  const matter = findMatter(channel, formCode);

  if (!matter) {
    return (
      <section className="section">
        <div className="container">
          <div className="page-header">
            <h1>Form not found</h1>
            <p>The requested form does not exist.</p>
          </div>
          <button className="btn btn-secondary" onClick={() => navigate('/submit')}>
            Back to Create Request
          </button>
        </div>
      </section>
    );
  }

  // Captured before the exhaustive ternary below so the fallback branch (which
  // TypeScript narrows to `never` once every code is handled) still type-checks.
  const { label: matterLabel, code: matterCode } = matter;

  return (
    <section className="section">
      <div className="container">
        {matter.code === 'RTP' ? (
          <RtpForm matter={matter} />
        ) : matter.code === 'PBL' ? (
          <PblForm matter={matter} />
        ) : matter.code === 'JVP' ? (
          <JvpForm matter={matter} />
        ) : matter.code === 'ST/SP' ? (
          <StspForm matter={matter} />
        ) : matter.code === 'CAA' ? (
          <CaaForm matter={matter} />
        ) : matter.code === 'PCCA' ? (
          <PccaForm matter={matter} />
        ) : matter.code === 'R-PCCA' ? (
          <RpccaForm matter={matter} />
        ) : matter.code === 'PP' ? (
          <PpForm matter={matter} />
        ) : matter.code === 'R-PP' ? (
          <RppForm matter={matter} />
        ) : matter.code === 'VAP' ? (
          <VapForm matter={matter} />
        ) : matter.code === 'Others' ? (
          <OthersForm matter={matter} />
        ) : matter.code === 'CPR' ? (
          <CprForm matter={matter} />
        ) : matter.code === 'CI' ? (
          <CiForm matter={matter} />
        ) : (
          <div className="form-info">
            The form for <strong>{matterLabel}</strong> ({matterCode}) is not
            implemented yet.
          </div>
        )}
      </div>
    </section>
  );
}
