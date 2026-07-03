from app.agents.daily_summary_agent import generate_daily_summary
from app.tools.task_tools import add_task
from app.utils.storage import save_json

def setup_function():
    save_json("tasks.json", [])

def test_daily_summary_contains_tasks():
    add_task("Test task 1")
    add_task("Test task 2")
    
    summary = generate_daily_summary()
    assert "Total Tasks: 2" in summary
    assert "Test task 1" in summary
    assert "Test task 2" in summary
