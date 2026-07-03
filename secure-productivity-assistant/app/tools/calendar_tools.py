from app.utils.storage import load_json
from app.security.approval import request_approval

def get_available_slots() -> list[str]:
    slots = load_json("sample_calendar.json")
    return [s["time"] for s in slots if s["status"] == "available"]

def book_meeting(topic: str, time: str) -> str:
    details = f"Book meeting '{topic}' at {time}"
    approved = request_approval("book_meeting", details)
    
    if not approved:
        return "waiting_for_approval"
        
    return "scheduled"
