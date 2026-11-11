import unittest
from datetime import date
from types import SimpleNamespace
from unittest.mock import MagicMock
from pydantic import ValidationError
from app.schemas import WorkSchedule, EmployeeUpdate, EmployeeCreate
from app.services.work_schedule import scheduled_mode
from app.routers.employees import update_employee, create_employee

REMOTE = ['remote'] * 5 + ['off', 'off']


class WorkScheduleTests(unittest.TestCase):
    def schedule(self, weeks=None):
        first = ['office', 'remote', 'office', 'remote', 'remote', 'off', 'off']
        return WorkSchedule(starts_on=date(2026, 11, 9), weeks=weeks or [first])

    def test_two_office_days_repeat_weekly(self):
        schedule = self.schedule().model_dump(mode='json')
        self.assertEqual(scheduled_mode(schedule, date(2026, 11, 9)), 'office')
        self.assertEqual(scheduled_mode(schedule, date(2026, 11, 10)), 'remote')
        self.assertEqual(scheduled_mode(schedule, date(2026, 11, 11)), 'office')
        self.assertEqual(scheduled_mode(schedule, date(2026, 11, 14)), 'off')
        self.assertEqual(scheduled_mode(schedule, date(2026, 11, 16)), 'office')

    def test_alternate_weeks_repeat_across_year(self):
        schedule = WorkSchedule(starts_on=date(2026, 12, 21), weeks=[['office'] * 5 + ['off'] * 2, REMOTE]).model_dump(mode='json')
        self.assertEqual(scheduled_mode(schedule, date(2026, 12, 28)), 'remote')
        self.assertEqual(scheduled_mode(schedule, date(2027, 1, 4)), 'office')
        self.assertIsNone(scheduled_mode(schedule, date(2026, 12, 20)))
        self.assertIsNone(scheduled_mode(None, date(2026, 12, 20)))

    def test_reject_invalid_patterns(self):
        for weeks in [[], [REMOTE] * 3, [['office']], [['unknown'] * 7]]:
            with self.assertRaises(ValidationError):
                self.schedule(weeks=weeks if weeks else [[]])
        with self.assertRaises(ValidationError):
            WorkSchedule(starts_on=date(2026, 11, 10), weeks=[REMOTE])

    def test_update_serializes_dates_and_clear_is_explicit(self):
        db = MagicMock()
        employee = SimpleNamespace(work_schedule=None, name='Employee')
        db.get.return_value = employee
        update_employee('id', EmployeeUpdate(work_schedule=self.schedule()), db, None)
        self.assertEqual(employee.work_schedule['starts_on'], '2026-11-09')
        saved = employee.work_schedule
        update_employee('id', EmployeeUpdate(name='Changed'), db, None)
        self.assertEqual(employee.work_schedule, saved)
        update_employee('id', EmployeeUpdate(work_schedule=None), db, None)
        self.assertIsNone(employee.work_schedule)

    def test_create_serializes_schedule(self):
        db = MagicMock()
        employee = create_employee(EmployeeCreate(name='Employee', work_schedule=self.schedule()), db, None)
        self.assertEqual(employee.work_schedule['starts_on'], '2026-11-09')
        db.commit.assert_called_once()


if __name__ == '__main__':
    unittest.main()
