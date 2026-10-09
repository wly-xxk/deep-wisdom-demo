"""Multi-agent orchestration for InterviewPrep.

Three agents share one persisted session state:

1. JD Analyst   — parses a JD into a structured ability matrix and calls the
                  global knowledge base tool (query + generate + insert).
2. Interviewer  — stateful mock interviewer with memory, tool calls and an
                  explicit decision loop (follow_up / switch_topic / end).
3. Reviewer     — turns the finished dialogue into a review report.

Tool calls are produced by the orchestration layer and recorded verbatim on the
dialogue, so the UI can prove the agents really used tools and reasons.
"""

import json
import logging
import re
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.ext.asyncio import AsyncSession

from models.knowledge_points import Knowledge_points
from schemas.aihub import ChatMessage, GenTxtRequest
from services.aihub import AIHubService
from services.knowledge_tools import (
    as_str_list,
    extract_json_block,
    generate_knowledge_payloads,
    insert_knowledge_point,
    knowledge_point_view,
    query_knowledge_point,
)

logger = logging.getLogger(__name__)

ANALYST_MODEL = "claude-opus-5"
INTERVIEWER_MODEL = "gpt-5.4"
REVIEWER_MODEL = "claude-opus-5"

VALID_CATEGORIES = ["技术深度", "工程能力", "架构思维", "软技能"]
VALID_EXAM_METHODS = ["原理问答", "项目深挖", "场景设计", "系统设计"]
VALID_PRIORITIES = ["P0", "P1", "P2"]
VALID_GAP_STATUS = ["gap", "partial", "covered"]

MAX_JD_CHARS = 6000
MAX_RESUME_CHARS = 6000
MAX_ROUNDS = 10
MIN_QUESTIONS = 3
MAX_ABILITY_ITEMS = 12

_generic_service: Optional[AIHubService] = None


def _service() -> AIHubService:
    global _generic_service
    if _generic_service is None:
        _generic_service = AIHubService()
    return _generic_service


async def _generate_json(
    system_prompt: str, user_prompt: str, model: str, max_tokens: int = 4096
) -> Dict[str, Any]:
    """Run a non-streaming generation and parse the JSON payload, with one repair retry."""
    service = _service()
    request = GenTxtRequest(
        messages=[
            ChatMessage(role="system", content=system_prompt),
            ChatMessage(role="user", content=user_prompt),
        ],
        model=model,
        stream=False,
        temperature=0.3,
        max_tokens=max_tokens,
    )
    response = await service.gentxt(request)
    raw = (response.content or "").strip()
    block = extract_json_block(raw)
    try:
        data = json.loads(block)
    except json.JSONDecodeError:
        repair = GenTxtRequest(
            messages=[
                ChatMessage(role="system", content="把下面的内容修复为合法 JSON，只输出 JSON。"),
                ChatMessage(role="user", content=block[:8000]),
            ],
            model=model,
            stream=False,
            temperature=0,
            max_tokens=max_tokens,
        )
        repaired = await service.gentxt(repair)
        data = json.loads(extract_json_block(repaired.content or ""))
    if not isinstance(data, dict):
        raise ValueError("模型返回的结构不是 JSON 对象")
    return data


def _pick(value: Any, allowed: List[str], default: str) -> str:
    text = (value or "").strip() if isinstance(value, str) else ""
    if text in allowed:
        return text
    for option in allowed:
        if option.lower() == text.lower():
            return option
    return default


def _clamp_int(value: Any, low: int, high: int, default: int) -> int:
    try:
        number = int(round(float(value)))
    except (TypeError, ValueError):
        return default
    return max(low, min(high, number))


def _clip(text: str, limit: int) -> str:
    text = (text or "").strip()
    return text if len(text) <= limit else text[:limit] + "…"


# ---------------------------------------------------------------------------
# Agent 1: JD Analyst
# ---------------------------------------------------------------------------


