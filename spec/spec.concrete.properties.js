
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
	   $('.a').getFoo().should.be_null
    end

    it 'can define and set a basic property'
      $('#a').concrete({
        Foo: null
      });
      $('.a').setFoo(1);
      $('.a').getFoo().should.equal 1
    end
	 
    it 'can define a default value'
      $('#a').concrete({
        Foo: 1
      });
      $('.a').getFoo().should.equal 1
    end
	
  end
end
