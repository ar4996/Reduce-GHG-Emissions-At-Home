"""
Flask backend for the HW10 technical prototype.

Flow:
    Home → Start → Learning placeholders (Avi/Ankit's section) → Planner (the quiz).
    When the user meets the CO2 goal in the planner, a congrats overlay appears
    with two options: email their certificate to themselves, or start over with
    a different budget. There is no separate "quiz result" page — the overlay IS
    the result.

Page routes:
    GET  /                        Home (Start button)
    POST /start                   Reset user data, redirect to /learn/1
    GET  /learn/<int:lesson_num>  Learning placeholder (owned by Avi/Ankit)
    GET  /quiz/1                  Planner SPA — this is the quiz

JSON API (backend persistence per spec #4):
    POST   /api/budget            Save budget + computed goal
    POST   /api/items             Add item id to plan
    DELETE /api/items/<item_id>   Remove item id from plan
    GET    /api/plan/summary      Plain-text plan summary

Single-user app per spec #8. State lives in user_data.json.
Content lives in data/*.json per spec #5.
"""

from flask import (
    Flask, render_template, request, redirect, url_for, jsonify, Response, abort
)
import json
import os
import random
from datetime import datetime
from threading import RLock

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
USER_DATA_FILE = os.path.join(BASE_DIR, "user_data.json")
FILE_ENCODING = "utf-8"
USER_DATA_LOCK = RLock()


def _empty_state():
    return {
        "started_at": None,
        "learning": [],
        "plan": {"budget": None, "goal": None, "applied": []},
    }


def load_json(filename):
    with open(os.path.join(DATA_DIR, filename), "r", encoding=FILE_ENCODING) as f:
        return json.load(f)


sustainable_living_opportunities = load_json("lessons.json")


def normalize_user_data(data):
    state = _empty_state()
    if not isinstance(data, dict):
        return state

    state.update(data)

    learning = data.get("learning")
    state["learning"] = learning if isinstance(learning, list) else []

    plan = data.get("plan")
    merged_plan = _empty_state()["plan"]
    if isinstance(plan, dict):
        merged_plan.update(plan)
        applied = plan.get("applied")
        merged_plan["applied"] = applied if isinstance(applied, list) else []
    state["plan"] = merged_plan

    return state


def load_user_data():
    if not os.path.exists(USER_DATA_FILE):
        return _empty_state()

    with USER_DATA_LOCK:
        with open(USER_DATA_FILE, "r", encoding=FILE_ENCODING) as f:
            raw_text = f.read()

    if not raw_text.strip():
        return _empty_state()

    try:
        return normalize_user_data(json.loads(raw_text))
    except json.JSONDecodeError:
        stripped_text = raw_text.lstrip()
        try:
            data, end = json.JSONDecoder().raw_decode(stripped_text)
        except json.JSONDecodeError:
            return _empty_state()

        cleaned_data = normalize_user_data(data)
        if stripped_text[end:].strip():
            save_user_data(cleaned_data)
        return cleaned_data


def save_user_data(data):
    normalized = normalize_user_data(data)
    temp_file = f"{USER_DATA_FILE}.tmp"

    with USER_DATA_LOCK:
        with open(temp_file, "w", encoding=FILE_ENCODING) as f:
            json.dump(normalized, f, indent=2, ensure_ascii=False)
            f.flush()
            os.fsync(f.fileno())
        os.replace(temp_file, USER_DATA_FILE)


def items_by_id():
    return {it["id"]: it for it in load_json("planner_items.json")}


# ADDED FOR BINARY QUIZ — strips correct answers before sending to client
def binary_questions_for_client():
    client_questions = []
    for q in load_json("binary_questions.json"):
        client_question = {k: v for k, v in q.items() if k != "correct"}
        options = list(q.get("options") or [])
        random.shuffle(options)
        client_question["options"] = options
        client_questions.append(client_question)
    return client_questions


def build_plan_summary(user_data):
    """Plain-text plan summary for /api/plan/summary (debugging / inspection)."""
    items_map = items_by_id()
    plan = user_data.get("plan") or {}
    applied_ids = plan.get("applied") or []
    applied = [items_map[i] for i in applied_ids if i in items_map]

    budget = plan.get("budget") or 0
    goal = plan.get("goal") or 0
    total_cost = sum(it["cost"] for it in applied)
    total_co2 = sum(it["impact"] for it in applied)

    lines = [
        "My Home Emissions Reduction Plan",
        "=" * 40,
        "",
        f"Budget: ${budget:,}",
        f"CO2 goal: {goal:.2f} T / year",
        f"Plan cost: ${total_cost:,} (remaining: ${budget - total_cost:,})",
        f"CO2 reduced: {total_co2:.2f} T / year",
        "",
        "Changes in the plan:",
    ]
    if not applied:
        lines.append("  (none)")
    else:
        for it in applied:
            cost = "FREE" if it["cost"] == 0 else f"${it['cost']:,}"
            lines.append(
                f"  - [{it['room']}] {it['name']} ({cost}, -{it['impact']}T CO2)"
            )
    lines += ["", "Generated by Reducing Greenhouse Gas Emissions at Home."]
    return "\n".join(lines)


