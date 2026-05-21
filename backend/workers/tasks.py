"""Compatibility wrappers for legacy worker imports in local SmartPipeline mode."""

from services.processing_service import process_file_local

__all__ = ["process_file_local"]
