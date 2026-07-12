const fs = require('fs/promises');
const path = require('path');
const XLSX = require('xlsx');
const fontkit = require('@pdf-lib/fontkit');
const { PDFDocument, rgb } = require('pdf-lib');

const assetsRoot = path.join(__dirname, '..', 'assets', 'certificate-generator');

function normalizeHeader(value) {
  return String(value || '').trim().replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function readParticipantNames(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!worksheet) throw new Error('The first worksheet is empty.');

  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false })
    .map((row) => row.map((value) => String(value || '').trim()));
  const firstUsedIndex = rows.findIndex((row) => row.some(Boolean));
  if (firstUsedIndex < 0) throw new Error('The first worksheet is empty.');

  const headers = rows[firstUsedIndex].map(normalizeHeader);
  const nameIndex = headers.indexOf('name');
  let names;

  if (nameIndex >= 0) {
    names = rows.slice(firstUsedIndex + 1).map((row) => row[nameIndex]).filter(Boolean);
  } else {
    const firstIndex = headers.findIndex((value) => ['firstname', 'first', 'givenname'].includes(value));
    const lastIndex = headers.findIndex((value) => ['lastname', 'last', 'familyname', 'surname'].includes(value));
    if (firstIndex >= 0 && lastIndex >= 0) {
      names = rows.slice(firstUsedIndex + 1)
        .map((row) => [row[firstIndex], row[lastIndex]].filter(Boolean).join(' ').trim())
        .filter(Boolean);
    } else {
      const width = Math.max(...rows.map((row) => row.length));
      const populatedColumns = Array.from({ length: width }, (_, column) => column)
        .filter((column) => rows.some((row) => row[column]));
      if (populatedColumns.length < 1 || populatedColumns.length > 2) {
        throw new Error('The first worksheet must contain a Name column, first and last name columns, or one/two populated columns.');
      }
      names = rows
        .map((row) => populatedColumns.map((column) => row[column]).filter(Boolean).join(' ').trim())
        .filter((value) => value && !value.endsWith(':') && !/certificate names/i.test(value));
    }
  }

  if (!names.length) throw new Error('The Excel file contains no valid participant names.');
  return names;
}

function fitFontSize(font, text, maxSize, minSize, width) {
  for (let size = maxSize; size >= minSize; size -= 0.5) {
    if (font.widthOfTextAtSize(text, size) <= width) return size;
  }
  return minSize;
}

function drawCentered(page, text, font, size, x, y, width) {
  const textWidth = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: x + Math.max(0, (width - textWidth) / 2), y, size, font, color: rgb(0, 0, 0) });
}

async function generateCertificates({ excelBuffer, programName, certificateDate }) {
  const names = readParticipantNames(excelBuffer);
  const [templateBytes, nameFontBytes, regularFontBytes, boldFontBytes] = await Promise.all([
    fs.readFile(path.join(assetsRoot, 'Template', 'certificate-template.pdf')),
    fs.readFile(path.join(assetsRoot, 'Fonts', 'Quattrocento-Regular.ttf')),
    fs.readFile(path.join(assetsRoot, 'Fonts', 'OpenSans-Regular.ttf')),
    fs.readFile(path.join(assetsRoot, 'Fonts', 'OpenSans-Bold.ttf'))
  ]);
  const template = await PDFDocument.load(templateBytes);
  const output = await PDFDocument.create();
  output.registerFontkit(fontkit);
  const [nameFont, regularFont, boldFont] = await Promise.all([
    output.embedFont(nameFontBytes), output.embedFont(regularFontBytes), output.embedFont(boldFontBytes)
  ]);
  const sourcePage = template.getPage(0);
  const embeddedTemplate = await output.embedPage(sourcePage);
  const dateLabel = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${certificateDate}T00:00:00Z`));

  for (const participantName of names) {
    const page = output.addPage([sourcePage.getWidth(), sourcePage.getHeight()]);
    page.drawPage(embeddedTemplate, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
    const height = page.getHeight();

    page.drawRectangle({ x: 155, y: height - 295 - 58, width: 535, height: 58, color: rgb(1, 1, 1) });
    const nameSize = fitFontSize(nameFont, participantName, 53.33, 26, 535);
    drawCentered(page, participantName, nameFont, nameSize, 155, height - 288 - 48, 535);

    page.drawRectangle({ x: 172, y: height - 388 - 42, width: 494, height: 42, color: rgb(1, 1, 1) });
    const prefix = `6 hours of ${programName} by the `;
    const suffix = 'LRCY';
    const programSize = fitFontSize(boldFont, prefix + suffix, 26.66, 12, 494);
    const totalWidth = boldFont.widthOfTextAtSize(prefix + suffix, programSize);
    const startX = 172 + Math.max(0, (494 - totalWidth) / 2);
    const programY = height - 386 - 26;
    page.drawText(prefix, { x: startX, y: programY, size: programSize, font: boldFont, color: rgb(0, 0, 0) });
    page.drawText(suffix, { x: startX + boldFont.widthOfTextAtSize(prefix, programSize), y: programY, size: programSize, font: boldFont, color: rgb(238 / 255, 34 / 255, 34 / 255) });

    page.drawRectangle({ x: 540, y: height - 482 - 30, width: 172, height: 30, color: rgb(1, 1, 1) });
    drawCentered(page, dateLabel, regularFont, 16, 584, height - 479 - 15, 110);
    page.drawLine({ start: { x: 545, y: height - 506 }, end: { x: 709, y: height - 506 }, thickness: 0.8, color: rgb(0, 0, 0) });
  }

  return { bytes: await output.save(), count: names.length };
}

module.exports = { generateCertificates, readParticipantNames };
