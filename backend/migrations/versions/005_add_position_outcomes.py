"""005_add_position_outcomes

Revision ID: 005
Revises: 004
Create Date: 2026-10-31 03:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '005'
down_revision: Union[str, None] = '004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    columns = [col['name'] for col in inspector.get_columns('positions')]
    
    if 'outcome' not in columns:
        op.add_column('positions', sa.Column('outcome', sa.String(length=32), nullable=True))
    if 'effective_stock_basis' not in columns:
        op.add_column('positions', sa.Column('effective_stock_basis', sa.Float(), nullable=True))
    if 'close_notes' not in columns:
        op.add_column('positions', sa.Column('close_notes', sa.String(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('positions', schema=None) as batch_op:
        batch_op.drop_column('close_notes')
        batch_op.drop_column('effective_stock_basis')
        batch_op.drop_column('outcome')
