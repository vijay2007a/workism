from __future__ import annotations

import json
import subprocess
import sys
import textwrap
from datetime import timedelta
from typing import Any

from fastapi import HTTPException

from services.firestore import collection, doc_to_dict, now_iso


PYTHON_PROBLEMS: list[dict[str, Any]] = [
    {
        "id": "python-intro-greeting-easy",
        "skill_id": "python",
        "module_id": "1",
        "title": "Build a welcome message",
        "difficulty": "Easy",
        "description": "Return a friendly welcome message for a learner.",
        "instructions": "Write a function `build_welcome_message(name)` that returns `Hello, <name>! Welcome to Workism.`",
        "entrypoint": "build_welcome_message",
        "language": "python",
        "starter_code": "def build_welcome_message(name):\n    # return a formatted welcome message\n    pass\n",
        "example_input": 'name="Vijay"',
        "expected_output": '"Hello, Vijay! Welcome to Workism."',
        "tests": [{"args": ["Vijay"], "expected": "Hello, Vijay! Welcome to Workism."}, {"args": ["Asha"], "expected": "Hello, Asha! Welcome to Workism."}],
        "hints": ["Use an f-string.", "Remember to include the exclamation mark."],
    },
    {
        "id": "python-vars-convert-medium",
        "skill_id": "python",
        "module_id": "2",
        "title": "Convert Celsius to Fahrenheit",
        "difficulty": "Medium",
        "description": "Practice numeric expressions and type conversion.",
        "instructions": "Write `celsius_to_fahrenheit(celsius)` so it converts Celsius to Fahrenheit using the formula `c * 9/5 + 32`.",
        "entrypoint": "celsius_to_fahrenheit",
        "language": "python",
        "starter_code": "def celsius_to_fahrenheit(celsius):\n    pass\n",
        "example_input": "celsius=0",
        "expected_output": "32.0",
        "tests": [{"args": [0], "expected": 32.0}, {"args": [100], "expected": 212.0}],
        "hints": ["Use multiplication and division in the formula.", "Return a number, not a string."],
    },
    {
        "id": "python-control-grade-hard",
        "skill_id": "python",
        "module_id": "3",
        "title": "Grade a score",
        "difficulty": "Hard",
        "description": "Use branching logic to map scores to grades.",
        "instructions": "Write `score_to_grade(score)` that returns A for 90+, B for 80-89, C for 70-79, D for 60-69, and F otherwise.",
        "entrypoint": "score_to_grade",
        "language": "python",
        "starter_code": "def score_to_grade(score):\n    pass\n",
        "example_input": "score=83",
        "expected_output": '"B"',
        "tests": [{"args": [92], "expected": "A"}, {"args": [85], "expected": "B"}, {"args": [73], "expected": "C"}, {"args": [64], "expected": "D"}, {"args": [51], "expected": "F"}],
        "hints": ["Start with the highest threshold first.", "Use if/elif/else."],
    },
    {
        "id": "python-functions-sum-easy",
        "skill_id": "python",
        "module_id": "4",
        "title": "Sum two numbers",
        "difficulty": "Easy",
        "description": "Write your first reusable function.",
        "instructions": "Write `add_numbers(a, b)` that returns the sum of two numbers.",
        "entrypoint": "add_numbers",
        "language": "python",
        "starter_code": "def add_numbers(a, b):\n    pass\n",
        "example_input": "a=2, b=3",
        "expected_output": "5",
        "tests": [{"args": [2, 3], "expected": 5}, {"args": [-1, 5], "expected": 4}],
        "hints": ["Return `a + b`.", "Keep the function simple."],
    },
    {
        "id": "python-functions-vowels-medium",
        "skill_id": "python",
        "module_id": "4",
        "title": "Count vowels in a string",
        "difficulty": "Medium",
        "description": "Use loops and string handling.",
        "instructions": "Write `count_vowels(text)` that returns the number of vowels in the given text.",
        "entrypoint": "count_vowels",
        "language": "python",
        "starter_code": "def count_vowels(text):\n    pass\n",
        "example_input": 'text="workism"',
        "expected_output": "2",
        "tests": [{"args": ["workism"], "expected": 2}, {"args": ["Python"], "expected": 1}],
        "hints": ["Lowercase the text first.", "Loop through the characters and count matches."],
    },
    {
        "id": "python-functions-normalize-hard",
        "skill_id": "python",
        "module_id": "4",
        "title": "Normalize a learner name",
        "difficulty": "Hard",
        "description": "Practice string cleanup and formatting.",
        "instructions": "Write `normalize_name(name)` that strips extra spaces and title-cases the name.",
        "entrypoint": "normalize_name",
        "language": "python",
        "starter_code": "def normalize_name(name):\n    pass\n",
        "example_input": 'name="   vijay  a  "',
        "expected_output": '"Vijay A"',
        "tests": [{"args": ["   vijay  a  "], "expected": "Vijay A"}, {"args": ["sara"], "expected": "Sara"}],
        "hints": ["Use `strip()` and `split()`.", "Join the words back with single spaces."],
    },
    {
        "id": "python-oop-profile-easy",
        "skill_id": "python",
        "module_id": "5",
        "title": "Return a profile summary",
        "difficulty": "Easy",
        "description": "Keep simple data together in a dictionary-like summary.",
        "instructions": "Write `profile_summary(name, age)` that returns a dictionary with keys `name` and `age`.",
        "entrypoint": "profile_summary",
        "language": "python",
        "starter_code": "def profile_summary(name, age):\n    pass\n",
        "example_input": 'name="Vijay", age=18',
        "expected_output": '{"name": "Vijay", "age": 18}',
        "tests": [{"args": ["Vijay", 18], "expected": {"name": "Vijay", "age": 18}}],
        "hints": ["Return a dictionary.", "Use the exact keys requested."],
    },
    {
        "id": "python-modules-packages-medium",
        "skill_id": "python",
        "module_id": "6",
        "title": "Build a module-friendly formatter",
        "difficulty": "Medium",
        "description": "Use clean helper functions that can live in separate modules.",
        "instructions": "Write `format_course_title(skill)` that returns `Python Development` when passed `python` and similar title-cased labels for other skills.",
        "entrypoint": "format_course_title",
        "language": "python",
        "starter_code": "def format_course_title(skill):\n    pass\n",
        "example_input": 'skill="python"',
        "expected_output": '"Python Development"',
        "tests": [{"args": ["python"], "expected": "Python Development"}, {"args": ["javascript"], "expected": "Javascript Development"}],
        "hints": ["Use `capitalize()` or `title()` carefully.", "Append ` Development`."],
    },
    {
        "id": "python-exceptions-divide-hard",
        "skill_id": "python",
        "module_id": "8",
        "title": "Safe divide",
        "difficulty": "Hard",
        "description": "Handle invalid input without crashing.",
        "instructions": "Write `safe_divide(a, b)` that returns `None` when division fails instead of raising an exception.",
        "entrypoint": "safe_divide",
        "language": "python",
        "starter_code": "def safe_divide(a, b):\n    pass\n",
        "example_input": "a=10, b=2",
        "expected_output": "5.0",
        "tests": [{"args": [10, 2], "expected": 5.0}, {"args": [10, 0], "expected": None}],
        "hints": ["Wrap the division in try/except.", "Return `None` on error."],
    },
]

