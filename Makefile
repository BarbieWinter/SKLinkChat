.PHONY: install setup dev test lint build clean

install:
	test -f .env || cp .env.example .env
	$(MAKE) setup

setup:
	cd server-py && python3 -m venv .venv && . .venv/bin/activate && pip install -e ".[dev]"
	cd client && npm install

dev:
	docker compose up --build

test:
	cd server-py && python -m compileall app

lint:
	cd server-py && ./.venv/bin/ruff check app
	cd client && npm run lint

build:
	cd client && npm run build

clean:
	rm -rf client/dist server-py/.ruff_cache server-py/server_py.egg-info
	find . -name "__pycache__" -type d -prune -exec rm -rf {} +
	find . -name ".DS_Store" -type f -delete
