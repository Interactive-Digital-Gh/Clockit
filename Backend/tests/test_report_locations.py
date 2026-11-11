import unittest
from datetime import date
from types import SimpleNamespace as Obj
from unittest.mock import patch, MagicMock
from app.services.report_locations import build_location_rows, recorded_location
from app.services.report_email import build_report, render_csv, render_html, render_text

class ReportLocationTests(unittest.TestCase):
    def employee(self):
        return Obj(id='1', name='Test Employee', email='test@example.test', agency=None, work_schedule={'starts_on': '2026-11-09', 'weeks': [['office','remote','off','office','remote','off','off']]})

    def test_missing_office_remote_and_off_duty(self):
        with patch('app.services.report_locations.today', return_value=date(2026,11,11)):
            rows = build_location_rows([self.employee()], [], date(2026,11,9), date(2026,11,12))
        self.assertEqual([r['planned'] for r in rows], ['Office','Remote','Off duty','Office'])
        self.assertEqual([r['check'] for r in rows], ['No clock-in','No clock-in','Not scheduled','Not yet due'])

    def test_mixed_sessions_and_no_schedule(self):
        employee = self.employee()
        record = Obj(employee_id='1', employee=employee, date=date(2026,11,9), sessions=[Obj(location_verified=True),Obj(location_verified=False)])
        self.assertEqual(recorded_location(record), 'Mixed on-site / unverified')
        record.sessions = [Obj(location_verified=False)]
        self.assertEqual(build_location_rows([employee], [record], record.date, record.date)[0]['check'], 'Office expected; unverified')
        employee.work_schedule = None
        self.assertEqual(build_location_rows([employee], [record], record.date, record.date)[0]['planned'], 'Not set')

    def test_renderers_include_roster_and_absence_uses_schedule(self):
        db = MagicMock()
        db.scalars.side_effect = [Obj(all=lambda: [self.employee()]), Obj(all=lambda: []), []]
        with patch('app.services.report_email.today_utc', return_value=date(2026,11,11)):
            report = build_report(db, date(2026,11,9), date(2026,11,11))
        self.assertEqual(report.absent_days(report.employees[0]), 2)
        for rendered in [render_csv(report).decode(), render_html(report), render_text(report)]:
            for label in ['Office','Remote','No clock-in','current']:
                self.assertIn(label, rendered)
