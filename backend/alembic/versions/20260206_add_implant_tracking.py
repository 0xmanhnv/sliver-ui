"""add tracked_implants table

Revision ID: 20260206_implants
Revises: 20260205_browser
Create Date: 2026-02-06
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = "20260206_implants"
down_revision = "20260205_browser"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tracked_implants",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("version", sa.String(32), nullable=False, server_default="1.0"),
        sa.Column("build_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("c2_domains", sa.JSON(), nullable=True),
        sa.Column("deployed_target", sa.String(255), nullable=True),
        sa.Column(
            "status",
            sa.String(32),
            nullable=False,
            server_default="built",
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("sha256_hash", sa.String(64), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_index("ix_tracked_implants_name", "tracked_implants", ["name"])
    op.create_index("ix_tracked_implants_status", "tracked_implants", ["status"])


def downgrade() -> None:
    op.drop_index("ix_tracked_implants_status", table_name="tracked_implants")
    op.drop_index("ix_tracked_implants_name", table_name="tracked_implants")
    op.drop_table("tracked_implants")
