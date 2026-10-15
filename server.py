import hashlib
import hmac
import json
import mimetypes
import os
import secrets
import sqlite3
import threading
import time
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parent
DATABASE = Path(os.environ.get("DATABASE_PATH", ROOT / "classhub.db"))
PASSWORD_ITERATIONS = 260_000
SESSION_LIFETIME = 8 * 60 * 60
SESSIONS = {}
SESSIONS_LOCK = threading.Lock()
PUBLIC_FILES = {"index.htm", "login.css", "qwe.css", "asd.js"}


def connect_database():
    connection = sqlite3.connect(DATABASE, timeout=10)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_database():
    with connect_database() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS students (
                id_code TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                course_section TEXT NOT NULL,
                password_salt BLOB NOT NULL,
                password_hash BLOB NOT NULL,
                password_iterations INTEGER NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        for student_id, name, section in (
            ("12-3456", "Stephen", "BSCS-1D"),
            ("26-1234", "Zhieck", "BSIS-1D"),
        ):
            salt = secrets.token_bytes(16)
            password_hash = hashlib.pbkdf2_hmac(
                "sha256", b"1234", salt, PASSWORD_ITERATIONS
            )
            connection.execute(
                """
                INSERT INTO students
                    (id_code, name, course_section, password_salt, password_hash, password_iterations)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(id_code) DO UPDATE SET
                    name = excluded.name,
                    course_section = excluded.course_section
                """,
                (
                    student_id,
                    name,
                    section,
                    salt,
                    password_hash,
                    PASSWORD_ITERATIONS,
                ),
            )


class ClassHubHandler(BaseHTTPRequestHandler):
    server_version = "ClassHub/1.0"

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "same-origin")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_json(self, status, payload, extra_headers=()):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        for name, value in extra_headers:
            self.send_header(name, value)
        self.end_headers()
        self.wfile.write(body)

    def session_token(self):
        cookie = SimpleCookie()
        cookie.load(self.headers.get("Cookie", ""))
        morsel = cookie.get("classhub_session")
        return morsel.value if morsel else None

    def current_student(self):
        token = self.session_token()
        if not token:
            return None
        now = time.time()
        with SESSIONS_LOCK:
            session = SESSIONS.get(token)
            if session and session["expires_at"] > now:
                student_id = session["student_id"]
            else:
                SESSIONS.pop(token, None)
                return None
        with connect_database() as connection:
            return connection.execute(
                "SELECT id_code, name, course_section FROM students WHERE id_code = ?",
                (student_id,),
            ).fetchone()

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == "/health":
            self.send_json(200, {"ok": True})
            return
        if path == "/":
            self.send_response(302)
            self.send_header("Location", "/index.htm")
            self.end_headers()
            return

        if path == "/qwe.html":
            if not self.current_student():
                self.send_response(302)
                self.send_header("Location", "/index.htm")
                self.end_headers()
                return
            self.serve_file("qwe.html")
            return

        if path == "/api/me":
            student = self.current_student()
            if not student:
                self.send_json(401, {"error": "Sign in required."})
                return
            self.send_json(
                200,
                {
                    "idCode": student["id_code"],
                    "name": student["name"],
                    "courseSection": student["course_section"],
                },
            )
            return

        filename = path.lstrip("/")
        if filename in PUBLIC_FILES:
            self.serve_file(filename)
            return
        self.send_json(404, {"error": "Not found."})

    def do_POST(self):
        path = urlsplit(self.path).path
        if path == "/api/login":
            self.login()
            return
        if path == "/api/logout":
            self.logout()
            return
        self.send_json(404, {"error": "Not found."})

    def login(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > 4096:
                raise ValueError
            payload = json.loads(self.rfile.read(length))
            id_code = str(payload.get("studentId", "")).strip()
            password = str(payload.get("password", ""))
        except (ValueError, TypeError, json.JSONDecodeError):
            self.send_json(400, {"error": "Enter a student ID code and password."})
            return

        with connect_database() as connection:
            student = connection.execute(
                "SELECT id_code, password_salt, password_hash, password_iterations "
                "FROM students WHERE id_code = ?",
                (id_code,),
            ).fetchone()

        valid = False
        if student:
            submitted_hash = hashlib.pbkdf2_hmac(
                "sha256",
                password.encode("utf-8"),
                student["password_salt"],
                student["password_iterations"],
            )
            valid = hmac.compare_digest(submitted_hash, student["password_hash"])
        if not valid:
            self.send_json(401, {"error": "Student ID code or password is incorrect."})
            return

        token = secrets.token_urlsafe(32)
        with SESSIONS_LOCK:
            SESSIONS[token] = {
                "student_id": student["id_code"],
                "expires_at": time.time() + SESSION_LIFETIME,
            }
        secure_cookie = (
            "; Secure"
            if self.headers.get("X-Forwarded-Proto", "").split(",", 1)[0].strip()
            == "https"
            else ""
        )
        cookie = (
            f"classhub_session={token}; HttpOnly; SameSite=Strict; "
            f"Path=/; Max-Age={SESSION_LIFETIME}{secure_cookie}"
        )
        self.send_json(200, {"ok": True}, (("Set-Cookie", cookie),))

    def logout(self):
        token = self.session_token()
        if token:
            with SESSIONS_LOCK:
                SESSIONS.pop(token, None)
        cookie = "classhub_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0"
        self.send_json(200, {"ok": True}, (("Set-Cookie", cookie),))

    def serve_file(self, filename):
        path = ROOT / filename
        try:
            body = path.read_bytes()
        except OSError:
            self.send_json(404, {"error": "File not found."})
            return
        content_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
        if content_type.startswith("text/") or content_type in {
            "application/javascript",
        }:
            content_type += "; charset=utf-8"
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main():
    initialize_database()
    port = int(os.environ.get("PORT", "8000"))
    server = ThreadingHTTPServer(("0.0.0.0", port), ClassHubHandler)
    print(f"ClassHub is listening on port {port}")
    print("Seed accounts: 12-3456 and 26-1234 (local demo password: 1234)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping ClassHub.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()