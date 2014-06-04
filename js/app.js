(function () {

  'use strict';

  function Todo(name) {
    this.storage = new app.Store(name);
    this.model = new app.Model(this.storage);
    this.template = new app.Template();
    this.view = new app.View(this.template);
    this.controller = new app.Controller(this.model, this.view);
  }

  var todo = new Todo('todos');

  window.addEventListener('load', function () {
    todo.controller.setView(document.location.hash);
  }.bind(this));
  window.addEventListener('hashchange', function () {
    todo.controller.setView(document.location.hash);
  }.bind(this));

  // This is a very quick and dirty sync setup

  // Update the UI whenever we see changes, this is gonna cause things
  // to refresh twice when you make a change, sorry
  todo.storage.db.changes({
    since: 'now',
    continuous: true,
    onChange: function(change) {
      todo.controller.setView(document.location.hash);
      todo.controller._filter(true);
    }
  });


  var url = 'http://couchdb.pouchdb.com/sotr';

  function sync() {
    todo.storage.db.sync(url, {live: true}).on('error', function() {
      setTimeout(sync, 1000);
    });
  }

  //sync();

})();
