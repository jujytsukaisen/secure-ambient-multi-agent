from app.security.schemas import EmailInput
from app.tools.task_tools import add_task
from app.agents.calendar_booking_agent import handle_meeting_request

def process_email(email: EmailInput):
    """
    Classifies the email and extracts tasks or routes to calendar agent.
    """
    print(f"\n[Email Filter] Processing email {email.id} from {email.sender}")
    
    if email.security_flagged:
        print("  -> [SECURITY WARNING] Prompt injection detected. Ignoring content.")
        email.classification = "spam"
        return
        
    subject = email.subject.lower()
    body = email.body.lower()
    
    if "urgent" in subject or "deadline" in body:
        email.classification = "important"
        print("  -> Classified as: Important. Extracting task.")
        add_task(f"Urgent: {email.subject}", email.id)
        
    elif "meet" in subject or "meet" in body or "sync" in subject:
        email.classification = "meeting_request"
        print("  -> Classified as: Meeting Request. Routing to Calendar Agent.")
        handle_meeting_request(email)
        
    elif "question" in subject or "reply" in body:
        email.classification = "needs_reply"
        print("  -> Classified as: Needs Reply. Extracting task.")
        add_task(f"Reply to {email.sender}: {email.subject}", email.id)
        
    elif "win" in subject or "free" in subject:
        email.classification = "spam"
        print("  -> Classified as: Spam.")
        
    else:
        email.classification = "low_priority"
        print("  -> Classified as: Low Priority.")
