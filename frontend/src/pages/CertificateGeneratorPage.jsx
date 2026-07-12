import { useRef, useState } from 'react';
import { generateCertificatePdf, tokenKey } from '../lib/app';

export default function CertificateGeneratorPage({ onBack, onNotice }) {
  const [excelFile, setExcelFile] = useState(null);
  const [programName, setProgramName] = useState('');
  const [certificateDate, setCertificateDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setGenerating(true);
    try {
      const formData = new FormData();
      formData.append('excel', excelFile);
      formData.append('programName', programName.trim());
      formData.append('certificateDate', certificateDate);
      const result = await generateCertificatePdf(formData, { token: localStorage.getItem(tokenKey) || '' });
      const url = window.URL.createObjectURL(result.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      onNotice?.(`Generated and downloaded ${result.count} certificate${result.count === 1 ? '' : 's'}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="page-shell certificate-generator-page">
      <div className="page-header">
        <div>
          <div className="panel-kicker">Document tools</div>
          <h2>Certificate Generator</h2>
          <p>Upload the participant list, enter the shared program details, and download one combined PDF.</p>
        </div>
      </div>

      <section className="panel certificate-generator-panel">
        <form className="certificate-generator-form" onSubmit={submit}>
          <label className="certificate-upload-zone">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              onChange={(event) => { setError(''); setExcelFile(event.target.files?.[0] || null); }}
              required
            />
            <span className="certificate-upload-icon">⇧</span>
            <strong>{excelFile ? excelFile.name : 'Choose participant Excel file'}</strong>
            <span>Name, First Name + Last Name, or one/two populated columns are supported.</span>
          </label>
          <div className="certificate-fields">
            <label>
              Program name
              <input value={programName} onChange={(event) => setProgramName(event.target.value)} placeholder="Youth & Health Training" required />
            </label>
            <label>
              Certificate date
              <input type="date" value={certificateDate} onChange={(event) => setCertificateDate(event.target.value)} required />
            </label>
          </div>
          <div className="certificate-generator-actions">
            <div>
              <strong>PDF output</strong>
              <span>Every participant receives a separate page using the official certificate design.</span>
            </div>
            <button type="submit" disabled={generating || !excelFile}>{generating ? 'Generating PDF…' : 'Generate & Download PDF'}</button>
          </div>
          {error ? <div className="error-banner">{error}</div> : null}
        </form>
      </section>
    </div>
  );
}
