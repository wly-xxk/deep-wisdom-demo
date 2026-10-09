"""Knowledge base tool layer.

The global knowledge base is shared by all users. Agents use these helpers as
tools: an exact-name lookup first, and an LLM-backed generation + insert when a
technology is not yet covered.
"""

import json
import logging
import re
from typing import Any, Dict, List, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.knowledge_points import Knowledge_points
from schemas.aihub import ChatMessage, GenTxtRequest
from services.aihub import AIHubService

logger = logging.getLogger(__name__)

KNOWLEDGE_MODEL = "deepseek-v4-pro"


def extract_json_block(text: str) -> str:
    """Pull the first JSON object/array out of a model response."""
    cleaned = (text or "").strip()
    if cleaned.startswith("```"):
        match = re.search(r"```(?:json)?\n(.*?)```", cleaned, re.DOTALL)
        if match:
            cleaned = match.group(1).strip()
    obj_start, obj_end = cleaned.find("{"), cleaned.rfind("}")
    arr_start, arr_end = cleaned.find("["), cleaned.rfind("]")
    if arr_start >= 0 and arr_end > arr_start and (obj_start < 0 or arr_start < obj_start):
        return cleaned[arr_start : arr_end + 1]
    if obj_start >= 0 and obj_end > obj_start:
        return cleaned[obj_start : obj_end + 1]
    return cleaned


def as_str_list(value: Any) -> List[str]:
    """Coerce arbitrary model output into a clean list of strings."""
    if value is None:
        return []
    if isinstance(value, str):
        parts = re.split(r"[,，;；\n]", value)
        return [p.strip() for p in parts if p.strip()]
    if isinstance(value, (list, tuple)):
        result: List[str] = []
        for item in value:
            if isinstance(item, str) and item.strip():
                result.append(item.strip())
            elif isinstance(item, dict):
                for key in ("name", "text", "title", "point"):
                    if isinstance(item.get(key), str) and item[key].strip():
                        result.append(item[key].strip())
                        break
        return result
    return []


async def query_knowledge_point(db: AsyncSession, name: str) -> Optional[Knowledge_points]:
    """Tool: query_knowledge_base(tech_name) — exact (case-insensitive) name match."""
    target = (name or "").strip().lower()
    if not target:
        return None
    result = await db.execute(
        select(Knowledge_points).where(func.lower(Knowledge_points.name) == target).limit(1)
    )
    return result.scalars().first()


async def list_knowledge_points(
    db: AsyncSession, skip: int = 0, limit: int = 100, keyword: Optional[str] = None
) -> Dict[str, Any]:
    """List knowledge points, optionally filtered by a name keyword."""
    stmt = select(Knowledge_points)
    count_stmt = select(func.count()).select_from(Knowledge_points)
    if keyword:
        pattern = f"%{keyword.strip().lower()}%"
        stmt = stmt.where(func.lower(Knowledge_points.name).like(pattern))
        count_stmt = count_stmt.where(func.lower(Knowledge_points.name).like(pattern))
    stmt = stmt.order_by(Knowledge_points.feedback_count.desc(), Knowledge_points.name.asc())
    stmt = stmt.offset(skip).limit(limit)
    rows = (await db.execute(stmt)).scalars().all()
    total = (await db.execute(count_stmt)).scalar() or 0
    return {"items": rows, "total": total}


async def generate_knowledge_payloads(tech_names: List[str]) -> Dict[str, Dict[str, Any]]:
    """Generate knowledge point content for technologies missing from the global base."""
    if not tech_names:
        return {}

    prompt = (
        "你是后端技术专家，请为下列技术生成结构化面试知识点。只输出 JSON，不要任何解释。\n"
        "JSON 结构：{\"items\": [{\"name\": \"技术名\", \"category\": \"分类\", "
        "\"definition\": \"一句话定义\", \"key_points\": [\"核心要点\"], "
        "\"common_exam_points\": [\"常见面试考点\"], \"related_technologies\": [\"关联技术\"]}]}\n"
        f"需要生成的技术：{', '.join(tech_names)}\n"
        "要求：每个技术都要覆盖；key_points 与 common_exam_points 各 3-5 条，用中文。"
    )

    service = AIHubService()
    request = GenTxtRequest(
        messages=[
            ChatMessage(role="system", content="你只输出严格的 JSON，不输出多余文本。"),
            ChatMessage(role="user", content=prompt),
        ],
        model=KNOWLEDGE_MODEL,
        stream=False,
        temperature=0.3,
        max_tokens=4096,
    )

    try:
        response = await service.gentxt(request)
        payload_text = extract_json_block(response.content)
        data = json.loads(payload_text)
    except Exception as exc:  # noqa: BLE001 - degrade gracefully, JD analysis must not fail
        logger.warning("Knowledge generation failed, falling back to stubs: %s", type(exc).__name__)
        data = {}

    items = data.get("items") if isinstance(data, dict) else None
    result: Dict[str, Dict[str, Any]] = {}
    if isinstance(items, list):
        for item in items:
            if not isinstance(item, dict):
                continue
            name = (item.get("name") or "").strip()
            if not name:
                continue
            result[name.lower()] = {
                "name": name,
                "category": (item.get("category") or "通用技术").strip() or "通用技术",
                "definition": (item.get("definition") or "").strip(),
                "key_points": as_str_list(item.get("key_points")),
                "common_exam_points": as_str_list(item.get("common_exam_points")),
                "related_technologies": as_str_list(item.get("related_technologies")),
            }

    for name in tech_names:
        key = name.strip().lower()
        if key and key not in result:
            result[key] = {
                "name": name.strip(),
                "category": "通用技术",
                "definition": f"{name.strip()} 相关技术点。",
                "key_points": [],
                "common_exam_points": [],
                "related_technologies": [],
            }
    return result


async def insert_knowledge_point(db: AsyncSession, payload: Dict[str, Any]) -> Knowledge_points:
    """Insert a newly generated knowledge point into the global base."""
    point = Knowledge_points(
        name=payload.get("name", "").strip(),
        category=payload.get("category") or "通用技术",
        definition=payload.get("definition") or "",
        key_points=as_str_list(payload.get("key_points")),
        common_exam_points=as_str_list(payload.get("common_exam_points")),
        related_technologies=as_str_list(payload.get("related_technologies")),
        version=1,
        feedback_count=0,
    )
    db.add(point)
    await db.flush()
    return point


async def build_knowledge_index(
    db: AsyncSession, tech_names: List[str]
) -> Dict[str, Dict[str, Any]]:
    """Prefetch knowledge payloads by lowercase tech name for one DB phase."""
    index: Dict[str, Dict[str, Any]] = {}
    for tech in tech_names:
        name = (tech or "").strip()
        if not name or name.lower() in index:
            continue
        point = await query_knowledge_point(db, name)
        if point:
            index[name.lower()] = knowledge_point_view(point)
    return index


def knowledge_point_view(point: Knowledge_points) -> Dict[str, Any]:
    """Serialize a knowledge point into the shape used by the ability matrix."""
    return {
        "id": point.id,
        "name": point.name,
        "category": point.category or "通用技术",
        "definition": point.definition or "",
        "key_points": list(point.key_points or []),
        "common_exam_points": list(point.common_exam_points or []),
        "related_technologies": list(point.related_technologies or []),
        "is_new": False,
    }
