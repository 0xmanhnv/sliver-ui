"""add browser_cookies table

Revision ID: 20260205_browser
Revises:
Create Date: 2026-02-05
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = "20260205_browser"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "browser_cookies",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("session_id", sa.String(64), nullable=False),
        sa.Column("hostname", sa.String(255), nullable=False, server_default=""),
        sa.Column("browser", sa.String(32), nullable=False),
        sa.Column("method", sa.String(32), nullable=False),
        sa.Column("domain", sa.String(255), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("value", sa.Text(), nullable=False),
        sa.Column("path", sa.String(1024), nullable=False, server_default="/"),
        sa.Column("expires", sa.String(64), nullable=True),
        sa.Column("secure", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("http_only", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("same_site", sa.String(16), nullable=True),
        sa.Column(
            "extracted_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
        ),
        sa.Column("extracted_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_browser_cookies_session_id", "browser_cookies", ["session_id"])
    op.create_index("ix_browser_cookies_hostname", "browser_cookies", ["hostname"])
    op.create_index("ix_browser_cookies_domain", "browser_cookies", ["domain"])


def downgrade() -> None:
    op.drop_index("ix_browser_cookies_domain", table_name="browser_cookies")
    op.drop_index("ix_browser_cookies_hostname", table_name="browser_cookies")
    op.drop_index("ix_browser_cookies_session_id", table_name="browser_cookies")
    op.drop_table("browser_cookies")
