(function($){

	// Gets all the child elements of a particular elements, stores it in an array
	function getElements(store, original) {
		var node, i = store.length, next = original.firstChild;

		while ((node = next)) {
			if (node.nodeType === 1) store[i++] = node;
			next = node.firstChild || node.nextSibling;
			while (!next && (node = node.parentNode) && node !== original) next = node.nextSibling;
		}
	}

	// This might be faster? Or slower? @todo: benchmark.
	function getElementsAlt(store, node) {
		if (node.getElementsByTagName) {
			var els = node.getElementsByTagName('*'), len = els.length, i = 0, j = store.length;
			for(; i < len; i++, j++) {
				store[j] = els[i];
			}
		}
		else if (node.childNodes) {
			var els = node.childNodes, len = els.length, i = 0;
			for(; i < len; i++) {
				getElements(store, els[i]);
			}
		}
	}

	var dontTrigger = false;

	// Monkey patch $.fn.domManip to catch all regular jQuery add element calls
	var _domManip = $.prototype.domManip;
	$.prototype.domManip = function(args, table, callback) {
		if (!callback.patched) {
			var original = callback;
			arguments[2] = function(elem){
				var rv = original.apply(this, arguments);

				if (!dontTrigger) {
					var added = [];

					if (elem.nodeType == 1) added[added.length] = elem;
					getElements(added, elem);

					var event = $.Event('EntwineElementsAdded');
					event.targets = added;
					$(document).triggerHandler(event);
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

		dontTrigger = true;
		var res = _html.apply(this, arguments);
		dontTrigger = false;

		var added = [];

		var i = 0, length = this.length;
		for (; i < length; i++ ) getElements(added, this[i]);

		var event = $.Event('EntwineElementsAdded');
		event.targets = added;
		$(document).triggerHandler(event);

		return res;
	}

	// If this is true, we've changed something to call cleanData so that we can catch the elements, but we don't
	// want to call the underlying original $.cleanData
	var supressActualClean = false;
	var removed = false;

	// Monkey patch $.cleanData to catch element removal
	var _cleanData = $.cleanData;
	$.cleanData = function( elems ) {
		var event = $.Event('EntwineElementsRemoved');
		event.targets = elems
		$(document).triggerHandler(event);

		if (!supressActualClean) _cleanData.apply(this, arguments);
	}

	// Monkey patch $.fn.remove to catch when we're just detaching (keepdata == 1) -
	// this doesn't call cleanData but still needs to trigger event
	var _remove = $.prototype.remove;
	$.prototype.remove = function(selector, keepdata) {
		supressActualClean = keepdata;
		var rv = _remove.call(this, selector);
		supressActualClean = false;
		return rv;
	}

	// And on DOM ready, trigger adding once
	$(function(){
		var added = []; getElements(added, document);

		var event = $.Event('EntwineElementsAdded');
		event.targets = added;
		$(document).triggerHandler(event);
	});


})(jQuery);