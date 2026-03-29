import warnings
warnings.filterwarnings("ignore", category=DeprecationWarning)
warnings.filterwarnings("ignore", category=FutureWarning)

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel
import json
import asyncio
from typing import Optional
from executor import PythonExecutor

app = FastAPI(title="AlgoViz Execution Engine", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ExecuteRequest(BaseModel):
    code: str
    language: str = "python"
    inputs: Optional[list] = []
    max_steps: Optional[int] = 5000
    timeout: Optional[float] = 8.0

@app.get("/")
async def root():
    return {
        "service": "algoviz-backend",
        "status": "ok",
        "docs": "/docs",
        "health": "/health",
        "execute": "/execute"
    }

@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return Response(status_code=204)

@app.post("/execute")
async def execute_code(req: ExecuteRequest):
    if req.language != "python":
        raise HTTPException(status_code=400, detail="Only Python supported in MVP")

    if len(req.code) > 50000:
        raise HTTPException(status_code=400, detail="Code too long")

    executor = PythonExecutor(max_steps=req.max_steps, timeout=req.timeout)
    trace = executor.execute(req.code, req.inputs or [])
    return {"trace": trace, "total_steps": len(trace)}

@app.get("/health")
async def health():
    return {"status": "ok"}