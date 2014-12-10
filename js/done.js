'use strict';

// Yay jQuery
var $ = (function() {
  var elements = {};
  return function(id) {
    if (!(id in elements)) {
      elements[id] = document.getElementById(id);
    }
    return elements[id];
  };
})();

function createListItem(doc) {
  var li = document.createElement('li');
  var a = document.createElement('a');
  var btn = document.createElement('button');
  li.dataset.id = doc._id;
  li.dataset.updated = doc.updated;
  li.dataset.status = doc.status;
  li.dataset.index = doc.index;
  btn.innerHTML = '✓';
  btn.dataset.id = doc._id;
  btn.dataset.action = 'done';
  a.href = '#/list/' + doc.category + '/edit/' + doc._id;
  a.innerHTML = doc.title;
  li.appendChild(a);
  li.appendChild(btn);
  return li;
}

function updateBackground(list) {
  var rgb1 = [118,195,45];
  var rgb2 = [195,237,131];
  var numItems = list.childNodes.length;
  var steps = [
    (rgb2[0] - rgb1[0]) / numItems,
    (rgb2[1] - rgb1[1]) / numItems,
    (rgb2[2] - rgb1[2]) / numItems
  ];

  for (var i = 0; i < numItems; i++) {
    var colour = 'rgb(' +
      Math.round(rgb1[0] + (i * steps[0])) + ',' +
      Math.round(rgb1[1] + (i * steps[1])) + ',' +
      Math.round(rgb1[2] + (i * steps[2])) + ')';
    list.childNodes[i].style.background = colour;
  }

  $('newList').style.background = 'rgb(98,179,25)';
  $('newItem').style.background = 'rgb(98,179,25)';
}

var DB_NAME = 'done';

var Done = function() {

  this.db = new PouchDB(DB_NAME);
  this.session;
  this.sync;

  this.currentList = null;
  // Items in a list have their own index (so they can be reordered)
  // new items get the highest index so we keep track of the highest
  // seen here
  this.currentIndex = 0;

  this.config = {};

  this.db.get('_local/config', (function(err, config) {
    this.config = config;
    this.addEvents();
    this.listenToChanges();
    this.updateSession()
      .then(this.hashChanged.bind(this))
      .then(function() {
        // Lets not show the user the animations and
        // item reordering on startup
        document.body.style.display = 'block';
      });
  }).bind(this));
};

Done.prototype.updateSession = function() {
  if (typeof PouchHost === 'undefined') {
    return new Promise(function(resolve) { resolve(); });
  }
  return PouchHost.session().then(function(session) {
    this.session = session;
    if (session && !session.error) {
      $('syncDesc').textContent = session.user;
      this.doSync(session.db);
    } else {
      $('syncDesc').textContent = 'Login to Sync';
    }
  }.bind(this));
};

Done.prototype.doSync = function(db) {

  var updateSyncStatus = function(status) {
    sync.status = status;
    $('syncIcon').dataset.status = sync.status;
    this.updateSyncPage();
  }.bind(this);

  var upToDates = 0;
  var sync = this.sync = this.db.sync(db, {live: true});
  updateSyncStatus('syncing');

  sync.on('change', function() {
    updateSyncStatus('syncing');
  });

  sync.on('uptodate', function() {
    // (we get 2 uptodates, for pull and push)
    if (++upToDates === 2) {
      upToDates = 0;
      updateSyncStatus('synced');
    }
  });

  sync.on('error', function() {
    updateSyncStatus('error');
  });
};

Done.prototype.addEvents = function() {
  window.addEventListener('hashchange', this.hashChanged.bind(this));
  $('newList').addEventListener('submit', this.createNewList.bind(this));
  $('newItem').addEventListener('submit', this.createNewItem.bind(this));
  $('syncSetup').addEventListener('submit', this.syncLogin.bind(this));
  $('items').addEventListener('click', this.toggleDone.bind(this));
};

Done.prototype.syncLogin = function(evt) {
  evt.preventDefault();
  PouchHost.login({
    email: $('email').value.trim()
  });
  var notification = 'You have been sent an email with a token to login. ' +
    'Click on the link in the email and your data will sync with done.gd';
  alert(notification);
  $('email').value = '';
  document.location.hash = '#';
};

Done.prototype.createNewList = function(evt) {
  evt.preventDefault();
  var name = $('newListText').value;
  if (!name || name === '') {
    return;
  }
  newListText.value = '';
  document.location.hash = '#/list/' + name + '/';
};

Done.prototype.toggleDone = function(evt) {
  var id = evt.target.dataset.id;
  if (!id || evt.target.nodeName !== 'BUTTON') {
    return;
  }
  this.db.get(id).then((function(doc) {
    doc.status = (doc.status == 'done') ? 'todo' : 'done';
    doc.updated = Date.now();
    this.db.put(doc);
  }).bind(this));
};

Done.prototype.editItem = function(id) {
  var li = document.querySelector('[data-id="' + id + '"]');
  var db = this.db;
  var self = this;

  db.get(id).then(function(doc) {
    var pos = li.getBoundingClientRect();
    items.style.transform = 'translate(0, -' + pos.top + 'px)';
    items.style.webkitTransform = 'translate(0, -' + pos.top + 'px)';
    document.body.classList.add('editing');
    li.innerHTML = '';
    var input = document.createElement('input');
    input.value = doc.title;
    li.appendChild(input);
    input.focus();
    input.addEventListener('blur', function() {
      window.location.hash = '#/list/' + doc.category;
      items.style.transform = '';
      items.style.webkitTransform = '';
      document.body.classList.remove('editing');
      doc.title = input.value;
      doc.updated = Date.now();
      db.put(doc);
    });
  });
};