PROBLEM_BY_ID = {problem["id"]: problem for problem in PYTHON_PROBLEMS}


def list_problems(skill_id: str | None = None, module_id: str | None = None) -> list[dict[str, Any]]:
    results = PYTHON_PROBLEMS
    if skill_id:
        results = [problem for problem in results if problem["skill_id"] == skill_id]
    if module_id:
        results = [problem for problem in results if problem["module_id"] == str(module_id)]
    return results


def get_problem(problem_id: str) -> dict[str, Any]:
    problem = PROBLEM_BY_ID.get(problem_id)
    if not problem:
        raise HTTPException(status_code=404, detail="Coding problem not found")
    return problem


def list_attempts(user_id: str, problem_id: str | None = None) -> list[dict[str, Any]]:
    query = collection("coding_attempts").where("user_id", "==", user_id)
    if problem_id:
        query = query.where("problem_id", "==", problem_id)
    return [doc_to_dict(snapshot) for snapshot in query.order_by("created_at").stream() if doc_to_dict(snapshot)]


def _serializable(value: Any) -> Any:
    try:
        json.dumps(value)
        return value
    except TypeError:
        if isinstance(value, dict):
            return {key: _serializable(item) for key, item in value.items()}
        if isinstance(value, (list, tuple)):
            return [_serializable(item) for item in value]
        return str(value)


