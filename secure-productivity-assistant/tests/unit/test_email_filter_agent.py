from app.agents.email_filter_agent import process_email
from app.security.schemas import EmailInput
from app.utils.storage import load_json, save_json
import os

def setup_function():
    save_json("tasks.json", [])

def test_process_important_email():
    email = EmailInput(
        id="test1",
        sender="boss@boss.com",
        subject="Urgent report",
        body="Needs to be done ASAP.",
        date="2023-10-24"
    )
    process_email(email)
    assert email.classification == "important"
    
    tasks = load_json("tasks.json")
    assert len(tasks) == 1
    assert "Urgent report" in tasks[0]["description"]

def test_process_spam_email():
    email = EmailInput(
        id="test2",
        sender="scam@scam.com",
        subject="Win a free prize",
        body="Click here.",
        date="2023-10-24"
    )
    process_email(email)
    assert email.classification == "spam"
    
    tasks = load_json("tasks.json")
    assert len(tasks) == 0
