'use strict';

var syncStatus = document.getElementById('syncStatus');
var syncDialog = document.getElementById('syncDialog');
var lists = document.getElementById('lists');
var items = document.getElementById('items');
var todoItems = document.getElementById('todo-items');
var doneItems = document.getElementById('done-items');
var newListForm = document.getElementById('newList');
var newItemForm = document.getElementById('newItem');
var newItemText = document.getElementById('newItemText');
var listName = document.getElementById('listName');
var listHeader = document.getElementById('listHeader');

var currentIndex = 0;

function newTodo(obj) {
  var def = {
    category: 'default',
    status: 'todo',
    title: '',
    index: ++currentIndex,
    created: Date.now()
  };
  Object.keys(obj).forEach(function(key) {
    def[key] = obj[key];
  });
  def._id = 'items_' + def.category + '_' + def.created;
  return def;
}

function createListItem(doc) {
  var li = document.createElement('li');
  var a = document.createElement('a');
  var btn = document.createElement('button');
  li.dataset.updated = doc.updated;
  li.dataset.status = doc.status;
  li.dataset.action = 'edit';
  li.dataset.id = doc._id;
  li.dataset.index = doc.index;
  btn.innerHTML = '✓';
  btn.dataset.id = doc._id;
  btn.dataset.action = 'done';
  a.innerHTML = doc.title;
  li.appendChild(a);
  li.appendChild(btn);
  return li;
}

function processChange(doc) {

  if (doc.index > currentIndex) {
    currentIndex = doc.index;
  }

  var item = document.querySelector('[data-id="' + doc._id + '"]');
  var li = createListItem(doc);

  if (item) {
    item.parentNode.removeChild(item);
  }

  // We store seperate lists for done and active items
  var toAdd = (doc.status === 'done') ? doneItems : todoItems;

  // Complete items are ordered by time last updated
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

  newListForm.style.background = 'rgb(98,179,25)';
  newItemForm.style.background = 'rgb(98,179,25)';
  listHeader.style.background ='rgb(98,179,25)';
}

var DB_NAME = 'done';

var Done = function() {

  this.db = new PouchDB(DB_NAME);
  this.currentList = null;
  this.config = {};

  this.db.get('config', (function(err, config) {
    this.config = config;
    this.addEvents();
    this.listenToChanges();
    this.handleEvent({type: 'hashchange'});
  }).bind(this));
};

Done.prototype.addEvents = function() {
  window.addEventListener('hashchange', this);
  newListForm.addEventListener('submit', this);
  newItemForm.addEventListener('submit', this);
  items.addEventListener('click', this);
};

Done.prototype.handleEvent = function(evt) {
  switch (evt.type) {
  case 'hashchange':
    this.urlChanged(document.location.hash.slice(1));
    break;
  case 'submit':
    evt.preventDefault();
    var action = evt.target.dataset.action;
    if (action === 'newList') {
      return this.createNewList(newListText.value);
    }
    if (action === 'newItem') {
      return this.createNewItem(newItemText.value);
    }
    break;
  case 'click':
    var action = evt.target.dataset.action;
    if (action === 'edit') {
      return this.editItem(evt.target, evt.target.dataset.id);
    }
    if (action === 'done') {
      return this.toggleDone(evt.target.dataset.id);
    }
    break;
  }
};

Done.prototype.createNewList = function(name) {
  if (!name || name === '') {
    return;
  }
  newListText.value = '';
  document.location.hash = '#/list/' + name + '/';
};

Done.prototype.toggleDone = function(id) {
  this.db.get(id).then((function(doc) {
    doc.status = (doc.status == 'done') ? 'todo' : 'done';
    doc.updated = Date.now();
    this.db.put(doc);
  }).bind(this));
};

Done.prototype.editItem = function(li, id) {
  var db = this.db;
  db.get(id).then(function(doc) {
    var pos = li.getBoundingClientRect();
    items.style.transform = 'translate(0, -' + pos.top + 'px)';
    document.body.classList.add('editing');
    li.innerHTML = '';
    var input = document.createElement('input');
    input.value = doc.title;
    li.appendChild(input);
    input.focus();
    input.addEventListener('blur', function() {
      items.style.transform = '';
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
    processChange(change.doc);
  }).bind(this));
};

Done.prototype.urlChanged = function(url) {
  if (!url || url === '') {
    url = '/list/default';
  }

  if (url === '/home/') {
    this.showLists();
  } else if (url.startsWith('/list/')) {
    this.showList(url);
  }

  document.body.dataset.url = url
}

Done.prototype.showLists = function() {
  var map = function(doc) {
    if (doc.category &&
        doc.status &&
        doc.status === 'todo') {
      emit(doc.category, 1);
    }
  };

  this.db.query({map: map, reduce: '_sum'}, {group_level: 1}).then((function(result) {
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
  }).bind(this));
}

Done.prototype.createNewItem = function(title) {
  if (!title || title === '') {
    return;
  }
  var item = newTodo({
    title: newItemText.value,
    category: this.currentList
  });
  this.db.put(item);
  newItemText.value = '';
  newItemText.blur();
}

Done.prototype.showList = function(url) {
  doneItems.innerHTML = '';
  todoItems.innerHTML = '';
  var parts = url.split('/');
  this.currentList = parts[2];

  listName.textContent = this.currentList;

  var map = function(doc) {
    if (doc.category) {
      emit(doc.category);
    }
  };

  this.db.query({map: map}, {
    include_docs: true,
    startkey: this.currentList,
    endkey: this.currentList + '{}'
  }).then(function(result) {
    result.rows.forEach(function(doc) {
      processChange(doc.doc);
    });
  });
};

new Done();