def _run_python_tests(problem: dict[str, Any], code: str, timeout_seconds: int = 8) -> dict[str, Any]:
    payload = {
        "code": code,
        "entrypoint": problem["entrypoint"],
        "tests": problem["tests"],
    }
    runner = textwrap.dedent(
        r"""
        import builtins
        import contextlib
        import io
        import json
        import math
        import re
        import sys

        SAFE_BUILTINS = {
            "abs": abs,
            "all": all,
            "any": any,
            "bool": bool,
            "dict": dict,
            "enumerate": enumerate,
            "Exception": Exception,
            "float": float,
            "int": int,
            "len": len,
            "list": list,
            "max": max,
            "min": min,
            "range": range,
            "round": round,
            "set": set,
            "sorted": sorted,
            "str": str,
            "sum": sum,
            "tuple": tuple,
            "zip": zip,
            "ValueError": ValueError,
            "TypeError": TypeError,
            "print": print,
        }

        payload = json.loads(sys.stdin.read())
        namespace = {"__builtins__": SAFE_BUILTINS, "math": math, "re": re}
        stdout = io.StringIO()
        error = None
        results = []

        try:
            with contextlib.redirect_stdout(stdout):
                exec(payload["code"], namespace, namespace)
                target = namespace.get(payload["entrypoint"])
                if not callable(target):
                    raise RuntimeError(f"Function {payload['entrypoint']} was not defined.")
                for case in payload["tests"]:
                    args = case.get("args", [])
                    kwargs = case.get("kwargs", {})
                    expected = case.get("expected")
                    actual = target(*args, **kwargs)
                    results.append({
                        "args": args,
                        "kwargs": kwargs,
                        "expected": expected,
                        "actual": actual,
                        "passed": actual == expected,
                    })
        except Exception as exc:
            error = str(exc)

        output = {
            "stdout": stdout.getvalue(),
            "tests": results,
            "passed": bool(results) and all(item["passed"] for item in results) and not error,
            "error": error,
        }
        print(json.dumps(output, default=str))
        """
    )
    completed = subprocess.run(
        [sys.executable, "-I", "-S", "-E", "-c", runner],
        input=json.dumps(payload),
        text=True,
        capture_output=True,
        timeout=timeout_seconds,
        cwd=None,
    )
    if completed.returncode != 0 and not completed.stdout:
        raise HTTPException(status_code=500, detail="Coding runner failed to execute.")
    raw = completed.stdout.strip().splitlines()[-1] if completed.stdout.strip() else "{}"
    return json.loads(raw)


def evaluate_code(problem_id: str, code: str) -> dict[str, Any]:
    problem = get_problem(problem_id)
    result = _run_python_tests(problem, code)
    tests = result.get("tests", [])
    passed_tests = sum(1 for item in tests if item.get("passed"))
    total_tests = len(tests)
    score = round((passed_tests / total_tests) * 100) if total_tests else 0
    return {
        "problem": problem,
        "stdout": result.get("stdout", ""),
        "error": result.get("error"),
        "passed": bool(result.get("passed")),
        "tests": tests,
        "passed_tests": passed_tests,
        "total_tests": total_tests,
        "score": score,
    }


