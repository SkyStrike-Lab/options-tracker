"""add_campaign_tracking

Revision ID: 004
Revises: 003
Create Date: 2026-10-28 23:37:16.993347

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '004'
down_revision: Union[str, None] = '003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    columns = [col['name'] for col in inspector.get_columns('positions')]
    
    if 'campaign_id' not in columns:
        op.add_column('positions', sa.Column('campaign_id', sa.String(), nullable=True))
    if 'rolled_from_id' not in columns:
        op.add_column('positions', sa.Column('rolled_from_id', sa.Integer(), nullable=True))
    if 'roll_count' not in columns:
        op.add_column('positions', sa.Column('roll_count', sa.Integer(), nullable=True, server_default='0'))
        
    indexes = [idx['name'] for idx in inspector.get_indexes('positions')]
    if 'ix_positions_campaign_id' not in indexes:
        op.create_index('ix_positions_campaign_id', 'positions', ['campaign_id'], unique=False)

    # Data patch to backfill existing positions
    connection.execute(sa.text("UPDATE positions SET campaign_id = group_id, roll_count = 0 WHERE campaign_id IS NULL;"))


def downgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    indexes = [idx['name'] for idx in inspector.get_indexes('positions')]
    if 'ix_positions_campaign_id' in indexes:
        op.drop_index('ix_positions_campaign_id', table_name='positions')
        
    with op.batch_alter_table('positions', schema=None) as batch_op:
        batch_op.drop_column('roll_count')
        batch_op.drop_column('rolled_from_id')
        batch_op.drop_column('campaign_id')
