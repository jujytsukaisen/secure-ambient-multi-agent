from app.utils.storage import load_json
from app.security.schemas import EmailInput
from app.security.redaction import redact_sensitive_data
from app.security.prompt_injection import detect_prompt_injection

def get_unread_emails() -> list[EmailInput]:
    raw_emails = load_json("sample_emails.json")
    emails = []
    for raw in raw_emails:
        body = redact_sensitive_data(raw.get("body", ""))
        is_injected = detect_prompt_injection(body)
        
        email = EmailInput(
            id=raw["id"],
            sender=raw["sender"],
            subject=raw["subject"],
            body=body,
            date=raw["date"],
            security_flagged=is_injected
        )
        emails.append(email)
    return emails
