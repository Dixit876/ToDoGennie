import sqlite3
import os
from flask import Flask, request, jsonify, render_template
from model import calculate_priority, get_next_task, is_near_deadline

app = Flask(__name__)
DB_PATH = os.path.join(os.path.dirname(__file__), "database.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                title       TEXT    NOT NULL,
                deadline    TEXT    NOT NULL,
                difficulty  INTEGER NOT NULL DEFAULT 1,
                remark      TEXT    DEFAULT '',
                completed   INTEGER DEFAULT 0,
                priority_level TEXT DEFAULT 'Medium',
                priority_score INTEGER DEFAULT 5,
                urgency     TEXT    DEFAULT 'Unknown',
                created_at  TEXT    DEFAULT (datetime('now'))
            )
        """)
        conn.commit()

def row_to_dict(row, recalc=False):
    d = dict(row)
    d["completed"] = bool(d["completed"])
    if recalc and not d["completed"]:
        priority = calculate_priority(d["deadline"], d["difficulty"])
        d["priority_level"] = priority["level"]
        d["priority_score"] = priority["score"]
        d["urgency"] = priority["urgency"]
    d["near_deadline"] = is_near_deadline(d["deadline"])
    return d

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/tasks", methods=["GET"])
def get_tasks():
    sort_by = request.args.get("sort", "priority")

    with get_db() as conn:
        if sort_by == "deadline":
            rows = conn.execute("SELECT * FROM tasks ORDER BY deadline ASC").fetchall()
        elif sort_by == "difficulty":
            rows = conn.execute("SELECT * FROM tasks ORDER BY difficulty DESC").fetchall()
        else:
            rows = conn.execute("SELECT * FROM tasks ORDER BY priority_score DESC, deadline ASC").fetchall()

    tasks = [row_to_dict(r, recalc=True) for r in rows]
    next_task = get_next_task(tasks)

    return jsonify({"tasks": tasks, "next_task": next_task})


@app.route("/api/tasks", methods=["POST"])
def add_task():
    data = request.get_json()

    title = data.get("title", "").strip()
    deadline = data.get("deadline", "")
    difficulty = int(data.get("difficulty", 1))
    remark = data.get("remark", "").strip()

    if not title or not deadline:
        return jsonify({"error": "Title and deadline are required."}), 400
    if not (1 <= difficulty <= 5):
        return jsonify({"error": "Difficulty must be between 1 and 5."}), 400

    priority = calculate_priority(deadline, difficulty)

    with get_db() as conn:
        cursor = conn.execute(
            """INSERT INTO tasks (title, deadline, difficulty, remark,
               priority_level, priority_score, urgency)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (title, deadline, difficulty, remark,
             priority["level"], priority["score"], priority["urgency"])
        )
        conn.commit()
        task_id = cursor.lastrowid
        row = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()

    return jsonify(row_to_dict(row)), 201


@app.route("/api/tasks/<int:task_id>", methods=["PATCH"])
def update_task(task_id):
    data = request.get_json()
    completed = data.get("completed", True)

    with get_db() as conn:
        row = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
        if not row:
            return jsonify({"error": "Task not found."}), 404

        conn.execute("UPDATE tasks SET completed = ? WHERE id = ?",
                     (int(completed), task_id))
        conn.commit()
        row = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()

    return jsonify(row_to_dict(row))


@app.route("/api/tasks/<int:task_id>", methods=["DELETE"])
def delete_task(task_id):
    with get_db() as conn:
        result = conn.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
        conn.commit()
        if result.rowcount == 0:
            return jsonify({"error": "Task not found."}), 404

    return jsonify({"message": "Task deleted successfully."})

init_db()
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=True, host="0.0.0.0", port=port)
