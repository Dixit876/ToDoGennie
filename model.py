from datetime import datetime


def calculate_priority(deadline_str: str, difficulty: int) -> dict:
 
    try:
        deadline = datetime.fromisoformat(deadline_str)
    except (ValueError, TypeError):
        return {"score": 5, "level": "Medium", "urgency": "Unknown"}

    now = datetime.now()
    delta = deadline - now
    hours_left = delta.total_seconds() / 3600

    if hours_left < 3:
        urgency_score = 5
        urgency_label = "Critical"
    elif hours_left < 24:
        urgency_score = 4
        urgency_label = "Very Urgent"
    elif hours_left < 72:
        urgency_score = 3
        urgency_label = "Urgent"
    elif hours_left < 168:
        urgency_score = 2
        urgency_label = "Moderate"
    else:
        urgency_score = 1
        urgency_label = "Relaxed"

    combined = urgency_score + difficulty

    if combined >= 8:
        level = "High"
    elif combined >= 5:
        level = "Medium"
    else:
        level = "Low"

    return {
        "score": combined,
        "level": level,
        "urgency": urgency_label,
        "hours_left": round(hours_left, 2),
    }


def get_next_task(tasks: list) -> dict | None:
   
    incomplete = [t for t in tasks if not t.get("completed")]
    if not incomplete:
        return None

    def sort_key(t):
        pri = t.get("priority_score", 0)
        try:
            dl = datetime.fromisoformat(t["deadline"])
        except Exception:
            dl = datetime.max
        return (-pri, dl)

    return sorted(incomplete, key=sort_key)[0]


def is_near_deadline(deadline_str: str, threshold_hours: float = 3.0) -> bool:
    
    try:
        deadline = datetime.fromisoformat(deadline_str)
        delta = deadline - datetime.now()
        return delta.total_seconds() / 3600 <= threshold_hours
    except Exception:
        return False
