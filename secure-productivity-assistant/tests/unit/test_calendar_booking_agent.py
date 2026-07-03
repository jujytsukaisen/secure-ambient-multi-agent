from app.agents.calendar_booking_agent import handle_meeting_request
from app.security.schemas import EmailInput
from app.utils.storage import save_json, load_json

def setup_function():
    save_json("tasks.json", [])

def test_calendar_booking_flow():
    email = EmailInput(
        id="test_cal",
        sender="client@client.com",
        subject="Sync meeting",
        body="Let's meet.",
        date="2023-10-24"
    )
    
    handle_meeting_request(email)
    
    # Check if a task was added
    tasks = load_json("tasks.json")
    assert len(tasks) == 1
    assert "Meeting: Sync meeting" in tasks[0]["description"]
