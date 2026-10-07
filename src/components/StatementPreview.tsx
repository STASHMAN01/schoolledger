/**
 * A fee statement as a parent receives it, redrawn as HTML for the landing
 * page. It follows the real PDF from src/lib/billing/statementPdf.ts line
 * for line: school header, "Statement of account — <year>", the child and
 * their class and parent, the Charge / Due / Paid / Paid on / Status
 * table oldest first (one-time charges like a trip sort to the start of
 * the year, as they do in the PDF), then Total charged, Total paid and
 * Outstanding. Amounts use the PDF's own format (R1050.00).
 *
 * Sample data only — the same family as the reminder demo above it
 * (Lerato Mokoena, Baby Bees, R1,050 outstanding), so the two panels tell
 * one story. Captioned as a sample wherever it's used.
 *
 * The page itself stays white in dark mode on purpose: it's a picture of
 * a printed document. Its rules use inline border colours because
 * globals.css sets an unlayered `* { border-color: var(--border) }`,
 * which outranks Tailwind's border-colour utilities.
 */

const RULE_DARK = { borderColor: "#292524" };
const RULE_LIGHT = { borderColor: "#d6d3d1" };

const ROWS = [
  { charge: "Zoo trip", due: "R120.00", paid: "R120.00", paidOn: "3 Feb 2026", status: "PAID" },
  { charge: "Jul Fees", due: "R1050.00", paid: "R1050.00", paidOn: "3 Jul 2026", status: "PAID" },
  { charge: "Aug Fees", due: "R1050.00", paid: "R1050.00", paidOn: "4 Aug 2026", status: "PAID" },
  { charge: "Sep Fees", due: "R1050.00", paid: "R1050.00", paidOn: "2 Sep 2026", status: "PAID" },
  { charge: "Oct Fees", due: "R1050.00", paid: "R0.00", paidOn: "—", status: "OUTSTANDING" },
];

export function StatementPreview() {
  return (
    <div className="overflow-hidden rounded-2xl border bg-white p-5 text-stone-900 shadow-[var(--shadow-lift)] sm:p-7">
      <p className="text-lg font-bold">School Demo</p>
      <p className="mt-0.5 text-[11px] text-stone-500">Banking details: Sample Bank 000 000 0000</p>
      <div className="mt-3 border-t-2 pt-3" style={RULE_DARK}>
        <p className="text-base font-bold">Statement of account — 2026</p>
      </div>

      <p className="mt-5 text-sm font-bold">Lerato Mokoena</p>
      <p className="text-[11px] text-stone-500">Baby Bees · Parent/guardian: Thandi Mokoena</p>

      <table className="mt-3 w-full border-collapse text-left text-[11px] sm:text-xs">
        <thead>
          <tr className="border-b" style={RULE_LIGHT}>
            <th className="py-1.5 pr-2 font-bold">Charge</th>
            <th className="py-1.5 pr-2 font-bold">Due</th>
            <th className="py-1.5 pr-2 font-bold">Paid</th>
            <th className="hidden py-1.5 pr-2 font-bold sm:table-cell">Paid on</th>
            <th className="py-1.5 font-bold">Status</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {ROWS.map((row) => (
            <tr key={row.charge}>
              <td className="py-1.5 pr-2">{row.charge}</td>
              <td className="py-1.5 pr-2">{row.due}</td>
              <td className="py-1.5 pr-2">{row.paid}</td>
              <td className="hidden py-1.5 pr-2 text-stone-600 sm:table-cell">{row.paidOn}</td>
              <td
                className={`py-1.5 text-[10px] tracking-wide ${
                  row.status === "PAID" ? "text-stone-600" : "font-bold text-red-700"
                }`}
              >
                {row.status}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 border-t pt-3 text-xs tabular-nums" style={RULE_LIGHT}>
        <p>Total charged: R4320.00</p>
        <p>Total paid: R3270.00</p>
        <p className="col-span-2 text-sm font-bold">Outstanding: R1050.00</p>
      </div>
    </div>
  );
}
