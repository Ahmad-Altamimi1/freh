import 'server-only';

import ExcelJS from 'exceljs';

import { formatDateAr } from '@/lib/format';
import type { Organization } from './types';

/**
 * Writing organizations workbooks — the export and the blank import template.
 *
 * Three things every sheet here gets right, because getting them wrong is what
 * makes an Arabic export unusable:
 *
 *  - `rightToLeft: true` on the view, so column A opens on the right.
 *  - The mobile column formatted as text (`@`). Written as a number, Excel
 *    strips the leading zero on open and the file is wrong the moment it is
 *    seen — the very defect this import exists to repair.
 *  - Headers matching what the importer accepts, so an exported file can be
 *    edited and imported straight back.
 */

/**
 * Column order shared by the export and the template.
 *
 * Headers are the Arabic labels, not the original Access names. The importer's
 * alias table accepts both, so an exported file re-imports unchanged — and a
 * single readable header row avoids the trap of a second, decorative header row
 * that the importer would read back as a row of data named "اسم الجمعية".
 */
const COLUMNS = [
  { header: 'اسم الجمعية', key: 'name', width: 46 },
  { header: 'اللواء', key: 'district', width: 18 },
  { header: 'التصنيف', key: 'classification', width: 20 },
  { header: 'الرقم الوطني', key: 'nationalId', width: 16 },
  { header: 'تاريخ التأسيس', key: 'establishedAt', width: 16 },
  { header: 'اسم المدير', key: 'directorName', width: 30 },
  { header: 'رقم الهاتف', key: 'mobile', width: 15 },
  { header: 'التسلسل', key: 'serialNo', width: 10 }
] as const;

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFEFEFEF' }
};

function applyHeaderStyling(sheet: ExcelJS.Worksheet, rowCount: number): void {
  sheet.views = [{ rightToLeft: true, state: 'frozen', ySplit: 1 }];

  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.alignment = { vertical: 'middle', horizontal: 'center' };
  header.eachCell((cell) => {
    cell.fill = HEADER_FILL;
  });

  // Autofilter over the header only when there is data beneath it — Excel
  // reports a corrupt file for a filter range that covers no rows.
  if (rowCount > 0) {
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: rowCount + 1, column: COLUMNS.length }
    };
  }
}

function configureColumns(sheet: ExcelJS.Worksheet): void {
  sheet.columns = COLUMNS.map((column) => ({
    header: column.header,
    key: column.key,
    width: column.width
  }));

  // Text format on the columns whose values are digit strings, not quantities.
  // Without this Excel right-aligns them as numbers and drops the leading zero.
  for (const key of ['mobile', 'nationalId'] as const) {
    const column = sheet.getColumn(key);
    column.numFmt = '@';
    column.alignment = { horizontal: 'left' };
  }
}

function toRow(organization: Organization) {
  return {
    name: organization.name,
    district: organization.district,
    classification: organization.classification ?? '',
    nationalId: organization.nationalId ?? '',
    establishedAt: organization.establishedAt ?? '',
    directorName: organization.directorName ?? '',
    mobile: organization.mobile ?? '',
    serialNo: organization.serialNo ?? ''
  };
}

/** One `field: value` line per applied condition, for the criteria sheet. */
export type AppliedFilterLine = { label: string; value: string };

/**
 * Builds the export workbook: the matching rows, plus a sheet recording the
 * filter that produced them.
 *
 * The second sheet is not decoration. An exported spreadsheet outlives the URL
 * that generated it, and a list of 16 societies with no statement of what was
 * asked for is a number nobody can defend later.
 */
export async function buildOrganizationsExport({
  organizations,
  appliedFilters,
  generatedAt
}: {
  organizations: Organization[];
  appliedFilters: AppliedFilterLine[];
  generatedAt: Date;
}): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'سجل الجمعيات';
  workbook.created = generatedAt;

  const sheet = workbook.addWorksheet('النتائج', { views: [{ rightToLeft: true }] });
  configureColumns(sheet);

  for (const organization of organizations) {
    sheet.addRow(toRow(organization));
  }

  applyHeaderStyling(sheet, organizations.length);

  const criteria = workbook.addWorksheet('معايير التصفية', {
    views: [{ rightToLeft: true }]
  });
  criteria.columns = [
    { header: 'المعيار', key: 'label', width: 28 },
    { header: 'القيمة', key: 'value', width: 60 }
  ];
  criteria.getRow(1).font = { bold: true };

  criteria.addRow({ label: 'تاريخ إنشاء التقرير', value: formatDateAr(generatedAt) });
  criteria.addRow({ label: 'عدد النتائج', value: String(organizations.length) });

  if (appliedFilters.length === 0) {
    criteria.addRow({ label: 'المعايير', value: 'بدون تصفية — السجل بالكامل' });
  } else {
    for (const line of appliedFilters) {
      criteria.addRow({ label: line.label, value: line.value });
    }
  }

  return (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
}

/**
 * A blank workbook carrying the headers the importer recognises, plus one
 * example row.
 *
 * The example is the fastest way to communicate the two formats that are easy to
 * get wrong — an ISO date, and a mobile number that keeps its leading zero.
 */
export async function buildOrganizationsTemplate(): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'سجل الجمعيات';

  const sheet = workbook.addWorksheet('البيانات', { views: [{ rightToLeft: true }] });
  configureColumns(sheet);

  sheet.addRow({
    name: 'جمعية المثال الثقافية',
    district: 'قصبة اربد',
    classification: 'نشاطات متنوعة',
    nationalId: '420000000',
    establishedAt: '2010-05-01',
    directorName: 'اسم المدير الكامل',
    mobile: '0790000000',
    serialNo: 1
  });

  applyHeaderStyling(sheet, 1);

  const notes = workbook.addWorksheet('تعليمات', { views: [{ rightToLeft: true }] });
  notes.columns = [{ header: 'ملاحظات', key: 'note', width: 90 }];
  notes.getRow(1).font = { bold: true };
  [
    'الصف الأول يحتوي أسماء الأعمدة — لا تحذفه.',
    'الصف الثاني مثال توضيحي — احذفه قبل الاستيراد أو استبدله ببياناتك.',
    'الأعمدة المطلوبة: «اسم الجمعية» و«اللواء». باقي الأعمدة اختيارية.',
    'يقبل الاستيراد أيضًا أسماء الأعمدة الأصلية من قاعدة البيانات: Org_Name وOrg_stat وغيرها.',
    'تاريخ التأسيس بصيغة YYYY-MM-DD.',
    'رقم الهاتف بصيغة 07XXXXXXXX — احرص على بقاء الصفر في البداية (العمود منسّق كنص).',
    'الرقم الوطني ليس فريدًا: قد تشترك جمعيتان في نفس الرقم، والمطابقة تتم بالرقم مع الاسم معًا.'
  ].forEach((note) => notes.addRow({ note }));

  return (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
}
