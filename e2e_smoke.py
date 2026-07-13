"""End-to-end smoke test against a real Postgres, with Google verify stubbed.
Run:  python e2e_smoke.py   (expects DATABASE_URL + JWT_SECRET + GOOGLE_WEB_CLIENT_ID set)
"""
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models import Agency, Employee

client = TestClient(app)


def as_google(sub, email, name):
    return {"sub": sub, "email": email, "name": name}


# Seed: an agency (no subnet restriction) + a pre-registered employee by email.
db = SessionLocal()
agency = Agency(name="HQ", network_config={"allowed_subnets": []})
db.add(agency)
db.flush()
db.add(Employee(name="Pre Reg", email="worker@acme.com", agency_id=agency.id))
db.commit()
agency_id = str(agency.id)
db.close()

# 1. First admin sign-in -> becomes super_admin
with patch("app.routers.auth.verify_google_id_token",
           return_value=as_google("admin-sub-1", "boss@acme.com", "Boss")):
    r = client.post("/auth/google/admin", json={"id_token": "x"})
assert r.status_code == 200, r.text
admin_tok = r.json()["access_token"]
me = client.get("/auth/me", headers={"Authorization": f"Bearer {admin_tok}"}).json()
assert me["type"] == "admin" and me["role"] == "super_admin", me
print("1. First admin -> super_admin  OK")

# 2. Employee sign-in claims the pre-registered row (same email)
with patch("app.routers.auth.verify_google_id_token",
           return_value=as_google("emp-sub-1", "worker@acme.com", "Worker")):
    r = client.post("/auth/google/employee", json={"id_token": "x"})
assert r.status_code == 200, r.text
emp_tok = r.json()["access_token"]
emp_hdr = {"Authorization": f"Bearer {emp_tok}"}
me = client.get("/auth/me", headers=emp_hdr).json()
assert me["type"] == "employee", me
# claimed, not duplicated
db = SessionLocal()
assert db.query(Employee).filter_by(email="worker@acme.com").count() == 1
db.close()
print("2. Employee claims pre-registered row (no dupe)  OK")

# 3. Clock in (agency has no subnet restriction -> allowed), then again = idempotent
r = client.post("/attendance/clock-in", json={}, headers=emp_hdr)
assert r.status_code == 200, r.text
rec1 = r.json()
r = client.post("/attendance/clock-in", json={}, headers=emp_hdr)
assert r.json()["id"] == rec1["id"], "clock-in not idempotent"
print(f"3. Clock-in idempotent (status={rec1['status']})  OK")

# 4. Clock out -> total_hours computed, second clock-out conflicts
r = client.post("/attendance/clock-out", headers=emp_hdr)
assert r.status_code == 200, r.text
assert r.json()["clock_out_time"] and r.json()["total_hours"] is not None
r2 = client.post("/attendance/clock-out", headers=emp_hdr)
assert r2.status_code == 409, r2.status_code
print("4. Clock-out computes hours; double clock-out -> 409  OK")

# 5. Employee token rejected on an admin endpoint
r = client.get("/employees", headers=emp_hdr)
assert r.status_code == 403, r.status_code
r = client.get("/employees", headers={"Authorization": f"Bearer {admin_tok}"})
assert r.status_code == 200 and len(r.json()) >= 1
print("5. Role gate: employee->403 on /employees, admin->200  OK")

# 6. Network gate: agency WITH a subnet, wrong IP -> 403
db = SessionLocal()
a2 = Agency(name="Locked", network_config={"allowed_subnets": ["192.168."]})
db.add(a2); db.flush()
db.add(Employee(name="Net Emp", email="net@acme.com", agency_id=a2.id))
db.commit(); db.close()
with patch("app.routers.auth.verify_google_id_token",
           return_value=as_google("emp-sub-2", "net@acme.com", "Net")):
    net_tok = client.post("/auth/google/employee", json={"id_token": "x"}).json()["access_token"]
net_hdr = {"Authorization": f"Bearer {net_tok}"}
r = client.post("/attendance/clock-in", json={"local_ip": "10.0.0.9"}, headers=net_hdr)
assert r.status_code == 403, r.status_code
r = client.post("/attendance/clock-in", json={"local_ip": "192.168.1.5"}, headers=net_hdr)
assert r.status_code == 200, r.text
print("6. Network gate: off-subnet->403, on-subnet->200  OK")

# 7. Overview reflects the two clock-ins today
r = client.get("/reports/overview", headers={"Authorization": f"Bearer {admin_tok}"})
o = r.json()
assert o["employees"] == 2 and o["agencies"] == 2, o
print(f"7. Overview metrics {o}  OK")

# 8. Second admin defaults to front_desk (least privilege), can't manage users
with patch("app.routers.auth.verify_google_id_token",
           return_value=as_google("admin-sub-2", "temp@acme.com", "Temp")):
    fd_tok = client.post("/auth/google/admin", json={"id_token": "x"}).json()["access_token"]
r = client.get("/profiles", headers={"Authorization": f"Bearer {fd_tok}"})
assert r.status_code == 403, r.status_code
r = client.get("/profiles", headers={"Authorization": f"Bearer {admin_tok}"})
assert r.status_code == 200 and len(r.json()) == 2
print("8. 2nd admin=front_desk (403 on /profiles); super_admin sees 2  OK")

print("\nALL E2E CHECKS PASSED")