Done.prototype.listenToChanges = function() {
  this.db.changes({
    since: 'now',
    live: true,
    include_docs: true
  }).on('change', (function(change) {
    if (change.doc.category !== this.currentList) {
      return;
    }
    this.processChange(change.doc);
  }).bind(this));
};

Done.prototype.updateSyncPage = function() {
  if (!this.session || !this.session.user) {
    $('login').style.display = 'block';
    $('loggedin').style.display = 'none';
    return;
  }
  $('loggedin').style.display = 'block';

  if (this.sync.status === 'error') {
    $('syncLargeStatus').innerHTML = 'Unknown Error syncing ' +
      '<button>Click to retry</button>';
  } else {
    $('syncLargeStatus').textContent = 'Currently Syncing';
  }

};

Done.prototype.hashChanged = function() {

  var url = window.location.hash.slice(1);
  if (!url || url === '') {
    url = '/list/todos';
  }

  document.body.dataset.url = url;

  if (url === '/home/') {
    return this.showLists();
  } else if (url.lastIndexOf('/list/', 0) === 0) {
    var parts = url.split('/');
    var promise = this.showList(parts[2]);
    if (parts[3] === 'edit') {
      this.editItem(parts[4]);
    }
    return promise;
  } else if (url === '/sync/') {
    this.updateSyncPage();
  }
}

Done.prototype.showLists = function() {
  return new Promise(function(resolve) {

    var query = {
      reduce: '_sum',
      map: function(doc) {
        if (doc.category &&
            doc.status && doc.status === 'todo') {
          emit(doc.category, 1);
        }
      }
    };

    this.db.query(query, {group_level: 1}).then(function(result) {
      lists.innerHTML = '';
      result.rows.forEach(function(obj) {
        var a = document.createElement('a');
        var span = document.createElement('span');
        var li = document.createElement('li');
        a.setAttribute('href', '#/list/' + obj.key + '/');
        a.textContent = obj.key;
        span.textContent = obj.value;
        li.appendChild(a);
        li.appendChild(span);
        lists.appendChild(li);
      });
      updateBackground(lists);
      resolve();
    }.bind(this));

  }.bind(this));
}

Done.prototype.createNewItem = function(evt) {
  evt.preventDefault();
  var title = $('newItemText').value.trim();
  if (!title || title === '') {
    return;
  }
  var item = this.newTodo({
    title: newItemText.value,
    category: this.currentList
  });
  this.db.put(item);
  newItemText.value = '';
  newItemText.blur();
}

/*
 * Show a particular list
 */
Done.prototype.showList = function(category) {
  return new Promise((function(resolve) {

    if (category === this.currentList) {
      return resolve();
    }

    $('doneItems').innerHTML = '';
    $('todoItems').innerHTML = '';

    this.currentIndex = 0;
    this.currentList = category;

    var map = function(doc) {
      if (doc.category) {
        emit(doc.category);
      }
    };

    var self = this;
    this.db.query({map: map}, {
      include_docs: true,
      startkey: this.currentList,
      endkey: this.currentList + '{}'
    }).then(function(result) {
      if (!result.rows.length) {
        updateBackground(todoItems);
      } else {
        result.rows.forEach(function(doc) {
          self.processChange(doc.doc);
        });
      }
      resolve();
    });

  }).bind(this));
};

/*
 * Process a change, this is used for both incoming changes and to draw
 * the individual lists, it means we can handle real time updates and
 * dont need to redraw entire lists for a single change.
 */
Done.prototype.processChange = function(doc) {

  if (doc.index > this.currentIndex) {
    this.currentIndex = doc.index;
  }

  var item = document.querySelector('[data-id="' + doc._id + '"]');
  var li = createListItem(doc);

  if (item) {
    item.parentNode.removeChild(item);
  }

  // We store seperate lists for done and active items
  var toAdd = (doc.status === 'done') ? $('doneItems') : $('todoItems');

  // Complete items are ordered by time last updated, active items
  // are ordered by index
  var compare = function(dataset) {
    return (doc.status === 'done')
      ? (parseInt(dataset.updated, 10) || 0) <= doc.updated
      : (parseInt(dataset.index, 10) || 0) <= doc.index;
  }

  var inserted = false;
  var childNodesLen = toAdd.childNodes.length;

  if (!childNodesLen) {
    toAdd.appendChild(li);
    inserted = true;
  } else {
    for (var i = 0; i < childNodesLen; i++) {
      if (compare(toAdd.childNodes[i].dataset)) {
        toAdd.insertBefore(li, toAdd.childNodes[i]);
        inserted = true;
        break
      }
    }
  }

  if (!inserted) {
    toAdd.appendChild(li);
  }

  if (doc.status === 'done' && toAdd.childNodes.length > 5) {
    toAdd.removeChild(toAdd.childNodes[toAdd.childNodes.length - 1]);
  }

  updateBackground(todoItems);
};

Done.prototype.newTodo = function(obj) {
  var def = {
    category: 'default',
    status: 'todo',
    title: '',
    index: ++this.currentIndex,
    created: Date.now()
  };

  Object.keys(obj).forEach(function(key) {
    def[key] = obj[key];
  });

  def._id = 'items_' + def.category + '_' + def.created;
  return def;
};

new Done();
