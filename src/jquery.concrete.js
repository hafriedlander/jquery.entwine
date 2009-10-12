var console;

(function($) {	

	/** What to call to run a function 'soon'. Normally setTimeout, but for syncronous mode we override so soon === now */
	var runSoon = window.setTimeout;
	
	/** Stores a count of definitions, so that we can sort identical selectors by definition order */
	var rulecount = 0;

	/** Utility to optionally display warning messages depending on level */
	var warn = function(message, level) {
		if (level <= $.concrete.warningLevel && console && console.log) { 
			console.warn(message);
			if (console.trace) console.trace();
		}
	}

   /** A property definition */
	$.property = function(options) {
		if (this instanceof $.property) this.options = options;
		else return new $.property(options);
	}
	$.extend($.property, {
		/**
		 * Strings for how to cast a value to a specific type. Used in some nasty meta-programming stuff below to try and
		 * keep property access as fast as possible
		 */
		casters: {
			'int': 'Math.round(parseFloat(v));',
			'float': 'parseFloat(v);',
			'string': '""+v;'
		},
		
		getter: function(options) {
			options = options || {};
			
			if (options.initial === undefined) return function(){ return this.d()[arguments.callee.pname] };
			
			var getter = function(){ 
				var d = this.d(); var k = arguments.callee.pname;
				return d.hasOwnProperty(k) ? d[k] : (d[k] = arguments.callee.initial);
			};
			var v = options.initial;
			getter.initial = options.restrict ? eval($.property.casters[options.restrict]) : v;
			
			return getter;
		},
		
		setter: function(options){
			options = options || {};
			if (options.restrict) {
				var restrict = options.restrict;
				return new Function('v', 'return this.d()[arguments.callee.pname] = ' + $.property.casters[options.restrict]);
			}
			
			return function(v){ return this.d()[arguments.callee.pname] = v; }
		}
	});
	$.extend($.property.prototype, {
		getter: function(){
			return $.property.getter(this.options);
		},
		setter: function(){
			return $.property.setter(this.options);
		}
	});

	var Rule = Base.extend({
		init: function(selector, name) {
			this.selector = selector;
			this.specifity = selector.specifity();
			this.important = 0;
			this.name = name;
			this.rulecount = rulecount++;
		}
	});
	
	Rule.compare = function(a, b) {
		var as = a.specifity, bs = b.specifity;
		
		return (a.important - b.important) ||
		       (as[0] - bs[0]) ||
		       (as[1] - bs[1]) ||
		       (as[2] - bs[2]) ||
		       (a.rulecount - b.rulecount) ;
	}

	$.fn._super = function(){
		var rv, i = this.length;
		while (i--) {
			var el = this[0];
			rv = el.f(el, arguments, el.i);
		}
		return rv;
	}


	var is_or_contains = document.compareDocumentPosition ?
		function(a, b){
			return a && b && (a == b || !!(a.compareDocumentPosition(b) & 16));
		} : 
		function(a, b){
			return a && b && (a == b || (a.contains ? a.contains(b) : true));
		} ;

	$.support.bubblingChange = !($.browser.msie || $.browser.safari);
		
	var namespaces = {};

	var Namespace = Base.extend({
		init: function(name){
			if (name && !name.match(/^[A-Za-z0-9.]+$/)) warn('Concrete namespace '+name+' is not formatted as period seperated identifiers', $.concrete.WARN_LEVEL_BESTPRACTISE);
			name = name || '__base';
			
			this.name = name;
			this.store = {};
			
			namespaces[name] = this;
			
			if (name == "__base") {
				this.injectee = $.fn
				this.$ = $;
			}
			else {
				// We're in a namespace, so we build a Class that subclasses the jQuery Object Class to inject namespace functions into
				var subfn = function(){}
				this.injectee = subfn.prototype = new $();
				
				// And then we provide an overriding $ that returns objects of our new Class, and an overriding pushStack to catch further selection building
				var bound$ = this.$ = function(a) {
					// Try the simple way first
					var jq = $.fn.init.apply(new subfn(), arguments);
					if (jq instanceof subfn) return jq;
					
					// That didn't return a bound object, so now we need to copy it
					var rv = new subfn();
					rv.selector = jq.selector; rv.context = jq.context; var i = rv.length = jq.length;
					while (i--) rv[i] = jq[i];
					return rv;
				}
				this.injectee.pushStack = function(elems, name, selector){
					var ret = bound$(elems);

					// Add the old object onto the stack (as a reference)
					ret.prevObject = this;
					ret.context = this.context;
					
					if ( name === "find" ) ret.selector = this.selector + (this.selector ? " " : "") + selector;
					else if ( name )       ret.selector = this.selector + "." + name + "(" + selector + ")";
					
					// Return the newly-formed element set
					return ret;
				}
				
				// Copy static functions through from $ to this.$ so e.g. $.ajax still works
				// @bug, @cantfix: Any class functions added to $ after this call won't get mirrored through 
				$.extend(this.$, $);
				
				// We override concrete to inject the name of this namespace when defining blocks inside this namespace
				var concrete_wrapper = this.injectee.concrete = function() {
					var args = arguments;
					
					if (!args[0] || typeof args[0] != 'string') { args = $.makeArray(args); args.unshift(name); }
					else if (args[0].charAt(0) != '.') args[0] = name+'.'+args[0];
					
					return $.fn.concrete.apply(this, args);
				}
				
				this.$.concrete = function() {
					concrete_wrapper.apply(null, arguments);
				}
			}
		},
		
		/**
		 * Returns a function that does selector matching against the function list for a function name
		 * Used by proxy for all calls, and by ctorProxy to handle _super calls
		 * @param {String} name - name of the function as passed in the construction object
		 * @param {String} funcprop - the property on the Rule object that gives the actual function to call
		 */
		one: function(name, funcprop) {
			var namespace = this;
			var funcs = this.store[name];
			
			var one = function(el, args, i){
				if (i === undefined) i = funcs.length;
				while (i--) {
					if (funcs[i].selector.matches(el)) {
						var ret, tmp_i = el.i, tmp_f = el.f;
						el.i = i; el.f = one;
						try { ret = funcs[i][funcprop].apply(namespace.$(el), args); }
						finally { el.i = tmp_i; el.f = tmp_f; }
						return ret;
					}
				}
			}
			
			return one;
		},
		
		/**
		 * A proxy is a function attached to a callable object (either the base jQuery.fn or a subspace object) which handles
		 * finding and calling the correct function for each member of the current jQuery context
		 * @param {String} name - name of the function as passed in the construction object
		 */
		build_proxy: function(name) {
			var one = this.one(name, 'func');
			
			var prxy = function() {
				var rv, ctx = $(this); 
				
				var i = ctx.length;
				while (i--) rv = one(ctx[i], arguments);
				return rv;
			};
			
			return prxy;
		},
		
		bind_proxy: function(selector, name, func) {
			var funcs = this.store[name] || (this.store[name] = []) ;
			
			var rule = funcs[funcs.length] = Rule(selector, name); rule.func = func;
			funcs.sort(Rule.compare);
			
			if (!this.injectee.hasOwnProperty(name)) {
				this.injectee[name] = this.build_proxy(name);
				this.injectee[name].concrete = true;
			}

			if (!this.injectee[name].concrete) {
				warn('Warning: Concrete function '+name+' clashes with regular jQuery function - concrete function will not be callable directly on jQuery object', $.concrete.WARN_LEVEL_IMPORTANT);
			}
		},
		
		build_event_proxy: function(name) {
			var one = this.one(name, 'func');
			
			var prxy = function(e, originalevent) {
				e = originalevent || e;
				
				var el = e.target;
				while (el && el != document && !e.isPropagationStopped()) {
					one(el, arguments);
					el = el.parentNode;
				}
			};
			
			return prxy;
		},
		
		build_mouseenterleave_proxy: function(name) {
			var one = this.one(name, 'func');
			
			var prxy = function(e) {
				var el = e.target;
				var rel = e.relatedTarget;
				
				while (el && el != document && !e.isPropagationStopped()) {
					/* We know el contained target. If it also contains relatedTarget then we didn't mouseenter / leave. What's more, every ancestor will also
					contan el and rel, and so we can just stop bubbling */
					if (is_or_contains(el, rel)) break;
					
					one(el, arguments);
					el = el.parentNode;
				}
			};
			
			return prxy;
		},
		
		build_change_proxy: function(name) {
			var one = this.one(name, 'func');
			
			var prxy = function(e) {
				var el = e.target;
				// If this is a keydown event, only worry about the enter key, since browsers only trigger onchange on enter or focus loss
				if (e.type === 'keydown' && e.keyCode !== 13) return;
				// Make sure this is event is for an input type we're interested in
				if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA' && el.tagName !== 'SELECT') return;
					
				var $el = $(el), nowVal, oldVal = $el.data('changeVal');
			
				// Detect changes on checkboxes & radiobuttons, which have different value logic. We don't use el.value, since el is part
				// of a set, and we only want to raise onchange once for a single user action.
				if (el.type == 'checkbox' || el.type == 'radio') {
					if (!el.disabled && e.type === 'click') {
						nowVal = el.checked;
						// If radio, we get two changes - the activation, and the deactivation. We only want to fire one change though
						if ((el.type === 'checkbox' || nowVal === true) && oldVal !== nowVal) e.type = 'change';
					}
				}
				// Detect changes on other input types. In this case value is OK.
				else {
					nowVal = el.value;
					if (oldVal !== undefined && oldVal !== nowVal) e.type = 'change';
				}
			
				// Save the current value for next time
				if (nowVal !== undefined) $el.data('changeVal', nowVal);
			
				// And if we decided that a change happened, do the actual triggering
				if (e.type == 'change') {
					while (el && el != document && !e.isPropagationStopped()) {
						one(el, arguments);
						el = el.parentNode;
					}
				}
			};
			
			return prxy;
		},
		
		bind_event: function(selector, name, func, event) {
			var funcs = this.store[name] || (this.store[name] = []) ;
			
			var rule = funcs[funcs.length] = Rule(selector, name); rule.func = func;
			funcs.sort(Rule.compare);
			
			if (!funcs.proxy) {
				switch (name) {
					case 'onmouseenter':
						funcs.proxy = this.build_mouseenterleave_proxy(name);
						event = 'mouseover';
						break;
					case 'onmouseleave':
						funcs.proxy = this.build_mouseenterleave_proxy(name);
						event = 'mouseout';
						break;
					case 'onchange':
						if (!$.support.bubblingChange) {
							funcs.proxy = this.build_change_proxy(name);
							event = 'click focusin focusout keydown';
						}
						break;
					case 'onsubmit':
						event = 'delegated_submit';
					case 'onfocus':
					case 'onblur':
						warn('Event '+event+' not supported - using focusin / focusout instead', $.concrete.WARN_LEVEL_IMPORTANT);
				}
				
				if (!funcs.proxy) funcs.proxy = this.build_event_proxy(name);
				$(document).bind(event, funcs.proxy);
			}
		},
		
		bind_condesc: function(selector, name, func) {
			var ctors = this.store.ctors || (this.store.ctors = []) ;
			
			var rule;
			for (var i = 0 ; i < ctors.length; i++) {
				if (ctors[i].selector.selector == selector.selector) {
					rule = ctors[i]; break;
				}
			}
			if (!rule) {
				rule = ctors[ctors.length] = Rule(selector, 'ctors');
				ctors.sort(Rule.compare);
			}
			
			rule[name] = func;
			
			if (!ctors[name+'proxy']) {
				var one = this.one('ctors', name);
				var namespace = this;
				
				var proxy = function(els, i, func) {
					var j = els.length;
					while (j--) {
						var el = els[j];
						
						var tmp_i = el.i, tmp_f = el.f;
						el.i = i; el.f = one;
						try { func.call(namespace.$(el)); }
						catch(e) { el.i = tmp_i; el.f = tmp_f; }					
					}
				}
				
				ctors[name+'proxy'] = proxy;
			}
		},
		
		add: function(selector, data) {
			var k, v, match, event;
			
			for (k in data) {
				v = data[k];
				
				if ($.isFunction(v) && v !== $.property) {
					if (k == 'onmatch' || k == 'onunmatch') {
						this.bind_condesc(selector, k, v);
					}
					else if (match = k.match(/^on(.*)/)) {
						event = match[1];
						this.bind_event(selector, k, v, event);
					}
					else {
						this.bind_proxy(selector, k, v);
					}
				}
				else {
					var g, s, p;

					if (k.charAt(0) != k.charAt(0).toUpperCase()) warn('Concrete property '+k+' does not start with a capital letter', $.concrete.WARN_LEVEL_BESTPRACTISE);
					
					if (v == $.property || v instanceof $.property) {
						g = v.getter(); s = v.setter();
					}
					else {
						p = $.property({initial: v}); g = p.getter(); s = p.setter(); 
					}
					
					g.pname = s.pname = k;
					this.bind_proxy(selector, k, g);
					this.bind_proxy(selector, 'set'+k, s);
				}
			}
		},
		
		has: function(ctx, name) {
			var rulelist = this.store[name];
			if (!rulelist) return false;
			
			/* We go forward this time, since low specifity is likely to knock out a bunch of elements quickly */
			for (var i = 0 ; i < rulelist.length; i++) {
				ctx = ctx.not(rulelist[i].selector);
				if (!ctx.length) return true;
			}
			return false;
		}
	});

	/**
	 * Main concrete function. Used for new definitions, calling into a namespace (or forcing the base namespace) and entering a using block
	 * 
	 */
	$.fn.concrete = function() {
		var i = 0;
		var selector = this.selector ? $.selector(this.selector) : null;
		
		var namespace = namespaces.__base || Namespace();
		if (typeof arguments[i] == 'string') {
			if (arguments[i].charAt('0') == '.') arguments[i] = arguments[i].substr(1);
			if (arguments[i]) namespace = namespaces[arguments[i]] || Namespace(arguments[i]);
			i++;
		}
		
		while (i < arguments.length) {
			var res = arguments[i];
			// If it's a function, call it - either it's a using block or it's a concrete definition builder
			if ($.isFunction(res)) {
				if (res.length != 1) warn('Function block inside concrete definition does not take $ argument properly', $.concrete.WARN_LEVEL_IMPORTANT);
				res = res.call(namespace.$(this), namespace.$);
			}
			//else if (namespace.name != '__base') warn('Raw object inside namespaced ('+namespace.name+') concrete definition - namespace lookup will not work properly', $.concrete.WARN_LEVEL_IMPORTANT);
				
			// Now if we still have a concrete definition object, inject it into namespace
			if (res) {
				if (selector) namespace.add(selector, res);
				else warn('Concrete block given to concrete call without selector. Make sure you call $(selector).concrete when defining blocks', $.concrete.WARN_LEVEL_IMPORTANT);
			}
			i++
		}
		
		return namespace.$(this);
	}
	
	$.concrete = function() {
		$.fn.concrete.apply(null, arguments);
	}
	
	/**
	 * A couple of utility functions for accessing the store outside of this closure, and for making things
	 * operate in a little more easy-to-test manner
	 */
	$.extend($.concrete, {
		
		/**
		 * Get all the namespaces. Usefull for introspection? Internal interface of Namespace not guaranteed consistant
		 */
		namespaces: function() { return namespaces; },
		
		/**
		 * Remove all concrete rules
		 */
		clear_all_rules: function() { 
			// Remove proxy functions
			for (var k in $.fn) { if ($.fn[k].concrete) delete $.fn[k] ; }
			// Remove namespaces, and start over again
			namespaces = [];
		},
		
		/**
		 * Make onmatch and onunmatch work in synchronous mode - that is, new elements will be detected immediately after
		 * the DOM manipulation that made them match. This is only really useful for during testing, since it's pretty slow
		 * (otherwise we'd make it the default).
		 */
		synchronous_mode: function() {
			if (check_id) clearTimeout(check_id); check_id = null;
			runSoon = function(func, delay){ func.call(this); return null; }
		},
		
		/**
		 * Trigger onmatch and onunmatch now - usefull for after DOM manipulation by methods other than through jQuery.
		 * Called automatically on document.ready
		 */
		triggerMatching: function() {
			matching();
		},
		
		WARN_LEVEL_NONE: 0,
		WARN_LEVEL_IMPORTANT: 1,
		WARN_LEVEL_BESTPRACTISE: 2,
		
		/** 
		 * Warning level. Set to a higher level to get warnings dumped to console.
		 */
		warningLevel: 0,
	});
	
	// 
	var check_id = null; // The timer handle for the asyncronous matching call
	var form_binding_cache = $([]); // A cache for already-handled form elements
	var delegate_submit = function(e){ $(document).triggerHandler('delegated_submit', e); } // The function that handles the delegation

	/**
	 * Finds all the elements that now match a different rule (or have been removed) and call onmatch on onunmatch as appropriate
	 * 
	 * Because this has to scan the DOM, and is therefore fairly slow, this is normally triggered off a short timeout, so that
	 * a series of DOM manipulations will only trigger this once.
	 * 
	 * The downside of this is that things like:
	 *   $('#foo').addClass('tabs'); $('#foo').tabFunctionBar();
	 * won't work.
	 */
	function matching() {
		// For every namespace
		for (var k in namespaces) {
			// That has constructors or destructors
			var ctors = namespaces[k].store.ctors;
			if (ctors) {
			
				// Keep a record of elements that have matched already
				var matched = $([]), match, add, rem;
				// Stepping through each selector from most to least specific
				var j = ctors.length;
				while (j--) {
					// Build some quick-acccess variables
					var sel = ctors[j].selector.selector, ctor = ctors[j].onmatch; dtor = ctors[j].onunmatch;
					// Get the list of elements that match this selector, that haven't yet matched a more specific selector
					res = add = $(sel).not(matched);
					
					// If this selector has a list of elements it matched against last time					
					if (ctors[j].cache) {
						// Find the ones that are extra this time
						add = res.not(ctors[j].cache);
						// Find the ones that are gone this time
						rem = ctors[j].cache.not(res);
						// And call the desctructor on them
						if (rem.length && dtor) ctors.onunmatchproxy(rem, j, dtor);
					}
					
					// Call the constructor on the newly matched ones
					if (add.length && ctor) ctors.onmatchproxy(add, j, ctor);
					
					// Add these matched ones to the list tracking all elements matched so far
					matched = matched.add(res);
					// And remember this list of matching elements again this selector, so next matching we can find the unmatched ones
					ctors[j].cache = res;
				}
			}
		}
		
		// As a special case, find all forms and bind onsubmit to trigger on the document too. This is the only event that can't be grabbed via delegation.
		var forms = $('form');
		// Only bind to forms we haven't processed yet
		forms.not(form_binding_cache).bind('submit', delegate_submit);
		// Then remember the current set of forms
		form_binding_cache = forms;
		
		check_id = null;
	}
	
	function registerMutateFunction() {
		$.each(arguments, function(i,func){
			var old = $.fn[func];
			$.fn[func] = function() {
				var rv = old.apply(this, arguments);
				if (!check_id) check_id = runSoon(matching, 100);
				return rv;
			}
		})
	}
	
	function registerSetterGetterFunction() {
		$.each(arguments, function(i,func){
			var old = $.fn[func];
			$.fn[func] = function(a, b) {
				var rv = old.apply(this, arguments);
				if (!check_id && (b !== undefined || typeof a != 'string')) check_id = runSoon(matching, 100);
				return rv;
			}
		})
	}

	// Register core DOM manipulation methods
	registerMutateFunction('append', 'prepend', 'after', 'before', 'wrap', 'removeAttr', 'addClass', 'removeClass', 'toggleClass', 'empty', 'remove');
	registerSetterGetterFunction('attr');
	
	// And on DOM ready, trigger matching once
	$(function(){ matching(); })
	
})(jQuery);