def persist_attempt(
    user_id: str,
    problem_id: str,
    code: str,
    language: str,
    evaluation: dict[str, Any],
    *,
    ai_help_used: bool = False,
    kind: str = "submit",
    update_progress: bool = True,
) -> dict[str, Any]:
    problem = evaluation["problem"]
    attempts = list_attempts(user_id, problem_id)
    attempt_number = len(attempts) + 1
    doc = collection("coding_attempts").document()
    record = {
        "id": doc.id,
        "user_id": user_id,
        "problem_id": problem_id,
        "module_id": problem["module_id"],
        "language": language,
        "code": code,
        "output": evaluation.get("stdout", ""),
        "error": evaluation.get("error"),
        "passed": evaluation["passed"],
        "attempt_number": attempt_number,
        "total_tests": evaluation["total_tests"],
        "passed_tests": evaluation["passed_tests"],
        "score": evaluation["score"],
        "ai_help_used": ai_help_used,
        "kind": kind,
        "created_at": now_iso(),
    }
    doc.set(record)
    if update_progress:
        progress_ref = collection("learning_progress").document(f"{user_id}_python_{problem['module_id']}")
        existing = progress_ref.get().to_dict() or {}
        lesson_completed = bool(existing.get("lesson_completed", False))
        practice_completed = bool(existing.get("practice_completed", False)) or bool(existing.get("completed", False))
        coding_completed = bool(existing.get("coding_completed", False)) or bool(evaluation["passed"])
        completed = lesson_completed and practice_completed and coding_completed
        progress_ref.set(
            {
                "user_id": user_id,
                "skill_id": "python",
                "module_id": problem["module_id"],
                "lesson_completed": lesson_completed,
                "practice_completed": practice_completed,
                "coding_completed": coding_completed,
                "completed": completed,
                "attempts": attempt_number,
                "best_score": max(int(existing.get("best_score") or 0), int(evaluation["score"])),
                "updated_at": now_iso(),
                **({"completed_at": now_iso()} if completed and not existing.get("completed_at") else {}),
            },
            merge=True,
        )
    return record


def coding_summary(user_id: str, problem_id: str | None = None) -> dict[str, Any]:
    attempts = list_attempts(user_id, problem_id)
    best = max((int(item.get("score") or 0) for item in attempts), default=0)
    passed = sum(1 for item in attempts if item.get("passed"))
    return {
        "attempts": len(attempts),
        "passed": passed,
        "best_score": best,
        "latest": attempts[-1] if attempts else None,
        "problem_id": problem_id,
    }


def update_learning_progress_after_lesson(user_id: str, module_id: str, *, lesson_completed: bool = True, practice_completed: bool = True) -> dict[str, Any]:
    doc_id = f"{user_id}_python_{module_id}"
    ref = collection("learning_progress").document(doc_id)
    existing = ref.get().to_dict() or {}
    coding_completed = bool(existing.get("coding_completed", False))
    completed = bool(lesson_completed and practice_completed and coding_completed)
    payload = {
        "user_id": user_id,
        "skill_id": "python",
        "module_id": str(module_id),
        "lesson_completed": lesson_completed,
        "practice_completed": practice_completed,
        "coding_completed": coding_completed,
        "completed": completed,
        "updated_at": now_iso(),
        **({"completed_at": now_iso()} if completed and not existing.get("completed_at") else {}),
    }
    ref.set(payload, merge=True)
    return payload


def recent_activity_for_user(user_id: str, limit: int = 10) -> list[dict[str, Any]]:
    attempts = list_attempts(user_id)
    return attempts[-limit:]
