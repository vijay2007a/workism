import secrets
from datetime import datetime, timezone


def make_certificate_id(user_id: str, evaluation_id: str) -> str:
    token = secrets.token_hex(3).upper()
    date = datetime.now(timezone.utc).strftime("%Y%m%d")
    return f"WK-{date}-{user_id[:6].upper()}-{evaluation_id[:6].upper()}-{token}"


def certificate_html(certificate_id: str, student: str, skill: str, score: int, issued_at: str) -> str:
    issued_date = datetime.fromisoformat(issued_at).strftime("%d %b %Y")
    return f"""<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>{certificate_id}</title>
  <style>
    body {{ font-family: Arial, sans-serif; margin: 0; background: #0b1020; color: #fff; }}
    .certificate {{ max-width: 900px; margin: 40px auto; padding: 56px; border: 2px solid #d7b56d; border-radius: 18px; text-align: center; background: linear-gradient(135deg,#15123a,#102345); }}
    h1 {{ letter-spacing: 4px; margin: 0 0 28px; }}
    .name {{ font-size: 46px; font-weight: 800; margin: 22px 0; }}
    .skill {{ font-size: 30px; color: #a8c7ff; margin: 12px 0; }}
    .meta {{ display: flex; justify-content: space-between; margin-top: 52px; color: #d7dce8; font-size: 14px; }}
  </style>
</head>
<body>
  <main class="certificate">
    <h1>WORKISM</h1>
    <p>Certificate of Achievement</p>
    <p>Presented to</p>
    <div class="name">{student}</div>
    <p>for successfully demonstrating proficiency in</p>
    <div class="skill">{skill}</div>
    <p>with an assessment score of {score}/100.</p>
    <section class="meta">
      <div>Certificate ID<br><strong>{certificate_id}</strong></div>
      <div>Date Issued<br><strong>{issued_date}</strong></div>
    </section>
  </main>
</body>
</html>"""
