.DEFAULT_GOAL := latest

BALLET_INSTALL_PREFIX ?= $(HOME)/.local
BALLET_BIN := $(BALLET_INSTALL_PREFIX)/bin/ballet

.PHONY: latest
latest:
	BALLET_INSTALL_PREFIX="$(BALLET_INSTALL_PREFIX)" npm run release:install
	"$(BALLET_BIN)" restart
	"$(BALLET_BIN)" status
