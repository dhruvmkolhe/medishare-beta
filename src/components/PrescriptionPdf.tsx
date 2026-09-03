import type { Credential, PrescriptionItem } from '../types';

interface PrintableMed {
  medication: string;
  strength?: string;
  dosage?: string;
  duration?: string;
  timing?: string;
  refills?: number;
}

interface Props {
  credential: Credential;
  items: PrescriptionItem[];
  providerName: string;
  patientName: string;
  qrUrl: string;
}

export default function PrescriptionPdf({ credential, items, providerName, patientName, qrUrl }: Props) {
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const medications: PrintableMed[] = items.length > 0 ? items : [{
      medication: credential.prescriptions?.medication || '',
      strength: credential.prescriptions?.strength || '',
      dosage: credential.prescriptions?.dosage || '',
      duration: credential.prescriptions?.duration || '',
      timing: '',
      refills: 0,
    }];

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Prescription - ${credential.credential_id}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', system-ui, sans-serif; padding: 40px; color: #1e293b; max-width: 800px; margin: 0 auto; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 24px; }
          .header h1 { font-size: 24px; color: #0f172a; }
          .header .subtitle { font-size: 12px; color: #64748b; margin-top: 4px; }
          .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; font-size: 14px; }
          .meta-item { display: flex; gap: 8px; }
          .meta-label { color: #64748b; min-width: 80px; }
          .meta-value { color: #0f172a; font-weight: 500; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
          th { background: #f1f5f9; text-align: left; padding: 10px 12px; font-size: 12px; font-weight: 600; color: #475569; border: 1px solid #e2e8f0; }
          td { padding: 10px 12px; font-size: 13px; border: 1px solid #e2e8f0; }
          .qr-section { display: flex; align-items: center; gap: 24px; border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 20px; }
          .qr-info { font-size: 11px; color: #64748b; }
          .qr-info .id { font-family: monospace; font-size: 10px; word-break: break-all; margin-top: 4px; color: #334155; }
          .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; text-align: center; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 500; }
          .badge-active { background: #dcfce7; color: #166534; }
          .signature-line { margin-top: 48px; display: flex; justify-content: flex-end; }
          .signature-line .line { width: 200px; border-top: 1px solid #94a3b8; padding-top: 4px; font-size: 11px; color: #64748b; text-align: center; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>℞ Prescription</h1>
            <div class="subtitle">MediShare Verified Credential</div>
          </div>
          <div style="text-align: right">
            <span class="badge badge-active">${credential.status}</span>
          </div>
        </div>

        <div class="meta">
          <div class="meta-item"><span class="meta-label">Provider:</span><span class="meta-value">${providerName}</span></div>
          <div class="meta-item"><span class="meta-label">Patient:</span><span class="meta-value">${patientName}</span></div>
          <div class="meta-item"><span class="meta-label">Issued:</span><span class="meta-value">${new Date(credential.issued_at).toLocaleDateString()}</span></div>
          <div class="meta-item"><span class="meta-label">Expires:</span><span class="meta-value">${new Date(credential.expires_at).toLocaleDateString()}</span></div>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Medication</th>
              <th>Strength</th>
              <th>Dosage</th>
              <th>Duration</th>
              ${medications[0]?.timing !== undefined ? '<th>Timing</th>' : ''}
              ${medications[0]?.refills !== undefined ? '<th>Refills</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${medications.map((med: PrintableMed, i: number) => `
              <tr>
                <td>${i + 1}</td>
                <td><strong>${med.medication}</strong></td>
                <td>${med.strength}</td>
                <td>${med.dosage}</td>
                <td>${med.duration}</td>
                ${med.timing !== undefined ? `<td>${med.timing || '—'}</td>` : ''}
                ${med.refills !== undefined ? `<td>${med.refills}</td>` : ''}
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          <div class="qr-box" id="qr-container"></div>
          <div class="notes">
            <p><strong>Notes / Instructions:</strong> ${credential.prescriptions?.notes || 'Take medications as directed by your physician.'}</p>
            <p style="margin-top: 10px; color: #64748b;">
              This is a digital cryptographic prescription credential issued by ${providerName}.
              Pharmacists can verify authenticity and check for revocations by scanning the QR code above.
            </p>
          </div>
        </div>
      </body>
      </html>
    `);

    // Render QR code into the print window
    const qrContainer = printWindow.document.getElementById('qr-container');
    if (qrContainer) {
      // Use a simple QR rendering approach for print
      qrContainer.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrUrl)}" width="120" height="120" />`;
    }

    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  return (
    <button
      onClick={handlePrint}
      className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-200 border border-slate-200 transition-colors"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
      </svg>
      Print / PDF
    </button>
  );
}
