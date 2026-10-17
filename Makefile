PYTHON ?= python3

.PHONY: test run

test:
	PYTHONDONTWRITEBYTECODE=1 $(PYTHON) validate_bundle.py

run:
	$(PYTHON) local_http_server.py --host 127.0.0.1 --port 8000
