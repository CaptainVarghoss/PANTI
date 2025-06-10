from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import re

import config

engine = create_engine(
    config.SQLALCHEMY_DATABASE_URL, connect_args=config.SQLALCHEMY_CONNECT_ARGS
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# --- SQLite Custom REGEXP Function ---
# This function defines the regex logic
def regexp(expression, item):
    """Custom REGEXP function for SQLite."""
    if item is None:
        return False
    match = re.search(expression, item)
    return match is not None

# Register the custom REGEXP function for all SQLite connections
# This will be called whenever SQLAlchemy establishes a new connection to the SQLite DB
@event.listens_for(engine, "connect")
def _set_sqlite_regexp(dbapi_connection, connection_record):
    dbapi_connection.create_function("regexp", 2, regexp)