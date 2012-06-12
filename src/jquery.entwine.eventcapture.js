(function($) {

	$.entwine.Namespace.addMethods({
		bind_capture: function(selector, event, name, capture) {
			var store  = this.captures || (this.captures = {});
			var rulelists = store[event] || (store[event] = {});
			var rulelist = rulelists[name] || (rulelists[name] = $.entwine.RuleList());

			rule = rulelist.addRule(selector, event);
			rule.handler = name;

			this.bind_proxy(selector, name, capture);
		}
	});

	var bindings = $.entwine.capture_bindings = {};

	var event_proxy = function(event) {
		return function(e) {
			var namespace, capturelists, forevent, capturelist, rule, handler, sel;

			for (var k in $.entwine.namespaces) {
				namespace = $.entwine.namespaces[k];
				capturelists = namespace.captures;

				if (capturelists && (forevent = capturelists[event])) {
					for (var k in forevent) {
						var capturelist = forevent[k];
						var triggered = namespace.$([]);

						// Stepping through each selector from most to least specific
						var j = capturelist.length;
						while (j--) {
							rule = capturelist[j];
							handler = rule.handler;
							sel = rule.selector.selector;

							var matching = namespace.$(sel).not(triggered);
							matching[handler].apply(matching, arguments);

							triggered = triggered.add(matching);
						}
					}
				}
			}
		}
	};

	$.entwine.Namespace.addHandler({
		order: 10,

		bind: function(selector, k, v) {
			if (v && $.isFunction(v) && v._iscapture) {
				var match = k.match(/^on(.*)_from/);
				var event = match && match[1];

				if (!event) {
					$.entwine.warn('To capture an event, the method name needs to start on{event}_from - got '+k+' so ignoring', $.entwine.WARN_LEVEL_IMPORTANT);
				}
				else {
					this.bind_capture(selector, event, k, v);

					if (!bindings[event]) {
						$(document).bind(event.replace(/(\s+|$)/g, '.entwine$1'), bindings[event] = event_proxy(event));
					}
				}

				return true;
			}
		},

		namespaceStaticOverrides: function(namespace){
			return {
				capture: $.entwine.capture
			};
		}
	});

	var selector_proxy = function(selector, handler, includechildren) {
		var matcher = $.selector(selector);
		return function(e){
			if (matcher.matches(e.target)) return handler.apply(this, arguments);
		}
	};

	var element_proxy = function(elements, handler, includechildren) {
		var elements = $(elements);
		return function(e){
			if (elements.filter(e.target).length) return handler.apply(this, arguments);
		}
	};

	var function_proxy = function(callback, handler, includechildren) {
		return function(e){
			if ($(callback.call(this)).filter(e.target).length) return handler.apply(this, arguments);
		}
	};

	$.extend($.entwine, {
		capture: function(source, handler, includechildren){
			var proxyGen;

			// If source is a string, it's a selector
			if (typeof(source) == 'string') proxyGen = selector_proxy;
			// If source is a function, it's called to get the actual element, once per object
			else if ($.isFunction(source)) proxyGen = function_proxy;
			// Default is to assume source is a jQuery object or something that can be turned into one (DOM element, array of elements, etc)
			else proxyGen = element_proxy;

			var proxy = proxyGen(source, handler, includechildren);
			proxy._iscapture = true;
			return proxy;
		}
	});

})(jQuery);
