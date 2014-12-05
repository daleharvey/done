#!/usr/bin/env node

'use strict';

var watch = require('watch');
var exec = require('child_process').exec

var ignores = [
  /done-compiled.css/,
  /manifest.appcache/,
  /^.git/,
  /^node_modules/
];

watch.watchTree('./', function(f, prev, curr) {
  if (typeof f == "object" && prev === null && curr === null) {
    return;
  }

  var matches = ignores.every(function(pattern) {
    return !pattern.test(f);
  });

  if (matches) {
    console.log(f, 'changed, triggering');
    exec('npm run build', function(err, stdout) {
      console.log(stdout);
    });
  }
});
