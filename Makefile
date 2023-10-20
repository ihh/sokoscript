grammar.js: grammar.commonjs	
	cat $< | perl -pe 's/module.exports =/export/;s/(\S+):\s+(peg\$$\1)/\2 as \1/' >$@

grammar.commonjs: grammar.pegjs
	node_modules/pegjs/bin/pegjs -o $@ $<
