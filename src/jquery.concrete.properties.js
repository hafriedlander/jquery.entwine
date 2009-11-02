(function($) {	

	var concrete_prepend = '__concrete!';
	
	var getConcreteData = function(el, namespace, property) {
		return el.data(concrete_prepend + namespace + '!' + property);
	}
	
	var setConcreteData = function(el, namespace, property, value) {
		return el.data(concrete_prepend + namespace + '!' + property, value);
	}
	
	var getConcreteDataAsHash = function(el, namespace) {
		var hash = {};
		var id = jQuery.data(el[0]);
		
		var matchstr = concrete_prepend + namespace + '!';
		var matchlen = matchstr.length;
		
		var cache = jQuery.cache[id];
		for (var k in cache) {
			if (k.substr(0,matchlen) == matchstr) hash[k.substr(matchlen)] = cache[k];
		}
		
		return hash;
	}
	
	var setConcreteDataFromHash = function(el, namespace, hash) {
		for (var k in hash) setConcreteData(namespace, k, hash[k]);
	}

	var concreteData = function(el, namespace, args) {
		switch (args.length) {
			case 0:
				return getConcreteDataAsHash(el, namespace);
			case 1:
				if (typeof args[0] == 'string') return getConcreteData(el, namespace, args[0]);
				else                            return setConcreteDataFromHash(el, namespace, args[0]);
			default:
				return setConcreteData(el, namespace, args[0], args[1]);
		}
	}
 
	$.extend($.fn, {
		concreteData: function() {
			return concreteData(this, '__base', arguments);
		}
	});
	
	$.concrete.Namespace.addHandler({
		order: 60,
		
		bind: function(selector, k, v) {
			if (k.charAt(0) != k.charAt(0).toUpperCase()) $.concrete.warn('Concrete property '+k+' does not start with a capital letter', $.concrete.WARN_LEVEL_BESTPRACTISE);

			// Create the getters and setters

			var getterName = 'get'+k;
			var setterName = 'set'+k;

			this.bind_proxy(selector, getterName, function() { return this.concreteData(k) || v ; });
			this.bind_proxy(selector, setterName, function(v){ return this.concreteData(k, v); });
			
			// Get the get and set proxies we just created
			
			var getter = this.injectee[getterName];
			var setter = this.injectee[setterName];
			
			// And bind in the jQuery-style accessor
			
			this.bind_proxy(selector, k, function(v){ return (arguments.length == 1 ? setter : getter).call(this, v) ; });

			return true;
		},
		
		namespaceMethodOverrides: function(namespace){
			return {
				concreteData: function() {
					return concreteData(this, namespace.name, arguments);
				}
			};
		}
	});
	
})(jQuery);
