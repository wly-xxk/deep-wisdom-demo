import json
import logging
from typing import List, Optional

from datetime import datetime, date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.knowledge_marks import Knowledge_marksService
from dependencies.auth import get_current_user
from schemas.auth import UserResponse

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/knowledge_marks", tags=["knowledge_marks"])


# ---------- Pydantic Schemas ----------
class Knowledge_marksData(BaseModel):
    """Entity data schema (for create/update)"""
    tech_id: int
    tech_name: str = None
    mastery: str = None
    favorited: bool = None
    personal_notes: str = None


class Knowledge_marksUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    tech_id: Optional[int] = None
    tech_name: Optional[str] = None
    mastery: Optional[str] = None
    favorited: Optional[bool] = None
    personal_notes: Optional[str] = None


class Knowledge_marksResponse(BaseModel):
    """Entity response schema"""
    id: int
    user_id: str
    tech_id: int
    tech_name: Optional[str] = None
    mastery: Optional[str] = None
    favorited: Optional[bool] = None
    personal_notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class Knowledge_marksListResponse(BaseModel):
    """List response schema"""
    items: List[Knowledge_marksResponse]
    total: int
    skip: int
    limit: int


class Knowledge_marksBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[Knowledge_marksData]


class Knowledge_marksBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: Knowledge_marksUpdateData


class Knowledge_marksBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[Knowledge_marksBatchUpdateItem]


class Knowledge_marksBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=Knowledge_marksListResponse)
async def query_knowledge_markss(
    query: str = Query(None, description='Query conditions as JSON, e.g. {"id":2} or {"id":{"$gte":2}}'),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Query knowledge_markss with filtering, sorting, and pagination (user can only see their own records)"""
    logger.debug(f"Querying knowledge_markss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = Knowledge_marksService(db)
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
        logger.debug(f"Found {result['total']} knowledge_markss")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Invalid knowledge_marks query: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error querying knowledge_markss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=Knowledge_marksListResponse)
async def query_knowledge_markss_all(
    query: str = Query(None, description='Query conditions as JSON, e.g. {"id":2} or {"id":{"$gte":2}}'),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query knowledge_markss with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying knowledge_markss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = Knowledge_marksService(db)
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
        logger.debug(f"Found {result['total']} knowledge_markss")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Invalid knowledge_marks query: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error querying knowledge_markss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=Knowledge_marksResponse)
async def get_knowledge_marks(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single knowledge_marks by ID (user can only see their own records)"""
    logger.debug(f"Fetching knowledge_marks with id: {id}, fields={fields}")
    
    service = Knowledge_marksService(db)
    try:
        result = await service.get_by_id(id, user_id=str(current_user.id))
        if not result:
            logger.warning(f"Knowledge_marks with id {id} not found")
            raise HTTPException(status_code=404, detail="Knowledge_marks not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching knowledge_marks {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=Knowledge_marksResponse, status_code=201)
async def create_knowledge_marks(
    data: Knowledge_marksData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new knowledge_marks"""
    logger.debug(f"Creating new knowledge_marks with data: {data}")
    
    service = Knowledge_marksService(db)
    try:
        result = await service.create(data.model_dump(), user_id=str(current_user.id))
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create knowledge_marks")
        
        logger.info(f"Knowledge_marks created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating knowledge_marks: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating knowledge_marks: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[Knowledge_marksResponse], status_code=201)
async def create_knowledge_markss_batch(
    request: Knowledge_marksBatchCreateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create multiple knowledge_markss in a single request"""
    logger.debug(f"Batch creating {len(request.items)} knowledge_markss")
    
    service = Knowledge_marksService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump(), user_id=str(current_user.id))
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} knowledge_markss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[Knowledge_marksResponse])
async def update_knowledge_markss_batch(
    request: Knowledge_marksBatchUpdateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update multiple knowledge_markss in a single request (requires ownership)"""
    logger.debug(f"Batch updating {len(request.items)} knowledge_markss")
    
    service = Knowledge_marksService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict, user_id=str(current_user.id))
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} knowledge_markss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=Knowledge_marksResponse)
async def update_knowledge_marks(
    id: int,
    data: Knowledge_marksUpdateData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing knowledge_marks (requires ownership)"""
    logger.debug(f"Updating knowledge_marks {id} with data: {data}")

    service = Knowledge_marksService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict, user_id=str(current_user.id))
        if not result:
            logger.warning(f"Knowledge_marks with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Knowledge_marks not found")
        
        logger.info(f"Knowledge_marks {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating knowledge_marks {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating knowledge_marks {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_knowledge_markss_batch(
    request: Knowledge_marksBatchDeleteRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple knowledge_markss by their IDs (requires ownership)"""
    logger.debug(f"Batch deleting {len(request.ids)} knowledge_markss")
    
    service = Knowledge_marksService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id, user_id=str(current_user.id))
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} knowledge_markss successfully")
        return {"message": f"Successfully deleted {deleted_count} knowledge_markss", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_knowledge_marks(
    id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a single knowledge_marks by ID (requires ownership)"""
    logger.debug(f"Deleting knowledge_marks with id: {id}")
    
    service = Knowledge_marksService(db)
    try:
        success = await service.delete(id, user_id=str(current_user.id))
        if not success:
            logger.warning(f"Knowledge_marks with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Knowledge_marks not found")
        
        logger.info(f"Knowledge_marks {id} deleted successfully")
        return {"message": "Knowledge_marks deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting knowledge_marks {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")