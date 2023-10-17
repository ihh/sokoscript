grammar.js: grammar.pegjs
	node_modules/pegjs/bin/pegjs $< >$@
