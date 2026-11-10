"""
Adaptive Conversation Manager for Gnani VoicePrep AI
Handles:
- Explicit Interview Stages:
  GREETING -> READINESS_CHECK -> SELF_INTRODUCTION -> TECHNICAL_INTERVIEW ->
  ADAPTIVE_FOLLOW_UP -> SCENARIO_INTERVIEW -> HR_INTERVIEW -> CLOSING -> FINAL_REPORT
- Context-Aware Acknowledgment & Dynamic Follow-up Generation based on candidate's latest transcript
- Non-repeating randomized question selection adapted to candidate answers and role
"""
import re
import random
from typing import Optional, Dict, Any, Tuple
from app.models import SessionState, QuestionItem, QuestionEvaluation
from app.data.interview_bank import (
    QUESTION_BANK,
    get_questions_for_role,
    get_intro_question,
    INTRO_QUESTION
)

STAGE_GREETING = "GREETING"
STAGE_READINESS = "READINESS_CHECK"
STAGE_INTRO = "SELF_INTRODUCTION"
STAGE_TECHNICAL = "TECHNICAL_INTERVIEW"
STAGE_FOLLOW_UP = "ADAPTIVE_FOLLOW_UP"
STAGE_SCENARIO = "SCENARIO_INTERVIEW"
STAGE_HR = "HR_INTERVIEW"
STAGE_CLOSING = "CLOSING"
STAGE_COMPLETED = "FINAL_REPORT"

