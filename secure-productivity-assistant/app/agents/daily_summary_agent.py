from app.tools.task_tools import get_all_tasks

def generate_daily_summary() -> str:
    """
    Reads all tasks and generates a summary report.
    """
    tasks = get_all_tasks()
    
    if not tasks:
        return "No tasks recorded today."
        
    summary_lines = []
    summary_lines.append(f"Total Tasks: {len(tasks)}")
    summary_lines.append("Task Breakdown:")
    
    for task in tasks:
        summary_lines.append(f" - [{task.status.upper()}] {task.description}")
        
    return "\n".join(summary_lines)
