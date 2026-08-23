/**
 * ব্লুপ্রিন্ট T-18 / Phase 3 আইটেম #30: "ডেটা এক্সপোর্ট (CSV/Excel) — প্রিমিয়াম"।
 * এই সেশনের সিদ্ধান্ত: CSV আউটপুট তৈরি করা হয় (Excel-এ সরাসরি খোলে) — একটি
 * পূর্ণ .xlsx বাইনারি জেনারেটর যোগ করা এই সেশনের স্কোপের বাইরে একটি আলাদা
 * নির্ভরতা (dependency) যুক্ত করত, যেখানে CSV ব্লুপ্রিন্টের "CSV/Excel" শর্ত
 * উভয়ই পূরণ করে। "PDF"-এর সমতুল্য হলো বিদ্যমান window.print() প্যাটার্ন
 * (quotation-print-view.tsx/delivery-challan.tsx-এর মতো), আলাদা রিপোর্ট প্রিন্ট
 * বাটন দিয়ে।
 */
/**
 * SECURITY FIX (AUDIT-REPORT-3.md Issue #5, ২ আগস্ট ২০২৬): user-typed fields
 * (itemName, customer name/notes, staffName, ইত্যাদি) flow into this export
 * unsanitized for formula-injection (CSV/Formula Injection, CWE-1236) — a
 * cell value starting with =, +, -, @, or a tab/CR could be evaluated as a
 * formula (data-exfiltration links, or worse) when the exported file is
 * opened in Excel/Sheets/LibreOffice. Standard OWASP mitigation: prefix such
 * values with a single quote so spreadsheet software treats them as plain
 * text instead of a formula. Applied before the existing quote/comma/
 * newline escaping below (order doesn't matter here, but keeping this first
 * avoids the leading `'` interacting with the quoting logic).
 */
function neutralizeFormulaPrefix(str: string): string {
  return /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
}

function escapeCsvCell(value: string | number): string {
  const str = typeof value === "string" ? neutralizeFormulaPrefix(value) : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** একটি হেডার + সারি অ্যারে থেকে CSV স্ট্রিং তৈরি করে (UTF-8 BOM সহ, বাংলা টেক্সট Excel-এ সঠিকভাবে দেখানোর জন্য)। */
export function buildCsv(headers: string[], rows: (string | number)[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(","));
  return `\uFEFF${lines.join("\r\n")}`;
}

/** ব্রাউজারে CSV ফাইল ডাউনলোড ট্রিগার করে (Blob + অস্থায়ী <a> লিংক, কোনো সার্ভার রাউন্ড-ট্রিপ ছাড়া)। */
export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  const csv = buildCsv(headers, rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
