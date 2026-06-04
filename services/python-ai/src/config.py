import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "")
API_SECRET = os.getenv("AI_SERVICE_SECRET", "change-me-in-production")
PORT = int(os.getenv("AI_SERVICE_PORT", "8000"))
MODEL_CACHE_DIR = os.getenv("MODEL_CACHE_DIR", "/tmp/ai-models")
