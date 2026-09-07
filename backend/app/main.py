from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.businesses import router as businesses_router
from app.api.chat import router as chat_router
from app.api.content_tip import router as content_tip_router
from app.api.context import router as context_router
from app.api.daily_question import router as daily_question_router
from app.api.google_drive import router as google_drive_router
from app.api.health import router as health_router
from app.api.instagram import router as instagram_router
from app.api.subscription import router as subscription_router

app = FastAPI(title="El Asesor")

# El auth es por bearer token (Authorization header), no cookies, así que
# "*" sigue siendo seguro. Restringir a los orígenes reales antes de
# desplegar a producción de todos modos.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(businesses_router)
app.include_router(context_router)
app.include_router(daily_question_router)
app.include_router(chat_router)
app.include_router(instagram_router)
app.include_router(google_drive_router)
app.include_router(content_tip_router)
app.include_router(subscription_router)
