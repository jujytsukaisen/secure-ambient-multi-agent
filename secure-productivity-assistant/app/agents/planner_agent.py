from app.tools.email_tools import get_unread_emails
from app.agents.email_filter_agent import process_email
from app.agents.daily_summary_agent import generate_daily_summary

class PlannerAgent:
    """
    Main coordinator agent.
    Routes work to appropriate sub-agents.
    """
    def process_ambient_events(self):
        print("Planner Agent: Checking for new emails...")
        emails = get_unread_emails()
        for email in emails:
            process_email(email)
            
    def run_end_of_day(self):
        print("Planner Agent: Generating end of day summary...")
        summary = generate_daily_summary()
        print("\n--- Daily Summary ---")
        print(summary)
        print("---------------------\n")
