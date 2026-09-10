"""Server-side attendance report: build, render (PDF/HTML/CSV), and email.

The PDF mirrors the format ID has been producing by hand — arrival-time band
distribution (early / L1 / L2 / L3) with a week-over-week comparison, a
per-employee table of days early/late/present/absent, an interpretation
section, a "late 2+ days" table, and an absentee table.

Lateness bands follow the configured shift start (settings.shift_start_hour /
_minute), matching services/attendance.py's convention of reading the
clock-in timestamp's own wall clock.

One builder powers both the dashboard's on-demand "Email report" action and
the weekly scheduled send.
"""

import csv
import io
from dataclasses import dataclass, field
from datetime import date, timedelta
from html import escape
from math import cos, pi, sin

from fpdf import FPDF
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from ..config import get_settings
from ..models import AttendanceRecord, Employee
from .attendance import today as today_utc
from .mailer import send_email

settings = get_settings()

# Arrival bands. EARLY is anything at/before shift start; the rest mirror the
# bands used in the existing hand-made report.
BAND_LABELS = (
    "Early",
    "L1 (8:31am-9:00am)",
    "L2 (9:01am-10:00am)",
    "L3 (after 10:00am)",
)
BAND_COLORS = ((34, 139, 94), (232, 168, 56), (222, 110, 46), (255, 59, 84))


@dataclass
class EmployeeSummary:
    name: str
    email: str
    agency: str
    early: int = 0
    l1: int = 0
    l2: int = 0
    l3: int = 0
    total_hours: float = 0.0

    @property
    def late_total(self) -> int:
        return self.l1 + self.l2 + self.l3

    @property
    def present(self) -> int:
        return self.early + self.late_total


@dataclass
class Report:
    date_from: date
    date_to: date
    working_days: int = 0
    total_records: int = 0
    total_hours: float = 0.0
    employees: list[EmployeeSummary] = field(default_factory=list)
    # Band counts [early, l1, l2, l3] for this period and the one before it.
    bands: list[int] = field(default_factory=lambda: [0, 0, 0, 0])
    prev_bands: list[int] = field(default_factory=lambda: [0, 0, 0, 0])

    @property
    def late_count(self) -> int:
        return self.bands[1] + self.bands[2] + self.bands[3]

    def absent_days(self, s: EmployeeSummary) -> int:
        return max(self.working_days - s.present, 0)

    @property
    def perfectly_early(self) -> list[EmployeeSummary]:
        """Reported early every working day — the report's headline callout."""
        if not self.working_days:
            return []
        return [s for s in self.employees if s.early == self.working_days]

    @property
    def late_twice_or_more(self) -> list[EmployeeSummary]:
        return [s for s in self.employees if s.late_total >= 2]

    @property
    def absentees(self) -> list[EmployeeSummary]:
        return [s for s in self.employees if self.absent_days(s) > 0]


def working_days_between(start: date, end: date) -> int:
    """Mon-Fri days in the range that have already happened (mirrors the
    dashboard's workingDaysElapsed in app/dashboard/reports/page.tsx)."""
    last = min(end, today_utc())
    if start > last:
        return 0
    days = (last - start).days + 1
    return sum(1 for i in range(days) if (start + timedelta(days=i)).weekday() < 5)


def _band_of(record: AttendanceRecord) -> int:
    """0=early, 1=L1, 2=L2, 3=L3, from the clock-in wall clock."""
    t = record.clock_in_time
    minutes = t.hour * 60 + t.minute
    shift_start = settings.shift_start_hour * 60 + settings.shift_start_minute
    if minutes <= shift_start:
        return 0
    if minutes <= 9 * 60:
        return 1
    if minutes <= 10 * 60:
        return 2
    return 3


def _band_counts(db: Session, date_from: date, date_to: date) -> list[int]:
    counts = [0, 0, 0, 0]
    stmt = select(AttendanceRecord).where(
        AttendanceRecord.date >= date_from, AttendanceRecord.date <= date_to
    )
    for rec in db.scalars(stmt):
        counts[_band_of(rec)] += 1
    return counts


