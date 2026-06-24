const fs = require('fs');
const path = require('path');

const PRESCRIPTION_LOGO_PATH = path.resolve(__dirname, '../../public/favicon.png');
let cachedPrescriptionLogoDataUri;

const getPrescriptionLogoDataUri = () => {
  if (cachedPrescriptionLogoDataUri !== undefined) {
    return cachedPrescriptionLogoDataUri;
  }

  try {
    const logo = fs.readFileSync(PRESCRIPTION_LOGO_PATH);
    cachedPrescriptionLogoDataUri = `data:image/png;base64,${logo.toString('base64')}`;
  } catch {
    cachedPrescriptionLogoDataUri = '';
  }

  return cachedPrescriptionLogoDataUri;
};

const valueOrFallback = (value, fallback = 'Not provided') => {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
};

const escapeHtml = (value) =>
  valueOrFallback(value, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const formatDate = (value) => {
  if (!value) return 'Not provided';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return escapeHtml(value);
  return parsed.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatDateTime = (value) => {
  const parsed = value ? new Date(value) : new Date();
  return parsed.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const paragraph = (value) => {
  const text = valueOrFallback(value);
  return escapeHtml(text).replace(/\n/g, '<br>');
};

const infoRow = (label, value) => `
  <div class="info-row">
    <span>${escapeHtml(label)}</span>
    <strong>${escapeHtml(valueOrFallback(value))}</strong>
  </div>
`;

const section = (title, content) => `
  <section class="section">
    <h2>${escapeHtml(title)}</h2>
    <div class="section-body">${content}</div>
  </section>
`;

const renderVitals = (vitals = {}) => {
  const entries = [
    ['Blood Pressure', vitals.bloodPressure],
    ['Pulse', vitals.pulse],
    ['Temperature', vitals.temperature],
    ['SpO2', vitals.spo2],
    ['Weight', vitals.weight],
    ['Height', vitals.height],
  ].filter(([, value]) => valueOrFallback(value, '') !== '');

  if (!entries.length) return '<p>Not provided</p>';
  return `<div class="vitals-grid">${entries.map(([label, value]) => `
    <div>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `).join('')}</div>`;
};

const renderMedicines = (medicines = []) => {
  if (!medicines.length) {
    return '<p>No medicines prescribed.</p>';
  }

  return `
    <table class="medicine-table">
      <thead>
        <tr>
          <th style="width: 24px;">#</th>
          <th>Medicine</th>
          <th>Dosage</th>
          <th>Frequency</th>
          <th>Duration</th>
          <th>Timing</th>
          <th>Instructions</th>
        </tr>
      </thead>
      <tbody>
        ${medicines.map((medicine, index) => `
          <tr>
            <td>${index + 1}</td>
            <td><strong>${escapeHtml(medicine.medicineName)}</strong></td>
            <td>${escapeHtml(valueOrFallback(medicine.dosage))}</td>
            <td>${escapeHtml(valueOrFallback(medicine.frequency))}</td>
            <td>${escapeHtml(valueOrFallback(medicine.duration))}</td>
            <td>${escapeHtml(valueOrFallback(medicine.timing))}</td>
            <td>${escapeHtml(valueOrFallback(medicine.instructions))}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
};

const buildPrescriptionTemplate = (data) => {
  const clinical = data.clinicalData || {};
  const generatedAt = formatDateTime(data.generatedAt || new Date());
  const logoDataUri = getPrescriptionLogoDataUri();
  const logoMarkup = logoDataUri
    ? `<img class="logo" src="${logoDataUri}" alt="Medi Meet logo">`
    : '<div class="logo logo-fallback">MM</div>';

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(data.prescriptionNumber)} - Medi Meet Prescription</title>
  <style>
    @page { size: A4; margin: 18mm 14mm 18mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #152033;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      line-height: 1.45;
      background: #fff;
    }
    .page { width: 100%; }
    .header {
      display: flex;
      justify-content: space-between;
      gap: 18px;
      border-bottom: 3px solid #0b6e7d;
      padding-bottom: 12px;
      margin-bottom: 14px;
    }
    .brand { display: flex; gap: 16px; align-items: center; }
    .logo {
      width: 76px;
      height: 76px;
      border-radius: 16px;
      border: 1px solid #d7e8eb;
      background: #fff;
      display: block;
      object-fit: contain;
      padding: 5px;
    }
    .logo-fallback {
      background: #0b6e7d;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 27px;
      font-weight: 800;
      border: 0;
      padding: 0;
    }
    .brand h1 { margin: 0; font-size: 27px; letter-spacing: .2px; color: #0b2833; }
    .brand p { margin: 2px 0 0; color: #526174; font-size: 11px; }
    .doc-meta { text-align: right; min-width: 210px; color: #526174; }
    .doc-meta strong { display: block; color: #152033; font-size: 12px; }
    .title-block {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      background: #f2f8f9;
      border: 1px solid #d7e8eb;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 14px;
    }
    .title-block h2 { margin: 0; font-size: 16px; color: #0b6e7d; }
    .title-block p { margin: 4px 0 0; color: #526174; }
    .summary-id { text-align: right; font-size: 10px; color: #526174; }
    .summary-id strong { display: block; font-size: 12px; color: #152033; }
    .two-col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 12px;
      page-break-inside: avoid;
    }
    .card {
      border: 1px solid #dfe7ee;
      border-radius: 8px;
      padding: 10px;
      min-height: 110px;
    }
    .card h3 {
      margin: 0 0 8px;
      color: #0b6e7d;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: .04em;
    }
    .info-row {
      display: grid;
      grid-template-columns: 110px 1fr;
      gap: 8px;
      padding: 3px 0;
      border-bottom: 1px solid #f0f3f6;
      word-break: break-word;
    }
    .info-row:last-child { border-bottom: 0; }
    .info-row span { color: #66758a; }
    .info-row strong { font-weight: 600; color: #152033; }
    .section {
      border: 1px solid #dfe7ee;
      border-radius: 8px;
      margin: 0 0 10px;
      overflow: hidden;
      page-break-inside: avoid;
    }
    .section h2 {
      margin: 0;
      padding: 7px 10px;
      background: #f6fafb;
      color: #0b6e7d;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: .04em;
      border-bottom: 1px solid #dfe7ee;
    }
    .section-body { padding: 9px 10px; min-height: 28px; }
    .section-body p { margin: 0; white-space: normal; word-break: break-word; }
    .vitals-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }
    .vitals-grid div {
      border: 1px solid #e7edf2;
      border-radius: 6px;
      padding: 7px;
      background: #fbfcfd;
    }
    .vitals-grid span { display: block; color: #66758a; font-size: 10px; }
    .vitals-grid strong { font-size: 12px; color: #152033; }
    .medicine-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 10px;
    }
    .medicine-table th {
      background: #0b6e7d;
      color: #fff;
      padding: 7px 5px;
      text-align: left;
      font-weight: 700;
    }
    .medicine-table td {
      border: 1px solid #dfe7ee;
      padding: 7px 5px;
      vertical-align: top;
      word-break: break-word;
    }
    .medicine-table tbody tr:nth-child(even) { background: #fbfcfd; }
    .signature {
      display: grid;
      grid-template-columns: 1fr 220px;
      gap: 18px;
      margin-top: 18px;
      page-break-inside: avoid;
    }
    .signature .box {
      border-top: 1px solid #aab6c4;
      padding-top: 8px;
      text-align: center;
      color: #526174;
      min-height: 54px;
    }
    .disclaimer {
      margin-top: 14px;
      border-top: 1px solid #dfe7ee;
      padding-top: 10px;
      color: #526174;
      font-size: 10px;
    }
    .footer {
      margin-top: 8px;
      text-align: center;
      color: #7a8797;
      font-size: 9px;
    }
  </style>
</head>
<body>
  <main class="page">
    <header class="header">
      <div class="brand">
        ${logoMarkup}
        <div>
          <h1>Medi Meet</h1>
          <p>Clinic Platform | Online Doctor Consultation</p>
          <p>Secure digital consultation and medical record service</p>
        </div>
      </div>
      <div class="doc-meta">
        <strong>${escapeHtml(valueOrFallback(data.doctor.doctorName))}</strong>
        ${escapeHtml(valueOrFallback(data.doctor.specialization))}<br>
        Reg. No: ${escapeHtml(valueOrFallback(data.doctor.registrationNumber))}<br>
        ${escapeHtml(valueOrFallback(data.doctor.doctorEmail))}
      </div>
    </header>

    <div class="title-block">
      <div>
        <h2>Prescription / Consultation Summary</h2>
        <p>This document was generated after an online consultation on Medi Meet.</p>
      </div>
      <div class="summary-id">
        Prescription No.
        <strong>${escapeHtml(data.prescriptionNumber)}</strong>
        Generated: ${escapeHtml(generatedAt)}
      </div>
    </div>

    <div class="two-col">
      <div class="card">
        <h3>Patient Information</h3>
        ${infoRow('Name', data.patient.patientName)}
        ${infoRow('Email', data.patient.patientEmail)}
        ${infoRow('Phone', data.patient.phone)}
        ${infoRow('Gender', data.patient.gender)}
        ${infoRow('Age', data.patient.age)}
        ${infoRow('DOB', data.patient.dateOfBirth)}
        ${infoRow('Address', data.patient.address)}
      </div>
      <div class="card">
        <h3>Doctor Information</h3>
        ${infoRow('Doctor', data.doctor.doctorName)}
        ${infoRow('Specialization', data.doctor.specialization)}
        ${infoRow('Qualification', data.doctor.qualification)}
        ${infoRow('Reg. Number', data.doctor.registrationNumber)}
        ${infoRow('Email', data.doctor.doctorEmail)}
      </div>
    </div>

    <div class="card" style="margin-bottom: 12px;">
      <h3>Appointment Information</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 18px;">
        ${infoRow('Appointment Date', formatDate(data.appointment.appointmentDate))}
        ${infoRow('Consultation Date', formatDate(data.appointment.consultationDate))}
        ${infoRow('Consultation Time', data.appointment.consultationTime)}
        ${infoRow('Consultation Type', data.appointment.consultationType)}
        ${infoRow('Visit Type', data.appointment.visitType)}
        ${infoRow('Status', data.appointment.status)}
      </div>
    </div>

    ${section('Chief Complaints', `<p>${paragraph(clinical.chiefComplaints)}</p>`)}
    ${section('Duration', `<p>${paragraph(clinical.duration)}</p>`)}
    ${section('Vitals', renderVitals(clinical.vitals))}
    ${section('History of Present Illness', `<p>${paragraph(clinical.historyOfPresentIllness)}</p>`)}
    ${section('Clinical Diagnosis', `<p>${paragraph(clinical.diagnosis)}</p>`)}
    ${section('Medicines', renderMedicines(data.medicines))}
    ${section('Investigation / Test Advice', `<p>${paragraph(clinical.investigationOrders)}</p>`)}
    ${section('Procedure History', `<p>${paragraph(clinical.procedureHistory)}</p>`)}
    ${section('Past Medical History', `<p>${paragraph(clinical.pastMedicalHistory)}</p>`)}
    ${section('Family History', `<p>${paragraph(clinical.familyHistory)}</p>`)}
    ${section('Social History', `<p>${paragraph(clinical.socialHistory)}</p>`)}
    ${section('Allergies', `<p>${paragraph(clinical.allergies)}</p>`)}
    ${section('General Advice', `<p>${paragraph(clinical.advice)}</p>`)}
    ${section('Follow-up', `<p>${clinical.followUpDate ? `Follow-up on ${escapeHtml(formatDate(clinical.followUpDate))}` : 'Not provided'}</p>`)}
    ${section('Emergency Instructions', `<p>${paragraph(clinical.emergencyInstructions)}</p>`)}
    ${section('Additional Notes', `<p>${paragraph(clinical.notes)}</p>`)}

    <div class="signature">
      <div>
        <strong>Generated electronically by Medi Meet</strong><br>
        This is a system-generated prescription and is valid without a physical stamp when verified in the Medi Meet app.
      </div>
      <div class="box">
        Digital Signature<br>
        <strong>${escapeHtml(valueOrFallback(data.doctor.doctorName))}</strong>
      </div>
    </div>

    <div class="disclaimer">
      <strong>Disclaimer:</strong>
      This prescription was generated after an online consultation on Medi Meet. Please follow the doctor's advice.
      In case of emergency, visit the nearest hospital immediately.
    </div>
    <div class="footer">
      Medi Meet | Confidential medical document | Do not share publicly
    </div>
  </main>
</body>
</html>`;
};

module.exports = buildPrescriptionTemplate;
