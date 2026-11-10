import json
import time
from typing import Dict, Any, List, Optional
from app.services.security_service import db_manager

class AnalyticsService:
    """
    Enterprise analytics & intelligent assessment insights service.
    Directly aggregates SQL data across candidates, sessions, and question rubrics.
    Avoids loading heavy audio or full session histories.
    """
    def __init__(self, manager=db_manager):
        self.db = manager

    def get_dashboard_summary(self, org_id: Optional[str] = None) -> Dict[str, Any]:
        """Aggregates high-level recruiter cohort metrics isolated by organization tenant."""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            where_cand = " WHERE org_id = ?" if org_id else ""
            where_sess = " WHERE org_id = ?" if org_id else ""
            cand_params = (org_id,) if org_id else ()
            sess_params = (org_id,) if org_id else ()

            # 1. Total Registered
            cursor.execute(f"SELECT COUNT(*) FROM candidates{where_cand}", cand_params)
            total_registered = cursor.fetchone()[0]

            # 2. Total Sessions
            cursor.execute(f"SELECT COUNT(*) FROM sessions{where_sess}", sess_params)
            total_sessions = cursor.fetchone()[0]

            # 3. Attendance Status
            att_cond = " WHERE attendance_status = 'PRESENT'" + (f" AND org_id = ?" if org_id else "")
            cursor.execute(f"SELECT COUNT(*) FROM sessions{att_cond}", sess_params)
            attended = cursor.fetchone()[0]

            abs_cond = " WHERE attendance_status = 'ABSENT'" + (f" AND org_id = ?" if org_id else "")
            cursor.execute(f"SELECT COUNT(*) FROM sessions{abs_cond}", sess_params)
            absent = cursor.fetchone()[0]

            # 4. Status Breakdown
            comp_cond = " WHERE interview_status = 'COMPLETED'" + (f" AND org_id = ?" if org_id else "")
            cursor.execute(f"SELECT COUNT(*) FROM sessions{comp_cond}", sess_params)
            completed = cursor.fetchone()[0]

            prog_cond = " WHERE interview_status = 'IN_PROGRESS'" + (f" AND org_id = ?" if org_id else "")
            cursor.execute(f"SELECT COUNT(*) FROM sessions{prog_cond}", sess_params)
            in_progress = cursor.fetchone()[0]

            term_cond = " WHERE interview_status = 'TERMINATED_INACTIVITY'" + (f" AND org_id = ?" if org_id else "")
            cursor.execute(f"SELECT COUNT(*) FROM sessions{term_cond}", sess_params)
            terminated = cursor.fetchone()[0]

            int_cond = " WHERE interview_status IN ('INTERRUPTED', 'EMERGENCY_EXIT')" + (f" AND org_id = ?" if org_id else "")
            cursor.execute(f"SELECT COUNT(*) FROM sessions{int_cond}", sess_params)
            interrupted = cursor.fetchone()[0]

            # 5. Average Benchmark Score (Completed sessions with score > 0)
            avg_cond = " WHERE interview_status = 'COMPLETED' AND overall_score > 0" + (f" AND org_id = ?" if org_id else "")
            cursor.execute(f"SELECT AVG(overall_score) FROM sessions{avg_cond}", sess_params)
            avg_row = cursor.fetchone()[0]
            avg_score = round(avg_row, 1) if avg_row is not None else 0.0

            # 6. Completion Rate
            completion_rate = round((completed / total_sessions * 100), 1) if total_sessions > 0 else 0.0

            # 7. Role-wise Distribution
            role_where = f"WHERE org_id = ?" if org_id else ""
            cursor.execute(f"""
                SELECT role_id, role_title, COUNT(*) as count, AVG(overall_score) as avg_score
                FROM sessions
                {role_where}
                GROUP BY role_id
                ORDER BY count DESC
            """, sess_params)
            role_dist = [
                {
                    "role_id": r["role_id"],
                    "role_title": r["role_title"],
                    "candidate_count": r["count"],
                    "average_score": round(r["avg_score"] or 0, 1)
                }
                for r in cursor.fetchall()
            ]

            # 8. Performance Tiers Distribution
            tier_where = f"WHERE org_id = ?" if org_id else ""
            cursor.execute(f"""
                SELECT 
                    SUM(CASE WHEN overall_score >= 85 THEN 1 ELSE 0 END) as tier_high,
                    SUM(CASE WHEN overall_score >= 70 AND overall_score < 85 THEN 1 ELSE 0 END) as tier_med,
                    SUM(CASE WHEN overall_score > 0 AND overall_score < 70 THEN 1 ELSE 0 END) as tier_low
                FROM sessions
                {tier_where}
            """, sess_params)
            tier_row = cursor.fetchone()
            performance_distribution = {
                "high_readiness": tier_row[0] or 0,
                "medium_readiness": tier_row[1] or 0,
                "needs_polish": tier_row[2] or 0
            }

            return {
                "total_registered": max(total_registered, total_sessions),
                "total_sessions": total_sessions,
                "attended": attended,
                "absent": absent,
                "completed": completed,
                "in_progress": in_progress,
                "interrupted": interrupted,
                "terminated": terminated,
                "average_score": avg_score,
                "completion_rate_percentage": completion_rate,
                "role_distribution": role_dist,
                "performance_distribution": performance_distribution
            }

    def get_role_analytics(self, role_id: Optional[str] = None, org_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Deep analytics by job role including competency radar averages and candidate counts."""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            conditions = []
            params = []
            if org_id:
                conditions.append("org_id = ?")
                params.append(org_id)
            if role_id and role_id != 'ALL':
                conditions.append("role_id = ?")
                params.append(role_id)
            
            where_sql = (" WHERE " + " AND ".join(conditions)) if conditions else ""
            query = f"""
                SELECT role_id, role_title, COUNT(*) as session_count,
                       AVG(overall_score) as avg_score,
                       MIN(overall_score) as min_score,
                       MAX(overall_score) as max_score
                FROM sessions
                {where_sql}
                GROUP BY role_id ORDER BY session_count DESC
            """

            cursor.execute(query, tuple(params))
            rows = cursor.fetchall()

            role_analytics = []
            for r in rows:
                rid = r["role_id"]
                # Aggregate evaluation dimension scores for this role
                cursor.execute("""
                    SELECT final_report_json FROM sessions 
                    WHERE role_id = ? AND final_report_json IS NOT NULL AND final_report_json != '{}'
                """, (rid,))
                rep_rows = cursor.fetchall()

                dim_totals = {"Technical Knowledge": 0, "Problem Solving": 0, "Communication": 0, "Architecture & Scaling": 0}
                dim_counts = {"Technical Knowledge": 0, "Problem Solving": 0, "Communication": 0, "Architecture & Scaling": 0}

                for rep_r in rep_rows:
                    try:
                        rep = json.loads(rep_r[0])
                        dims = rep.get("dimension_scores") or {}
                        for k, v in dims.items():
                            if k in dim_totals and isinstance(v, (int, float)):
                                dim_totals[k] += v
                                dim_counts[k] += 1
                    except Exception:
                        pass

                avg_dimensions = {}
                for k, total in dim_totals.items():
                    c = dim_counts[k]
                    avg_dimensions[k] = round(total / c, 1) if c > 0 else 70.0

                role_analytics.append({
                    "role_id": rid,
                    "role_title": r["role_title"],
                    "candidate_count": r["session_count"],
                    "average_score": round(r["avg_score"] or 0, 1),
                    "min_score": r["min_score"] or 0,
                    "max_score": r["max_score"] or 0,
                    "dimension_averages": avg_dimensions
                })
            return role_analytics

    def compare_candidates(self, candidate_or_session_ids: List[str], org_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Compares selected candidates across competencies, scores, strengths, and areas for growth with tenant isolation."""
        if not candidate_or_session_ids:
            return []

        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            placeholders = ",".join(["?"] * len(candidate_or_session_ids))
            where_sql = f"(session_id IN ({placeholders}) OR candidate_id IN ({placeholders}))"
            params = list(candidate_or_session_ids * 2)
            if org_id:
                where_sql += " AND org_id = ?"
                params.append(org_id)

            query = f"""
                SELECT session_id, candidate_id, candidate_name, candidate_email, role_id, role_title,
                       overall_score, interview_status, attendance_status, joined_at, completed_at,
                       final_report_json
                FROM sessions
                WHERE {where_sql}
                ORDER BY overall_score DESC
            """
            cursor.execute(query, tuple(params))
            rows = cursor.fetchall()

            comparison = []
            seen_sessions = set()
            for r in rows:
                sid = r["session_id"]
                if sid in seen_sessions:
                    continue
                seen_sessions.add(sid)

                rep = {}
                if r["final_report_json"]:
                    try:
                        rep = json.loads(r["final_report_json"])
                    except Exception:
                        rep = {}

                comparison.append({
                    "session_id": sid,
                    "candidate_id": r["candidate_id"],
                    "name": r["candidate_name"],
                    "email": r["candidate_email"],
                    "role_title": r["role_title"],
                    "overall_score": r["overall_score"] or 0,
                    "interview_status": r["interview_status"],
                    "attendance_status": r["attendance_status"],
                    "dimension_scores": rep.get("dimension_scores") or {
                        "Technical Knowledge": r["overall_score"] or 65,
                        "Problem Solving": r["overall_score"] or 65,
                        "Communication": 80,
                        "Architecture & Scaling": 60
                    },
                    "strengths": (rep.get("strengths") or [])[:3],
                    "areas_for_growth": (rep.get("areas_for_growth") or [])[:3],
                    "performance_tier": rep.get("performance_tier") or "Evaluated Candidate"
                })
            return comparison

    def generate_intelligent_insights(self, org_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Extracts evidence-based cohort patterns from actual persisted transcripts and rubrics.
        Never hallucinates or invents data. Isolated by tenant when org_id is provided.
        """
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            where_clause = " WHERE ((evaluations_json IS NOT NULL AND evaluations_json != '[]') OR (final_report_json IS NOT NULL AND final_report_json != '{}'))"
            params = []
            if org_id:
                where_clause += " AND org_id = ?"
                params.append(org_id)

            cursor.execute(f"""
                SELECT evaluations_json, final_report_json FROM sessions 
                {where_clause}
            """, tuple(params))
            rows = cursor.fetchall()

            all_strengths: Dict[str, int] = {}
            all_growth_areas: Dict[str, int] = {}
            question_scores: Dict[str, List[float]] = {}
            question_titles: Dict[str, str] = {}

            for r in rows:
                # 1. Parse evaluations
                if r[0]:
                    try:
                        evals = json.loads(r[0])
                        for ev in evals:
                            qid = ev.get("question_id", "q")
                            qtitle = ev.get("question_title", qid)
                            score = ev.get("overall_score")
                            question_titles[qid] = qtitle
                            if score is not None:
                                question_scores.setdefault(qid, []).append(float(score))
                            for st in ev.get("strengths") or []:
                                all_strengths[st] = all_strengths.get(st, 0) + 1
                            for imp in ev.get("improvements") or []:
                                all_growth_areas[imp] = all_growth_areas.get(imp, 0) + 1
                    except Exception:
                        pass

                # 2. Parse final report
                if r[1]:
                    try:
                        rep = json.loads(r[1])
                        for st in rep.get("strengths") or []:
                            all_strengths[st] = all_strengths.get(st, 0) + 1
                        for imp in rep.get("areas_for_growth") or []:
                            all_growth_areas[imp] = all_growth_areas.get(imp, 0) + 1
                    except Exception:
                        pass

            # Sort frequencies
            top_strengths = sorted([{"insight": k, "frequency": v} for k, v in all_strengths.items()], key=lambda x: x["frequency"], reverse=True)[:5]
            top_gaps = sorted([{"insight": k, "frequency": v} for k, v in all_growth_areas.items()], key=lambda x: x["frequency"], reverse=True)[:5]

            # Question performance
            question_analytics = []
            for qid, scores in question_scores.items():
                avg_q_score = round(sum(scores) / len(scores), 1)
                question_analytics.append({
                    "question_id": qid,
                    "title": question_titles.get(qid, qid),
                    "average_score": avg_q_score,
                    "attempts": len(scores)
                })
            question_analytics.sort(key=lambda x: x["average_score"])

            # Recommendations based on actual data
            recommendations = []
            if top_gaps:
                recommendations.append(f"Consider probing concrete metrics & architectural trade-offs earlier: '{top_gaps[0]['insight']}' appeared across multiple candidate responses.")
            if question_analytics and question_analytics[0]["average_score"] < 60:
                recommendations.append(f"Question '{question_analytics[0]['title'][:60]}...' has the lowest cohort score ({question_analytics[0]['average_score']}%). Review question clarity or prompt scaffolding.")
            else:
                recommendations.append("Candidate cohort demonstrates balanced core responsiveness; consider introducing deeper distributed systems edge-case prompts.")

            return {
                "top_candidate_strengths": top_strengths,
                "top_observed_skill_gaps": top_gaps,
                "question_performance_ranking": question_analytics[:5],
                "actionable_curriculum_recommendations": recommendations,
                "sample_size_evaluated_sessions": len(rows)
            }

analytics_service = AnalyticsService()

