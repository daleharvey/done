(function (window) {

  'use strict';

  function Store(name, cb) {
    this.name = name;
    window.db = this.db = new PouchDB(name, cb);
  }

  function pdocTodoc(doc) {
    doc.id = parseInt(doc._id, 10);
    delete doc._rev;
    delete doc._id;
    return doc;
  }

  Store.prototype.find = function(query, callback) {
    this.db.allDocs({include_docs: true}, function(err, docs) {
      var matches = [];
      docs.rows.forEach(function(row) {
        var doc = pdocTodoc(row.doc);
        for (var q in query) {
          if (query[q] !== doc[q]) {
            return;
          }
        }
        matches.push(doc);
      });
      callback(matches);
    });
  };

  Store.prototype.findAll = function(callback) {
    this.db.allDocs({include_docs: true}, function(err, docs) {
      callback(docs.rows.map(function(row) {
        return pdocTodoc(row.doc);
      }).reverse());
    });
  };

  Store.prototype.save = function (id, updateData, callback) {
    if (typeof id !== 'object') {
      this.db.get(id, (function(err, data) {
        for (var x in updateData) {
          data[x] = updateData[x];
          this.db.put(data, callback);
        }
      }).bind(this));
    } else {
      callback = updateData;
      updateData = id;
      updateData._id = new Date().getTime().toString();
      this.db.put(updateData, function(err) {
        callback();
      });
    }
  };

  Store.prototype.remove = function (id, callback) {
    this.db.get(id, (function(err, data) {
      this.db.remove(data, callback);
    }).bind(this));
  };

  Store.prototype.drop = function (callback) {
    PouchDB.destroy(this.name, callback);
  };

  // Export to window
  window.app = window.app || {};
  window.app.Store = Store;

})(window);
