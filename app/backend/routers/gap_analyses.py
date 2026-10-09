import json
import logging
from typing import List, Optional

from datetime import datetime, date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.gap_analyses import Gap_analysesService
from dependencies.auth import get_current_user
from schemas.auth import UserResponse

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/gap_analyses", tags=["gap_analyses"])


# ---------- Pydantic Schemas ----------
class Gap_analysesData(BaseModel):
    """Entity data schema (for create/update)"""
    jd_id: int
    resume_text: str
    gaps: Optional[dict] = None
    summary: str = None


class Gap_analysesUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    jd_id: Optional[int] = None
    resume_text: Optional[str] = None
    gaps: Optional[dict] = None
    summary: Optional[str] = None


class Gap_analysesResponse(BaseModel):
    """Entity response schema"""
    id: int
    user_id: str
    jd_id: int
    resume_text: str
    gaps: Optional[dict] = None
    summary: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class Gap_analysesListResponse(BaseModel):
    """List response schema"""
    items: List[Gap_analysesResponse]
    total: int
    skip: int
    limit: int


class Gap_analysesBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[Gap_analysesData]


class Gap_analysesBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: Gap_analysesUpdateData


class Gap_analysesBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[Gap_analysesBatchUpdateItem]


class Gap_analysesBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=Gap_analysesListResponse)
async def query_gap_analysess(
    query: str = Query(None, description='Query conditions as JSON, e.g. {"id":2} or {"id":{"$gte":2}}'),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Query gap_analysess with filtering, sorting, and pagination (user can only see their own records)"""
    logger.debug(f"Querying gap_analysess: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = Gap_analysesService(db)
    try:
        # Parse query JSON if provided
        query_dict = None
        if query:
            try:
                query_dict = json.loads(query)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid query JSON format")
        
        result = await service.get_list(
            skip=skip, 
            limit=limit,
            query_dict=query_dict,
            sort=sort,
            user_id=str(current_user.id),
        )
        logger.debug(f"Found {result['total']} gap_analysess")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Invalid gap_analyses query: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error querying gap_analysess: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=Gap_analysesListResponse)
async def query_gap_analysess_all(
    query: str = Query(None, description='Query conditions as JSON, e.g. {"id":2} or {"id":{"$gte":2}}'),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query gap_analysess with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying gap_analysess: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = Gap_analysesService(db)
    try:
        # Parse query JSON if provided
        query_dict = None
        if query:
            try:
                query_dict = json.loads(query)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid query JSON format")

        result = await service.get_list(
            skip=skip,
            limit=limit,
            query_dict=query_dict,
            sort=sort
        )
        logger.debug(f"Found {result['total']} gap_analysess")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Invalid gap_analyses query: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error querying gap_analysess: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=Gap_analysesResponse)
async def get_gap_analyses(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single gap_analyses by ID (user can only see their own records)"""
    logger.debug(f"Fetching gap_analyses with id: {id}, fields={fields}")
    
    service = Gap_analysesService(db)
    try:
        result = await service.get_by_id(id, user_id=str(current_user.id))
        if not result:
            logger.warning(f"Gap_analyses with id {id} not found")
            raise HTTPException(status_code=404, detail="Gap_analyses not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching gap_analyses {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=Gap_analysesResponse, status_code=201)
async def create_gap_analyses(
    data: Gap_analysesData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new gap_analyses"""
    logger.debug(f"Creating new gap_analyses with data: {data}")
    
    service = Gap_analysesService(db)
    try:
        result = await service.create(data.model_dump(), user_id=str(current_user.id))
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create gap_analyses")
        
        logger.info(f"Gap_analyses created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating gap_analyses: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating gap_analyses: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[Gap_analysesResponse], status_code=201)
async def create_gap_analysess_batch(
    request: Gap_analysesBatchCreateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create multiple gap_analysess in a single request"""
    logger.debug(f"Batch creating {len(request.items)} gap_analysess")
    
    service = Gap_analysesService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump(), user_id=str(current_user.id))
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} gap_analysess successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[Gap_analysesResponse])
async def update_gap_analysess_batch(
    request: Gap_analysesBatchUpdateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update multiple gap_analysess in a single request (requires ownership)"""
    logger.debug(f"Batch updating {len(request.items)} gap_analysess")
    
    service = Gap_analysesService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict, user_id=str(current_user.id))
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} gap_analysess successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=Gap_analysesResponse)
async def update_gap_analyses(
    id: int,
    data: Gap_analysesUpdateData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing gap_analyses (requires ownership)"""
    logger.debug(f"Updating gap_analyses {id} with data: {data}")

    service = Gap_analysesService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict, user_id=str(current_user.id))
        if not result:
            logger.warning(f"Gap_analyses with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Gap_analyses not found")
        
        logger.info(f"Gap_analyses {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating gap_analyses {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating gap_analyses {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_gap_analysess_batch(
    request: Gap_analysesBatchDeleteRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple gap_analysess by their IDs (requires ownership)"""
    logger.debug(f"Batch deleting {len(request.ids)} gap_analysess")
    
    service = Gap_analysesService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id, user_id=str(current_user.id))
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} gap_analysess successfully")
        return {"message": f"Successfully deleted {deleted_count} gap_analysess", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_gap_analyses(
    id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a single gap_analyses by ID (requires ownership)"""
    logger.debug(f"Deleting gap_analyses with id: {id}")
    
    service = Gap_analysesService(db)
    try:
        success = await service.delete(id, user_id=str(current_user.id))
        if not success:
            logger.warning(f"Gap_analyses with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Gap_analyses not found")
        
        logger.info(f"Gap_analyses {id} deleted successfully")
        return {"message": "Gap_analyses deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting gap_analyses {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")