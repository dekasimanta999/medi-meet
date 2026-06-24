const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const buildPrescriptionTemplate = require('../templates/prescriptionTemplate');

const PRESCRIPTION_DIR = path.resolve(__dirname, '../private/medical_records/prescriptions');

const ensurePrescriptionDir = async () => {
  await fs.promises.mkdir(PRESCRIPTION_DIR, { recursive: true });
};

const safeFileName = (value) =>
  String(value || '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120);

const generatePrescriptionPDF = async ({ data, appointmentId, patientId }) => {
  await ensurePrescriptionDir();

  const timestamp = Date.now();
  const fileName = `prescription_${safeFileName(appointmentId)}_${safeFileName(patientId)}_${timestamp}.pdf`;
  const absolutePath = path.join(PRESCRIPTION_DIR, fileName);
  const resolvedPath = path.resolve(absolutePath);

  if (!resolvedPath.startsWith(PRESCRIPTION_DIR + path.sep)) {
    throw new Error('Invalid prescription file path.');
  }

  const html = buildPrescriptionTemplate(data);
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.pdf({
      path: resolvedPath,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
    });
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  const stat = await fs.promises.stat(resolvedPath);

  return {
    fileName,
    relativePath: `prescriptions/${fileName}`,
    absolutePath: resolvedPath,
    size: stat.size,
    mimeType: 'application/pdf',
  };
};

module.exports = {
  generatePrescriptionPDF,
  PRESCRIPTION_DIR,
};
