from app.agents.planner_agent import PlannerAgent
from app.utils.storage import save_json, load_json

def setup_function():
    save_json("tasks.json", [])

def test_full_workflow():
    planner = PlannerAgent()
    
    # 1. Process emails
    planner.process_ambient_events()
    
    # 2. Check tasks generated
    tasks = load_json("tasks.json")
    assert len(tasks) > 0 # At least some sample emails generate tasks
    
    # 3. Check daily summary
    from app.agents.daily_summary_agent import generate_daily_summary
    summary = generate_daily_summary()
    assert "Total Tasks" in summary
