(function($) {	

	$.concrete.Namespace.add_method_handler(60, function(selector, k, v){
		var g, s, p;

		if (k.charAt(0) != k.charAt(0).toUpperCase()) $.concrete.warn('Concrete property '+k+' does not start with a capital letter', $.concrete.WARN_LEVEL_BESTPRACTISE);
	
		g = function() { return this.data(k) || v ; }
		s = function(v){ return this.data(k, v); }
		
		g.pname = s.pname = k;
		
		this.bind_proxy(selector, 'get'+k, g);
		this.bind_proxy(selector, 'set'+k, s);
		
		return true;
	});
	
})(jQuery);
