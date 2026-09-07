"""google_drive_connection e imported_file

Revision ID: f1a2b3c4d5e6
Revises: 57cc868c449e
Create Date: 2026-09-06 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, None] = '57cc868c449e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('google_drive_connection',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('business_id', sa.Integer(), nullable=False),
    sa.Column('access_token', sa.Text(), nullable=False),
    sa.Column('refresh_token', sa.Text(), nullable=False),
    sa.Column('token_expires_at', sa.DateTime(), nullable=False),
    sa.Column('folder_id', sa.String(length=128), nullable=True),
    sa.Column('folder_name', sa.String(length=255), nullable=True),
    sa.Column('connected_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('last_synced_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['business_id'], ['business.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('business_id')
    )
    op.create_table('google_drive_imported_file',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('connection_id', sa.Integer(), nullable=False),
    sa.Column('drive_file_id', sa.String(length=128), nullable=False),
    sa.Column('nombre_archivo', sa.String(length=255), nullable=False),
    sa.Column('filas_importadas', sa.Integer(), nullable=False),
    sa.Column('imported_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['connection_id'], ['google_drive_connection.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('connection_id', 'drive_file_id')
    )


def downgrade() -> None:
    op.drop_table('google_drive_imported_file')
    op.drop_table('google_drive_connection')
