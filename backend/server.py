from fastapi import FastAPI, APIRouter
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
import json
import math
from datetime import datetime, timezone
from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")  # Ignore MongoDB's _id field
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

class AnalyzeRequest(BaseModel):
    crop: str = "Onion"
    quantity: float = 12
    location: str = "Nashik, Maharashtra"
    quality: str = "Grade A"
    timeline: str = "Within 7 days"

class ChatRequest(BaseModel):
    message: str
    session_id: str = "demo-farmer"
    context: Optional[dict] = None

class OfferRequest(BaseModel):
    option_id: str
    farmer: str = "Rajesh Patil"

MARKETS = [
    {"id":"m1","market":"Lasalgaon Mandi","location":"Nashik · 42 km","price":2420,"distance":42,"travel":"1h 18m","transport":680,"storage":0,"buyer":"FreshCart Foods","demand":"High","timing":"Pickup in 2 days"},
    {"id":"m2","market":"Pune APMC","location":"Pune · 184 km","price":2680,"distance":184,"travel":"4h 35m","transport":2360,"storage":0,"buyer":"GreenBasket Retail","demand":"Medium","timing":"Pickup in 5 days"},
    {"id":"m3","market":"Mumbai Vashi","location":"Mumbai · 208 km","price":2790,"distance":208,"travel":"5h 10m","transport":2980,"storage":0,"buyer":"Harbor Foods Co.","demand":"High","timing":"Pickup in 3 days"},
]

def calculate_options(payload: AnalyzeRequest):
    qty = payload.quantity
    options = []
    for market in MARKETS:
        revenue = market["price"] * qty
        commission = round(revenue * 0.012)
        packaging = round(qty * 85)
        loss = round(revenue * 0.018)
        net = revenue - market["transport"] - commission - packaging - loss
        options.append({**market, "revenue": revenue, "commission": commission, "packaging": packaging, "loss": loss, "net": net, "confidence": 88 - len(options)*5})
    store_revenue = 2920 * qty
    store_costs = round(qty * 160) + round(store_revenue * .035) + 1850 + round(store_revenue * .012)
    store_net = store_revenue - store_costs
    sell_now = max(options, key=lambda x: x["net"])
    store = {"id":"store","market":"Store 30 days → Vashi","price":2920,"revenue":store_revenue,"transport":1850,"storage":round(qty*160),"commission":round(store_revenue*.012),"packaging":round(qty*85),"loss":round(store_revenue*.035),"net":store_net,"confidence":72,"buyer":"Harbor Foods Co.","demand":"Rising","timing":"Sell after 30 days"}
    ranked = sorted(options, key=lambda x: x["net"], reverse=True)
    return {"input": payload.model_dump(), "options": ranked, "store": store, "recommended": ranked[0], "sell_now_net": sell_now["net"], "store_net": store_net, "generated_at": datetime.now(timezone.utc).isoformat()}

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "AgriSutra API ready", "version": "mvp-demo"}

@api_router.get("/dashboard")
async def dashboard():
    analysis = calculate_options(AnalyzeRequest())
    return {"farmer": {"name":"Rajesh Patil","location":"Nashik, Maharashtra","verified":True,"lot":"ON-2408-17","crop":"Onion","quantity":12,"quality":"Grade A"}, "analysis": analysis, "alerts":[{"title":"Demand rising","text":"FreshCart increased onion demand by 18%","type":"demand"},{"title":"Price window","text":"Best net realisation is within 7 days","type":"price"}], "stats":{"active_lots":1,"offers":3,"shipments":1,"payment":"₹ 18,460 pending"}}

@api_router.post("/analyze")
async def analyze(payload: AnalyzeRequest):
    return calculate_options(payload)

@api_router.post("/offers")
async def create_offer(payload: OfferRequest):
    return {"id":"OF-" + uuid.uuid4().hex[:6].upper(), "status":"Offer sent", "message":"Your offer is ready for buyer confirmation.", "option_id":payload.option_id, "created_at":datetime.now(timezone.utc).isoformat()}

@api_router.get("/role/{role}")
async def role_dashboard(role: str):
    return {"role":role,"updated":"Just now","items":{"buyer":["3 matching lots","2 offers awaiting response","Next pickup: 24 Aug"],"fpo":["42 farmers onboarded","8 active lots","₹ 4.8L aggregated value"],"admin":["128 verified users","4 disputes to review","99.2% audit completeness"]}.get(role, ["Your produce is ready to sell","3 transparent options","1 active shipment"])}

@api_router.post("/assistant/chat")
async def assistant_chat(payload: ChatRequest):
    analysis = calculate_options(AnalyzeRequest(**(payload.context or {})))
    context = json.dumps({"recommended_market":analysis["recommended"]["market"],"recommended_net":analysis["recommended"]["net"],"sell_now":analysis["sell_now_net"],"store":analysis["store_net"]})
    system = "You are AgriSutra's farmer assistant. Be warm, concise, and explain only the backend numbers provided. Never sell automatically. The farmer is the final decision-maker. Support English and simple Hindi. Backend context: " + context
    async def stream():
        try:
            chat = LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=payload.session_id, system_message=system).with_model("openai", "gpt-5.4")
            async for event in chat.stream_message(UserMessage(text=payload.message)):
                if isinstance(event, TextDelta):
                    yield "data: " + json.dumps({"text":event.content}) + "\n\n"
                elif isinstance(event, StreamDone):
                    break
        except Exception:
            fallback = f"Based on the current calculation, {analysis['recommended']['market']} gives the strongest expected net realisation of ₹{analysis['recommended']['net']:,.0f}. You remain in control—would you like to review the costs or create an offer?"
            yield "data: " + json.dumps({"text":fallback}) + "\n\n"
        yield "data: [DONE]\n\n"
    return StreamingResponse(stream(), media_type="text/event-stream", headers={"Cache-Control":"no-cache","X-Accel-Buffering":"no"})

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    
    # Convert to dict and serialize datetime to ISO string for MongoDB
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    _ = await db.status_checks.insert_one(doc)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    # Exclude MongoDB's _id field from the query results
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    
    # Convert ISO string timestamps back to datetime objects
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    
    return status_checks

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()