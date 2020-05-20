# Rekishi
[![npm version](https://badge.fury.io/js/rekishi.svg)](https://badge.fury.io/js/rekishi)
![the gzip size of Rekishi](https://img.badgesize.io/robb0wen/rekishi/master/dist/rekishi.js.svg?compression=gzip)
![the Brotli size of Rekishi](https://img.badgesize.io/robb0wen/rekishi/master/dist/rekishi.js.svg?compression=brotli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

<img src="./rekishi.png" alt="Rekishi" width="110" height="120" />

## What is Rekishi?

Rekishi is a minimal wrapper for the History API that provides additional pub/sub functionality. 

I became frustrated that, whilst you can assign some state, the history API doesn't give access to any information about _outgoing_ URLs. If you need to create dynamic transitions between different pages or different types of content, then Rekishi can help.

Beyond watching for URL changes, Rekishi also allows you to associate data with incoming paths - that means that, for example, your front-end code can know ahead of time that `/blog/finding-the-best-coffee-in-tokyo` is a going to be a blog post.


## What Rekishi isn't

Rekishi is not a clientside router, in the traditional sense. It isn't really designed for use with a framework either - There are far better and more mature libraries available for that. 

Rekishi is concerned only with watching and responding to changes in browser history. What you do with that information is up to you and your application.

## Why "Rekishi"?

At this point, most of the more obvious names for History libs have been taken. Rekishi (歴史 | れきし) means history in Japanese. Why pick a Japanese word? well, part of my own personal history was spent living in Tokyo, so it felt appropriate.

# Installation
Npm is the preferred method. Open your project directory in your command line or terminal, then run:

```
npm install rekishi
```

# Standard usage

## Import Rekishi

First of all, you will need to import Rekishi and any actions that you require:
``` javascript
import { 
  Rekishi, 
  REKISHI_POP, 
  REKISHI_PUSH,
  REKISHI_HASH,
  REKISHI_PARAMS,
  REKISHI_HASHPARAMS,
  REKISHI_NOCHANGE
} from 'rekishi';
```

## Initialise Rekishi

Next you will need to initialise an instance of Rekishi:
``` javascript
const options = {
  registeredRoutes: [
    {
      path: '/blog/*',
      data: {
        type: 'post'
      }
    }
  ],
  initPathData: { 
    type: 'page',
    initial: true,
    foo: 'bar'
  },
  scrollRestoration: 'manual'
};

const rekishi = new Rekishi(options);
```

The constructor options object currently takes the following properties:

### _registeredPaths_

This property takes an array of path objects. These objects contain a path glob, and a data object, in the following structure:

``` javascript
{
  path: String,
  data: Object
}
```

Each path object in this array is assigned to Rekishi on initialisation, and that default data will be passed automatically to your handler function.



The `path` property is a string representation of a relative url pathname. It uses a simple matching format:

`/path/` would match exactly to `/path` or `/path/` (trailing slash is optional)  
`/path/*` would match to any url under `/path/`, such as `/path/to/a/post`

The paths defined in `registeredPaths` stack, so the order is significant. If you wanted to pass data to all posts, but single out a specific subpage you could do:

``` javascript
[
  {
    path: '/posts/*',
    data: {
      type: 'post'
    }
  },
  {
    path: '/posts/riding-the-shinkansen',
    data: {
      type: 'post',
      featured: true
    }
  }
]
```

__Note:__ Rekishi is not designed to map data to specific domains, hashes or query parameters. Any paths in a format such as `http://mywebsite.com/blog?id=1` will be ignored.

### _initPathData_
This property allows you to pass and store a data object _specific to the page that initialises Rekishi_. 

For example, this property allows you to override the default registered path data for users entering the site directly on a URL. 

Consider this example:

``` javascript
const rekishi = new Rekishi({
  registeredPaths: [
    {
      path: '/profile',
      type: 'modal'
    }
  ],
  initPathData: {
    type: 'page'
  }
});
```

By default, when the history changes to `/profile`, your application would consider that path to have a type of `modal`. Using the above configuration, when a user enters the site directly on the `/profile` url, that type will be overwritten with `page`.

This can be useful if you are creating page transitions that need to vary depending on a particular data property.

### scrollRestoration 
Modifies the history API scroll position. Defaults to `manual` (full controll over scroll position between routes). Alternatively, `auto` will leave scroll position up to the browser. For more see: https://developer.mozilla.org/en-US/docs/Web/API/History/scrollRestoration

## Handler functions

Now that Rekishi is initialised, you can define a function to respond to any changes in history:

``` javascript
const handleRouteChange = ({ incoming, outgoing, action }) => {
  switch (action) {
    case REKISHI_POP:
      // browser history has changed
      // do something based on incoming and outgoing data
      break;

    case REKISHI_PUSH:
      // a new link has been followed
      break;

    case REKISHI_HASH:
    case REKISHI_HASHPARAMS:
      // the hash has changed, so handle it
      break;

    case REKISHI_PARAMS:
    case REKISHI_HASHPARAMS:
      // the query has changed, so handle it
      break;

    case REKISHI_NOCHANGE:
      // nothing changed
      break;
  }
};
```

Handler functions have access to the current state object:

``` javascript
{
  incoming: {
    path: String,
    hash: String,
    params: Object,
    data: Object
  },
  outgoing: {
    path: String,
    hash: String,
    params: Object,
    data: Object
  },
  action: REKISHI_PUSH || REKISHI_POP || REKISHI__HASH || REKISHI_PARAMS || REKISHI_HASHPARAMS || REKISHI_NOCHANGE
}
```
The actions available to you are:

* __REKISHI_PUSH__ - a new path was visited and pushed to history
* __REKISHI_POP__ - A previous path was visited when the user travelled forward or back in their browser's history
* __REKISHI_HASH__ - the path hasn't changed, but the hash fragment has
* __REKISHI_PARAMS__ - the path hasn't changed, but the query parameters have
* __REKISHI_HASHPARAMS__ - the path hasn't changed, but both the hash and the query parameters have
* __REKISHI_NOCHANGE__ - the path, hash fragment and query parameters are unchanged

Together with the incoming and outgoing objects, you can use these actions to choreograph page changes, animations or transitions however you want. 

For example, if you wanted a transition between a page and modal content, you might write a handler function that looks like this:

``` javascript
const handleRouteChange = ({ incoming, outgoing, action }) => {
  switch (action) {
    // on either history, or new link events...
    case REKISHI_POP:
    case REKISHI_PUSH:
      
      if (incoming.type == 'modal' && outgoing.type == 'page') {
        // AJAX the content from incoming.path
        // set up your modal and inject AJAX content
      }

      if (incoming.type == 'page' && outgoing.type == 'modal') {
        //close your modal and remove the content
      }

      break;
  }
};
```

Similarly, responding to a change in hash fragment could look like this:

``` javascript
const handleRouteChange = ({ incoming, outgoing, action }) => {
  switch (action) {
    case REKISHI_HASH:
    case REKISHI_HASHPARAMS:
      // find an element that matches the hash
      // if it exists, scroll to its position

      break;
  }
};
```

## Subscribing to handlers

Once you have written a handler function, you can tell Rekishi to call that function whenever there are any changes in history. You can set Rekishi to watch as many handler functions as you need.

``` javascript
rekishi.watch(handleRouteChange);
```

## Pushing new paths
For most situations, you will need your application to be able to visit new URLs. You can pass a new URL, and any optional data, to Rekishi with the `push` method.

``` javascript
rekishi.push(url, data);
```
In this case, `url` is a relative internal path that can include a hash or query params, but not a domain (Rekishi shouldn't be listening to external URLs). 

For example you might want to bind internal links to Rekishi in the following way:

``` javascript
const internalLinks = [...root.querySelectorAll('a[href^="/"], a[href^="#"], a[href^="?"]')];

interalLinks.forEach(link => {

  link.addEventListener('click', event => {
    // prevent the link from following
    event.preventDefault();

    // capture the url and any additional data from the markup
    const href = link.getAttribute('href');
    const data = {
      foo: link.dataset.foo,
      bar: link.dataset.bar
    };

    // push the url and any optional custom data to Rekishi
    rekishi.push(href, data);
  });

});
```
Any data passed with the `push` method will be merged with registered path data. This means that properties passed in the `push` data object will override the defaults associated with a particular path.


# Optional methods

## Unsubscribing to changes
When you're ready to stop watching for changes, you can pass the handler function into the `unwatch` method.

``` javascript
rekishi.unwatch(handleRouteChange);
```

## Registering additional paths
Sometimes you might need to register additional path information on-the-fly. You can do this by calling the `registerPath` method:

``` javascript
rekishi.registerPath('/contact', { type: "modal" });
```