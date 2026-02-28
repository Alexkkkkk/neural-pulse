import logging
from fastapi.responses import JSONResponse
from functools import wraps

logger = logging.getLogger("NEURAL_PULSE")

class HTTPWrapper:
    @staticmethod
    def success(data: dict = None, message: str = "Success"):
        return {"status": "ok", "message": message, "data": data if data else {}}

    @staticmethod
    def error(message: str = "Internal Error", status_code: int = 500):
        return JSONResponse(status_code=status_code, content={"status": "error", "message": message})

def api_error_handler(func):
    @wraps(func)
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except Exception as e:
            logger.error(f"💥 API Error in {func.__name__}: {str(e)}")
            return HTTPWrapper.error(message="Server error. Please try again.")
    return wrapper
