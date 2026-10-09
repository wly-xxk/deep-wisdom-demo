"""convert ability / gap / dialogue columns to jsonb

Revision ID: 4e37a7065af4
Revises: 531e475c2c73
Create Date: 2026-10-08 20:49:10.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '4e37a7065af4'
down_revision: Union[str, Sequence[str], None] = '531e475c2c73'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: ARRAY(String) -> JSONB for nested structured payloads."""
    op.execute("ALTER TABLE jd_analyses ALTER COLUMN abilities TYPE JSONB USING to_jsonb(abilities)")
    op.execute("ALTER TABLE gap_analyses ALTER COLUMN gaps TYPE JSONB USING to_jsonb(gaps)")
    for column in ["abilities", "gaps", "abilities_examined", "abilities_remaining", "dialogue"]:
        op.execute(f"ALTER TABLE interview_sessions ALTER COLUMN {column} TYPE JSONB USING to_jsonb({column})")


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("ALTER TABLE jd_analyses ALTER COLUMN abilities TYPE VARCHAR[] USING NULL")
    op.execute("ALTER TABLE gap_analyses ALTER COLUMN gaps TYPE VARCHAR[] USING NULL")
    for column in ["abilities", "gaps", "abilities_examined", "abilities_remaining", "dialogue"]:
        op.execute(f"ALTER TABLE interview_sessions ALTER COLUMN {column} TYPE VARCHAR[] USING NULL")