async def analyze_jd(
    db: AsyncSession, jd_text: str, company: str = "", position: str = ""
) -> Dict[str, Any]:
    """Parse the JD into an ability matrix and link knowledge base entries.

    Returns the payload persisted to ``jd_analyses``.
    """
    context = ""
    if company or position:
        context = f"公司：{company or '未知'}；岗位：{position or '未知'}\n"

    system_prompt = (
        "你是资深技术面试官兼 JD 分析师。你的任务是把招聘 JD 拆解为结构化的能力矩阵。"
        "只输出严格 JSON，不要输出任何解释文本。"
    )
    user_prompt = (
        f"{context}请分析下面的 JD，输出能力矩阵。JSON 结构：\n"
        "{\n"
        '  "company": "公司名，未提到则为空字符串",\n'
        '  "position": "岗位名，未提到则为空字符串",\n'
        '  "summary": "一句话总结该岗位的考察重心",\n'
        '  "abilities": [\n'
        "    {\n"
        '      "name": "能力项名称，如 大规模监控体系设计",\n'
        '      "category": "技术深度 | 工程能力 | 架构思维 | 软技能",\n'
        '      "exam_method": "原理问答 | 项目深挖 | 场景设计 | 系统设计",\n'
        '      "priority": "P0 | P1 | P2",\n'
        '      "jd_reference": "该能力项对应的 JD 原句",\n'
        '      "technologies": ["Kubernetes", "Prometheus"]\n'
        "    }\n"
        "  ]\n"
        "}\n"
        "要求：\n"
        f"1. 提取 {MAX_ABILITY_ITEMS} 条以内的核心能力项，按重要性排序，P0 必须有 2-4 条。\n"
        "2. technologies 只填通用技术名词，不要填公司内部系统名；没有明确技术则给空数组。\n"
        "3. 全部使用中文描述。\n"
        f"JD 原文：\n{_clip(jd_text, MAX_JD_CHARS)}"
    )

    payload = await _generate_json(system_prompt, user_prompt, ANALYST_MODEL, max_tokens=4096)

    raw_abilities = payload.get("abilities")
    if not isinstance(raw_abilities, list) or not raw_abilities:
        raise ValueError("JD 分析未产出能力项，请补充更完整的 JD 文本后重试")

    abilities: List[Dict[str, Any]] = []
    tech_order: List[str] = []
    for index, item in enumerate(raw_abilities[:MAX_ABILITY_ITEMS]):
        if not isinstance(item, dict):
            continue
        name = (item.get("name") or "").strip()
        if not name:
            continue
        technologies = as_str_list(item.get("technologies"))
        abilities.append(
            {
                "id": f"A{index + 1}",
                "name": name,
                "category": _pick(item.get("category"), VALID_CATEGORIES, "技术深度"),
                "exam_method": _pick(item.get("exam_method"), VALID_EXAM_METHODS, "项目深挖"),
                "priority": _pick(item.get("priority"), VALID_PRIORITIES, "P1"),
                "jd_reference": (item.get("jd_reference") or "").strip(),
                "technologies": technologies,
                "knowledge_refs": [],
            }
        )
        for tech in technologies:
            key = tech.strip().lower()
            if key and key not in [t.lower() for t in tech_order]:
                tech_order.append(tech.strip())

    if not abilities:
        raise ValueError("JD 分析未产出有效能力项，请重试")

    # Tool use, DB phase 1 (read): look up the global knowledge base by exact name.
    views: Dict[str, Dict[str, Any]] = {}
    for tech in tech_order:
        existing = await query_knowledge_point(db, tech)
        if existing:
            view = knowledge_point_view(existing)
            view["is_new"] = False
            views[tech.lower()] = view
            existing.feedback_count = (existing.feedback_count or 0) + 1
    await db.commit()

    # Tool use, AI step: generate content only for technologies still missing.
    missing = [tech for tech in tech_order if tech.lower() not in views]
    generated_payloads = await generate_knowledge_payloads(missing)

    # Tool use, DB phase 2 (write): insert generated points into the global base.
    for tech, payload in generated_payloads.items():
        point = await insert_knowledge_point(db, payload)
        view = knowledge_point_view(point)
        view["is_new"] = True
        views[tech] = view
    await db.commit()

    tags: List[Dict[str, Any]] = []
    seen_ids: set = set()
    for tech in tech_order:
        view = views.get(tech.lower())
        if not view or view["id"] in seen_ids:
            continue
        tags.append(view)
        seen_ids.add(view["id"])

    for ability in abilities:
        ability["knowledge_refs"] = [
            views[tech.lower()]["id"] for tech in ability["technologies"] if tech.lower() in views
        ]

    return {
        "company": (payload.get("company") or company or "").strip(),
        "position": (payload.get("position") or position or "").strip(),
        "summary": (payload.get("summary") or "").strip(),
        "abilities": abilities,
        "knowledge_tags": tags,
        "status": "analyzed",
    }