def build_report(db: Session, date_from: date, date_to: date) -> Report:
    report = Report(
        date_from=date_from,
        date_to=date_to,
        working_days=working_days_between(date_from, date_to),
    )

    # Start from the full active roster — employees with no clock-ins at all
    # must still appear (fully absent), which a records-only query would miss.
    employees = db.scalars(
        select(Employee).options(joinedload(Employee.agency)).where(Employee.is_active.is_(True))
    ).all()
    by_id: dict[str, EmployeeSummary] = {
        str(e.id): EmployeeSummary(
            name=e.name,
            email=e.email or "",
            agency=(e.agency.name if e.agency else "") or "",
        )
        for e in employees
    }

    records = db.scalars(
        select(AttendanceRecord)
        .options(joinedload(AttendanceRecord.employee).joinedload(Employee.agency))
        .where(AttendanceRecord.date >= date_from, AttendanceRecord.date <= date_to)
        .order_by(AttendanceRecord.date)
    ).all()

    for rec in records:
        key = str(rec.employee_id)
        summary = by_id.get(key)
        if summary is None:  # inactive/deleted employee with records in range
            emp = rec.employee
            summary = by_id[key] = EmployeeSummary(
                name=emp.name if emp else "Unknown",
                email=(emp.email if emp else None) or "",
                agency=(emp.agency.name if emp and emp.agency else "") or "",
            )
        band = _band_of(rec)
        setattr(summary, ("early", "l1", "l2", "l3")[band], getattr(summary, ("early", "l1", "l2", "l3")[band]) + 1)
        report.bands[band] += 1
        hours = float(rec.total_hours or 0)
        summary.total_hours += hours
        report.total_hours += hours

    report.total_records = len(records)
    report.employees = sorted(by_id.values(), key=lambda s: s.name.lower())

    # Same-length preceding period, for the week-over-week comparison.
    span = (date_to - date_from).days + 1
    report.prev_bands = _band_counts(db, date_from - timedelta(days=span), date_from - timedelta(days=1))
    return report


# --- Renderers ---------------------------------------------------------------
def render_csv(report: Report) -> bytes:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(
        ["Name", "Email", "Agency", "Early", "L1", "L2", "L3", "Late total", "Present", "Absent", "Total hours"]
    )
    for s in report.employees:
        writer.writerow(
            [s.name, s.email, s.agency, s.early, s.l1, s.l2, s.l3,
             s.late_total, s.present, report.absent_days(s), f"{s.total_hours:.2f}"]
        )
    return buf.getvalue().encode()


def _pct(counts: list[int]) -> list[float]:
    total = sum(counts) or 1
    return [c * 100 / total for c in counts]


