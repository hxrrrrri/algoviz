from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import json
import asyncio
from typing import Optional
from executor import PythonExecutor
import uvicorn

app = FastAPI(title="AlgoViz Execution Engine", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ExecuteRequest(BaseModel):
    code: str
    language: str = "python"
    inputs: Optional[list] = []
    max_steps: Optional[int] = 5000

@app.post("/execute")
async def execute_code(req: ExecuteRequest):
    if req.language != "python":
        raise HTTPException(status_code=400, detail="Only Python supported in MVP")
    
    if len(req.code) > 10000:
        raise HTTPException(status_code=400, detail="Code too long (max 10000 chars)")
    
    executor = PythonExecutor(max_steps=req.max_steps)
    trace = executor.execute(req.code, req.inputs or [])
    return {"trace": trace, "total_steps": len(trace)}

@app.post("/execute/stream")
async def execute_stream(req: ExecuteRequest):
    if req.language != "python":
        raise HTTPException(status_code=400, detail="Only Python supported in MVP")
    
    executor = PythonExecutor(max_steps=req.max_steps)
    
    async def generate():
        trace = executor.execute(req.code, req.inputs or [])
        for step in trace:
            yield f"data: {json.dumps(step)}\n\n"
            await asyncio.sleep(0)
        yield "data: [DONE]\n\n"
    
    return StreamingResponse(generate(), media_type="text/event-stream")

@app.get("/health")
async def health():
    return {"status": "ok"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
