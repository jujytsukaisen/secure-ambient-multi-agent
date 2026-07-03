from app.security.schemas import EmailInput
from app.tools.calendar_tools import get_available_slots, book_meeting
from app.tools.task_tools import add_task

def handle_meeting_request(email: EmailInput):
    """
    Suggests slots and attempts booking.
    """
    slots = get_available_slots()
    if not slots:
        print("  -> [Calendar] No available slots.")
        return
        
    # Pick the first available slot as a prototype heuristic
    suggested_slot = slots[0]
    print(f"  -> [Calendar] Suggesting slot: {suggested_slot}")
    
    status = book_meeting(email.subject, suggested_slot)
    
    if status == "scheduled":
        print(f"  -> [Calendar] Meeting scheduled for {suggested_slot}.")
        add_task(f"Meeting: {email.subject} at {suggested_slot}", email.id)
    else:
        print("  -> [Calendar] Booking pending approval.")
        task = add_task(f"Pending Meeting Approval: {email.subject}", email.id)
        # Update task status to waiting_for_approval (simplified)
        task.status = "waiting_for_approval"
