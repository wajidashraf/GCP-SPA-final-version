import { useCallback, useEffect, useRef, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import { Loader2, PenLine, Upload, X } from 'lucide-react';
import { InlineMessage } from '../ui';
import { uploadFileToSharePoint } from '../../shared/uploadApi';
import { uploadConfig } from '../../shared/uploadConfig';
import { createSignature } from '../../shared/services/signatureService';

type Tab = 'draw' | 'upload';

type SignatureModalProps = {
  show: boolean;
  memberName: string;
  memberEmail: string;
  requestId: string;
  contactId: string | null;
  loginHint?: string;
  onHide: () => void;
  onSaved: () => void;
};

const CANVAS_W = 520;
const CANVAS_H = 200;

const SignatureModal = ({
  show,
  memberName,
  memberEmail,
  requestId,
  contactId,
  loginHint,
  onHide,
  onSaved,
}: SignatureModalProps) => {
  const [activeTab, setActiveTab] = useState<Tab>('draw');
  const [hasDrawn, setHasDrawn] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPtRef = useRef<{ x: number; y: number } | null>(null);

  // Reset state on open.
  useEffect(() => {
    if (show) {
      setActiveTab('draw');
      setHasDrawn(false);
      setUploadFile(null);
      setSaving(false);
      setProgress(0);
      setError(null);
    }
  }, [show]);

  // Clear canvas when tab switches to draw or on modal open.
  useEffect(() => {
    if (!show || activeTab !== 'draw') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    setHasDrawn(false);
  }, [show, activeTab]);

  const getCanvasPoint = (
    e: React.MouseEvent | React.TouchEvent,
    canvas: HTMLCanvasElement,
  ): { x: number; y: number } => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    if ('touches' in e) {
      const touch = e.touches[0] ?? e.changedTouches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      e.preventDefault();
      isDrawingRef.current = true;
      lastPtRef.current = getCanvasPoint(e, canvas);
    },
    [],
  );

  const draw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawingRef.current) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      e.preventDefault();
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const pt = getCanvasPoint(e, canvas);
      const prev = lastPtRef.current ?? pt;
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(pt.x, pt.y);
      ctx.strokeStyle = '#0f1e4a';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
      lastPtRef.current = pt;
      setHasDrawn(true);
    },
    [],
  );

  const stopDraw = useCallback(() => {
    isDrawingRef.current = false;
    lastPtRef.current = null;
  }, []);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx?.clearRect(0, 0, CANVAS_W, CANVAS_H);
    setHasDrawn(false);
  };

  const canSubmit =
    !saving &&
    (activeTab === 'draw' ? hasDrawn : uploadFile !== null);

  const getSignatureBlob = async (): Promise<Blob> => {
    if (activeTab === 'upload') {
      if (!uploadFile) throw new Error('No file selected.');
      return uploadFile;
    }
    const canvas = canvasRef.current;
    if (!canvas) throw new Error('Canvas not available.');
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Canvas is empty.'))),
        'image/png',
      );
    });
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setError(null);
    setSaving(true);
    setProgress(0);
    try {
      if (!uploadConfig.isConfigured) {
        throw new Error(
          'File upload is not configured. Contact your administrator.',
        );
      }
      const blob = await getSignatureBlob();
      const fileName = `${memberEmail.replace(/[^a-zA-Z0-9]/g, '_')}-signature.png`;
      const file = new File([blob], fileName, { type: 'image/png' });

      const uploaded = await uploadFileToSharePoint(
        file,
        { entityType: 'signatures', requestId, loginHint },
        (pct) => setProgress(pct),
      );

      await createSignature({
        requestId,
        signatoryEmail: memberEmail,
        signatoryContactId: contactId,
        signUrl: uploaded.webUrl,
      });

      onSaved();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'An error occurred. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal show={show} onHide={saving ? undefined : onHide} centered size="lg">
      <Modal.Header className="border-0 pb-0">
        <Modal.Title className="fw-semibold" style={{ fontSize: '1rem' }}>
          <PenLine size={16} aria-hidden="true" className="me-2" />
          Sign as {memberName}
        </Modal.Title>
        {!saving ? (
          <button
            type="button"
            className="btn-close"
            onClick={onHide}
            aria-label="Close"
          />
        ) : null}
      </Modal.Header>

      <Modal.Body className="pt-2">
        {/* Tab switcher */}
        <div className="sig-modal-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'draw'}
            className={`sig-modal-tab ${activeTab === 'draw' ? 'active' : ''}`}
            onClick={() => !saving && setActiveTab('draw')}
          >
            <PenLine size={14} aria-hidden="true" />
            Draw
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'upload'}
            className={`sig-modal-tab ${activeTab === 'upload' ? 'active' : ''}`}
            onClick={() => !saving && setActiveTab('upload')}
          >
            <Upload size={14} aria-hidden="true" />
            Upload
          </button>
        </div>

        {/* Draw tab */}
        {activeTab === 'draw' ? (
          <div className="sig-modal-canvas-wrap">
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              className="sig-modal-canvas"
              aria-label="Signature drawing area"
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={stopDraw}
              onMouseLeave={stopDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={stopDraw}
            />
            <p className="sig-modal-hint">
              {hasDrawn ? 'Signature drawn.' : 'Draw your signature above using your mouse or touchscreen.'}
            </p>
            {hasDrawn ? (
              <button
                type="button"
                className="sig-modal-clear-btn"
                onClick={clearCanvas}
                disabled={saving}
              >
                <X size={13} aria-hidden="true" />
                Clear
              </button>
            ) : null}
          </div>
        ) : null}

        {/* Upload tab */}
        {activeTab === 'upload' ? (
          <div className="sig-modal-upload-wrap">
            <label className="sig-modal-upload-label" htmlFor="sig-file-input">
              {uploadFile ? (
                <span className="sig-modal-file-chosen">
                  {uploadFile.name}
                  <button
                    type="button"
                    className="sig-modal-clear-btn ms-2"
                    onClick={(e) => {
                      e.preventDefault();
                      setUploadFile(null);
                    }}
                    disabled={saving}
                  >
                    <X size={13} aria-hidden="true" />
                    Remove
                  </button>
                </span>
              ) : (
                <>
                  <Upload size={20} aria-hidden="true" className="mb-1" />
                  <span>Click to select or drag and drop a signature image</span>
                  <span className="sig-modal-hint">PNG or JPEG, max 5 MB</span>
                </>
              )}
            </label>
            <input
              id="sig-file-input"
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              className="visually-hidden"
              disabled={saving}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setUploadFile(f);
                e.target.value = '';
              }}
            />
          </div>
        ) : null}

        {/* Progress bar */}
        {saving && progress > 0 ? (
          <div className="sig-modal-progress">
            <div
              className="sig-modal-progress-bar"
              style={{ width: `${progress}%` }}
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        ) : null}

        {error ? (
          <InlineMessage tone="error" className="mt-2">
            {error}
          </InlineMessage>
        ) : null}
      </Modal.Body>

      <Modal.Footer className="border-0 pt-0">
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          onClick={onHide}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="button"
          className="rd-verify-btn"
          style={{ minWidth: 110 }}
          onClick={() => void handleSubmit()}
          disabled={!canSubmit}
        >
          {saving ? (
            <>
              <Loader2 size={14} aria-hidden="true" className="sig-spin me-1" />
              Saving…
            </>
          ) : (
            <>
              <PenLine size={14} aria-hidden="true" />
              Save Signature
            </>
          )}
        </button>
      </Modal.Footer>
    </Modal>
  );
};

export { SignatureModal };
