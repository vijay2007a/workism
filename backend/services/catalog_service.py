from services.firestore import collection, now_iso


DEFAULT_SKILLS = {
    "python": {
        "name": "Python",
        "category": "Programming",
        "level": "Beginner to Advanced",
        "description": "Core Python, APIs, testing, and deployment.",
    },
    "javascript": {
        "name": "JavaScript",
        "category": "Programming",
        "level": "Beginner to Advanced",
        "description": "Modern JavaScript and browser fundamentals.",
    },
    "react": {
        "name": "React",
        "category": "Web Development",
        "level": "Beginner to Advanced",
        "description": "Component-driven frontend development.",
    },
    "sql": {
        "name": "SQL",
        "category": "Database",
        "level": "Beginner to Advanced",
        "description": "Data modeling, querying, and optimization.",
    },
}


def ensure_default_catalog() -> None:
    for skill_id, skill in DEFAULT_SKILLS.items():
        collection("skills").document(skill_id).set({**skill, "created_at": now_iso()}, merge=True)
    collection("assessments").document("python-task-api").set(
        {
            "skill_id": "python",
            "title": "Build a REST API for a Task Management System",
            "difficulty": "Intermediate",
            "max_score": 100,
            "requirements": [
                "User registration/authentication",
                "CRUD operations",
                "Data validation",
                "Error handling",
                "Unit tests",
                "README documentation",
                "Proper project structure",
            ],
            "created_at": now_iso(),
        },
        merge=True,
    )
