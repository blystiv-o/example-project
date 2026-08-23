PROJECT_DIR := $(CURDIR)
DEV_PROCESS_PATTERN := [t]urbo run dev|[n]ext dev|[n]est.*start.*--watch

.PHONY: stop

stop:
	@echo "Зупинка web та API..."
	@found=0; \
	for pid in $$(pgrep -f '$(DEV_PROCESS_PATTERN)' 2>/dev/null || true); do \
		cwd=$$(lsof -a -p "$$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p'); \
		case "$$cwd" in \
			"$(PROJECT_DIR)"|"$(PROJECT_DIR)"/*) \
				kill -TERM "$$pid" 2>/dev/null || true; \
				found=1; \
				;; \
		esac; \
	done; \
	if [ "$$found" -eq 0 ]; then \
		echo "Процеси web та API не запущені."; \
	fi
	@echo "Зупинка Docker-сервісів..."
	@docker compose down --remove-orphans
	@echo "Проєкт зупинено."