# ---------------------------------------------------------------------------
# Gap analysis pipeline step
# ---------------------------------------------------------------------------


async def analyze_gap(
    abilities: List[Dict[str, Any]], resume_text: str
) -> Dict[str, Any]:
    """Compare the ability matrix against resume evidence (pipeline step, not an agent)."""
    if not abilities:
        raise ValueError("缺少能力矩阵，请先完成 JD 分析")

    ability_brief = [
        {
            "ability_id": item.get("id"),
            "name": item.get("name"),
            "priority": item.get("priority"),
            "technologies": item.get("technologies", []),
        }
        for item in abilities
    ]

    system_prompt = (
        "你是严谨的技术简历评估专家。你要逐条比对岗位能力项与简历证据，判断覆盖程度。"
        "只输出严格 JSON，不要输出解释文本。"
    )
    user_prompt = (
        "请对每个能力项给出覆盖判断。JSON 结构：\n"
        '{"gaps": [{"ability_id": "A1", "status": "gap | partial | covered", '
        '"resume_evidence": "简历中的对应证据原文，没有则空字符串", '
        '"coverage_score": 0, "suggestion": "针对性补充建议"}], "summary": "一句话整体差距总结"}\n'
        "判定口径（必须严格遵守）：\n"
        "- gap：简历完全未提及该能力项对应技术 → coverage_score < 30\n"
        "- partial：简历提到但证据不充分 → coverage_score 30-70\n"
        "- covered：简历有充分证据 → coverage_score >= 70\n"
        "要求：gaps 必须覆盖全部能力项，且 ability_id 必须与输入一致。全部使用中文。\n"
        f"能力项列表：{json.dumps(ability_brief, ensure_ascii=False)}\n"
        f"简历原文：\n{_clip(resume_text, MAX_RESUME_CHARS)}"
    )

    payload = await _generate_json(system_prompt, user_prompt, ANALYST_MODEL, max_tokens=4096)
    raw_gaps = payload.get("gaps")
    if not isinstance(raw_gaps, list):
        raise ValueError("差距分析失败，请重试")

    by_id: Dict[str, Dict[str, Any]] = {}
    for item in raw_gaps:
        if isinstance(item, dict):
            key = str(item.get("ability_id") or "").strip()
            if key:
                by_id[key] = item

    gaps: List[Dict[str, Any]] = []
    for ability in abilities:
        ability_id = ability.get("id")
        item = by_id.get(str(ability_id), {})
        score = _clamp_int(item.get("coverage_score"), 0, 100, 0)
        status = _pick(item.get("status"), VALID_GAP_STATUS, "")
        if not status:
            status = "gap" if score < 30 else ("partial" if score < 70 else "covered")
        # Keep the documented thresholds authoritative over a mislabelled status.
        if score < 30:
            status = "gap"
        elif score < 70:
            status = "partial"
        else:
            status = "covered"
        gaps.append(
            {
                "ability_id": ability_id,
                "ability_name": ability.get("name"),
                "category": ability.get("category"),
                "priority": ability.get("priority"),
                "status": status,
                "resume_evidence": (item.get("resume_evidence") or "").strip(),
                "coverage_score": score,
                "suggestion": (item.get("suggestion") or "").strip(),
            }
        )

    return {"gaps": gaps, "summary": (payload.get("summary") or "").strip()}


# ---------------------------------------------------------------------------
# Agent 2: Interviewer
# ---------------------------------------------------------------------------


