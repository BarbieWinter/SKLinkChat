from __future__ import annotations

import argparse
from typing import Iterable

import psycopg
from psycopg import sql
from psycopg.types.json import Json

TABLE_ORDER = [
    "accounts",
    "account_interests",
    "auth_sessions",
    "email_verification_tokens",
    "password_reset_tokens",
    "registration_risk_events",
    "chat_sessions",
    "chat_matches",
    "chat_messages",
    "chat_reports",
    "audit_events",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Copy SKLinkChat PostgreSQL data between databases.")
    parser.add_argument("--source", required=True, help="Source PostgreSQL DSN")
    parser.add_argument("--target", required=True, help="Target PostgreSQL DSN")
    parser.add_argument(
        "--truncate",
        action="store_true",
        help="Truncate target tables before copying data",
    )
    return parser.parse_args()


def get_columns(conn: psycopg.Connection, table_name: str) -> list[str]:
    with conn.cursor() as cur:
        cur.execute(
            """
            select column_name
            from information_schema.columns
            where table_schema = 'public' and table_name = %s
            order by ordinal_position
            """,
            (table_name,),
        )
        return [row[0] for row in cur.fetchall()]


def fetch_rows(conn: psycopg.Connection, table_name: str, columns: Iterable[str]) -> list[tuple]:
    with conn.cursor() as cur:
        query = sql.SQL("select {columns} from {table}").format(
            columns=sql.SQL(", ").join(sql.Identifier(column) for column in columns),
            table=sql.Identifier(table_name),
        )
        cur.execute(query)
        return cur.fetchall()


def insert_rows(conn: psycopg.Connection, table_name: str, columns: list[str], rows: list[tuple]) -> None:
    if not rows:
        return

    placeholders = sql.SQL(", ").join(sql.Placeholder() for _ in columns)
    query = sql.SQL("insert into {table} ({columns}) values ({values})").format(
        table=sql.Identifier(table_name),
        columns=sql.SQL(", ").join(sql.Identifier(column) for column in columns),
        values=placeholders,
    )

    with conn.cursor() as cur:
        prepared_rows = [
            tuple(Json(value) if isinstance(value, (dict, list)) else value for value in row)
            for row in rows
        ]
        cur.executemany(query, prepared_rows)


def reset_sequence(conn: psycopg.Connection, table_name: str) -> None:
    with conn.cursor() as cur:
        cur.execute("select pg_get_serial_sequence(%s, 'id')", (table_name,))
        row = cur.fetchone()
        sequence_name = row[0] if row else None
        if not sequence_name:
            return

        cur.execute(
            sql.SQL(
                """
                select setval(
                    %s,
                    coalesce((select max(id) from {table}), 1),
                    (select count(*) > 0 from {table})
                )
                """
            ).format(table=sql.Identifier(table_name)),
            (sequence_name,),
        )


def truncate_target(conn: psycopg.Connection) -> None:
    with conn.cursor() as cur:
        cur.execute(
            sql.SQL("truncate table {} restart identity cascade").format(
                sql.SQL(", ").join(sql.Identifier(name) for name in TABLE_ORDER)
            )
        )


def main() -> None:
    args = parse_args()

    with psycopg.connect(args.source) as source_conn, psycopg.connect(args.target) as target_conn:
        if args.truncate:
            truncate_target(target_conn)

        for table_name in TABLE_ORDER:
            columns = get_columns(source_conn, table_name)
            rows = fetch_rows(source_conn, table_name, columns)
            insert_rows(target_conn, table_name, columns, rows)
            reset_sequence(target_conn, table_name)
            print(f"{table_name}: copied {len(rows)} rows")

        target_conn.commit()


if __name__ == "__main__":
    main()
