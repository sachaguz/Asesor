from __future__ import annotations

from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from app.llm.base import LLMProvider
from app.models import GoogleDriveConnection, GoogleDriveImportedFile
from app.services.column_mapper import MapeoNoDetectado, detectar_mapeo
from app.services.google_drive import descargar_archivo, listar_csvs_nuevos
from app.services.sales_importer import SalesImporter


@dataclass
class SyncResult:
    archivos_importados: int = 0
    filas_importadas: int = 0
    errores: list[str] = field(default_factory=list)


def sincronizar_carpeta(db: Session, conexion: GoogleDriveConnection, llm: LLMProvider) -> SyncResult:
    """Importa cada CSV nuevo de la carpeta conectada, reusando exactamente
    el mismo pipeline que el import manual (detectar_mapeo + SalesImporter,
    ver POST /businesses/{id}/sales/import) — la única diferencia es de dónde
    sale el contenido del archivo."""
    resultado = SyncResult()
    for archivo in listar_csvs_nuevos(db, conexion):
        try:
            contenido = descargar_archivo(db, conexion, archivo["id"])
            mapping = detectar_mapeo(llm, contenido)
            import_result = SalesImporter(db, conexion.business_id, mapping).import_csv(contenido)
        except MapeoNoDetectado as exc:
            resultado.errores.append(f"{archivo['name']}: {exc}")
            continue

        resultado.errores.extend(f"{archivo['name']} — {error}" for error in import_result.errores)
        resultado.archivos_importados += 1
        resultado.filas_importadas += import_result.filas_importadas
        db.add(
            GoogleDriveImportedFile(
                connection_id=conexion.id,
                drive_file_id=archivo["id"],
                nombre_archivo=archivo["name"],
                filas_importadas=import_result.filas_importadas,
            )
        )

    return resultado