def _ability_map(abilities: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    return {str(item.get("id")): item for item in abilities if item.get("id")}


def _gap_map(gaps: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    return {str(item.get("ability_id")): item for item in gaps if item.get("ability_id")}


def get_next_ability(
    abilities: List[Dict[str, Any]],
    gaps: List[Dict[str, Any]],
    remaining: List[str],
) -> Optional[str]:
    """Tool: get_next_ability() — pick the next ability by gap severity then priority.

    Order: gap > partial > covered, then P0 > P1 > P2, then original order.
    """
    if not remaining:
        return None
    status_rank = {"gap": 0, "partial": 1, "covered": 2}
    priority_rank = {"P0": 0, "P1": 1, "P2": 2}
    gap_index = _gap_map(gaps)
    ability_index = _ability_map(abilities)

    def sort_key(ability_id: str) -> Tuple[int, int, int]:
        gap = gap_index.get(str(ability_id), {})
        ability = ability_index.get(str(ability_id), {})
        order = [str(a.get("id")) for a in abilities].index(str(ability_id)) if str(ability_id) in [
            str(a.get("id")) for a in abilities
        ] else 99
        return (
            status_rank.get(gap.get("status", "covered"), 2),
            priority_rank.get(ability.get("priority", "P2"), 2),
            order,
        )

    return sorted([str(item) for item in remaining], key=sort_key)[0]


def evaluate_end_conditions(
    abilities: List[Dict[str, Any]],
    gaps: List[Dict[str, Any]],
    examined: List[str],
    round_count: int,
    user_ended: bool = False,
) -> Tuple[bool, str]:
    """Return (should_end, reason). `end` is a forced terminal condition."""
    if user_ended:
        return True, "用户主动结束面试"
    p0_ids = [str(a.get("id")) for a in abilities if a.get("priority") == "P0"]
    p0_all_covered = all(str(aid) in [str(e) for e in examined] for aid in p0_ids) if p0_ids else True
    if p0_all_covered and round_count >= MIN_QUESTIONS:
        return True, "P0 必考项已全覆盖且已完成至少 3 题"
    if round_count >= MAX_ROUNDS:
        return True, f"已达到单场 {MAX_ROUNDS} 轮上限（兜底结束）"
    return False, ""


async def interviewer_turn(
    abilities: List[Dict[str, Any]],
    gaps: List[Dict[str, Any]],
    dialogue: List[Dict[str, Any]],
    examined: List[str],
    remaining: List[str],
    current_ability_id: Optional[str],
    round_count: int,
    knowledge_index: Dict[str, Dict[str, Any]],
    user_answer: Optional[str] = None,
    user_ended: bool = False,
) -> Dict[str, Any]:
    """Produce the next interviewer turn: candidate decision -> tool calls -> question.

    ``knowledge_index`` is prefetched by the caller (lowercase tech name -> knowledge
    payload) so no database query runs while AI calls are in flight.

    Returns ``{dialogue, abilities_examined, abilities_remaining, current_ability_id,
    round_count, status}``.
    """
    ability_index = _ability_map(abilities)
    gap_index = _gap_map(gaps)
    tool_calls: List[Dict[str, Any]] = []
    records: List[Dict[str, Any]] = []

    # --- Phase 1: score the previous answer (record_answer tool) -------------
    if user_answer:
        current = ability_index.get(str(current_ability_id), {})
        last_question = next(
            (m.get("content", "") for m in reversed(dialogue) if m.get("type") == "question"), ""
        )
        score_prompt = (
            "你是技术面试官。请评估候选人对上一道题的作答，只输出 JSON：\n"
            '{"score": 0-100 的整数, "good": "答得好的地方", "weak": "不足（遗漏/深度不够/缺数据）", '
            '"improvement": "更优的回答骨架，不是完整答案", "decision": "follow_up | switch_topic"}\n'
            "decision 判定：回答有亮点但不够深，或遗漏关键子点 → follow_up；"
            "当前能力项已充分讨论或完全答不上来 → switch_topic。全部使用中文。\n"
            f"考察能力项：{current.get('name', '')}（{current.get('category', '')}，"
            f"考察方式 {current.get('exam_method', '')}，优先级 {current.get('priority', '')}）\n"
            f"上一个问题：{last_question}\n"
            f"候选人回答：{user_answer}"
        )
        try:
            evaluation = await _generate_json(
                "你只输出严格 JSON。", score_prompt, INTERVIEWER_MODEL, max_tokens=1200
            )
        except Exception as exc:  # noqa: BLE001 - keep the interview usable
            logger.warning("Answer scoring failed: %s", type(exc).__name__)
            evaluation = {}

        score = _clamp_int(evaluation.get("score"), 0, 100, 60)
        ability_id = str(current_ability_id) if current_ability_id else ""
        records.append(
            {
                "role": "interviewer",
                "type": "feedback",
                "ability_id": ability_id,
                "feedback": {
                    "good": (evaluation.get("good") or "").strip(),
                    "weak": (evaluation.get("weak") or "").strip(),
                    "improvement": (evaluation.get("improvement") or "").strip(),
                },
                "score": score,
                "decision": _pick(evaluation.get("decision"), ["follow_up", "switch_topic"], ""),
                "tool_calls": [
                    {
                        "name": "record_answer",
                        "args": {"ability_id": ability_id, "score": score},
                        "result": "已记录到面试记录",
                    }
                ],
            }
        )
        tool_calls.append({"name": "record_answer", "args": {"ability_id": ability_id, "score": score}})

        if ability_id and ability_id not in [str(e) for e in examined]:
            examined.append(ability_id)
        remaining = [str(item) for item in remaining if str(item) != ability_id]

    # --- Phase 2: forced terminal conditions ---------------------------------
    should_end, end_reason = evaluate_end_conditions(
        abilities, gaps, examined, round_count, user_ended
    )
    if should_end:
        if records:
            records[-1]["decision"] = "end"
            records[-1]["end_reason"] = end_reason
        records.append(
            {
                "role": "interviewer",
                "type": "system",
                "content": f"面试结束：{end_reason}。接下来为你生成复盘报告。",
                "decision": "end",
                "tool_calls": [],
            }
        )
        return {
            "records": records,
            "tool_calls": tool_calls,
            "abilities_examined": examined,
            "abilities_remaining": remaining,
            "current_ability_id": current_ability_id,
            "round_count": round_count,
            "status": "finished",
        }

    # --- Phase 3: choose the next ability (get_next_ability tool) ------------
    previous_decision = records[-1].get("decision") if records else ""
    next_ability_id = current_ability_id
    if not user_answer or previous_decision == "switch_topic" or not current_ability_id:
        picked = get_next_ability(abilities, gaps, remaining) if remaining else None
        tool_calls.append(
            {"name": "get_next_ability", "args": {"remaining": remaining}, "result": picked or ""}
        )
        if picked:
            next_ability_id = picked
        elif current_ability_id:
            # All abilities examined but P2 supplementary questions stay on topic.
            next_ability_id = current_ability_id
        else:
            should_end, end_reason = True, "所有能力项已考察完毕"
            records.append(
                {
                    "role": "interviewer",
                    "type": "system",
                    "content": f"面试结束：{end_reason}。接下来为你生成复盘报告。",
                    "decision": "end",
                    "tool_calls": [],
                }
            )
            return {
                "records": records,
                "tool_calls": tool_calls,
                "abilities_examined": examined,
                "abilities_remaining": remaining,
                "current_ability_id": current_ability_id,
                "round_count": round_count,
                "status": "finished",
            }

    ability = ability_index.get(str(next_ability_id), {})
    gap = gap_index.get(str(next_ability_id), {})

    # Tool use: consult the knowledge base before asking, so the question stays on exam points.
    knowledge_context = ""
    question_tools: List[Dict[str, Any]] = []
    for tech in ability.get("technologies", [])[:2]:
        point = knowledge_index.get(tech.strip().lower())
        if point:
            exam_points = point.get("common_exam_points") or []
            knowledge_context += f"{point.get('name')}：{'; '.join(exam_points[:3])}\n"
            question_tools.append(
                {
                    "name": "query_knowledge_base",
                    "args": {"tech": tech},
                    "result": f"命中 {point.get('name')}，核心考点 {len(exam_points)} 条",
                }
            )
        else:
            question_tools.append(
                {"name": "query_knowledge_base", "args": {"tech": tech}, "result": "未命中，按通用考点提问"}
            )
        tool_calls.append({"name": "query_knowledge_base", "args": {"tech": tech}})

    question_prompt = (
        "你是严格但有建设性的技术面试官，正在做模拟面试。请提出下一个问题，只输出 JSON：\n"
        '{"question": "面试问题", "focus": "本题想考察的子点"}\n'
        "要求：问题必须口语化、可回答、单一焦点；结合候选人缺口设计；不要重复已问过的问题。"
        "全部使用中文。\n"
        f"考察能力项：{ability.get('name', '')}（分类 {ability.get('category', '')}，"
        f"考察方式 {ability.get('exam_method', '')}，优先级 {ability.get('priority', '')}）\n"
        f"JD 原句：{ability.get('jd_reference', '')}\n"
        f"候选人缺口：{gap.get('status', 'unknown')}（覆盖分 {gap.get('coverage_score', 0)}），"
        f"建议方向：{gap.get('suggestion', '')}\n"
        f"关联技术：{', '.join(ability.get('technologies', []))}\n"
        f"知识点库参考：{knowledge_context or '（无）'}\n"
        f"已问过的问题：{json.dumps([m.get('content') for m in records if m.get('type') == 'question'][-4:], ensure_ascii=False)}\n"
        f"历史对话摘要：{json.dumps([{'role': m.get('role'), 'content': _clip(str(m.get('content') or m.get('feedback') or ''), 160)} for m in dialogue[-6:]], ensure_ascii=False)}"
    )

    try:
        generated = await _generate_json(
            "你只输出严格 JSON。", question_prompt, INTERVIEWER_MODEL, max_tokens=1200
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Question generation failed: %s", type(exc).__name__)
        generated = {}

    question = (generated.get("question") or "").strip() or (
        f"请结合你的项目经历讲讲 {ability.get('name', '这个能力项')} 你是怎么做的？"
    )

    records.append(
        {
            "role": "interviewer",
            "type": "question",
            "ability_id": str(next_ability_id) if next_ability_id else "",
            "content": question,
            "focus": (generated.get("focus") or "").strip(),
            "decision": "follow_up" if user_answer and previous_decision == "follow_up" else "switch_topic",
            "tool_calls": question_tools,
        }
    )
    tool_calls.append({"name": "generate_question", "args": {"ability_id": next_ability_id}})

    return {
        "records": records,
        "tool_calls": tool_calls,
        "abilities_examined": examined,
        "abilities_remaining": remaining,
        "current_ability_id": str(next_ability_id) if next_ability_id else None,
        "round_count": round_count + 1,
        "status": "ongoing",
    }


# ---------------------------------------------------------------------------
# Agent 3: Reviewer
# ---------------------------------------------------------------------------


def _compute_dimension_scores(
    abilities: List[Dict[str, Any]], dialogues: List[Dict[str, Any]]
) -> Dict[str, int]:
    """Aggregate per-category scores from the recorded feedback."""
    scores: Dict[str, List[int]] = {}
    ability_index = _ability_map(abilities)
    for message in dialogues:
        if message.get("type") != "feedback":
            continue
        ability = ability_index.get(str(message.get("ability_id")), {})
        category = ability.get("category") or "技术深度"
        scores.setdefault(category, []).append(_clamp_int(message.get("score"), 0, 100, 0))
    return {
        category: int(round(sum(values) / len(values))) if values else 0
        for category, values in scores.items()
    }


async def generate_report(
    abilities: List[Dict[str, Any]],
    gaps: List[Dict[str, Any]],
    dialogue: List[Dict[str, Any]],
    company: str = "",
    position: str = "",
) -> Dict[str, Any]:
    """Build the review report: overall score, radar data, per-question review, top gaps."""
    answered = [m for m in dialogue if m.get("type") == "feedback"]
    covered_count = len(answered)

    conversation_brief = [
        {
            "ability": next(
                (a.get("name") for a in abilities if str(a.get("id")) == str(m.get("ability_id"))), ""
            ),
            "question": _clip(str(m.get("content") or ""), 200),
            "answer": _clip(str(m.get("answer") or ""), 400),
            "score": m.get("score"),
            "feedback": m.get("feedback"),
        }
        for m in dialogue
        if m.get("type") in ("question", "answer", "feedback")
    ]

    system_prompt = (
        "你是面试复盘专家。请基于完整面试记录输出复盘报告。只输出严格 JSON，不要解释文本。"
    )
    user_prompt = (
        "请输出复盘报告。JSON 结构：\n"
        '{"overall_score": 0-100 的整数, "summary": "整体评价（3-4 句）", '
        '"highlights": ["表现亮点"], '
        '"question_reviews": [{"ability_name": "能力项", "score": 0-100, "good": "好的方面", '
        '"weak": "不足", "improvement": "改进建议"}], '
        '"top_gaps": [{"ability_name": "最薄弱能力项", "reason": "为什么薄弱", "advice": "专项建议"}]}\n'
        "评分口径：综合覆盖度、表达质量、回答深度，直接给出 0-100 整数，不做分档。\n"
        "要求：question_reviews 必须覆盖每一道已提问的问题；top_gaps 最多 3 条；全部使用中文。\n"
        f"目标岗位：{company or '未知公司'} / {position or '未知岗位'}\n"
        f"能力矩阵：{json.dumps(abilities, ensure_ascii=False)[:3000]}\n"
        f"差距分析：{json.dumps(gaps, ensure_ascii=False)[:2000]}\n"
        f"面试记录：{json.dumps(conversation_brief, ensure_ascii=False)[:6000]}"
    )

    try:
        payload = await _generate_json(system_prompt, user_prompt, REVIEWER_MODEL, max_tokens=4096)
    except Exception as exc:  # noqa: BLE001 - still return a usable report
        logger.warning("Report generation failed: %s", type(exc).__name__)
        payload = {}

    dimension_scores = _compute_dimension_scores(abilities, dialogue)
    if not dimension_scores:
        dimension_scores = {"技术深度": 0}

    average = int(round(sum(dimension_scores.values()) / len(dimension_scores)))
    overall = _clamp_int(payload.get("overall_score"), 0, 100, average)

    ability_index = _ability_map(abilities)
    reviews: List[Dict[str, Any]] = []
    for item in payload.get("question_reviews") or []:
        if not isinstance(item, dict):
            continue
        reviews.append(
            {
                "ability_name": (item.get("ability_name") or "").strip(),
                "score": _clamp_int(item.get("score"), 0, 100, 0),
                "good": (item.get("good") or "").strip(),
                "weak": (item.get("weak") or "").strip(),
                "improvement": (item.get("improvement") or "").strip(),
            }
        )
    if not reviews:
        for message in answered:
            ability = ability_index.get(str(message.get("ability_id")), {})
            feedback = message.get("feedback") or {}
            reviews.append(
                {
                    "ability_name": ability.get("name") or "未命名能力项",
                    "score": _clamp_int(message.get("score"), 0, 100, 0),
                    "good": feedback.get("good", ""),
                    "weak": feedback.get("weak", ""),
                    "improvement": feedback.get("improvement", ""),
                }
            )

    top_gaps: List[Dict[str, Any]] = []
    for item in payload.get("top_gaps") or []:
        if not isinstance(item, dict):
            continue
        top_gaps.append(
            {
                "ability_name": (item.get("ability_name") or "").strip(),
                "reason": (item.get("reason") or "").strip(),
                "advice": (item.get("advice") or "").strip(),
            }
        )
    if not top_gaps:
        weakest = sorted(gaps, key=lambda g: _clamp_int(g.get("coverage_score"), 0, 100, 100))[:3]
        top_gaps = [
            {
                "ability_name": gap.get("ability_name") or "",
                "reason": f"简历覆盖度 {gap.get('coverage_score', 0)} 分（{gap.get('status', '')}）",
                "advice": gap.get("suggestion") or "",
            }
            for gap in weakest
        ]

    return {
        "overall_score": overall,
        "summary": (payload.get("summary") or "").strip(),
        "highlights": as_str_list(payload.get("highlights")),
        "question_reviews": reviews,
        "top_gaps": top_gaps[:3],
        "dimension_scores": dimension_scores,
        "questions_answered": covered_count,
        "radar": [{"dimension": key, "score": value} for key, value in dimension_scores.items()],
    }