class AdaptiveConversationEngine:
    """
    Manages conversational transitions, context extraction, dynamic follow-ups,
    and stage progressions.
    """

    def create_initial_item(self, session: SessionState) -> Tuple[QuestionItem, str]:
        """
        Creates the opening human-like conversational question item and prompt text.
        Every interview starts with a warm greeting, not an abrupt technical prompt.
        """
        role_name = session.config.role_name
        if session.config.mode == "company":
            stage = STAGE_GREETING
            greeting_text = (
                f"Hello! Welcome to your interview. I'm your AI interviewer today. "
                f"I'll be conducting your interview for the {role_name} position. "
                f"How are you doing today?"
            )
            item = QuestionItem(
                id="conv-greeting",
                role_id="universal",
                category="conversation",
                difficulty="easy",
                title=greeting_text,
                context="Interviewer greeting and ice-breaker to make the candidate comfortable.",
                key_points=["well", "good", "great", "fine", "doing well", "excited", "ready", "hello", "hi"],
                stage=stage
            )
            return item, greeting_text
        else:
            # Practice mode: warm greeting then prompt
            stage = STAGE_TECHNICAL
            available = [q for q in QUESTION_BANK if q.role_id == session.config.role_id]
            if not available:
                available = get_questions_for_role(session.config.role_id)
            selected = random.choice(available) if available else QUESTION_BANK[0]
            speech = f"Hello. Welcome to your practice session for {role_name}. Here is your prompt: {selected.title}"
            selected.stage = stage
            return selected, speech

    def process_and_get_next(
        self,
        session: SessionState,
        latest_transcript: str,
        evaluation: QuestionEvaluation
    ) -> Tuple[Optional[QuestionItem], str, str]:
        """
        Processes candidate answer, updates conversation stage, and returns:
        (next_question_item, speech_text, current_stage)
        """
        current_stage = session.stage
        transcript_clean = latest_transcript.lower().strip()
        role_name = session.config.role_name

        # 1. GREETING -> READINESS_CHECK
        if current_stage == STAGE_GREETING:
            session.stage = STAGE_READINESS
            session.topics_covered.append("greeting")

            # Extract mood acknowledgment
            ack = self._acknowledge_greeting(transcript_clean)
            prompt = f"{ack} Are you comfortable and ready to begin?"

            item = QuestionItem(
                id="conv-readiness",
                role_id="universal",
                category="conversation",
                difficulty="easy",
                title=prompt,
                context="Readiness confirmation before beginning evaluation.",
                key_points=["yes", "ready", "comfortable", "sure", "begin", "start", "absolutely"],
                stage=STAGE_READINESS
            )
            session.current_question = item
            return item, prompt, STAGE_READINESS

        # 2. READINESS_CHECK -> SELF_INTRODUCTION
        elif current_stage == STAGE_READINESS:
            session.stage = STAGE_INTRO
            session.topics_covered.append("readiness")

            prompt = "Great! Let's start with a brief introduction. Could you please tell me about yourself?"
            intro_item = QuestionItem(
                id="intro-self",
                role_id="universal",
                category="self_introduction",
                difficulty="easy",
                title="Could you please tell me about yourself?",
                context="Candidate background, experience, projects, and tech stack.",
                key_points=["background", "education", "experience", "projects", "skills", "technologies"],
                stage=STAGE_INTRO
            )
            session.current_question = intro_item
            session.asked_question_ids.append("intro-self")
            return intro_item, prompt, STAGE_INTRO

        # 3. SELF_INTRODUCTION -> ADAPTIVE_FOLLOW_UP (or first technical question)
        elif current_stage == STAGE_INTRO:
            session.topics_covered.append("self_introduction")
            # Analyze keywords mentioned by candidate in introduction
            tech_entity = self._extract_tech_entity(transcript_clean, session.config.tech_stack)

            if tech_entity and session.follow_up_count < 1:
                session.stage = STAGE_FOLLOW_UP
                session.follow_up_count += 1
                prompt = (
                    f"That's very interesting. You mentioned working with {tech_entity}. "
                    f"What was the most challenging problem you solved while working with {tech_entity}?"
                )
                item = QuestionItem(
                    id=f"follow-intro-{tech_entity.lower().replace(' ', '-')}",
                    role_id=session.config.role_id,
                    category="project_experience",
                    difficulty="medium",
                    title=prompt,
                    context=f"Adaptive follow-up exploring candidate's hands-on experience with {tech_entity}.",
                    key_points=[tech_entity.lower(), "challenge", "solved", "architecture", "impact", "solution"],
                    stage=STAGE_FOLLOW_UP
                )
                session.current_question = item
                session.asked_question_ids.append(item.id)
                return item, prompt, STAGE_FOLLOW_UP
            else:
                return self._select_next_domain_question(session, latest_transcript, evaluation.overall_score)

        # 4. ADAPTIVE_FOLLOW_UP / TECHNICAL / SCENARIO / HR
        else:
            # Check if we should generate an in-depth follow-up on the technical response
            should_follow_up = (
                session.follow_up_count < 2 and
                evaluation.overall_score >= 65 and
                len(transcript_clean.split()) > 20 and
                current_stage in (STAGE_TECHNICAL, STAGE_SCENARIO)
            )

            if should_follow_up:
                detail_entity = self._extract_deep_entity(transcript_clean)
                if detail_entity:
                    session.stage = STAGE_FOLLOW_UP
                    session.follow_up_count += 1
                    prompt = (
                        f"I see. You mentioned {detail_entity}. "
                        f"How did you decide on that approach, and what trade-offs did you consider?"
                    )
                    item = QuestionItem(
                        id=f"follow-detail-{random.randint(100, 999)}",
                        role_id=session.config.role_id,
                        category="problem_solving",
                        difficulty="hard" if evaluation.overall_score >= 80 else "medium",
                        title=prompt,
                        context=f"Adaptive deep-dive into {detail_entity} trade-offs and decision rationale.",
                        key_points=[detail_entity, "trade-offs", "decision", "performance", "alternatives"],
                        stage=STAGE_FOLLOW_UP
                    )
                    session.current_question = item
                    session.asked_question_ids.append(item.id)
                    return item, prompt, STAGE_FOLLOW_UP

            # Otherwise proceed to next domain question
            return self._select_next_domain_question(session, latest_transcript, evaluation.overall_score)

    def _select_next_domain_question(
        self,
        session: SessionState,
        latest_transcript: str,
        previous_score: int
    ) -> Tuple[Optional[QuestionItem], str, str]:
        # Count only substantive evaluative questions toward target
        eval_count = len([e for e in session.history if e.category != "conversation"])
        target_limit = getattr(session.config, "target_questions", None) or session.total_questions

        if eval_count >= target_limit:
            session.stage = STAGE_CLOSING
            closing_speech = (
                f"Thank you very much. That concludes our structured interview questions for the "
                f"{session.config.role_name} position today. You did a great job walking me through your experience. "
                f"Our recruitment evaluation team will review your responses. Have a wonderful day!"
            )
            item = QuestionItem(
                id="conv-closing",
                role_id="universal",
                category="conversation",
                difficulty="easy",
                title=closing_speech,
                context="Interview conclusion and wrap-up.",
                key_points=["thank you", "bye", "thanks"],
                stage=STAGE_CLOSING
            )
            session.current_question = item
            return item, closing_speech, STAGE_CLOSING

        # Determine next domain stage
        dist = getattr(session.config, "distribution_ratio", "balanced")
        asked_categories = [e.category for e in session.history]

        if "technical_knowledge" not in asked_categories:
            target_stage = STAGE_TECHNICAL
            preferred_cats = ["technical_knowledge"]
        elif "scenario_based" not in asked_categories and dist != "hr_heavy":
            target_stage = STAGE_SCENARIO
            preferred_cats = ["scenario_based", "problem_solving"]
        elif "behavioural" not in asked_categories and (dist == "hr_heavy" or eval_count >= 2):
            target_stage = STAGE_HR
            preferred_cats = ["behavioural", "hr"]
        else:
            target_stage = STAGE_TECHNICAL
            preferred_cats = ["technical_knowledge", "problem_solving", "project_experience"]

        session.stage = target_stage

        pool = get_questions_for_role(session.config.role_id)
        candidates = [
            q for q in pool
            if q.id not in session.asked_question_ids and q.category in preferred_cats
        ]

        if not candidates:
            candidates = [q for q in pool if q.id not in session.asked_question_ids and q.category != "self_introduction"]

        if not candidates:
            candidates = [q for q in QUESTION_BANK if q.id not in session.asked_question_ids and q.category != "self_introduction"]

        # If completely exhausted, pick any role question
        if not candidates:
            candidates = pool

        # Difficulty adaptation
        if session.config.difficulty.lower() == "adaptive":
            if previous_score >= 80:
                diff_filter = [q for q in candidates if q.difficulty == "hard"]
            elif previous_score <= 60:
                diff_filter = [q for q in candidates if q.difficulty == "easy"]
            else:
                diff_filter = [q for q in candidates if q.difficulty == "medium"]

            if diff_filter:
                candidates = diff_filter

        selected = random.choice(candidates)
        selected.stage = target_stage
        session.current_question = selected
        session.asked_question_ids.append(selected.id)

        # Build natural spoken bridge
        bridge = self._build_natural_bridge(target_stage, latest_transcript)
        speech = f"{bridge} {selected.title}"

        return selected, speech, target_stage

    def _acknowledge_greeting(self, text: str) -> str:
        if any(w in text for w in ["great", "awesome", "fantastic", "wonderful"]):
            return "Wonderful to hear that! It's a pleasure to connect with you."
        if any(w in text for w in ["good", "fine", "well", "doing well"]):
            return "Glad to hear that you are doing well."
        if any(w in text for w in ["nervous", "anxious"]):
            return "No need to worry at all. This is a conversational assessment to highlight your strengths."
        return "Thank you. It is a pleasure to meet you today."

    def _build_natural_bridge(self, stage: str, prior_answer: str) -> str:
        words = prior_answer.split()
        if stage == STAGE_TECHNICAL:
            return "Thank you for that context. Let's move to our next technical topic."
        elif stage == STAGE_SCENARIO:
            return "I understand your perspective. Now, let's explore how you handle real-world engineering scenarios."
        elif stage == STAGE_HR:
            return "That was very clear. Next, I'd like to ask you a question about collaboration and communication."
        return "Thank you for that explanation. Let's examine our next prompt."

    def _extract_tech_entity(self, text: str, tech_stack: list) -> Optional[str]:
        # Check against role tech stack
        for t in tech_stack:
            if t.lower() in text:
                return t

        # Common tech keywords
        common = ["Python", "FastAPI", "React", "Java", "Spring Boot", "Kafka", "Docker", "AWS", "SQL", "PostgreSQL", "Node.js", "Redis", "MongoDB", "Kubernetes"]
        for c in common:
            if c.lower() in text:
                return c
        return None

    def _extract_deep_entity(self, text: str) -> Optional[str]:
        # Search for interesting technical verbs or objects
        patterns = [
            r"using ([a-zA-Z0-9_\-\.]+)",
            r"implemented ([a-zA-Z0-9_\-\.]+)",
            r"optimized ([a-zA-Z0-9_\-\.]+)",
            r"migrated ([a-zA-Z0-9_\-\.]+)",
            r"architecture of ([a-zA-Z0-9_\-\.]+)",
            r"designed ([a-zA-Z0-9_\-\.]+)"
        ]
        for p in patterns:
            m = re.search(p, text, re.IGNORECASE)
            if m:
                entity = m.group(1).strip()
                if len(entity) > 3 and entity.lower() not in ("that", "this", "some", "which", "with"):
                    return entity
        return None

conversation_engine = AdaptiveConversationEngine()
