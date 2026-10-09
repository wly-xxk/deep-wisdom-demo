import json
import logging
from typing import List, Optional

from datetime import datetime, date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.knowledge_points import Knowledge_pointsService

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/knowledge_points", tags=["knowledge_points"])


# ---------- Pydantic Schemas ----------
class Knowledge_pointsData(BaseModel):
    """Entity data schema (for create/update)"""
    name: str
    category: str = None
    definition: str = None
    key_points: Optional[List[str]] = None
    common_exam_points: Optional[List[str]] = None
    related_technologies: Optional[List[str]] = None
    version: int = None
    feedback_count: int = None


class Knowledge_pointsUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    name: Optional[str] = None
    category: Optional[str] = None
    definition: Optional[str] = None
    key_points: Optional[List[str]] = None
    common_exam_points: Optional[List[str]] = None
    related_technologies: Optional[List[str]] = None
    version: Optional[int] = None
    feedback_count: Optional[int] = None


class Knowledge_pointsResponse(BaseModel):
    """Entity response schema"""
    id: int
    name: str
    category: Optional[str] = None
    definition: Optional[str] = None
    key_points: Optional[List[str]] = None
    common_exam_points: Optional[List[str]] = None
    related_technologies: Optional[List[str]] = None
    version: Optional[int] = None
    feedback_count: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class Knowledge_pointsListResponse(BaseModel):
    """List response schema"""
    items: List[Knowledge_pointsResponse]
    total: int
    skip: int
    limit: int


class Knowledge_pointsBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[Knowledge_pointsData]


class Knowledge_pointsBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: Knowledge_pointsUpdateData


class Knowledge_pointsBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[Knowledge_pointsBatchUpdateItem]


class Knowledge_pointsBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=Knowledge_pointsListResponse)
async def query_knowledge_pointss(
    query: str = Query(None, description='Query conditions as JSON, e.g. {"id":2} or {"id":{"$gte":2}}'),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Query knowledge_pointss with filtering, sorting, and pagination"""
    logger.debug(f"Querying knowledge_pointss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = Knowledge_pointsService(db)
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
        )
        logger.debug(f"Found {result['total']} knowledge_pointss")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Invalid knowledge_points query: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error querying knowledge_pointss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=Knowledge_pointsListResponse)
async def query_knowledge_pointss_all(
    query: str = Query(None, description='Query conditions as JSON, e.g. {"id":2} or {"id":{"$gte":2}}'),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query knowledge_pointss with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying knowledge_pointss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = Knowledge_pointsService(db)
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
        logger.debug(f"Found {result['total']} knowledge_pointss")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Invalid knowledge_points query: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error querying knowledge_pointss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=Knowledge_pointsResponse)
async def get_knowledge_points(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Get a single knowledge_points by ID"""
    logger.debug(f"Fetching knowledge_points with id: {id}, fields={fields}")
    
    service = Knowledge_pointsService(db)
    try:
        result = await service.get_by_id(id)
        if not result:
            logger.warning(f"Knowledge_points with id {id} not found")
            raise HTTPException(status_code=404, detail="Knowledge_points not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching knowledge_points {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=Knowledge_pointsResponse, status_code=201)
async def create_knowledge_points(
    data: Knowledge_pointsData,
    db: AsyncSession = Depends(get_db),
):
    """Create a new knowledge_points"""
    logger.debug(f"Creating new knowledge_points with data: {data}")
    
    service = Knowledge_pointsService(db)
    try:
        result = await service.create(data.model_dump())
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create knowledge_points")
        
        logger.info(f"Knowledge_points created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating knowledge_points: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating knowledge_points: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[Knowledge_pointsResponse], status_code=201)
async def create_knowledge_pointss_batch(
    request: Knowledge_pointsBatchCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create multiple knowledge_pointss in a single request"""
    logger.debug(f"Batch creating {len(request.items)} knowledge_pointss")
    
    service = Knowledge_pointsService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump())
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} knowledge_pointss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[Knowledge_pointsResponse])
async def update_knowledge_pointss_batch(
    request: Knowledge_pointsBatchUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Update multiple knowledge_pointss in a single request"""
    logger.debug(f"Batch updating {len(request.items)} knowledge_pointss")
    
    service = Knowledge_pointsService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict)
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} knowledge_pointss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=Knowledge_pointsResponse)
async def update_knowledge_points(
    id: int,
    data: Knowledge_pointsUpdateData,
    db: AsyncSession = Depends(get_db),
):
    """Update an existing knowledge_points"""
    logger.debug(f"Updating knowledge_points {id} with data: {data}")

    service = Knowledge_pointsService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict)
        if not result:
            logger.warning(f"Knowledge_points with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Knowledge_points not found")
        
        logger.info(f"Knowledge_points {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating knowledge_points {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating knowledge_points {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_knowledge_pointss_batch(
    request: Knowledge_pointsBatchDeleteRequest,
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple knowledge_pointss by their IDs"""
    logger.debug(f"Batch deleting {len(request.ids)} knowledge_pointss")
    
    service = Knowledge_pointsService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id)
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} knowledge_pointss successfully")
        return {"message": f"Successfully deleted {deleted_count} knowledge_pointss", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_knowledge_points(
    id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a single knowledge_points by ID"""
    logger.debug(f"Deleting knowledge_points with id: {id}")
    
    service = Knowledge_pointsService(db)
    try:
        success = await service.delete(id)
        if not success:
            logger.warning(f"Knowledge_points with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Knowledge_points not found")
        
        logger.info(f"Knowledge_points {id} deleted successfully")
        return {"message": "Knowledge_points deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting knowledge_points {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")