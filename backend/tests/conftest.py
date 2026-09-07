from collections.abc import Generator

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

import app.models  # noqa: F401  registra los modelos antes de create_all
from app.config import settings
from app.db.base import Base
from app.db.session import get_db
from app.main import app

# Los tests nunca deben depender de lo que diga el .env real de desarrollo
# (mock o claude): si alguien deja LLM_PROVIDER=claude puesto para probar a
# mano, cualquier test que no mockee get_llm_provider explícitamente
# terminaría llamando a la API real — lento y con costo en cada corrida. Se
# fuerza "mock" acá, antes de que se resuelva cualquier dependency; los
# tests que sí quieren un LLM específico lo siguen pisando con
# app.dependency_overrides como ya hacían.
settings.llm_provider = "mock"
settings.cheap_llm_provider = "mock"

# Los tests corren contra su propia base de datos, nunca contra la de
# desarrollo: create_all/drop_all aquí destruiría datos reales si apuntara
# a la misma DB que usa `docker compose up`.
_TEST_DATABASE_URL = settings.database_url.rsplit("/", 1)[0] + "/asesor_test"

engine = create_engine(_TEST_DATABASE_URL)
TestSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def _get_test_db() -> Generator[Session, None, None]:
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = _get_test_db


@pytest.fixture(scope="session", autouse=True)
def _tablas() -> Generator[None, None, None]:
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture(autouse=True)
def _tablas_limpias() -> Generator[None, None, None]:
    yield
    with engine.begin() as conn:
        for tabla in reversed(Base.metadata.sorted_tables):
            conn.execute(tabla.delete())
