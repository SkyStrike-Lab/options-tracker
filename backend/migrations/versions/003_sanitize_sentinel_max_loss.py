"""sanitize_sentinel_max_loss

Revision ID: 003
Revises: 002
Create Date: 2026-10-13 13:52:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '003'
down_revision: Union[str, None] = '002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Reset sentinel 999999 max_loss values to 0.0
    connection = op.get_bind()
    connection.execute(
        sa.text("UPDATE positions SET max_loss = 0.0 WHERE max_loss = 999999.0 OR max_loss = 999999")
    )


def downgrade() -> None:
    pass
