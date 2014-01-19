(function () {

  'use strict';

  function Todo(name) {
    this.storage = new app.Store(name);
    this.model = new app.Model(this.storage);
    this.template = new app.Template();
    this.view = new app.View(this.template);
    this.controller = new app.Controller(this.model, this.view);
  }

  var todo = new Todo('todos-vanillajs');

  window.addEventListener('load', function () {
    todo.controller.setView(document.location.hash);
  }.bind(this));
  window.addEventListener('hashchange', function () {
    todo.controller.setView(document.location.hash);
  }.bind(this));

  // This is a very quick and dirty sync setup

  // where is my db servive at
  var authHost = 'http://persona.pouchdb.com';
  var syncDom = document.getElementById('sync');
  var signinLink = document.getElementById('signin');
  var signoutLink = document.getElementById('signout');
  var username = document.getElementById('username');

  var opts = {
    lines: 9, // The number of lines to draw
    length: 5, // The length of each line
    width: 3, // The line thickness
    radius: 5, // The radius of the inner circle
    corners: 1, // Corner roundness (0..1)
    rotate: 0, // The rotation offset
    direction: 1, // 1: clockwise, -1: counterclockwise
    color: '#000', // #rgb or #rrggbb or array of colors
    speed: 1, // Rounds per second
    trail: 100, // Afterglow percentage
    shadow: false, // Whether to render a shadow
    hwaccel: false, // Whether to use hardware acceleration
    className: 'spinner', // The CSS class to assign to the spinner
    zIndex: 2e9, // The z-index (defaults to 2000000000)
    top: 'auto', // Top position relative to parent in px
    left: 'auto' // Left position relative to parent in px
  };
  var target = document.getElementById('spinner');
  var spinner = new Spinner(opts);

  // Update the UI whenever we see changes, this is gonna cause things
  // to refresh twice when you make a change, sorry
  todo.storage.db.changes({
    since: 'latest',
    continuous: true,
    onChange: function(change) {
      todo.controller.setView(document.location.hash);
      todo.controller._filter(true);
    }
  });

  var spinnerActive = false;
  var spinnerTimeout = null;

  function dataNotSyncing() {
    spinnerActive = false;
    spinnerTimeout = null;
    spinner.stop();
  }

  function dataSyncing() {
    if (!spinnerActive) {
      spinnerActive = true;
      spinner.spin(target);
    } else {
      clearTimeout(spinnerTimeout);
    }
    spinnerTimeout = setTimeout(dataNotSyncing, 2000);
  };

  function sync(url) {
    var opts = {continuous: true, onChange: dataSyncing};
    todo.storage.db.replicate.to(url, opts);
    todo.storage.db.replicate.from(url, opts);
  }

  var loggedIn = function(result) {
    syncDom.dataset.loggedin = 'true';
    username.textContent = result.name
    sync(result.db);
  };

  var loggedOut = function() {
    syncDom.dataset.loggedin = 'false';
  };

  function simpleXhrSentinel(xhr) {
    return function() {
      if (xhr.readyState == 4) {
        if (xhr.status == 200) {
          var result = {};
          try {
            result = JSON.parse(xhr.responseText);
          } catch(e) {}
          loggedIn(result);
        } else {
          loggedOut();
          navigator.id.logout();
        }
      }
    };
  }

  function verifyAssertion(assertion) {
    var xhr = new XMLHttpRequest();
    var param = 'assert=' + assertion;
    xhr.open('POST', authHost + '/persona/sign-in', true);
    xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    xhr.setRequestHeader("Content-length", param.length);
    xhr.setRequestHeader("Connection", "close");
    xhr.send(param);
    xhr.onreadystatechange = simpleXhrSentinel(xhr);
  }

  function signoutUser() {
    var xhr = new XMLHttpRequest();
    xhr.open("POST", authHost + '/persona/sign-out', true);
    xhr.send(null);
    xhr.onreadystatechange = simpleXhrSentinel(xhr);
  }

  navigator.id.watch({
    onlogin: verifyAssertion,
    onlogout: signoutUser
  });

  signinLink.onclick = function() { navigator.id.request(); };
  signoutLink.onclick = function() { navigator.id.logout(); };

})();