class _ReportPDF(FPDF):
    """Adds the running header/footer used by the existing ID report."""

    title_line = "INTERACTIVE DIGITAL ATTENDANCE REPORT"
    period_line = ""

    def header(self) -> None:
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(20, 18, 16)
        self.cell(0, 5, self.title_line, new_x="LMARGIN", new_y="NEXT")
        self.set_font("Helvetica", "", 10)
        self.cell(0, 5, self.period_line, new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(220, 220, 220)
        self.line(self.l_margin, self.get_y() + 1, self.w - self.r_margin, self.get_y() + 1)
        self.ln(5)

    def footer(self) -> None:
        self.set_y(-15)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(150, 150, 150)
        self.cell(0, 5, f"Page | {self.page_no()}", align="R")


def _pie(pdf: FPDF, cx: float, cy: float, r: float, counts: list[int]) -> None:
    """Pie chart drawn as polygon slice approximations (fpdf2 has no arc fill)."""
    total = sum(counts)
    if not total:
        pdf.set_fill_color(235, 235, 235)
        pdf.ellipse(cx - r, cy - r, r * 2, r * 2, style="F")
        return
    start = -pi / 2  # 12 o'clock
    for value, color in zip(counts, BAND_COLORS):
        if not value:
            continue
        sweep = 2 * pi * value / total
        steps = max(int(sweep * 24 / pi), 2)
        pts = [(cx, cy)]
        for i in range(steps + 1):
            a = start + sweep * i / steps
            pts.append((cx + r * cos(a), cy + r * sin(a)))
        pdf.set_fill_color(*color)
        pdf.polygon(pts, style="F")
        start += sweep


def _legend(pdf: FPDF, x: float, y: float, counts: list[int]) -> None:
    pdf.set_font("Helvetica", "", 8)
    pcts = _pct(counts)
    for i, (label, color) in enumerate(zip(BAND_LABELS, BAND_COLORS)):
        row_y = y + i * 5
        pdf.set_fill_color(*color)
        pdf.rect(x, row_y, 3, 3, style="F")
        pdf.set_text_color(60, 60, 60)
        pdf.set_xy(x + 5, row_y - 1)
        pdf.cell(45, 5, f"{label}  {pcts[i]:.0f}%")


def _table(pdf: FPDF, widths, headers, rows, aligns) -> None:
    pdf.set_font("Helvetica", "B", 8.5)
    pdf.set_text_color(20, 18, 16)
    pdf.set_draw_color(20, 18, 16)
    for w, h, a in zip(widths, headers, aligns):
        pdf.cell(w, 7, h, border="B", align=a)
    pdf.ln()
    pdf.set_font("Helvetica", "", 8.5)
    pdf.set_draw_color(232, 232, 232)
    for row in rows:
        if pdf.get_y() > pdf.h - 25:
            pdf.add_page()
            pdf.set_font("Helvetica", "B", 8.5)
            pdf.set_draw_color(20, 18, 16)
            for w, h, a in zip(widths, headers, aligns):
                pdf.cell(w, 7, h, border="B", align=a)
            pdf.ln()
            pdf.set_font("Helvetica", "", 8.5)
            pdf.set_draw_color(232, 232, 232)
        for w, value, a in zip(widths, row, aligns):
            pdf.cell(w, 6, str(value), border="B", align=a)
        pdf.ln()


def _heading(pdf: FPDF, text: str) -> None:
    pdf.ln(3)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(20, 18, 16)
    pdf.multi_cell(0, 6, text, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(1)


def _body(pdf: FPDF, text: str) -> None:
    pdf.set_font("Helvetica", "", 9.5)
    pdf.set_text_color(60, 60, 60)
    pdf.multi_cell(0, 5, text, new_x="LMARGIN", new_y="NEXT")


def render_pdf(report: Report) -> bytes:
    period = f"{report.date_from:%d %b} - {report.date_to:%d %b %Y}"
    pdf = _ReportPDF()
    pdf.period_line = period.upper()
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.add_page()

    # --- Outline -------------------------------------------------------------
    _heading(pdf, "REPORT OUTLINE")
    _body(
        pdf,
        "- A graphical presentation showing the time of arrival of team members.\n"
        "- A table giving analysis on days present, indicating days late and days early.\n"
        "- An interpretation of the table.\n"
        "- A table presenting absent days.",
    )

    # --- 1. Arrival distribution --------------------------------------------
    _heading(pdf, "1. ARRIVAL TIMES OF TEAM MEMBERS")
    top = pdf.get_y() + 2
    pdf.set_font("Helvetica", "B", 8.5)
    pdf.set_text_color(20, 18, 16)
    pdf.set_xy(pdf.l_margin, top)
    pdf.cell(90, 5, "CHART 1: THIS PERIOD")
    pdf.set_xy(pdf.l_margin + 95, top)
    pdf.cell(90, 5, "CHART 2: PREVIOUS PERIOD")
    _pie(pdf, pdf.l_margin + 22, top + 30, 20, report.bands)
    _legend(pdf, pdf.l_margin + 48, top + 18, report.bands)
    _pie(pdf, pdf.l_margin + 117, top + 30, 20, report.prev_bands)
    _legend(pdf, pdf.l_margin + 143, top + 18, report.prev_bands)
    pdf.set_y(top + 56)

    # Trend comparison, plainly stated rather than another chart.
    cur, prev = _pct(report.bands), _pct(report.prev_bands)
    if sum(report.prev_bands):
        deltas = []
        for label, c, p in zip(BAND_LABELS, cur, prev):
            diff = c - p
            word = "up" if diff > 0 else "down" if diff < 0 else "unchanged"
            deltas.append(f"{label} {c:.0f}% ({word} {abs(diff):.0f} pts)" if diff else f"{label} {c:.0f}% (unchanged)")
        _body(pdf, "Compared with the previous period: " + "; ".join(deltas) + ".")
    else:
        _body(pdf, "No data for the previous period, so no comparison is shown.")

    # --- 2. Table 1 ----------------------------------------------------------
    _heading(pdf, "2. TABLE 1: DAYS PRESENT, DAYS LATE AND DAYS EARLY")
    _table(
        pdf,
        widths=(52, 16, 16, 16, 16, 18, 20, 18),
        headers=("Team member", "Early", "L1", "L2", "L3", "Late total", "Present", "Absent"),
        rows=[
            (s.name, s.early, s.l1, s.l2, s.l3, s.late_total, s.present, report.absent_days(s))
            for s in report.employees
        ],
        aligns=("L", "R", "R", "R", "R", "R", "R", "R"),
    )

    # --- 3. Interpretation ---------------------------------------------------
    _heading(pdf, "3. INTERPRETATION OF TABLE 1")
    total_emp = len(report.employees) or 1
    _body(pdf, f"The expected number of days to report to work in this period was {report.working_days}.")
    early_all = report.perfectly_early
    if early_all:
        pdf.ln(1)
        _body(
            pdf,
            f"The following, accounting for {len(early_all) * 100 / total_emp:.0f}% of "
            f"{len(report.employees)} team members, reported early consistently throughout the period:",
        )
        _body(pdf, "\n".join(f"- {s.name}" for s in early_all))
    else:
        _body(pdf, "No team member reported early on every working day in this period.")

    late_rows = report.late_twice_or_more
    _heading(pdf, "B. TEAM MEMBERS WHO REPORTED LATE FOR 2 DAYS OR MORE")
    if late_rows:
        _table(
            pdf,
            widths=(70, 26, 26, 26, 26),
            headers=("Team member", "L1", "L2", "L3", "Late total"),
            rows=[(s.name, s.l1, s.l2, s.l3, s.late_total) for s in late_rows],
            aligns=("L", "R", "R", "R", "R"),
        )
    else:
        _body(pdf, "No team member was late on two or more days in this period.")

    # --- 4. Absences ---------------------------------------------------------
    _heading(pdf, "4. TABLE 2: TEAM MEMBERS ABSENT IN THE PERIOD")
    absentees = report.absentees
    if absentees:
        _table(
            pdf,
            widths=(70, 30, 74),
            headers=("Team member", "Number of days", "Reason"),
            rows=[(s.name, report.absent_days(s), "") for s in absentees],
            aligns=("L", "R", "L"),
        )
        pdf.ln(2)
        _body(
            pdf,
            f"{len(absentees)} team members, accounting for {len(absentees) * 100 / total_emp:.0f}% of "
            f"{len(report.employees)} team members, recorded absences during the period under review. "
            "Reasons (leave, work-from-home schedules, approved days off, client events) are not tracked "
            "in Clockit and need to be filled in manually.",
        )
    else:
        _body(pdf, "No absences recorded in this period.")

    return bytes(pdf.output())


def render_html(report: Report, message: str | None = None) -> str:
    message_block = (
        f"<p style='margin:0 0 16px;padding:10px 14px;background:#f6f5f4;border-left:3px solid #141210;"
        f"border-radius:4px;white-space:pre-wrap'>{escape(message)}</p>"
        if message
        else ""
    )
    cell = "padding:6px 10px;border-bottom:1px solid #eee"
    rows = "".join(
        f"<tr><td style='{cell}'>{escape(s.name)}</td>"
        f"<td style='{cell};text-align:right'>{s.early}</td>"
        f"<td style='{cell};text-align:right'>{s.late_total}</td>"
        f"<td style='{cell};text-align:right'>{s.present}</td>"
        f"<td style='{cell};text-align:right'>{report.absent_days(s)}</td></tr>"
        for s in report.employees
    )
    pcts = _pct(report.bands)
    bands = " · ".join(f"{label.split(' ')[0]} {p:.0f}%" for label, p in zip(BAND_LABELS, pcts))
    return f"""
<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;color:#141210;max-width:680px">
  <h2 style="margin:0 0 4px">Attendance report</h2>
  <p style="margin:0 0 16px;color:#666">{report.date_from} to {report.date_to}</p>
  {message_block}
  <p style="margin:0 0 6px">
    <b>{len(report.employees)}</b> team members ·
    <b>{report.working_days}</b> working days ·
    <b>{report.total_records}</b> clock-ins ·
    <b>{report.late_count}</b> late
  </p>
  <p style="margin:0 0 16px;color:#666">Arrival split — {bands}</p>
  <table style="border-collapse:collapse;width:100%;font-size:14px">
    <tr style="text-align:left;border-bottom:2px solid #141210">
      <th style="padding:6px 10px">Team member</th>
      <th style="padding:6px 10px;text-align:right">Early</th>
      <th style="padding:6px 10px;text-align:right">Late</th>
      <th style="padding:6px 10px;text-align:right">Present</th>
      <th style="padding:6px 10px;text-align:right">Absent</th>
    </tr>
    {rows}
  </table>
  <p style="margin:16px 0 0;color:#999;font-size:12px">
    Full report attached as PDF, raw data as CSV · Sent by Clockit
  </p>
</div>
"""


def render_text(report: Report, message: str | None = None) -> str:
    lines = [
        f"Attendance report - {report.date_from} to {report.date_to}",
        *([message, ""] if message else []),
        f"{len(report.employees)} team members, {report.working_days} working days, "
        f"{report.total_records} clock-ins, {report.late_count} late.",
        "",
    ]
    for s in report.employees:
        lines.append(
            f"- {s.name}: {s.early} early, {s.late_total} late, "
            f"{s.present} present, {report.absent_days(s)} absent"
        )
    lines += ["", "Full report attached as PDF, raw data as CSV."]
    return "\n".join(lines)


def send_report(
    db: Session, to: str, date_from: date, date_to: date, message: str | None = None
) -> bool:
    """message: optional personal note from the sender, shown at the top of
    the email body (not in the attachments)."""
    report = build_report(db, date_from, date_to)
    stem = f"attendance_{date_from}_to_{date_to}"
    return send_email(
        to=to,
        subject=f"Clockit attendance report - {date_from} to {date_to}",
        body=render_text(report, message),
        html=render_html(report, message),
        attachments=[
            (f"{stem}.pdf", render_pdf(report), "application/pdf"),
            (f"{stem}.csv", render_csv(report), "text/csv"),
        ],
    )
