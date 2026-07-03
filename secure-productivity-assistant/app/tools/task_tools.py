from app.utils.storage import load_json, save_json
from app.security.schemas import TaskObject
import uuid

def add_task(description: str, source_email_id: str = None) -> TaskObject:
    tasks = load_json("tasks.json")
    
    new_task = TaskObject(
        id=str(uuid.uuid4()),
        description=description,
        status="pending",
        source_email_id=source_email_id
    )
    
    tasks.append(new_task.model_dump())
    save_json("tasks.json", tasks)
    return new_task

def get_all_tasks() -> list[TaskObject]:
    raw_tasks = load_json("tasks.json")
    return [TaskObject(**t) for t in raw_tasks]
