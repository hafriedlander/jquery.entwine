
describe 'Concrete'
  describe 'Properties'
    before
      $('body').append('<div id="dom_test"></div>')
    end
    after
      $('#dom_test').remove()
    end
  
    before_each
      $.concrete.clear_all_rules()
      $('#dom_test').html('<div id="a" class="a b c"></div><div id="b" class="b c"></div>')
    end

    it 'can define and get a basic property'
      $('#a').concrete({
        Foo: null
      });
	   $('.a').Foo().should.be_null
    end

    it 'can define and set a basic property'
      $('#a').concrete({
        Foo: null
      });
	   $('.a').setFoo(1);
		$('.a').Foo().should.equal 1
    end
	 
    it 'can define an initial value'
      $('#a').concrete({
        Foo: 1
      });
		$('.a').Foo().should.equal 1
    end
	
    it 'can define an int restriction'
      $('#a').concrete({
        Foo: $.property({restrict: 'int'})
      });
		$('.a').setFoo('1');
		$('.a').Foo().should.equal 1
    end

    it 'can define an int restriction and an initial value'
      $('#a').concrete({
        Foo: $.property({restrict: 'int', initial: '2'})
      });
		$('.a').Foo().should.equal 2
		$('.a').setFoo('1');
		$('.a').Foo().should.equal 1
    end
  end
end
