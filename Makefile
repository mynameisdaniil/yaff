NPM = /usr/bin/env npm
NODE = /usr/bin/env node
MODULES = ./node_modules/

default: test

test:
	$(NODE) test.js

seq:
	$(NODE) seq.js

install:
	@rm -rf $(MODULES)
	$(NPM) install
