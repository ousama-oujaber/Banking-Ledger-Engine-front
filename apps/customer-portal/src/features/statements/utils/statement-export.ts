import { AccountStatement } from '../types';

export function generateStatementCsv(statement: AccountStatement): string {
  const metaLines = [
    `"Account ID","${statement.accountId}"`,
    `"Period","${statement.fromDate} to ${statement.toDate}"`,
    `"Currency","${statement.currency}"`,
    `"Opening Balance","${statement.openingBalance.format()}"`,
    `"Closing Balance","${statement.closingBalance.format()}"`,
    `"Total Debits","${statement.totalDebits.format()}"`,
    `"Total Credits","${statement.totalCredits.format()}"`,
    `"Generated At","${statement.generatedAt}"`,
    '',
    '"Entry ID","Entry Date","Value Date","Reference","Description","Debit","Credit","Running Balance"',
  ];

  const rowLines = statement.entries.map((entry) => {
    const debit = entry.debitAmount.isZero() ? '' : entry.debitAmount.amount.toFixed(2);
    const credit = entry.creditAmount.isZero() ? '' : entry.creditAmount.amount.toFixed(2);
    const running = entry.runningBalance.amount.toFixed(2);

    const safeDesc = (entry.description || '').replace(/"/g, '""');
    const safeRef = (entry.reference || '').replace(/"/g, '""');

    return `"${entry.entryId}","${entry.entryDate}","${entry.valueDate}","${safeRef}","${safeDesc}","${debit}","${credit}","${running}"`;
  });

  return [...metaLines, ...rowLines].join('\n');
}

export function triggerDownload(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadStatementCsv(statement: AccountStatement): void {
  const csv = generateStatementCsv(statement);
  const filename = `statement-${statement.accountId}-${statement.fromDate}-to-${statement.toDate}.csv`;
  triggerDownload(csv, filename, 'text/csv;charset=utf-8;');
}

export function downloadStatementJson(statement: AccountStatement): void {
  const exportPayload = {
    ...statement,
    openingBalance: statement.openingBalance.format(),
    closingBalance: statement.closingBalance.format(),
    totalCredits: statement.totalCredits.format(),
    totalDebits: statement.totalDebits.format(),
    entries: statement.entries.map((e) => ({
      ...e,
      debitAmount: e.debitAmount.format(),
      creditAmount: e.creditAmount.format(),
      runningBalance: e.runningBalance.format(),
    })),
  };

  const jsonStr = JSON.stringify(exportPayload, null, 2);
  const filename = `statement-${statement.accountId}-${statement.fromDate}-to-${statement.toDate}.json`;
  triggerDownload(jsonStr, filename, 'application/json');
}
