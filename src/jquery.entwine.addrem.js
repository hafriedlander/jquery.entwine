(function($) {

	$.entwine.Namespace.addMethods({
		build_addrem_proxy: function(name) {
			var one = this.one(name, 'func');

			return function() {
				if (this.length === 0){
					return;
				}
				else if (this.length) {
					var rv, i = this.length;
					while (i--) rv = one(this[i], arguments);
					return rv;
				}
				else {
					return one(this, arguments);
				}
			};
		},

		bind_addrem_proxy: function(selector, name, func) {
			var rulelist = this.store[name] || (this.store[name] = $.entwine.RuleList());

			var rule = rulelist.addRule(selector, name); rule.func = func;

			if (!this.injectee.hasOwnProperty(name)) {
				this.injectee[name] = this.build_addrem_proxy(name);
				this.injectee[name].isentwinemethod = true;
			}
		}
	});

	$.entwine.Namespace.addHandler({
		order: 30,

		bind: function(selector, k, v) {
			if ($.isFunction(v) && (k == 'onadd' || k == 'onremove')) {
				this.bind_addrem_proxy(selector, k, v);
				return true;
			}
		}
	});

	var domTrackAdded = false;

	var added = function(els) {
		if (domTrackAdded !== false) { els = $(els).not(domTrackAdded); domTrackAdded = domTrackAdded.add(els); }

		// For every namespace
		for (var k in $.entwine.namespaces) {
			var namespace = $.entwine.namespaces[k];
			if (namespace.injectee.onadd) namespace.injectee.onadd.call(els);
		}
	};

	var removed = function(els) {
		// For every namespace
		for (var k in $.entwine.namespaces) {
			var namespace = $.entwine.namespaces[k];
			if (namespace.injectee.onremove) namespace.injectee.onremove.call(els);
		}
	};

	// Monkey patch $.fn.domManip to catch all regular jQuery add element calls
	var _domManip = $.prototype.domManip;
	$.prototype.domManip = function(args, table, callback) {

		if (!callback.patched) {
			var original = callback;
			arguments[2] = function(elem){
				var rv = original.apply(this, arguments);

				if (elem.nodeType == 1) {
					added(elem);
					added(elem.getElementsByTagName('*'));
				}
				// Document fragments don't have getElementsByTagName - sad face
				else if (elem.nodeType == 11) {
					var node = elem.firstChild;
					while (node) {
						if (node.nodeType === 1) { added(node); added(node.getElementsByTagName('*')); }
						node = node.nextSibling;
					}
				}

				return rv;
			}
			arguments[2].patched = true;
		}

		return _domManip.apply(this, arguments);
	}

	// Monkey patch $.fn.html to catch when jQuery sets innerHTML directly
	var _html = $.prototype.html;
	$.prototype.html = function(value) {
		if (value === undefined) return _html.apply(this, arguments);

		domTrackAdded = $([]);
		var res = _html.apply(this, arguments);
		added(this.find('*'));
		domTrackAdded = false;

		return res;
	}

	// Monkey patch $.cleanData to catch element removal
	var _cleanData = $.cleanData;
	$.cleanData = function( elems ) {
		removed(elems);
		return _cleanData( elems );
	}

	// And on DOM ready, trigger adding once
	$(function(){
		added($('*'));
	});


})(jQuery);
