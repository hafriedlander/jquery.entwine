#!/bin/sh

$VER = `git rev-parse HEAD`

cp LICENSE /tmp/
echo "/* jQuery.Concrete - Copyright 2009 Hamish Friedlander and SilverStripe. Version $VER. */" > /tmp/concrete.js

for x in vendor/jquery.selector/jquery.class.js vendor/jquery.selector/jquery.selector.js vendor/jquery.selector/jquery.selector.specifity.js vendor/jquery.selector/jquery.selector.matches.js src/jquery.dat.js src/jquery.concrete.js ; do \
  echo "/* $x */" >> /tmp/concrete.js
  cat $x >> /tmp/concrete.js
  echo >> /tmp/concrete.js
done

git checkout dist
mv /tmp/concrete.js .
mv /tmp/LICENSE .

git add concrete.js
git add LICENSE
git commit -m "Update dist to master version $VER"

git checkout master