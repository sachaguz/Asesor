from __future__ import annotations

import csv
import io
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from sqlalchemy.orm import Session

from app.models import Product, Sale, Stock, Variant

_DATE_FORMATS = ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y")
_VARIANTE_DEFAULT = "default"


class SalesImportError(ValueError):
    pass


@dataclass
class ColumnMapping:
    """Mapea las columnas de un CSV externo a los campos canónicos de venta.

    No hay formato fijo: cada negocio/POS exporta distinto, así que quien
    importa decide qué columna del CSV corresponde a cada campo.
    """

    fecha: str
    producto: str
    cantidad: str
    precio: str
    variante: str | None = None


@dataclass
class ImportResult:
    filas_importadas: int = 0
    errores: list[str] = field(default_factory=list)


def _parse_fecha(valor: str) -> date:
    valor = valor.strip()
    for formato in _DATE_FORMATS:
        try:
            return datetime.strptime(valor, formato).date()
        except ValueError:
            continue
    raise SalesImportError(f"fecha no reconocida: {valor!r}")


def _parse_precio(valor: str) -> Decimal:
    try:
        return Decimal(valor.strip().replace(",", ""))
    except InvalidOperation as exc:
        raise SalesImportError(f"precio no válido: {valor!r}") from exc


class SalesImporter:
    """Normaliza un CSV genérico de ventas a Product/Variant/Sale/Stock.

    Universal por diseño: no asume ningún POS ni giro concreto (ver decisión
    de arquitectura de El Asesor). Producto y variante se resuelven por
    nombre, creándolos si no existen todavía para este negocio.
    """

    def __init__(self, db: Session, business_id: int, mapping: ColumnMapping) -> None:
        self.db = db
        self.business_id = business_id
        self.mapping = mapping
        self._productos: dict[str, Product] = {}
        self._variantes: dict[tuple[int, str], Variant] = {}

    def import_csv(self, contenido: str) -> ImportResult:
        resultado = ImportResult()
        lector = csv.DictReader(io.StringIO(contenido))
        for numero_fila, fila in enumerate(lector, start=2):  # la fila 1 es el header
            try:
                self._importar_fila(fila)
            except (SalesImportError, KeyError, ValueError) as exc:
                resultado.errores.append(f"Fila {numero_fila}: {exc}")
                continue
            resultado.filas_importadas += 1
        return resultado

    def _importar_fila(self, fila: dict[str, str]) -> None:
        m = self.mapping
        try:
            producto_nombre = fila[m.producto].strip()
            variante_nombre = fila[m.variante].strip() if m.variante else ""
            cantidad = int(fila[m.cantidad])
        except KeyError as exc:
            raise SalesImportError(f"columna no encontrada: {exc}") from exc

        if not variante_nombre:
            variante_nombre = _VARIANTE_DEFAULT

        fecha = _parse_fecha(fila[m.fecha])
        precio = _parse_precio(fila[m.precio])

        producto = self._get_or_create_producto(producto_nombre)
        variante = self._get_or_create_variante(producto, variante_nombre)

        self.db.add(
            Sale(
                business_id=self.business_id,
                variant_id=variante.id,
                fecha=fecha,
                cantidad=cantidad,
                precio=precio,
            )
        )

    def _get_or_create_producto(self, nombre: str) -> Product:
        if nombre in self._productos:
            return self._productos[nombre]

        producto = (
            self.db.query(Product)
            .filter_by(business_id=self.business_id, nombre=nombre)
            .one_or_none()
        )
        if producto is None:
            producto = Product(business_id=self.business_id, nombre=nombre)
            self.db.add(producto)
            self.db.flush()
        self._productos[nombre] = producto
        return producto

    def _get_or_create_variante(self, producto: Product, nombre: str) -> Variant:
        clave = (producto.id, nombre)
        if clave in self._variantes:
            return self._variantes[clave]

        variante = (
            self.db.query(Variant)
            .filter_by(product_id=producto.id, nombre=nombre)
            .one_or_none()
        )
        if variante is None:
            variante = Variant(product_id=producto.id, nombre=nombre)
            self.db.add(variante)
            self.db.flush()
            self.db.add(Stock(variant_id=variante.id, cantidad_actual=0))
        self._variantes[clave] = variante
        return variante
