import re
from typing import List, Dict, Any
from app.models import QuestionEvaluation

FILLER_WORDS = {
    "en": ["um", "uh", "like", "you know", "basically", "actually", "literally", "sort of", "kind of"],
    "hi": ["matlab", "basically", "jaise ki", "aur kya", "haan toh", "samjho", "like"],
    "te": ["ante", "ante kada", "basically", "like", "mari", "ade"]
}

STAR_KEYWORDS = [
    "situation", "task", "action", "result", "outcome", "impact", 
    "challenge", "solved", "metric", "improved", "led", "developed", 
    "built", "designed", "architected", "optimized"
]

class InterviewEvaluator:
    """
    Evaluates candidate spoken responses against structured interview rubrics:
    1. Relevance to context & key concepts
    2. STAR Structure & articulation
    3. Clarity and concise communication (filler density)
    4. Technical & problem-solving depth
    """

    def evaluate(
        self,
        transcript: str,
        category_id: str,
        question_title: str,
        key_points: List[str],
        language: str = "en-IN"
    ) -> Dict[str, Any]:
        cleaned_text = transcript.lower().strip()
        words = re.findall(r'\b\w+\b', cleaned_text)
        word_count = len(words)

        # 1. Relevance Score
        matched_points = 0
        for kp in key_points:
            kp_words = [w.lower() for w in re.findall(r'\b\w+\b', kp) if len(w) > 3]
            if any(w in cleaned_text for w in kp_words):
                matched_points += 1
        
        relevance_ratio = (matched_points / max(1, len(key_points)))
        relevance_score = int(min(98, max(45, 50 + (relevance_ratio * 45))))

        # 2. Structure & STAR Score
        star_hits = sum(1 for kw in STAR_KEYWORDS if kw in cleaned_text)
        structure_score = int(min(95, max(40, 52 + (star_hits * 8))))

        # 3. Clarity & Filler Score
        filler_count = 0
        lang_key = "te" if "te" in language else ("hi" if "hi" in language else "en")
        active_fillers = FILLER_WORDS.get(lang_key, FILLER_WORDS["en"])
        for filler in active_fillers:
            filler_count += len(re.findall(r'\b' + re.escape(filler) + r'\b', cleaned_text))
            
        filler_ratio = filler_count / max(1, word_count)
        if filler_ratio < 0.03:
            clarity_score = 92
        elif filler_ratio < 0.07:
            clarity_score = 80
        elif filler_ratio < 0.12:
            clarity_score = 68
        else:
            clarity_score = 55

        # 4. Technical & Problem-solving Depth
        has_metrics = bool(re.search(r'\d+[%kKmM]?|\bpercent\b|\bseconds\b|\bmilliseconds\b', cleaned_text))
        tech_score = 58
        if word_count > 30:
            tech_score += 14
        if word_count > 60:
            tech_score += 10
        if has_metrics:
            tech_score += 12
        if matched_points >= 2:
            tech_score += 6
        tech_score = min(96, tech_score)

        problem_solving_score = int(min(96, max(45, (structure_score * 0.6) + (tech_score * 0.4))))

        # Overall weighted score
        overall_score = int(
            relevance_score * 0.30 +
            tech_score * 0.30 +
            structure_score * 0.20 +
            clarity_score * 0.20
        )

        if overall_score >= 85:
            rating = "Outstanding Candidate Response"
        elif overall_score >= 70:
            rating = "Strong & Competent"
        elif overall_score >= 55:
            rating = "Acceptable with Growth Areas"
        else:
            rating = "Needs Refinement & Practice"

        # Extract Evidence Concepts
        technical_keywords = [
            "api", "database", "sql", "cache", "redis", "concurrency", "thread",
            "docker", "kubernetes", "microservices", "spring", "python", "react",
            "kafka", "message queue", "orm", "indexing", "asynchronous", "async",
            "latency", "throughput", "schema", "rest", "json", "git", "ci/cd"
        ]
        extracted_concepts = [kw for kw in technical_keywords if kw in cleaned_text]
        if not extracted_concepts:
            extracted_concepts = [w for w in words if len(w) > 5][:4]

        rubric_matched = []
        for kp in key_points:
            kp_words = [w.lower() for w in re.findall(r'\b\w+\b', kp) if len(w) > 3]
            if any(w in cleaned_text for w in kp_words):
                rubric_matched.append(kp)

        evidence_notes = (
            f"Evidence verified: {len(rubric_matched)} key concepts addressed ({', '.join(rubric_matched[:3]) if rubric_matched else 'generic technical discussion'}). "
            f"Spoken length: {word_count} words. Filler density: {filler_count} instances."
        )

        # Generate Strengths
        strengths = []
        if matched_points >= 1 or relevance_score >= 75:
            strengths.append("Addressed the core interview prompt with relevant technical context.")
        if has_metrics:
            strengths.append("Quantified engineering metrics and business impact effectively.")
        if clarity_score >= 80:
            strengths.append("Communicated with smooth cadence and minimal filler words.")
        if star_hits >= 2 or structure_score >= 75:
            strengths.append("Clear structural articulation detailing specific actions and outcomes.")
        if not strengths:
            strengths.append("Demonstrated foundational familiarity and prompt response.")

        # Generate Improvement Points
        improvements = []
        if not has_metrics:
            improvements.append("Quantify outcomes with concrete figures (e.g. latency reduced by X%, throughput, test coverage).")
        if star_hits < 2:
            improvements.append("Adopt the STAR format: specify the Situation, your exact Task, Action taken, and measurable Result.")
        if filler_count >= 2:
            improvements.append(f"Detected {filler_count} conversational filler words. Practice silent pauses to project executive presence.")
        if word_count < 40:
            improvements.append("Elaborate on architectural alternatives considered and why your chosen path was superior.")
        if not improvements:
            improvements.append("Keep practicing high-level summaries before drilling into technical minutiae.")

        suggested_structure = (
            "1. Situation & Objective: 15-20s setting the stage.\n"
            "2. Action & Decision Rationale: 30-40s covering your specific role, technical tools, and problem-solving.\n"
            "3. Measurable Result: 15s quantifying the business and engineering impact."
        )

        # Spoken feedback tailored for Gnani Timbre TTS
        if overall_score >= 80:
            spoken_feedback = (
                f"Well done! You scored {overall_score} out of 100. "
                "Your explanation was solid and relevant. "
                "Next, let's explore deeper technical edge cases."
            )
        else:
            spoken_feedback = (
                f"Good attempt, scoring {overall_score} out of 100. "
                "Be sure to quantify your results with metrics and keep answers structured."
            )

        return {
            "overall_score": overall_score,
            "rating": rating,
            "relevance_score": relevance_score,
            "technical_score": tech_score,
            "problem_solving_score": problem_solving_score,
            "communication_score": clarity_score,
            "structure_score": structure_score,
            "strengths": strengths,
            "improvements": improvements,
            "suggested_structure": suggested_structure,
            "spoken_feedback": spoken_feedback,
            "extracted_concepts": extracted_concepts,
            "evidence_notes": evidence_notes,
            "evaluated_competency": category_id,
            "rubric_criteria_matched": rubric_matched
        }

evaluator = InterviewEvaluator()
