import warnings
warnings.filterwarnings("ignore", message=".*sklearn.utils.parallel.*")
import asyncio
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from runner import Simulation

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

sim = Simulation()


async def simulation_loop():
    """Runs forever in the background, advancing the simulation."""
    while True:
        sim.step(1.0)
        await asyncio.sleep(0.2)  # advance roughly every 200ms


@app.on_event("startup")
async def startup():
    asyncio.create_task(simulation_loop())


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            await websocket.send_json(sim.snapshot())
            await asyncio.sleep(0.2)
    except Exception:
        pass


@app.post("/play")
async def play():
    sim.playing = True
    return {"playing": True}


@app.post("/pause")
async def pause():
    sim.playing = False
    return {"playing": False}


@app.post("/reset")
def reset():
    global sim
    sim = Simulation()
    return {"status": "reset"}


@app.get("/")
def root():
    return {"status": "backend is running", "time": sim.time}
