from __future__ import annotations

import importlib
import pkgutil

from alembic import op

from app.db import Base

revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def import_model_modules() -> None:
    import app.modules

    for module in pkgutil.walk_packages(
        app.modules.__path__,
        prefix=f"{app.modules.__name__}.",
    ):
        if module.name.endswith(".models"):
            importlib.import_module(module.name)


def upgrade() -> None:
    import_model_modules()
    Base.metadata.create_all(bind=op.get_bind())


def downgrade() -> None:
    import_model_modules()
    bind = op.get_bind()
    for table in reversed(Base.metadata.sorted_tables):
        table.drop(bind=bind, checkfirst=True)
