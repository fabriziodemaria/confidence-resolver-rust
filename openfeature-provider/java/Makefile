# openfeature-provider/java Makefile
# Java OpenFeature local provider

ROOT := $(realpath $(CURDIR)/../..)

# Stamps and inputs
BUILD_STAMP := .build.stamp
INSTALL_STAMP := .install.stamp
SRC := $(shell find src -name '*.java' 2>/dev/null)
RESOURCES_WASM := src/main/resources/wasm/confidence_resolver.wasm
LOCAL_WASM := $(ROOT)/wasm/confidence_resolver.wasm
GEN_MESSAGES := target/generated-sources/protobuf/java/com/spotify/confidence/wasm/Messages.java

.PHONY: install build test clean

# Always build/copy wasm when not in Docker; inside Docker we rely on COPY from Dockerfile
ifneq ($(IN_DOCKER_BUILD),1)
.PHONY: $(LOCAL_WASM)

$(LOCAL_WASM):
	$(MAKE) -C $(ROOT) wasm/confidence_resolver.wasm

$(RESOURCES_WASM):
	@mkdir -p $(dir $@)
	@if [ -n "$$CONFIDENCE_RESOLVER_VERSION" ]; then \
	  REPO="$$CONFIDENCE_RESOLVER_REPO"; \
	  if [ -z "$$REPO" ]; then REPO="$$GITHUB_REPOSITORY"; fi; \
	  if [ -z "$$REPO" ]; then REPO=$(shell git config --get remote.origin.url | sed -E 's#.*[:/]([^/]+/[^/]+?)(\\.git)?$#\\1#'); fi; \
	  URL="https://github.com/$$REPO/releases/download/confidence_resolver-v$$CONFIDENCE_RESOLVER_VERSION/confidence_resolver.wasm"; \
	  echo "Downloading WASM from $$URL"; \
	  if [ -n "$$GITHUB_TOKEN" ]; then \
	    curl -fsSL -H "Authorization: Bearer $$GITHUB_TOKEN" -o $@ "$$URL"; \
	  else \
	    curl -fsSL -o $@ "$$URL"; \
	  fi; \
	else \
	  $(MAKE) -C $(ROOT) wasm/confidence_resolver.wasm; \
	  cp $(LOCAL_WASM) $@; \
	fi
else
# In Docker, the WASM is already copied into src/main/resources by the Dockerfile
$(RESOURCES_WASM):
	@mkdir -p $(dir $@)
	@test -f $@ || (echo "Missing $@ (expected via Docker COPY)"; exit 1)
endif

# A lightweight install target to prep resources
$(INSTALL_STAMP): pom.xml $(RESOURCES_WASM)
	touch $@


$(BUILD_STAMP): $(INSTALL_STAMP) pom.xml $(SRC)
	mvn -q -DskipTests protobuf:compile
	@if [ -f "$(GEN_MESSAGES)" ]; then \
		mkdir -p src/main/java/com/spotify/confidence/wasm; \
		cp $(GEN_MESSAGES) src/main/java/com/spotify/confidence/wasm/Messages.java; \
	fi
	mvn -q -DskipTests package
	touch $@

install: $(INSTALL_STAMP)

build: $(BUILD_STAMP)

test: $(INSTALL_STAMP)
	mvn -q test

clean:
	mvn -q clean
	rm -f $(BUILD_STAMP) $(INSTALL_STAMP)
	rm -f $(RESOURCES_WASM)


