"""Extract plain text from uploaded JD / resume files (PDF or image)."""

import logging
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from dependencies.auth import get_current_user
from schemas.aihub import AnalyzePdfRequest, ChatMessage, GenTxtRequest
from schemas.auth import UserResponse
from services.aihub import AIHubService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/interview", tags=["interview"])

IMAGE_MODEL = "gemini-3.1-pro-preview"
MAX_DATA_URI_CHARS = 28 * 1024 * 1024

INSTRUCTIONS = {
    "jd": "这是一份招聘岗位描述（JD）。请完整、忠实地提取其中的全部文字，包括公司、岗位名称、岗位职责、任职要求、加分项等，保持原有条目结构，输出纯文本，不要添加任何解释或总结。",
    "resume": "这是一份个人简历。请完整、忠实地提取其中的全部文字，包括基本信息、教育经历、工作经历、项目经历、技能等，保持原有段落和条目结构，输出纯文本，不要添加任何解释或总结。",
}


class ExtractTextRequest(BaseModel):
    file: str = Field(..., description="Base64 data URI of a PDF or image")
    kind: Literal["jd", "resume"] = "jd"


class ExtractTextResponse(BaseModel):
    text: str


@router.post("/extract_text", response_model=ExtractTextResponse)
async def extract_text(
    body: ExtractTextRequest,
    _user: UserResponse = Depends(get_current_user),
) -> ExtractTextResponse:
    data = body.file.strip()
    if not data.startswith("data:"):
        raise HTTPException(status_code=400, detail="文件格式无效，请重新上传")
    if len(data) > MAX_DATA_URI_CHARS:
        raise HTTPException(status_code=400, detail="文件过大，请上传 20MB 以内的文件")

    mime = data[5 : data.find(";")].lower() if ";" in data else ""
    instruction = INSTRUCTIONS[body.kind]
    service = AIHubService()

    try:
        if mime == "application/pdf":
            result = await service.analyze_pdf(
                AnalyzePdfRequest(pdf=data, instruction=instruction, mode="extract")
            )
            text = result.result
        elif mime.startswith("image/"):
            response = await service.gentxt(
                GenTxtRequest(
                    model=IMAGE_MODEL,
                    stream=False,
                    messages=[
                        ChatMessage(
                            role="user",
                            content=[
                                {"type": "text", "text": instruction},
                                {"type": "image_url", "image_url": {"url": data}},
                            ],
                        )
                    ],
                )
            )
            text = response.content
        else:
            raise HTTPException(status_code=400, detail="仅支持 PDF 或图片（PNG/JPG/WebP）")
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.exception("extract_text failed")
        raise HTTPException(status_code=500, detail=f"文件解析失败：{exc}") from exc

    text = (text or "").strip()
    if text.startswith("```"):
        text = text.strip("`").split("\n", 1)[-1].strip()
    if len(text) < 10:
        raise HTTPException(status_code=422, detail="未能从文件中识别出有效文字，请换一份更清晰的文件")
    return ExtractTextResponse(text=text)
