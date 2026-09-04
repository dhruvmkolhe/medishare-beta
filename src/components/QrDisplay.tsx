import QRCode from 'react-qr-code';
import { useTranslation } from 'react-i18next';
import { Download, Share2, Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface Props {
  url: string;
  credentialId: string;
  pickupPin?: string;
  size?: number;
}

export default function QrDisplay({ url, credentialId, pickupPin, size = 256 }: Props) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(credentialId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const downloadQr = () => {
    const svg = document.querySelector(`#qr-${credentialId}`);
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      const padding = 36;
      const targetSize = size * 2;
      canvas.width = targetSize + padding * 2;
      canvas.height = targetSize + padding * 2;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, padding, padding, targetSize, targetSize);
      const a = document.createElement('a');
      a.download = `medishare-qr-${credentialId}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'MediShare Prescription Credential', url });
      } catch {}
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm inline-block">
        <QRCode id={`qr-${credentialId}`} value={url} size={size} level="M" />
      </div>

      {pickupPin && (
        <div className="w-full max-w-sm bg-purple-50/90 border border-purple-200/80 rounded-xl p-3 text-center shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-purple-900">
            Patient Pickup PIN (2FA Verification)
          </div>
          <div className="text-2xl font-mono font-black text-purple-700 tracking-widest my-1">
            {pickupPin}
          </div>
          <p className="text-[11px] text-purple-600 leading-snug">
            Provide this secret PIN to your pharmacist along with this QR code to claim your medication securely.
          </p>
        </div>
      )}

      <div className="w-full max-w-sm bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-slate-700 truncate pl-1">{credentialId}</span>
        <button
          type="button"
          onClick={copyId}
          className="flex items-center gap-1 px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-md text-xs font-medium text-slate-700 transition-colors shadow-xs flex-shrink-0"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5 text-slate-500" />}
          <span>{copied ? 'Copied' : 'Copy ID'}</span>
        </button>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <button
          onClick={downloadQr}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors shadow-xs"
        >
          <Download className="h-4 w-4" />
          <span>Download PNG</span>
        </button>
        <button
          onClick={share}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-200 border border-slate-200 transition-colors"
        >
          <Share2 className="h-4 w-4" />
          <span>{t('qr.share')}</span>
        </button>
      </div>
    </div>
  );
}
