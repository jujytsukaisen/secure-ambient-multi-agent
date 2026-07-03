import sys
from app.agents.planner_agent import PlannerAgent
from app.utils.storage import save_json

def reset_tasks():
    save_json("tasks.json", [])

def main():
    if len(sys.argv) < 2:
        print("Usage: python -m app.main [process-emails|daily-summary|demo]")
        sys.exit(1)
        
    command = sys.argv[1]
    planner = PlannerAgent()
    
    if command == "process-emails":
        planner.process_ambient_events()
    elif command == "daily-summary":
        planner.run_end_of_day()
    elif command == "demo":
        print("=== Starting Demo ===")
        reset_tasks()
        planner.process_ambient_events()
        planner.run_end_of_day()
        print("=== Demo Complete ===")
    else:
        print("Unknown command.")

if __name__ == "__main__":
    main()
