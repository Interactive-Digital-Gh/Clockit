"""Run: python -m unittest discover -s tests (from Backend)."""
import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from fastapi import HTTPException
from pydantic import ValidationError
from app.routers import attendance as routes
from app.schemas import ClockInRequest, AttendanceQrSettingsUpdate


class QrAttendanceTests(unittest.TestCase):
    def test_response_includes_remaining_lifetime(self):
        qr = SimpleNamespace(token="test", created_at=datetime.now(timezone.utc) - timedelta(seconds=10), rotated_by="auto")
        with patch.object(routes, '_get_qr_settings', return_value=SimpleNamespace(rotation_seconds=30)):
            result = routes._qr_response(MagicMock(), qr)
            self.assertGreater(result.expires_in_seconds, 19)
            self.assertLessEqual(result.expires_in_seconds, 20)
        with patch.object(routes, '_get_qr_settings', return_value=SimpleNamespace(rotation_seconds=None)):
            self.assertIsNone(routes._qr_response(MagicMock(), qr).expires_in_seconds)

    def test_seconds_range_and_manual(self):
        for value in [None, 1, 30, 900, 86400]:
            self.assertEqual(AttendanceQrSettingsUpdate(rotation_seconds=value).rotation_seconds, value)
        for value in [0, -1, 86401, 1.5]:
            with self.assertRaises(ValidationError):
                AttendanceQrSettingsUpdate(rotation_seconds=value)

    def invoke_clock_in(self, endpoint, token):
        employee = SimpleNamespace(id="employee", agency=None)
        request = SimpleNamespace(headers={}, client=SimpleNamespace(host="203.0.113.1"))
        if endpoint == routes.clock_in:
            return endpoint(ClockInRequest(qr_token=token), request, MagicMock(), employee)
        return endpoint(ClockInRequest(qr_token=token), request, MagicMock(), SimpleNamespace())

    def test_valid_qr_is_onsite_without_gps_or_agency(self):
        for endpoint in [routes.clock_in, routes.my_clock_in_as_profile]:
            with self.subTest(endpoint=endpoint.__name__), patch.object(routes, '_current_qr_autorotate', return_value=SimpleNamespace(token='valid')), patch.object(routes.svc, 'get_or_create_employee_for_profile', return_value=SimpleNamespace(id='employee', agency=None)), patch.object(routes.svc, 'clock_in') as save:
                self.invoke_clock_in(endpoint, 'valid')
                self.assertTrue(save.call_args.kwargs['location_verified'])
                self.assertEqual(save.call_args.kwargs['verification_source'], 'office_qr')
                self.assertEqual(save.call_args.kwargs['verification_method'], 'qr')

    def test_invalid_qr_never_writes_attendance(self):
        for endpoint in [routes.clock_in, routes.my_clock_in_as_profile]:
            with self.subTest(endpoint=endpoint.__name__), patch.object(routes, '_current_qr_autorotate', return_value=SimpleNamespace(token='current')), patch.object(routes.svc, 'get_or_create_employee_for_profile', return_value=SimpleNamespace(id='employee', agency=None)), patch.object(routes.svc, 'clock_in') as save:
                with self.assertRaises(HTTPException) as result:
                    self.invoke_clock_in(endpoint, 'expired')
                self.assertEqual(result.exception.status_code, 409)
                save.assert_not_called()

    def test_manual_without_location_stays_remote(self):
        with patch.object(routes.svc, 'clock_in') as save, patch.object(routes, '_current_qr_autorotate') as qr:
            self.invoke_clock_in(routes.clock_in, None)
            qr.assert_not_called()
            self.assertFalse(save.call_args.kwargs['location_verified'])
            self.assertEqual(save.call_args.kwargs['verification_method'], 'manual')

    def test_rotation_uses_seconds_not_minutes(self):
        for age, rotates in [(29, False), (31, True)]:
            db = MagicMock()
            db.scalar.return_value = SimpleNamespace(rotation_seconds=30)
            old = SimpleNamespace(created_at=datetime.now(timezone.utc) - timedelta(seconds=age))
            with patch.object(routes, '_current_qr', return_value=old):
                result = routes._current_qr_autorotate(db)
            self.assertEqual(db.add.called, rotates)
            self.assertEqual(result is old, not rotates)


if __name__ == '__main__':
    unittest.main()
