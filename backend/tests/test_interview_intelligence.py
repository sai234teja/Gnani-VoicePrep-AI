import pytest
from app.models import SessionState, InterviewConfig, QuestionItem, QuestionEvaluation
from app.services.conversation_engine import conversation_engine, STAGE_GREETING, STAGE_READINESS, STAGE_INTRO, STAGE_TECHNICAL, STAGE_FOLLOW_UP, STAGE_CLOSING
from app.services.evaluator import evaluator

def test_interview_planning_and_greeting_initiation():
    config = InterviewConfig(
        role_id="python-fullstack",
        role_name="Python Full Stack",
        mode="company",
        difficulty="Adaptive",
        target_questions=3,
        interview_duration_minutes=15
    )
    session = SessionState(
        session_id="test-plan-1",
        config=config,
        current_question=QuestionItem(id="temp", role_id="universal", difficulty="easy", title="temp", context="temp", key_points=[]),
        created_at=1000.0
    )

    initial_item, speech = conversation_engine.create_initial_item(session)
    assert initial_item.id == "conv-greeting"
    assert "Hello!" in speech
    assert "Python Full Stack" in speech

def test_mandatory_self_introduction_and_readiness_transition():
    config = InterviewConfig(
        role_id="java-dev",
        role_name="Java Developer",
        mode="company",
        difficulty="Adaptive",
        target_questions=3
    )
    session = SessionState(
        session_id="test-plan-2",
        config=config,
        stage=STAGE_GREETING,
        current_question=QuestionItem(id="conv-greeting", role_id="universal", difficulty="easy", title="Hello", context="Greeting", key_points=[]),
        created_at=1000.0
    )

    # 1. Answer greeting -> Readiness
    item1, speech1, stage1 = conversation_engine.process_and_get_next(
        session, "I am doing well, thank you!", QuestionEvaluation(
            question_id="conv-greeting", question_title="Hello", transcript="doing well",
            detected_language="en-IN", overall_score=80, relevance_score=80,
            problem_solving_score=80, communication_score=90, technical_score=70,
            strengths=[], improvements=[], spoken_feedback="Good"
        )
    )
    assert stage1 == STAGE_READINESS
    assert "comfortable and ready" in speech1

    # 2. Answer readiness -> Self Introduction
    item2, speech2, stage2 = conversation_engine.process_and_get_next(
        session, "Yes I am ready", QuestionEvaluation(
            question_id="conv-readiness", question_title="Ready?", transcript="yes ready",
            detected_language="en-IN", overall_score=85, relevance_score=85,
            problem_solving_score=80, communication_score=90, technical_score=75,
            strengths=[], improvements=[], spoken_feedback="Great"
        )
    )
    assert stage2 == STAGE_INTRO
    assert "tell me about yourself" in speech2.lower()

def test_evidence_extraction_and_rubric_matching():
    candidate_answer = (
        "In my previous project, we migrated our monolith to a Spring Boot microservice architecture with Kafka message queues. "
        "I was tasked with reducing API latency under high concurrency. I implemented Redis caching and optimized database indexing, "
        "which reduced latency by 45 percent and handled 1000 requests per second."
    )
    key_points = ["spring boot", "microservices", "redis", "latency", "kafka"]

    res = evaluator.evaluate(
        transcript=candidate_answer,
        category_id="java-dev",
        question_title="Tell me about a time you optimized microservice performance",
        key_points=key_points,
        language="en-IN"
    )

    assert res["overall_score"] >= 80
    assert "redis" in res["extracted_concepts"] or "spring" in res["extracted_concepts"] or "kafka" in res["extracted_concepts"]
    assert len(res["rubric_criteria_matched"]) >= 2
    assert "Evidence verified:" in res["evidence_notes"]
    assert "Quantified engineering metrics" in res["strengths"][1] or "Quantified engineering metrics" in res["strengths"][0]

def test_adaptive_difficulty_and_duplicate_prevention():
    config = InterviewConfig(
        role_id="python-fullstack",
        role_name="Python Full Stack",
        mode="company",
        difficulty="Adaptive",
        target_questions=3
    )
    session = SessionState(
        session_id="test-plan-3",
        config=config,
        stage=STAGE_TECHNICAL,
        asked_question_ids=["q-prev-1"],
        current_question=QuestionItem(id="q-prev-1", role_id="python-fullstack", difficulty="medium", title="Python Q1", context="Context", key_points=["python"]),
        created_at=1000.0
    )

    # High score (90) -> Difficulty scales to hard
    next_item, speech, stage = conversation_engine.process_and_get_next(
        session, "Comprehensive response detailing Python GIL, multiprocessing and asyncio event loop trade-offs.",
        QuestionEvaluation(
            question_id="q-prev-1", question_title="Python Q1", transcript="test",
            detected_language="en-IN", overall_score=90, relevance_score=95,
            problem_solving_score=90, communication_score=90, technical_score=92,
            strengths=[], improvements=[], spoken_feedback="Excellent"
        )
    )

    assert next_item is not None
    # Avoid duplicate
    assert next_item.id != "q-prev-1"
    assert next_item.id in session.asked_question_ids

def test_graceful_closing_when_target_reached():
    config = InterviewConfig(
        role_id="software-eng",
        role_name="Software Engineer",
        mode="company",
        target_questions=2
    )
    session = SessionState(
        session_id="test-plan-4",
        config=config,
        stage=STAGE_TECHNICAL,
        history=[
            QuestionEvaluation(question_id="q1", question_title="T1", category="technical_knowledge", transcript="a", detected_language="en-IN", overall_score=70, relevance_score=70, problem_solving_score=70, communication_score=70, technical_score=70, strengths=[], improvements=[], spoken_feedback="ok"),
            QuestionEvaluation(question_id="q2", question_title="T2", category="scenario_based", transcript="b", detected_language="en-IN", overall_score=75, relevance_score=75, problem_solving_score=75, communication_score=75, technical_score=75, strengths=[], improvements=[], spoken_feedback="good")
        ],
        current_question=QuestionItem(id="q2", role_id="software-eng", difficulty="medium", title="T2", context="C", key_points=[]),
        created_at=1000.0
    )

    next_item, speech, stage = conversation_engine.process_and_get_next(
        session, "Final response", session.history[-1]
    )

    assert stage == STAGE_CLOSING
    assert "concludes our structured interview" in speech.lower()