# ==================== PAGE ROUTES ====================
@app.route("/")
def home():
    return render_template("welcome.html")


@app.route('/learn/index')
def learn_index():
    return render_template('lesson-welcome.html')


@app.route('/lesson-welcome')
def lesson_welcome():
    return redirect(url_for('learn_index'))


@app.route('/learn/<int:index>')
def lesson_page(index):
    if index < 0 or index >= len(sustainable_living_opportunities):
        return redirect(url_for('lesson_welcome'))

    user_data = load_user_data()
    user_data["learning"].append({
                "lesson_num": index + 1,
        "entered_at": datetime.now().isoformat(),
    })
    save_user_data(user_data)

    room_data = sustainable_living_opportunities[index].copy()

    room_data["room_image_url"] = url_for(
        "static",
        filename=room_data["room_image"]
    )
    next_index = index + 1 if index + 1 < len(sustainable_living_opportunities) else None

    return render_template(
        "lesson.html",
        room_data=room_data,
        current_index=index,
        next_index=next_index,
    )


@app.route("/start", methods=["POST"])
def start():
    state = _empty_state()
    state["started_at"] = datetime.now().isoformat()
    save_user_data(state)
    return redirect(url_for('learn_index'))


# ADDED FOR BINARY QUIZ — serves templates/binary.html
@app.route("/quiz/binary")
def quiz_binary():
    return render_template("binary.html", questions=binary_questions_for_client())


def planner_view_context(force_setup=False):
    plan = {"budget": None, "goal": None, "applied": []}
    if not force_setup:
        plan = load_user_data().get("plan") or {}

    return {
        "plan": plan,
        "items": load_json("planner_items.json"),
        "rooms": load_json("rooms.json"),
        "force_setup": force_setup,
    }


@app.route("/quiz/setup")
def quiz_setup():
    return render_template("planner.html", **planner_view_context(force_setup=True))


@app.route("/quiz/1")
def quiz_planner():
    return render_template("planner.html", **planner_view_context())


# ==================== JSON API ====================
@app.route("/api/budget", methods=["POST"])
def api_budget():
    payload = request.get_json(silent=True) or {}
    try:
        budget = int(payload["budget"])
        goal = float(payload["goal"])
    except (KeyError, TypeError, ValueError):
        abort(400, "budget (int) and goal (float) required")

    user_data = load_user_data()
    plan = user_data.get("plan") or {"applied": []}
    plan["budget"] = budget
    plan["goal"] = goal
    plan["applied"] = []
    user_data["plan"] = plan
    save_user_data(user_data)
    return jsonify({"ok": True})


@app.route("/api/items", methods=["POST"])
def api_add_item():
    payload = request.get_json(silent=True) or {}
    item_id = payload.get("id")
    if not item_id or item_id not in items_by_id():
        abort(400, "valid item id required")

    user_data = load_user_data()
    plan = user_data.setdefault("plan", {"budget": None, "goal": None, "applied": []})
    applied = plan.setdefault("applied", [])
    if item_id not in applied:
        applied.append(item_id)
    save_user_data(user_data)
    return jsonify({"ok": True, "applied": applied})


@app.route("/api/items/<item_id>", methods=["DELETE"])
def api_remove_item(item_id):
    user_data = load_user_data()
    plan = user_data.setdefault("plan", {"budget": None, "goal": None, "applied": []})
    applied = plan.setdefault("applied", [])
    plan["applied"] = [i for i in applied if i != item_id]
    save_user_data(user_data)
    return jsonify({"ok": True, "applied": plan["applied"]})


@app.route("/api/plan/summary")
def api_plan_summary():
    return Response(build_plan_summary(load_user_data()), mimetype="text/plain")


# ADDED FOR BINARY QUIZ — server-side all-or-nothing correctness check
@app.route("/api/binary", methods=["POST"])
def api_binary():
    payload = request.get_json(silent=True) or {}
    submission = payload.get("submission")
    if not isinstance(submission, list):
        abort(400, "submission (list) required")

    answer_key = {q["id"]: q["correct"] for q in load_json("binary_questions.json")}
    submitted = {s.get("question_id"): s.get("answer") for s in submission}

    all_correct = (
        len(submitted) == len(answer_key)
        and all(answer_key.get(qid) == ans for qid, ans in submitted.items())
    )

    user_data = load_user_data()
    user_data["binary"] = {
        "submitted_at": datetime.now().isoformat(),
        "submission": submission,
        "all_correct": all_correct,
    }
    save_user_data(user_data)
    return jsonify({"all_correct": all_correct})


if __name__ == "__main__":
    app.run(debug=True, port=5000)
