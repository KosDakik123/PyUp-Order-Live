import os
import secrets
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from argon2 import PasswordHasher
from datetime import datetime, timedelta
from jose import jwt

SECRET_KEY = os.getenv("SECRET_KEY", "supersecretkey")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

ph = PasswordHasher()


def hash_password(password: str):
    return ph.hash(password)


def verify_password(plain: str, hashed: str):
    try:
        ph.verify(hashed, plain)
        return True
    except:
        return False


def create_access_token(user_id: str):
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": user_id, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def generate_verification_token() -> str:
    """Generate a secure random URL-safe token."""
    return secrets.token_urlsafe(32)


def send_verification_email(to_email: str, token: str, base_url: str) -> bool:
    """
    Send an email verification link to the user.

    Reads SMTP settings from environment variables:
        SMTP_HOST     – e.g. smtp.gmail.com        (default: localhost)
        SMTP_PORT     – e.g. 587                   (default: 587)
        SMTP_USER     – sender account / username
        SMTP_PASSWORD – sender password / app-password
        SMTP_FROM     – From address               (falls back to SMTP_USER)
        SMTP_USE_TLS  – "true" / "false"           (default: true)
    """
    smtp_host = os.getenv("SMTP_HOST", "localhost")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_pass = os.getenv("SMTP_PASSWORD", "")
    smtp_from = os.getenv("SMTP_FROM", smtp_user)
    use_tls   = os.getenv("SMTP_USE_TLS", "true").lower() == "true"

    verify_url = f"{base_url}/verify-email?token={token}"

    # ── Build the email ──────────────────────────────────────────────────────
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Verify your email address"
    msg["From"]    = smtp_from
    msg["To"]      = to_email

    text_body = f"""\
Hi there!

Thank you for registering. Please verify your email address by visiting:

{verify_url}

This link will remain valid until you use it.

If you did not create an account, you can safely ignore this email.
"""

    html_body = f"""\
<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:30px">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:10px;
              padding:32px;box-shadow:0 2px 8px rgba(0,0,0,.08)">
    <h2 style="color:#667eea;margin-top:0">Verify your email 📧</h2>
    <p>Thanks for signing up! Click the button below to activate your account.</p>
    <a href="{verify_url}"
       style="display:inline-block;background:linear-gradient(135deg,#667eea,#764ba2);
              color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;
              font-size:15px;font-weight:bold;margin:16px 0">
      ✅ Verify Email
    </a>
    <p style="color:#666;font-size:13px">
      Or copy this link into your browser:<br>
      <a href="{verify_url}" style="color:#667eea">{verify_url}</a>
    </p>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
    <p style="color:#aaa;font-size:12px">
      If you didn't create this account, you can safely ignore this email.
    </p>
  </div>
</body>
</html>
"""

    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    # ── Send ─────────────────────────────────────────────────────────────────
    try:
        if use_tls:
            server = smtplib.SMTP(smtp_host, smtp_port)
            server.ehlo()
            server.starttls()
        else:
            server = smtplib.SMTP_SSL(smtp_host, smtp_port)

        if smtp_user and smtp_pass:
            server.login(smtp_user, smtp_pass)

        server.sendmail(smtp_from, to_email, msg.as_string())
        server.quit()
        return True
    except Exception as exc:
        print(f"[auth] Failed to send verification email to {to_email}: {exc}")
        return False