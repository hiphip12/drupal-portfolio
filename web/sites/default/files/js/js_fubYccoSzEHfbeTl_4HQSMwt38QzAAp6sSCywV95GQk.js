/**
 * @file
 * Drupal Bootstrap object.
 */

/**
 * All Drupal Bootstrap JavaScript APIs are contained in this namespace.
 *
 * @param {underscore} _
 * @param {jQuery} $
 * @param {Drupal} Drupal
 * @param {drupalSettings} drupalSettings
 */
(function (_, $, Drupal, drupalSettings) {
  'use strict';

  /**
   * @typedef Drupal.bootstrap
   */
  var Bootstrap = {
    processedOnce: {},
    settings: drupalSettings.bootstrap || {}
  };

  /**
   * Wraps Drupal.checkPlain() to ensure value passed isn't empty.
   *
   * Encodes special characters in a plain-text string for display as HTML.
   *
   * @param {string} str
   *   The string to be encoded.
   *
   * @return {string}
   *   The encoded string.
   *
   * @ingroup sanitization
   */
  Bootstrap.checkPlain = function (str) {
    return str && Drupal.checkPlain(str) || '';
  };

  /**
   * Creates a jQuery plugin.
   *
   * @param {String} id
   *   A jQuery plugin identifier located in $.fn.
   * @param {Function} plugin
   *   A constructor function used to initialize the for the jQuery plugin.
   * @param {Boolean} [noConflict]
   *   Flag indicating whether or not to create a ".noConflict()" helper method
   *   for the plugin.
   */
  Bootstrap.createPlugin = function (id, plugin, noConflict) {
    // Immediately return if plugin doesn't exist.
    if ($.fn[id] !== void 0) {
      return this.fatal('Specified jQuery plugin identifier already exists: @id. Use Drupal.bootstrap.replacePlugin() instead.', {'@id': id});
    }

    // Immediately return if plugin isn't a function.
    if (typeof plugin !== 'function') {
      return this.fatal('You must provide a constructor function to create a jQuery plugin "@id": @plugin', {'@id': id, '@plugin':  plugin});
    }

    // Add a ".noConflict()" helper method.
    this.pluginNoConflict(id, plugin, noConflict);

    $.fn[id] = plugin;
  };

  /**
   * Diff object properties.
   *
   * @param {...Object} objects
   *   Two or more objects. The first object will be used to return properties
   *   values.
   *
   * @return {Object}
   *   Returns the properties of the first passed object that are not present
   *   in all other passed objects.
   */
  Bootstrap.diffObjects = function (objects) {
    var args = Array.prototype.slice.call(arguments);
    return _.pick(args[0], _.difference.apply(_, _.map(args, function (obj) {
      return Object.keys(obj);
    })));
  };

  /**
   * Map of supported events by regular expression.
   *
   * @type {Object<Event|MouseEvent|KeyboardEvent|TouchEvent,RegExp>}
   */
  Bootstrap.eventMap = {
    Event: /^(?:load|unload|abort|error|select|change|submit|reset|focus|blur|resize|scroll)$/,
    MouseEvent: /^(?:click|dblclick|mouse(?:down|enter|leave|up|over|move|out))$/,
    KeyboardEvent: /^(?:key(?:down|press|up))$/,
    TouchEvent: /^(?:touch(?:start|end|move|cancel))$/
  };

  /**
   * Extends a jQuery Plugin.
   *
   * @param {String} id
   *   A jQuery plugin identifier located in $.fn.
   * @param {Function} callback
   *   A constructor function used to initialize the for the jQuery plugin.
   *
   * @return {Function|Boolean}
   *   The jQuery plugin constructor or FALSE if the plugin does not exist.
   */
  Bootstrap.extendPlugin = function (id, callback) {
    // Immediately return if plugin doesn't exist.
    if (typeof $.fn[id] !== 'function') {
      return this.fatal('Specified jQuery plugin identifier does not exist: @id', {'@id':  id});
    }

    // Immediately return if callback isn't a function.
    if (typeof callback !== 'function') {
      return this.fatal('You must provide a callback function to extend the jQuery plugin "@id": @callback', {'@id': id, '@callback':  callback});
    }

    // Determine existing plugin constructor.
    var constructor = $.fn[id] && $.fn[id].Constructor || $.fn[id];
    var plugin = callback.apply(constructor, [this.settings]);
    if (!$.isPlainObject(plugin)) {
      return this.fatal('Returned value from callback is not a plain object that can be used to extend the jQuery plugin "@id": @obj', {'@obj':  plugin});
    }

    this.wrapPluginConstructor(constructor, plugin, true);

    return $.fn[id];
  };

  Bootstrap.superWrapper = function (parent, fn) {
    return function () {
      var previousSuper = this.super;
      this.super = parent;
      var ret = fn.apply(this, arguments);
      if (previousSuper) {
        this.super = previousSuper;
      }
      else {
        delete this.super;
      }
      return ret;
    };
  };

  /**
   * Provide a helper method for displaying when something is went wrong.
   *
   * @param {String} message
   *   The message to display.
   * @param {Object} [args]
   *   An arguments to use in message.
   *
   * @return {Boolean}
   *   Always returns FALSE.
   */
  Bootstrap.fatal = function (message, args) {
    if (this.settings.dev && console.warn) {
      for (var name in args) {
        if (args.hasOwnProperty(name) && typeof args[name] === 'object') {
          args[name] = JSON.stringify(args[name]);
        }
      }
      Drupal.throwError(new Error(Drupal.formatString(message, args)));
    }
    return false;
  };

  /**
   * Intersects object properties.
   *
   * @param {...Object} objects
   *   Two or more objects. The first object will be used to return properties
   *   values.
   *
   * @return {Object}
   *   Returns the properties of first passed object that intersects with all
   *   other passed objects.
   */
  Bootstrap.intersectObjects = function (objects) {
    var args = Array.prototype.slice.call(arguments);
    return _.pick(args[0], _.intersection.apply(_, _.map(args, function (obj) {
      return Object.keys(obj);
    })));
  };

  /**
   * Normalizes an object's values.
   *
   * @param {Object} obj
   *   The object to normalize.
   *
   * @return {Object}
   *   The normalized object.
   */
  Bootstrap.normalizeObject = function (obj) {
    if (!$.isPlainObject(obj)) {
      return obj;
    }

    for (var k in obj) {
      if (typeof obj[k] === 'string') {
        if (obj[k] === 'true') {
          obj[k] = true;
        }
        else if (obj[k] === 'false') {
          obj[k] = false;
        }
        else if (obj[k].match(/^[\d-.]$/)) {
          obj[k] = parseFloat(obj[k]);
        }
      }
      else if ($.isPlainObject(obj[k])) {
        obj[k] = Bootstrap.normalizeObject(obj[k]);
      }
    }

    return obj;
  };

  /**
   * An object based once plugin (similar to jquery.once, but without the DOM).
   *
   * @param {String} id
   *   A unique identifier.
   * @param {Function} callback
   *   The callback to invoke if the identifier has not yet been seen.
   *
   * @return {Bootstrap}
   */
  Bootstrap.once = function (id, callback) {
    // Immediately return if identifier has already been processed.
    if (this.processedOnce[id]) {
      return this;
    }
    callback.call(this, this.settings);
    this.processedOnce[id] = true;
    return this;
  };

  /**
   * Provide jQuery UI like ability to get/set options for Bootstrap plugins.
   *
   * @param {string|object} key
   *   A string value of the option to set, can be dot like to a nested key.
   *   An object of key/value pairs.
   * @param {*} [value]
   *   (optional) A value to set for key.
   *
   * @returns {*}
   *   - Returns nothing if key is an object or both key and value parameters
   *   were provided to set an option.
   *   - Returns the a value for a specific setting if key was provided.
   *   - Returns an object of key/value pairs of all the options if no key or
   *   value parameter was provided.
   *
   * @see https://github.com/jquery/jquery-ui/blob/master/ui/widget.js
   */
  Bootstrap.option = function (key, value) {
    var options = $.isPlainObject(key) ? $.extend({}, key) : {};

    // Get all options (clone so it doesn't reference the internal object).
    if (arguments.length === 0) {
      return $.extend({}, this.options);
    }

    // Get/set single option.
    if (typeof key === "string") {
      // Handle nested keys in dot notation.
      // e.g., "foo.bar" => { foo: { bar: true } }
      var parts = key.split('.');
      key = parts.shift();
      var obj = options;
      if (parts.length) {
        for (var i = 0; i < parts.length - 1; i++) {
          obj[parts[i]] = obj[parts[i]] || {};
          obj = obj[parts[i]];
        }
        key = parts.pop();
      }

      // Get.
      if (arguments.length === 1) {
        return obj[key] === void 0 ? null : obj[key];
      }

      // Set.
      obj[key] = value;
    }

    // Set multiple options.
    $.extend(true, this.options, options);
  };

  /**
   * Adds a ".noConflict()" helper method if needed.
   *
   * @param {String} id
   *   A jQuery plugin identifier located in $.fn.
   * @param {Function} plugin
   * @param {Function} plugin
   *   A constructor function used to initialize the for the jQuery plugin.
   * @param {Boolean} [noConflict]
   *   Flag indicating whether or not to create a ".noConflict()" helper method
   *   for the plugin.
   */
  Bootstrap.pluginNoConflict = function (id, plugin, noConflict) {
    if (plugin.noConflict === void 0 && (noConflict === void 0 || noConflict)) {
      var old = $.fn[id];
      plugin.noConflict = function () {
        $.fn[id] = old;
        return this;
      };
    }
  };

  /**
   * Creates a handler that relays to another event name.
   *
   * @param {HTMLElement|jQuery} target
   *   A target element.
   * @param {String} name
   *   The name of the event to trigger.
   * @param {Boolean} [stopPropagation=true]
   *   Flag indicating whether to stop the propagation of the event, defaults
   *   to true.
   *
   * @return {Function}
   *   An even handler callback function.
   */
  Bootstrap.relayEvent = function (target, name, stopPropagation) {
    return function (e) {
      if (stopPropagation === void 0 || stopPropagation) {
        e.stopPropagation();
      }
      var $target = $(target);
      var parts = name.split('.').filter(Boolean);
      var type = parts.shift();
      e.target = $target[0];
      e.currentTarget = $target[0];
      e.namespace = parts.join('.');
      e.type = type;
      $target.trigger(e);
    };
  };

  /**
   * Replaces a Bootstrap jQuery plugin definition.
   *
   * @param {String} id
   *   A jQuery plugin identifier located in $.fn.
   * @param {Function} callback
   *   A callback function that is immediately invoked and must return a
   *   function that will be used as the plugin constructor.
   * @param {Boolean} [noConflict]
   *   Flag indicating whether or not to create a ".noConflict()" helper method
   *   for the plugin.
   */
  Bootstrap.replacePlugin = function (id, callback, noConflict) {
    // Immediately return if plugin doesn't exist.
    if (typeof $.fn[id] !== 'function') {
      return this.fatal('Specified jQuery plugin identifier does not exist: @id', {'@id':  id});
    }

    // Immediately return if callback isn't a function.
    if (typeof callback !== 'function') {
      return this.fatal('You must provide a valid callback function to replace a jQuery plugin: @callback', {'@callback': callback});
    }

    // Determine existing plugin constructor.
    var constructor = $.fn[id] && $.fn[id].Constructor || $.fn[id];
    var plugin = callback.apply(constructor, [this.settings]);

    // Immediately return if plugin isn't a function.
    if (typeof plugin !== 'function') {
      return this.fatal('Returned value from callback is not a usable function to replace a jQuery plugin "@id": @plugin', {'@id': id, '@plugin': plugin});
    }

    this.wrapPluginConstructor(constructor, plugin);

    // Add a ".noConflict()" helper method.
    this.pluginNoConflict(id, plugin, noConflict);

    $.fn[id] = plugin;
  };

  /**
   * Simulates a native event on an element in the browser.
   *
   * Note: This is a fairly complete modern implementation. If things aren't
   * working quite the way you intend (in older browsers), you may wish to use
   * the jQuery.simulate plugin. If it's available, this method will defer to
   * that plugin.
   *
   * @see https://github.com/jquery/jquery-simulate
   *
   * @param {HTMLElement|jQuery} element
   *   A DOM element to dispatch event on. Note: this may be a jQuery object,
   *   however be aware that this will trigger the same event for each element
   *   inside the jQuery collection; use with caution.
   * @param {String|String[]} type
   *   The type(s) of event to simulate.
   * @param {Object} [options]
   *   An object of options to pass to the event constructor. Typically, if
   *   an event is being proxied, you should just pass the original event
   *   object here. This allows, if the browser supports it, to be a truly
   *   simulated event.
   *
   * @return {Boolean}
   *   The return value is false if event is cancelable and at least one of the
   *   event handlers which handled this event called Event.preventDefault().
   *   Otherwise it returns true.
   */
  Bootstrap.simulate = function (element, type, options) {
    // Handle jQuery object wrappers so it triggers on each element.
    var ret = true;
    if (element instanceof $) {
      element.each(function () {
        if (!Bootstrap.simulate(this, type, options)) {
          ret = false;
        }
      });
      return ret;
    }

    if (!(element instanceof HTMLElement)) {
      this.fatal('Passed element must be an instance of HTMLElement, got "@type" instead.', {
        '@type': typeof element,
      });
    }

    // Defer to the jQuery.simulate plugin, if it's available.
    if (typeof $.simulate === 'function') {
      new $.simulate(element, type, options);
      return true;
    }

    var event;
    var ctor;
    var types = [].concat(type);
    for (var i = 0, l = types.length; i < l; i++) {
      type = types[i];
      for (var name in this.eventMap) {
        if (this.eventMap[name].test(type)) {
          ctor = name;
          break;
        }
      }
      if (!ctor) {
        throw new SyntaxError('Only rudimentary HTMLEvents, KeyboardEvents and MouseEvents are supported: ' + type);
      }
      var opts = {bubbles: true, cancelable: true};
      if (ctor === 'KeyboardEvent' || ctor === 'MouseEvent') {
        $.extend(opts, {ctrlKey: !1, altKey: !1, shiftKey: !1, metaKey: !1});
      }
      if (ctor === 'MouseEvent') {
        $.extend(opts, {button: 0, pointerX: 0, pointerY: 0, view: window});
      }
      if (options) {
        $.extend(opts, options);
      }
      if (typeof window[ctor] === 'function') {
        event = new window[ctor](type, opts);
        if (!element.dispatchEvent(event)) {
          ret = false;
        }
      }
      else if (document.createEvent) {
        event = document.createEvent(ctor);
        event.initEvent(type, opts.bubbles, opts.cancelable);
        if (!element.dispatchEvent(event)) {
          ret = false;
        }
      }
      else if (typeof element.fireEvent === 'function') {
        event = $.extend(document.createEventObject(), opts);
        if (!element.fireEvent('on' + type, event)) {
          ret = false;
        }
      }
      else if (typeof element[type]) {
        element[type]();
      }
    }
    return ret;
  };

  /**
   * Strips HTML and returns just text.
   *
   * @param {String|Element|jQuery} html
   *   A string of HTML content, an Element DOM object or a jQuery object.
   *
   * @return {String}
   *   The text without HTML tags.
   *
   * @todo Replace with http://locutus.io/php/strings/strip_tags/
   */
  Bootstrap.stripHtml = function (html) {
    if (html instanceof $) {
      html = html.html();
    }
    else if (html instanceof Element) {
      html = html.innerHTML;
    }
    var tmp = document.createElement('DIV');
    tmp.innerHTML = html;
    return (tmp.textContent || tmp.innerText || '').replace(/^[\s\n\t]*|[\s\n\t]*$/, '');
  };

  /**
   * Provide a helper method for displaying when something is unsupported.
   *
   * @param {String} type
   *   The type of unsupported object, e.g. method or option.
   * @param {String} name
   *   The name of the unsupported object.
   * @param {*} [value]
   *   The value of the unsupported object.
   */
  Bootstrap.unsupported = function (type, name, value) {
    Bootstrap.warn('Unsupported by Drupal Bootstrap: (@type) @name -> @value', {
      '@type': type,
      '@name': name,
      '@value': typeof value === 'object' ? JSON.stringify(value) : value
    });
  };

  /**
   * Provide a helper method to display a warning.
   *
   * @param {String} message
   *   The message to display.
   * @param {Object} [args]
   *   Arguments to use as replacements in Drupal.formatString.
   */
  Bootstrap.warn = function (message, args) {
    if (this.settings.dev && console.warn) {
      console.warn(Drupal.formatString(message, args));
    }
  };

  /**
   * Wraps a plugin with common functionality.
   *
   * @param {Function} constructor
   *   A plugin constructor being wrapped.
   * @param {Object|Function} plugin
   *   The plugin being wrapped.
   * @param {Boolean} [extend = false]
   *   Whether to add super extensibility.
   */
  Bootstrap.wrapPluginConstructor = function (constructor, plugin, extend) {
    var proto = constructor.prototype;

    // Add a jQuery UI like option getter/setter method.
    var option = this.option;
    if (proto.option === void(0)) {
      proto.option = function () {
        return option.apply(this, arguments);
      };
    }

    if (extend) {
      // Handle prototype properties separately.
      if (plugin.prototype !== void 0) {
        for (var key in plugin.prototype) {
          if (!plugin.prototype.hasOwnProperty(key)) continue;
          var value = plugin.prototype[key];
          if (typeof value === 'function') {
            proto[key] = this.superWrapper(proto[key] || function () {}, value);
          }
          else {
            proto[key] = $.isPlainObject(value) ? $.extend(true, {}, proto[key], value) : value;
          }
        }
      }
      delete plugin.prototype;

      // Handle static properties.
      for (key in plugin) {
        if (!plugin.hasOwnProperty(key)) continue;
        value = plugin[key];
        if (typeof value === 'function') {
          constructor[key] = this.superWrapper(constructor[key] || function () {}, value);
        }
        else {
          constructor[key] = $.isPlainObject(value) ? $.extend(true, {}, constructor[key], value) : value;
        }
      }
    }
  };

  // Add Bootstrap to the global Drupal object.
  Drupal.bootstrap = Drupal.bootstrap || Bootstrap;

})(window._, window.jQuery, window.Drupal, window.drupalSettings);
;
(function ($, _) {

  /**
   * @class Attributes
   *
   * Modifies attributes.
   *
   * @param {Object|Attributes} attributes
   *   An object to initialize attributes with.
   */
  var Attributes = function (attributes) {
    this.data = {};
    this.data['class'] = [];
    this.merge(attributes);
  };

  /**
   * Renders the attributes object as a string to inject into an HTML element.
   *
   * @return {String}
   *   A rendered string suitable for inclusion in HTML markup.
   */
  Attributes.prototype.toString = function () {
    var output = '';
    var name, value;
    var checkPlain = function (str) {
      return str && str.toString().replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;') || '';
    };
    var data = this.getData();
    for (name in data) {
      if (!data.hasOwnProperty(name)) continue;
      value = data[name];
      if (_.isFunction(value)) value = value();
      if (_.isObject(value)) value = _.values(value);
      if (_.isArray(value)) value = value.join(' ');
      output += ' ' + checkPlain(name) + '="' + checkPlain(value) + '"';
    }
    return output;
  };

  /**
   * Renders the Attributes object as a plain object.
   *
   * @return {Object}
   *   A plain object suitable for inclusion in DOM elements.
   */
  Attributes.prototype.toPlainObject = function () {
    var object = {};
    var name, value;
    var data = this.getData();
    for (name in data) {
      if (!data.hasOwnProperty(name)) continue;
      value = data[name];
      if (_.isFunction(value)) value = value();
      if (_.isObject(value)) value = _.values(value);
      if (_.isArray(value)) value = value.join(' ');
      object[name] = value;
    }
    return object;
  };

  /**
   * Add class(es) to the array.
   *
   * @param {string|Array} value
   *   An individual class or an array of classes to add.
   *
   * @return {Attributes}
   *
   * @chainable
   */
  Attributes.prototype.addClass = function (value) {
    var args = Array.prototype.slice.call(arguments);
    this.data['class'] = this.sanitizeClasses(this.data['class'].concat(args));
    return this;
  };

  /**
   * Returns whether the requested attribute exists.
   *
   * @param {string} name
   *   An attribute name to check.
   *
   * @return {boolean}
   *   TRUE or FALSE
   */
  Attributes.prototype.exists = function (name) {
    return this.data[name] !== void(0) && this.data[name] !== null;
  };

  /**
   * Retrieve a specific attribute from the array.
   *
   * @param {string} name
   *   The specific attribute to retrieve.
   * @param {*} defaultValue
   *   (optional) The default value to set if the attribute does not exist.
   *
   * @return {*}
   *   A specific attribute value, passed by reference.
   */
  Attributes.prototype.get = function (name, defaultValue) {
    if (!this.exists(name)) this.data[name] = defaultValue;
    return this.data[name];
  };

  /**
   * Retrieves a cloned copy of the internal attributes data object.
   *
   * @return {Object}
   */
  Attributes.prototype.getData = function () {
    return _.extend({}, this.data);
  };

  /**
   * Retrieves classes from the array.
   *
   * @return {Array}
   *   The classes array.
   */
  Attributes.prototype.getClasses = function () {
    return this.get('class', []);
  };

  /**
   * Indicates whether a class is present in the array.
   *
   * @param {string|Array} className
   *   The class(es) to search for.
   *
   * @return {boolean}
   *   TRUE or FALSE
   */
  Attributes.prototype.hasClass = function (className) {
    className = this.sanitizeClasses(Array.prototype.slice.call(arguments));
    var classes = this.getClasses();
    for (var i = 0, l = className.length; i < l; i++) {
      // If one of the classes fails, immediately return false.
      if (_.indexOf(classes, className[i]) === -1) {
        return false;
      }
    }
    return true;
  };

  /**
   * Merges multiple values into the array.
   *
   * @param {Attributes|Node|jQuery|Object} object
   *   An Attributes object with existing data, a Node DOM element, a jQuery
   *   instance or a plain object where the key is the attribute name and the
   *   value is the attribute value.
   * @param {boolean} [recursive]
   *   Flag determining whether or not to recursively merge key/value pairs.
   *
   * @return {Attributes}
   *
   * @chainable
   */
  Attributes.prototype.merge = function (object, recursive) {
    // Immediately return if there is nothing to merge.
    if (!object) {
      return this;
    }

    // Get attributes from a jQuery element.
    if (object instanceof $) {
      object = object[0];
    }

    // Get attributes from a DOM element.
    if (object instanceof Node) {
      object = Array.prototype.slice.call(object.attributes).reduce(function (attributes, attribute) {
        attributes[attribute.name] = attribute.value;
        return attributes;
      }, {});
    }
    // Get attributes from an Attributes instance.
    else if (object instanceof Attributes) {
      object = object.getData();
    }
    // Otherwise, clone the object.
    else {
      object = _.extend({}, object);
    }

    // By this point, there should be a valid plain object.
    if (!$.isPlainObject(object)) {
      setTimeout(function () {
        throw new Error('Passed object is not supported: ' + object);
      });
      return this;
    }

    // Handle classes separately.
    if (object && object['class'] !== void 0) {
      this.addClass(object['class']);
      delete object['class'];
    }

    if (recursive === void 0 || recursive) {
      this.data = $.extend(true, {}, this.data, object);
    }
    else {
      this.data = $.extend({}, this.data, object);
    }

    return this;
  };

  /**
   * Removes an attribute from the array.
   *
   * @param {string} name
   *   The name of the attribute to remove.
   *
   * @return {Attributes}
   *
   * @chainable
   */
  Attributes.prototype.remove = function (name) {
    if (this.exists(name)) delete this.data[name];
    return this;
  };

  /**
   * Removes a class from the attributes array.
   *
   * @param {...string|Array} className
   *   An individual class or an array of classes to remove.
   *
   * @return {Attributes}
   *
   * @chainable
   */
  Attributes.prototype.removeClass = function (className) {
    var remove = this.sanitizeClasses(Array.prototype.slice.apply(arguments));
    this.data['class'] = _.without(this.getClasses(), remove);
    return this;
  };

  /**
   * Replaces a class in the attributes array.
   *
   * @param {string} oldValue
   *   The old class to remove.
   * @param {string} newValue
   *   The new class. It will not be added if the old class does not exist.
   *
   * @return {Attributes}
   *
   * @chainable
   */
  Attributes.prototype.replaceClass = function (oldValue, newValue) {
    var classes = this.getClasses();
    var i = _.indexOf(this.sanitizeClasses(oldValue), classes);
    if (i >= 0) {
      classes[i] = newValue;
      this.set('class', classes);
    }
    return this;
  };

  /**
   * Ensures classes are flattened into a single is an array and sanitized.
   *
   * @param {...String|Array} classes
   *   The class or classes to sanitize.
   *
   * @return {Array}
   *   A sanitized array of classes.
   */
  Attributes.prototype.sanitizeClasses = function (classes) {
    return _.chain(Array.prototype.slice.call(arguments))
      // Flatten in case there's a mix of strings and arrays.
      .flatten()

      // Split classes that may have been added with a space as a separator.
      .map(function (string) {
        return string.split(' ');
      })

      // Flatten again since it was just split into arrays.
      .flatten()

      // Filter out empty items.
      .filter()

      // Clean the class to ensure it's a valid class name.
      .map(function (value) {
        return Attributes.cleanClass(value);
      })

      // Ensure classes are unique.
      .uniq()

      // Retrieve the final value.
      .value();
  };

  /**
   * Sets an attribute on the array.
   *
   * @param {string} name
   *   The name of the attribute to set.
   * @param {*} value
   *   The value of the attribute to set.
   *
   * @return {Attributes}
   *
   * @chainable
   */
  Attributes.prototype.set = function (name, value) {
    var obj = $.isPlainObject(name) ? name : {};
    if (typeof name === 'string') {
      obj[name] = value;
    }
    return this.merge(obj);
  };

  /**
   * Prepares a string for use as a CSS identifier (element, class, or ID name).
   *
   * Note: this is essentially a direct copy from
   * \Drupal\Component\Utility\Html::cleanCssIdentifier
   *
   * @param {string} identifier
   *   The identifier to clean.
   * @param {Object} [filter]
   *   An object of string replacements to use on the identifier.
   *
   * @return {string}
   *   The cleaned identifier.
   */
  Attributes.cleanClass = function (identifier, filter) {
    filter = filter || {
      ' ': '-',
      '_': '-',
      '/': '-',
      '[': '-',
      ']': ''
    };

    identifier = identifier.toLowerCase();

    if (filter['__'] === void 0) {
      identifier = identifier.replace('__', '#DOUBLE_UNDERSCORE#');
    }

    identifier = identifier.replace(Object.keys(filter), Object.keys(filter).map(function(key) { return filter[key]; }));

    if (filter['__'] === void 0) {
      identifier = identifier.replace('#DOUBLE_UNDERSCORE#', '__');
    }

    identifier = identifier.replace(/[^\u002D\u0030-\u0039\u0041-\u005A\u005F\u0061-\u007A\u00A1-\uFFFF]/g, '');
    identifier = identifier.replace(['/^[0-9]/', '/^(-[0-9])|^(--)/'], ['_', '__']);

    return identifier;
  };

  /**
   * Creates an Attributes instance.
   *
   * @param {object|Attributes} [attributes]
   *   An object to initialize attributes with.
   *
   * @return {Attributes}
   *   An Attributes instance.
   *
   * @constructor
   */
  Attributes.create = function (attributes) {
    return new Attributes(attributes);
  };

  window.Attributes = Attributes;

})(window.jQuery, window._);
;
/**
 * @file
 * Theme hooks for the Drupal Bootstrap base theme.
 */
(function ($, Drupal, Bootstrap, Attributes) {

  /**
   * Fallback for theming an icon if the Icon API module is not installed.
   */
  if (!Drupal.icon) Drupal.icon = { bundles: {} };
  if (!Drupal.theme.icon || Drupal.theme.prototype.icon) {
    $.extend(Drupal.theme, /** @lends Drupal.theme */ {
      /**
       * Renders an icon.
       *
       * @param {string} bundle
       *   The bundle which the icon belongs to.
       * @param {string} icon
       *   The name of the icon to render.
       * @param {object|Attributes} [attributes]
       *   An object of attributes to also apply to the icon.
       *
       * @returns {string}
       */
      icon: function (bundle, icon, attributes) {
        if (!Drupal.icon.bundles[bundle]) return '';
        attributes = Attributes.create(attributes).addClass('icon').set('aria-hidden', 'true');
        icon = Drupal.icon.bundles[bundle](icon, attributes);
        return '<span' + attributes + '></span>';
      }
    });
  }

  /**
   * Callback for modifying an icon in the "bootstrap" icon bundle.
   *
   * @param {string} icon
   *   The icon being rendered.
   * @param {Attributes} attributes
   *   Attributes object for the icon.
   */
  Drupal.icon.bundles.bootstrap = function (icon, attributes) {
    attributes.addClass(['glyphicon', 'glyphicon-' + icon]);
  };

  /**
   * Add necessary theming hooks.
   */
  $.extend(Drupal.theme, /** @lends Drupal.theme */ {

    /**
     * Renders a Bootstrap AJAX glyphicon throbber.
     *
     * @returns {string}
     */
    ajaxThrobber: function () {
      return Drupal.theme('bootstrapIcon', 'refresh', {'class': ['ajax-throbber', 'glyphicon-spin'] });
    },

    /**
     * Renders a button element.
     *
     * @param {object|Attributes} attributes
     *   An object of attributes to apply to the button. If it contains one of:
     *   - value: The label of the button.
     *   - context: The context type of Bootstrap button, can be one of:
     *     - default
     *     - primary
     *     - success
     *     - info
     *     - warning
     *     - danger
     *     - link
     *
     * @returns {string}
     */
    button: function (attributes) {
      attributes = Attributes.create(attributes).addClass('btn');
      var context = attributes.get('context', 'default');
      var label = attributes.get('value', '');
      attributes.remove('context').remove('value');
      if (!attributes.hasClass(['btn-default', 'btn-primary', 'btn-success', 'btn-info', 'btn-warning', 'btn-danger', 'btn-link'])) {
        attributes.addClass('btn-' + Bootstrap.checkPlain(context));
      }

      // Attempt to, intelligently, provide a default button "type".
      if (!attributes.exists('type')) {
        attributes.set('type', attributes.hasClass('form-submit') ? 'submit' : 'button');
      }

      return '<button' + attributes + '>' + label + '</button>';
    },

    /**
     * Alias for "button" theme hook.
     *
     * @param {object|Attributes} attributes
     *   An object of attributes to apply to the button.
     *
     * @see Drupal.theme.button()
     *
     * @returns {string}
     */
    btn: function (attributes) {
      return Drupal.theme('button', attributes);
    },

    /**
     * Renders a button block element.
     *
     * @param {object|Attributes} attributes
     *   An object of attributes to apply to the button.
     *
     * @see Drupal.theme.button()
     *
     * @returns {string}
     */
    'btn-block': function (attributes) {
      return Drupal.theme('button', Attributes.create(attributes).addClass('btn-block'));
    },

    /**
     * Renders a large button element.
     *
     * @param {object|Attributes} attributes
     *   An object of attributes to apply to the button.
     *
     * @see Drupal.theme.button()
     *
     * @returns {string}
     */
    'btn-lg': function (attributes) {
      return Drupal.theme('button', Attributes.create(attributes).addClass('btn-lg'));
    },

    /**
     * Renders a small button element.
     *
     * @param {object|Attributes} attributes
     *   An object of attributes to apply to the button.
     *
     * @see Drupal.theme.button()
     *
     * @returns {string}
     */
    'btn-sm': function (attributes) {
      return Drupal.theme('button', Attributes.create(attributes).addClass('btn-sm'));
    },

    /**
     * Renders an extra small button element.
     *
     * @param {object|Attributes} attributes
     *   An object of attributes to apply to the button.
     *
     * @see Drupal.theme.button()
     *
     * @returns {string}
     */
    'btn-xs': function (attributes) {
      return Drupal.theme('button', Attributes.create(attributes).addClass('btn-xs'));
    },

    /**
     * Renders a glyphicon.
     *
     * @param {string} name
     *   The name of the glyphicon.
     * @param {object|Attributes} [attributes]
     *   An object of attributes to apply to the icon.
     *
     * @returns {string}
     */
    bootstrapIcon: function (name, attributes) {
      return Drupal.theme('icon', 'bootstrap', name, attributes);
    }

  });

})(window.jQuery, window.Drupal, window.Drupal.bootstrap, window.Attributes);
;
/**
 * @file
 * Bootstrap Popovers.
 */

var Drupal = Drupal || {};

(function ($, Drupal, Bootstrap) {
  "use strict";

  var $document = $(document);

  /**
   * Extend the Bootstrap Popover plugin constructor class.
   */
  Bootstrap.extendPlugin('popover', function (settings) {
    return {
      DEFAULTS: {
        animation: !!settings.popover_animation,
        autoClose: !!settings.popover_auto_close,
        enabled: settings.popover_enabled,
        html: !!settings.popover_html,
        placement: settings.popover_placement,
        selector: settings.popover_selector,
        trigger: settings.popover_trigger,
        title: settings.popover_title,
        content: settings.popover_content,
        delay: parseInt(settings.popover_delay, 10),
        container: settings.popover_container
      }
    };
  });

  /**
   * Bootstrap Popovers.
   *
   * @todo This should really be properly delegated if selector option is set.
   */
  Drupal.behaviors.bootstrapPopovers = {
    $activePopover: null,
    attach: function (context) {
      // Immediately return if popovers are not available.
      if (!$.fn.popover || !$.fn.popover.Constructor.DEFAULTS.enabled) {
        return;
      }

      var _this = this;

      $document
        .on('show.bs.popover', '[data-toggle=popover]', function () {
          var $trigger = $(this);
          var popover = $trigger.data('bs.popover');

          // Only keep track of clicked triggers that we're manually handling.
          if (popover.options.originalTrigger === 'click') {
            if (_this.$activePopover && _this.getOption('autoClose') && !_this.$activePopover.is($trigger)) {
              _this.$activePopover.popover('hide');
            }
            _this.$activePopover = $trigger;
          }
        })
        // Unfortunately, :focusable is only made available when using jQuery
        // UI. While this would be the most semantic pseudo selector to use
        // here, jQuery UI may not always be loaded. Instead, just use :visible
        // here as this just needs some sort of selector here. This activates
        // delegate binding to elements in jQuery so it can work it's bubbling
        // focus magic since elements don't really propagate their focus events.
        // @see https://www.drupal.org/project/bootstrap/issues/3013236
        .on('focus.bs.popover', ':visible', function (e) {
          var $target = $(e.target);
          if (_this.$activePopover && _this.getOption('autoClose') && !_this.$activePopover.is($target) && !$target.closest('.popover.in')[0]) {
            _this.$activePopover.popover('hide');
            _this.$activePopover = null;
          }
        })
        .on('click.bs.popover', function (e) {
          var $target = $(e.target);
          if (_this.$activePopover && _this.getOption('autoClose') && !$target.is('[data-toggle=popover]') && !$target.closest('.popover.in')[0]) {
            _this.$activePopover.popover('hide');
            _this.$activePopover = null;
          }
        })
        .on('keyup.bs.popover', function (e) {
          if (_this.$activePopover && _this.getOption('autoClose') && e.which === 27) {
            _this.$activePopover.popover('hide');
            _this.$activePopover = null;
          }
        })
      ;

      var elements = $(context).find('[data-toggle=popover]').toArray();
      for (var i = 0; i < elements.length; i++) {
        var $element = $(elements[i]);
        var options = $.extend({}, $.fn.popover.Constructor.DEFAULTS, $element.data());

        // Store the original trigger.
        options.originalTrigger = options.trigger;

        // If the trigger is "click", then we'll handle it manually here.
        if (options.trigger === 'click') {
          options.trigger = 'manual';
        }

        // Retrieve content from a target element.
        var target = options.target || $element.is('a[href^="#"]') && $element.attr('href');
        var $target = $document.find(target).clone();
        if (!options.content && $target[0]) {
          $target.removeClass('visually-hidden hidden').removeAttr('aria-hidden');
          options.content = $target.wrap('<div/>').parent()[options.html ? 'html' : 'text']() || '';
        }

        // Initialize the popover.
        $element.popover(options);

        // Handle clicks manually.
        if (options.originalTrigger === 'click') {
          // To ensure the element is bound multiple times, remove any
          // previously set event handler before adding another one.
          $element
            .off('click.drupal.bootstrap.popover')
            .on('click.drupal.bootstrap.popover', function (e) {
              $(this).popover('toggle');
              e.preventDefault();
              e.stopPropagation();
            })
          ;
        }
      }
    },
    detach: function (context) {
      // Immediately return if popovers are not available.
      if (!$.fn.popover || !$.fn.popover.Constructor.DEFAULTS.enabled) {
        return;
      }

      // Destroy all popovers.
      $(context).find('[data-toggle="popover"]')
        .off('click.drupal.bootstrap.popover')
        .popover('destroy')
      ;
    },
    getOption: function(name, defaultValue, element) {
      var $element = element ? $(element) : this.$activePopover;
      var options = $.extend(true, {}, $.fn.popover.Constructor.DEFAULTS, ($element && $element.data('bs.popover') || {}).options);
      if (options[name] !== void 0) {
        return options[name];
      }
      return defaultValue !== void 0 ? defaultValue : void 0;
    }
  };

})(window.jQuery, window.Drupal, window.Drupal.bootstrap);
;
/**
 * @file
 * Bootstrap Tooltips.
 */

var Drupal = Drupal || {};

(function ($, Drupal, Bootstrap) {
  "use strict";

  /**
   * Extend the Bootstrap Tooltip plugin constructor class.
   */
  Bootstrap.extendPlugin('tooltip', function (settings) {
    return {
      DEFAULTS: {
        animation: !!settings.tooltip_animation,
        enabled: settings.tooltip_enabled,
        html: !!settings.tooltip_html,
        placement: settings.tooltip_placement,
        selector: settings.tooltip_selector,
        trigger: settings.tooltip_trigger,
        delay: parseInt(settings.tooltip_delay, 10),
        container: settings.tooltip_container
      }
    };
  });

  /**
   * Bootstrap Tooltips.
   *
   * @todo This should really be properly delegated if selector option is set.
   */
  Drupal.behaviors.bootstrapTooltips = {
    attach: function (context) {
      // Immediately return if tooltips are not available.
      if (!$.fn.tooltip || !$.fn.tooltip.Constructor.DEFAULTS.enabled) {
        return;
      }

      var elements = $(context).find('[data-toggle="tooltip"]').toArray();
      for (var i = 0; i < elements.length; i++) {
        var $element = $(elements[i]);
        var options = $.extend({}, $.fn.tooltip.Constructor.DEFAULTS, $element.data());
        $element.tooltip(options);
      }
    },
    detach: function (context) {
      // Immediately return if tooltips are not available.
      if (!$.fn.tooltip || !$.fn.tooltip.Constructor.DEFAULTS.enabled) {
        return;
      }

      // Destroy all tooltips.
      $(context).find('[data-toggle="tooltip"]').tooltip('destroy');
    }
  };

})(window.jQuery, window.Drupal, window.Drupal.bootstrap);
;
"use strict";[Element.prototype,CharacterData.prototype,DocumentType.prototype].forEach((function(a){a.hasOwnProperty("remove")||Object.defineProperty(a,"remove",{configurable:!0,enumerable:!0,writable:!0,value:function(){this.parentNode.removeChild(this)}})}));const $=window.jQuery,WAITING_TIME_TO_APPLY_CHANGES=200,bootstrapVersion=function(){if(window.dxprBuilder.bootstrapVersionNumber)return window.dxprBuilder.bootstrapVersionNumber;window.dxprBuilder.bootstrapVersionNumber="3";const a=document.createElement("div");a.classList.add("col","col-xs-6");const e=window.getComputedStyle(document.body.appendChild(a)).getPropertyValue("flex-basis");return a.remove(),"0px"===e?(window.dxprBuilder.bootstrapVersionNumber="4",window.dxprBuilder.bootstrapVersionNumber):"0%"===e?(window.dxprBuilder.bootstrapVersionNumber="5",window.dxprBuilder.bootstrapVersionNumber):window.dxprBuilder.bootstrapVersionNumber},carouselInit=function(a,e){return"3"===bootstrapVersion()?$(a).carousel(e):new bootstrap.Carousel(a,e)},getBootstrapBreakPoints=function(){const a={xs:Drupal.t(`Extra small (<${"3"===bootstrapVersion()?"768":"576"}px)`),sm:Drupal.t(`Small devices (≥${"3"===bootstrapVersion()?"768":"576"}px)`),md:Drupal.t(`Medium devices (≥${"3"===bootstrapVersion()?"992":"768"}px)`),lg:Drupal.t(`Large devices (≥${"3"===bootstrapVersion()?"1200":"992"}px)}`)};return"3"===bootstrapVersion()?a:"4"===bootstrapVersion()?{...a,xl:Drupal.t("Extra large (≥1200px)")}:{...a,xl:Drupal.t("Extra large (≥1200px)"),xxl:Drupal.t("Extra extra large (≥1400px)")}},get_sticky_height=function(){let a=0;for(const e of drupalSettings.dxprBuilder.offsetSelector.split(",")){const t=document.querySelector(e);if(t){a=t.offsetHeight;break}}const e=document.getElementById("toolbar-bar");e&&(a+=e.offsetHeight);const t=document.querySelector(".is-active.toolbar-tray-horizontal");return t&&(a+=t.offsetHeight),a},collapsibleInit=function(a,e,t){a&&("5"===bootstrapVersion()?new bootstrap.Collapse(a,{toggle:!!t,parent:`#${e}`}):$(a).collapse({toggle:!!t,parent:`#${e}`}))};!function(a){if("dxprBuilder"in window){if("dxpr_backend"in window.dxprBuilder)return}else window.dxprBuilder={};function e(a,e){var t=function(){};t.prototype=e.prototype,a.prototype=new t,a.prototype.constructor=a,a.baseclass=e}function t(a,e){var t={};for(var n in e)void 0!==t[n]&&t[n]==e[n]||(a[n]=e[n]);if(document.all&&!document.isOpera){var r=e.toString;"function"==typeof r&&r!=a.toString&&r!=t.toString&&"\nfunction toString() {\n  [native code]\n}\n"!=r&&(a.toString=e.toString)}return a}function n(a){return _.isString(a)?a.replace(/(\`{2})/g,'"'):a}function r(){this.dom_element=null,this.heading="",this.description="",this.param_name="",this.required=!1,this.admin_label="",this.holder="",this.wrapper_class="",this.value=null,this.can_be_empty=!1,this.hidden=!1,this.tab="",this.dependency={},this.passthrough=!1,"create"in this&&this.create()}function o(a){var e;return a.type in r.prototype.param_types?(t(e=new r.prototype.param_types[a.type],a),e):(t(e=new r,a),e)}function s(){}function m(a,e){this.id="gb"+Math.random().toString(36).substr(2,8),null!=a&&(this.parent=a,"boolean"==typeof e?e?a.children.push(this):a.children.unshift(this):a.children.splice(e,0,this)),this.children=[],this.dom_element=null,this.dom_content_element=null,this.attrs=this.initialize_parameters(this,this.params),this.controls=null,window.dxprBuilder.dxprElements.add_element(this.id,this,e)}function l(a,t,n){if(e(n,m),n.prototype.base=a,n.prototype.is_container=t,m.prototype.elements[a]=n,m.prototype.tags[a]=n,t)for(var r=1;r<m.prototype.max_nested_depth;r++)m.prototype.tags[a+"_"+r]=n}function i(a,e){i.baseclass.apply(this,arguments)}function p(a,e){p.baseclass.apply(this,arguments)}function d(a,t,n){if(e(n,p),n.prototype.base=a,n.prototype.is_container=t,p.prototype.elements[a]=n,p.prototype.tags[a]=n,t)for(var r=1;r<p.prototype.max_nested_depth;r++)p.prototype.tags[a+"_"+r]=n}function u(a,e){u.baseclass.apply(this,arguments)}function v(a,e){v.baseclass.apply(this,arguments),this.columns="",e&&"boolean"==typeof e||this.set_columns("1/2 + 1/2"),this.attrs.device="sm","3"!==bootstrapVersion()&&(this.attrs.device="md")}function h(a,e){h.baseclass.call(this,a,e)}function c(a,e){c.baseclass.apply(this,arguments),this.rendered=!1,this.loaded_container=null,this.js={},this.css={}}function f(a,e){f.baseclass.apply(this,arguments)}function w(a,e){w.baseclass.apply(this,arguments)}"dxpr_backend"in window.dxprBuilder||(window.dxprBuilder.dxpr_frontend=!0,window.dxprBuilder.dxpr_elements=[],window.dxprBuilder.dxpr_extend=[],window.dxprBuilder.pids={},a.fn.closest_descendents=function(e){for(var t=a(),n=this;n.length;)t=a.merge(t,n.filter(e)),n=(n=n.not(e)).children();return t},r.prototype.safe=!0,r.prototype.param_types={},window.dxprBuilder.dxpr_add_css=function(e,t){var n=drupalSettings.dxprBuilder.dxprBaseUrl+e;if(a('link[href*="'+n+'"]').length||"dxpr_exported"in window.dxprBuilder)t();else{var r=document.getElementsByTagName("head")[0],o=document.createElement("link");o.rel="stylesheet",o.type="text/css",o.href=n,o.onload=t,r.appendChild(o)}},window.dxprBuilder.dxpr_add_js=function(a){"loaded"in a&&a.loaded||"dxpr_exported"in window.dxprBuilder?a.callback():window.dxprBuilder.dxpr_add_external_js(drupalSettings.dxprBuilder.dxprBaseUrl+a.path,"callback"in a?a.callback:()=>{})},window.dxprBuilder.dxpr_add_js_list=function(a){if("loaded"in a&&a.loaded)a.callback();else for(var e=0,t=0;t<a.paths.length;t++)dxprBuilder.dxpr_add_js({path:a.paths[t],callback:function(){++e==a.paths.length&&a.callback()}})},window.dxprBuilder.dxpr_js_waiting_callbacks={},window.dxprBuilder.dxpr_loaded_js={},window.dxprBuilder.dxpr_add_external_js=function(a,e){if(a in window.dxprBuilder.dxpr_js_waiting_callbacks)return void window.dxprBuilder.dxpr_js_waiting_callbacks[a].push(e);if(a in window.dxprBuilder.dxpr_loaded_js)return void e();window.dxprBuilder.dxpr_js_waiting_callbacks[a]=[e];const t=document.getElementsByTagName("head")[0],n=document.createElement("script");n.type="text/javascript",n.src=a,n.onload=function(){for(window.dxprBuilder.dxpr_loaded_js[a]=!0;a in window.dxprBuilder.dxpr_js_waiting_callbacks;){const e=window.dxprBuilder.dxpr_js_waiting_callbacks[a];window.dxprBuilder.dxpr_js_waiting_callbacks[a]=void 0,delete window.dxprBuilder.dxpr_js_waiting_callbacks[a];for(let a=0;a<e.length;a++)e[a]()}},t.appendChild(n)},window.dxprBuilder.dxpr_add_css("vendor/unmanaged/glyphicons-halflings/css/halflings-set.css",(()=>{})),window.dxprBuilder.dxpr_add_css("vendor/unmanaged/font-awesome/css/font-awesome.min.css",(function(){})),"4"===bootstrapVersion()&&window.dxprBuilder.dxpr_add_css("vendor/managed/bootstrap-4-vertical-tabs/dist/b4vtabs.css",(()=>{})),s.prototype.elements_instances={},s.prototype.elements_instances_by_an_name={},s.prototype.get_element=function(a){return this.elements_instances[a]},s.prototype.delete_element=function(e){a(document).trigger("dxpr_delete_element",e),delete this.elements_instances[e]},s.prototype.add_element=function(e,t,n){this.elements_instances[e]=t,a(document).trigger("dxpr_add_element",{id:e,position:n})},m.prototype.elements={},m.prototype.tags={},m.prototype.params=[{param_name:"box_model",value:"",safe:!0},{param_name:"hash",value:"",safe:!0},{param_name:"el_class",value:"",safe:!0},{param_name:"style",value:"",safe:!0},{param_name:"shadow",value:"0",safe:!0},{param_name:"hover_style",value:"",safe:!0},{param_name:"hover_shadow",value:"0",safe:!0},{param_name:"pos_left",value:"",safe:!0},{param_name:"pos_right",value:"",safe:!0},{param_name:"pos_top",value:"",safe:!0},{param_name:"pos_bottom",value:"",safe:!0},{param_name:"pos_width",value:"",safe:!0},{param_name:"pos_height",value:"",safe:!0},{param_name:"pos_zindex",value:"",safe:!0}],m.prototype.get_hover_style=function(){return"hover_style"in this.attrs?"<style>\x3c!-- .hover-style-"+this.id+":hover "+this.style_selector+" { "+this.attrs.hover_style+"} --\x3e</style>":""},m.prototype.showed=function(a){"pos_left"in this.attrs&&""!=this.attrs.pos_left&&a(this.dom_element).css("left",this.attrs.pos_left),"pos_right"in this.attrs&&""!=this.attrs.pos_right&&a(this.dom_element).css("right",this.attrs.pos_right),"pos_top"in this.attrs&&""!=this.attrs.pos_top&&a(this.dom_element).css("top",this.attrs.pos_top),"pos_bottom"in this.attrs&&""!=this.attrs.pos_bottom&&a(this.dom_element).css("bottom",this.attrs.pos_bottom),"pos_width"in this.attrs&&""!=this.attrs.pos_width&&a(this.dom_element).css("width",this.attrs.pos_width),"pos_height"in this.attrs&&""!=this.attrs.pos_height&&a(this.dom_element).css("height",this.attrs.pos_height),"pos_zindex"in this.attrs&&""!=this.attrs.pos_zindex&&a(this.dom_element).css("z-index",this.attrs.pos_zindex),"hover_style"in this.attrs&&""!=this.attrs.hover_style&&(a("head").find("#hover-style-"+this.id).remove(),a("head").append(this.get_hover_style()),a(this.dom_element).addClass("hover-style-"+this.id))},m.prototype.update_dom=function(){this.detach_children(),a(this.dom_element).remove(),this.parent.detach_children(),this.render(a),this.attach_children(),drupalSettings.dxprBuilder.dxprEditor&&this.show_controls(),this.parent.attach_children(),drupalSettings.dxprBuilder.dxprEditor&&(this.update_sortable(),this.update_empty()),this.parent.recursive_showed(a)},m.prototype.attach_children=function(){for(var e=0;e<this.children.length;e++)a(this.dom_content_element).append(this.children[e].dom_element)},m.prototype.detach_children=function(){for(var e=0;e<this.children.length;e++)a(this.children[e].dom_element).detach()},m.prototype.recursive_showed=function(){this.showed(a);for(var e=0;e<this.children.length;e++)this.children[e].recursive_showed()},m.prototype.parse_attrs=function(e){for(var t=0;t<this.params.length;t++){var r=this.params[t];if(r.param_name in e)if(r.safe)this.attrs[r.param_name]=n(e[r.param_name]);else{var o=n(e[r.param_name]);try{this.attrs[r.param_name]=decodeURIComponent(atob(o.replace(/^#E\-8_/,"")))}catch(a){this.attrs[r.param_name]=decodeURIComponent(o.replace(/^#E\-8_/,""))}}else"value"in r&&_.isString(r.value)&&(this.attrs[r.param_name]=r.value)}for(var s in e)s in this.attrs||(this.attrs[s]=e[s]);a(document).trigger("dxpr_edited_element",this.id)},m.prototype.parse_empty_html=function(e,t){var n=new(0,m.prototype.elements.az_text)(t,!1);n.attrs.content=a(e).html(),window.dxprBuilder.dxpr_editor&&(n.update_dom(),"update_empty"in t&&t.update_empty())},m.prototype.parse_content_html=function(e){var t=a(this).attr("data-azb"),n=i;t in m.prototype.tags&&(n=m.prototype.tags[t]);var r=new n(e,!0);window.dxprBuilder.dxpr_frontend&&(window.dxprBuilder.dxprElements.elements_instances[r.id]=null,delete window.dxprBuilder.dxprElements.elements_instances[r.id],r.id=a(this).attr("data-az-id"),window.dxprBuilder.dxprElements.elements_instances[r.id]=r),r.dom_element=a(this);var o={};if(a(a(this)[0].attributes).each((function(){this.nodeName.indexOf("data-azat")>=0&&(o[this.nodeName.replace("data-azat-","")]=this.value)})),r.parse_attrs(o),r.is_container){var s=a(this).closest_descendents("[data-azcnt]");if(s.length>0)if(r.dom_content_element=a(s),r.has_content)if(r instanceof i)r.attrs.content=a(s).wrap("<div></div>").parent().html(),a(s).unwrap();else{const e=r.dom_element[0].getAttribute("data-az-persist");"az_html"==r.base&&drupalSettings.dxprBuilder.dxprEditor&&e&&e.length>0?r.attrs.content=window.dxprBuilder.atobUTF16(e):r.attrs.content=a(s).html()}else r.parse_html(s)}},m.prototype.parse_html=function(e){var t=this;0==a(e).children().closest_descendents("[data-azb]").length&&a.trim(a(e).html()).length>0?m.prototype.parse_empty_html.call(this,e,t):a(e).children().closest_descendents("[data-azb]").each((function(){m.prototype.parse_content_html.call(this,t)}))},m.prototype.add_css=function(a,e,t){this.get_my_container().css[drupalSettings.dxprBuilder.dxprBaseUrl+a]=!0,e||window.dxprBuilder.dxpr_add_css(a,t)},m.prototype.add_js_list=function(a){for(var e=this.get_my_container(),t=0;t<a.paths.length;t++)e.js[drupalSettings.dxprBuilder.dxprBaseUrl+a.paths[t]]=!0;window.dxprBuilder.dxpr_add_js_list(a)},m.prototype.add_js=function(a){this.get_my_container().js[drupalSettings.dxprBuilder.dxprBaseUrl+a.path]=!0,window.dxprBuilder.dxpr_add_js(a)},m.prototype.add_external_js=function(a,e){this.get_my_container().js[a]=!0,window.dxprBuilder.dxpr_add_external_js(a,e)},m.prototype.get_my_container=function(){return this instanceof c?this:this.parent.get_my_container()},m.prototype.trigger_start_in_animation=function(){for(var a=0;a<this.children.length;a++)"trigger_start_in_animation"in this.children[a]&&this.children[a].trigger_start_in_animation()},m.prototype.trigger_start_out_animation=function(){for(var a=0;a<this.children.length;a++)"trigger_start_out_animation"in this.children[a]&&this.children[a].trigger_start_out_animation()},m.prototype.get_dom_element=function(){return this.dom_element[0]},m.prototype.get_element_id=function(){return this.attrs.hash?this.attrs.hash:this.attrs.pid?this.attrs.pid:this.id},m.prototype.initialize_parameters=function(a,e){const t={},n=e.length;for(let a=0;a<n;a++)_.isString(e[a].value)?t[e[a].param_name]=e[a].value:t[e[a].param_name]=e[a].getDefault?e[a].getDefault(e[a]):"";return t},l("az_unknown",!0,i),i.prototype.has_content=!0,window.dxprBuilder.dxpr_online="http:"==window.location.protocol||"https:"==window.location.protocol,window.dxprBuilder.bootstrapVersionNumber=void 0,window.dxprBuilder.containerCounts="dxprBuilder.saveContainerCounter",window.dxprBuilder.containerMaxCounts=5,window.dxprBuilder.dxprElements=new s,window.dxprBuilder.dxpr_editor=!1,window.dxprBuilder.dxpr_containers=[],window.dxprBuilder.dxpr_containers_loaded={},e(p,m),p.prototype.params=[{param_name:"an_start",value:"",safe:!0},{param_name:"an_in",value:"",safe:!0},{param_name:"an_out",value:"",safe:!0},{param_name:"an_hidden",value:"",safe:!0},{param_name:"an_infinite",value:"",safe:!0},{param_name:"an_offset",value:"100",safe:!0},{param_name:"an_duration",value:"1000",safe:!0},{param_name:"an_in_delay",value:"0",safe:!0},{param_name:"an_out_delay",value:"0",safe:!0},{param_name:"an_parent",value:"1",safe:!0},{param_name:"an_name",value:"",safe:!0},{param_name:"box_model",value:"",safe:!0},{param_name:"hash",value:"",safe:!0},{param_name:"el_class",value:"",safe:!0},{param_name:"style",value:"",safe:!0},{param_name:"shadow",value:"0",safe:!0},{param_name:"hover_style",value:"",safe:!0},{param_name:"hover_shadow",value:"0",safe:!0},{param_name:"pos_left",value:"",safe:!0},{param_name:"pos_right",value:"",safe:!0},{param_name:"pos_top",value:"",safe:!0},{param_name:"pos_bottom",value:"",safe:!0},{param_name:"pos_width",value:"",safe:!0},{param_name:"pos_height",value:"",safe:!0},{param_name:"pos_zindex",value:"",safe:!0}],p.prototype.set_in_timeout=function(){var e=this;e.in_timeout=setTimeout((function(){e.clear_animation(),a(e.dom_element).css("opacity",""),a(e.dom_element).removeClass("animated"),a(e.dom_element).removeClass(e.attrs.an_in),a(e.dom_element).removeClass(e.attrs.an_out),e.animation_in=!1,e.animation_out=!1,a(e.dom_element).css("animation-duration",e.attrs.an_duration+"ms"),a(e.dom_element).css("-webkit-animation-duration",e.attrs.an_duration+"ms"),a(e.dom_element).addClass("animated"),e.animated=!0,"yes"==e.attrs.an_infinite&&a(e.dom_element).addClass("infinite"),a(e.dom_element).addClass(e.attrs.an_in),e.animation_in=!0}),Math.round(e.attrs.an_in_delay))},p.prototype.start_in_animation=function(){var e=this;0==a(e.dom_element).parents(".dxpr-animations-disabled").length&&""!=e.attrs.an_in&&(e.animated?e.animation_out?e.set_in_timeout():e.out_timeout>0&&(clearTimeout(e.out_timeout),e.hidden_after_in||e.set_in_timeout()):e.set_in_timeout())},p.prototype.set_out_timeout=function(){var e=this;e.out_timeout=setTimeout((function(){e.clear_animation(),a(e.dom_element).css("opacity",""),a(e.dom_element).removeClass("animated"),a(e.dom_element).removeClass(e.attrs.an_in),a(e.dom_element).removeClass(e.attrs.an_out),e.animation_in=!1,e.animation_out=!1,a(e.dom_element).css("animation-duration",e.attrs.an_duration+"ms"),a(e.dom_element).css("-webkit-animation-duration",e.attrs.an_duration+"ms"),a(e.dom_element).addClass("animated"),e.animated=!0,"yes"==e.attrs.an_infinite&&a(e.dom_element).addClass("infinite"),a(e.dom_element).addClass(e.attrs.an_out),e.animation_out=!0}),Math.round(e.attrs.an_out_delay))},p.prototype.start_out_animation=function(){var e=this;0==a(e.dom_element).parents(".dxpr-animations-disabled").length&&""!=e.attrs.an_out&&(e.animated?e.animation_in?e.set_out_timeout():e.in_timeout>0&&(clearTimeout(e.in_timeout),e.hidden_before_in||e.set_out_timeout()):e.set_out_timeout())},p.prototype.clear_animation=function(){this.animation_in&&(this.hidden_before_in&&a(this.dom_element).css("opacity","1"),this.hidden_after_in&&a(this.dom_element).css("opacity","0")),this.animation_out&&(this.hidden_before_in&&a(this.dom_element).css("opacity","0"),this.hidden_after_in&&a(this.dom_element).css("opacity","1")),a(this.dom_element).hasClass("animated")&&(a(this.dom_element).css("animation-duration",""),a(this.dom_element).css("-webkit-animation-duration",""),a(this.dom_element).removeClass("animated"),this.animated=!1,a(this.dom_element).removeClass("infinite"),a(this.dom_element).removeClass(this.attrs.an_in),a(this.dom_element).removeClass(this.attrs.an_out),this.animation_in=!1,this.animation_out=!1)},p.prototype.end_animation=function(){this.in_timeout=0,this.out_timeout=0,this.animation_in&&(this.clear_animation(),"hover"!=this.attrs.an_start||this.hover||this.attrs.an_in!=this.attrs.an_out&&this.start_out_animation()),this.animation_out&&(this.clear_animation(),"hover"==this.attrs.an_start&&this.hover&&this.attrs.an_in!=this.attrs.an_out&&this.start_in_animation())},p.prototype.trigger_start_in_animation=function(){"trigger"==this.attrs.an_start?this.start_in_animation():p.baseclass.prototype.trigger_start_in_animation.apply(this,arguments)},p.prototype.trigger_start_out_animation=function(){"trigger"==this.attrs.an_start?this.start_out_animation():p.baseclass.prototype.trigger_start_out_animation.apply(this,arguments)},p.prototype.animation=function(){var e=this;e.hidden_before_in=_.indexOf(e.attrs.an_hidden.split(","),"before_in")>=0,e.hidden_after_in=_.indexOf(e.attrs.an_hidden.split(","),"after_in")>=0,e.hidden_before_in&&a(e.dom_element).css("opacity","0"),e.hidden_after_in&&a(e.dom_element).css("opacity","1");var t=e.attrs.an_parent;""==t&&(t=1),t=Math.round(t);for(var n=0,r=a(e.dom_element);n<t;)r=a(r).parent().closest("[data-az-id]"),n++;if(""!=e.attrs.an_start){e.in_timeout=0,e.out_timeout=0,e.animated=!1,e.animation_in=!1,e.animation_out=!1;e.add_css("vendor/managed/animate.css/animate.min.css",!1,(function(){!function(){switch(a(r).off("click.az_animation"+e.id),a(r).off("mouseenter.az_animation"+e.id),a(r).off("mouseleave.az_animation"+e.id),e.attrs.an_start){case"click":a(r).on("click.az_animation"+e.id,(function(){e.animated||e.start_in_animation()}));break;case"appear":e.add_js({path:"vendor/managed/jquery.waypoints/lib/jquery.waypoints.min.js",loaded:"waypoint"in a.fn,callback:function(){a(e.dom_element).waypoint((function(a){e.animated||e.start_in_animation()}),{offset:e.attrs.an_offset+"%",handler:function(a){this.destroy()}}),a(document).trigger("scroll")}});break;case"hover":a(r).on("mouseenter.az_animation"+e.id,(function(){e.hover=!0,e.start_in_animation()})),a(r).on("mouseleave.az_animation"+e.id,(function(){e.hover=!1,e.start_out_animation()}))}}()}))}},p.prototype.showed=function(a){p.baseclass.prototype.showed.apply(this,arguments),this.an_name="","an_name"in this.attrs&&""!=this.attrs.an_name&&(this.an_name=this.attrs.an_name,window.dxprBuilder.dxprElements.elements_instances_by_an_name[this.an_name]=this),"an_start"in this.attrs&&""!=this.attrs.an_start&&"no"!=this.attrs.an_start&&this.animation()},d("az_section",!0,u),u.prototype.params=[{param_name:"fluid",value:"",safe:!0},{param_name:"fullheight",value:"",safe:!0},{param_name:"vertical_centering",value:"",safe:!0},{param_name:"effect",value:"",safe:!0},{param_name:"parallax_speed",value:"",safe:!0},{param_name:"parallax_mode",value:"",safe:!0},{param_name:"parallax_mobile_disable",value:"",safe:!0},{param_name:"gradient_start_color",value:"",safe:!0},{param_name:"gradient_end_color",value:"",safe:!0},{param_name:"gradient_direction",value:"180",safe:!0},{param_name:"gradient_start",value:"0",safe:!0},{param_name:"gradient_end",value:"100",safe:!0},{param_name:"video_options",value:"",safe:!0},{param_name:"video_youtube",value:"",safe:!0},{param_name:"video_start",value:"0",safe:!0},{param_name:"video_stop",value:"0",safe:!0},{param_name:"an_start",value:"",safe:!0},{param_name:"an_in",value:"",safe:!0},{param_name:"an_out",value:"",safe:!0},{param_name:"an_hidden",value:"",safe:!0},{param_name:"an_infinite",value:"",safe:!0},{param_name:"an_offset",value:"100",safe:!0},{param_name:"an_duration",value:"1000",safe:!0},{param_name:"an_in_delay",value:"0",safe:!0},{param_name:"an_out_delay",value:"0",safe:!0},{param_name:"an_parent",value:"1",safe:!0},{param_name:"an_name",value:"",safe:!0},{param_name:"box_model",value:"",safe:!0},{param_name:"hash",value:"",safe:!0},{param_name:"el_class",value:"",safe:!0},{param_name:"style",value:"",safe:!0},{param_name:"shadow",value:"0",safe:!0},{param_name:"hover_style",value:"",safe:!0},{param_name:"hover_shadow",value:"0",safe:!0},{param_name:"pos_left",value:"",safe:!0},{param_name:"pos_right",value:"",safe:!0},{param_name:"pos_top",value:"",safe:!0},{param_name:"pos_bottom",value:"",safe:!0},{param_name:"pos_width",value:"",safe:!0},{param_name:"pos_height",value:"",safe:!0},{param_name:"pos_zindex",value:"",safe:!0}],u.prototype.showed=function(a){u.baseclass.prototype.showed.apply(this,arguments);const e=this;switch(this.attrs.effect){case"parallax":if(window.innerWidth<481&&this.attrs.parallax_mobile_disable){a(e.dom_element).css("background-attachment","scroll"),a(e.dom_element).css("background-position","");break}this.add_js_list({paths:["vendor/unmanaged/jquery.parallax/jquery.parallax.js","vendor/managed/jquery.waypoints/lib/jquery.waypoints.min.js"],loaded:"waypoint"in a.fn&&"parallax"in a.fn,callback:function(){a(e.dom_element).waypoint((function(t){var n=a(e.dom_element).css("background-position").match(/([\w%]*) [\w%]/);if(null==n)var r="50%";else r=n[1];a(e.dom_element).css("background-attachment",e.attrs.parallax_mode),a(e.dom_element).css("background-position",r+" 0"),a(e.dom_element).parallax(r,e.attrs.parallax_speed/100)}),{offset:"100%",handler:function(a){this.destroy()}}),a(document).trigger("scroll")}});break;case"fixed":a(e.dom_element).css("background-attachment","fixed");break;case"youtube":if(!e.attrs.video_youtube)return;var t=_.indexOf(e.attrs.video_options.split(","),"loop")>=0,n=-1==_.indexOf(e.attrs.video_options.split(","),"audio"),r=-1==_.indexOf(e.attrs.video_options.split(","),"noCrop"),o=_.indexOf(e.attrs.video_options.split(","),"resizeSection")>=0,s=-1==_.indexOf(e.attrs.video_options.split(","),"disMobile"),m=_.indexOf(e.attrs.video_options.split(","),"showControls")>=0;this.add_css("vendor/unmanaged/dxpr.jquery.mb.YTPlayer/dist/css/jquery.mb.ytplayer.min.css","mb_YTPlayer"in a.fn,(function(){})),this.add_js_list({paths:["vendor/unmanaged/dxpr.jquery.mb.YTPlayer/dist/jquery.mb.YTPlayer.min.js","vendor/managed/jquery.waypoints/lib/jquery.waypoints.min.js"],loaded:"waypoint"in a.fn&&"mb_YTPlayer"in a.fn,callback:function(){a(e.dom_element).waypoint((function(l){var i,_;a(e.dom_element).attr("data-property",`{\n                  videoURL: "${i=e.attrs.video_youtube,_=i.match(/^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#\&\?]*).*/),!(!_||11!=_[7].length)&&_[7]}",\n                  containment: "[data-az-id=${e.id}]",\n                  showControls: ${m.toString()},\n                  autoPlay: true,\n                  stopMovieOnBlur: false,\n                  loop: ${t.toString()},\n                  mute: ${n.toString()},\n                  optimizeDisplay: ${r.toString()},\n                  startAt: ${e.attrs.video_start},\n                  stopAt: ${e.attrs.video_stop},\n                  useOnMobile: ${s.toString()},\n                  showYTLogo: false,\n                  isStandAlonePlayer: false,\n                }`),a(e.dom_element).YTPPlayerDestroy(),a(e.dom_element).mb_YTPlayer();const p=e.get_dom_element().offsetWidth;o&&e.dom_element.css({height:""+9/16*p})}),{offset:"300%",handler:function(a){this.destroy()}}),a(document).trigger("scroll")}})}},d("az_row",!0,v),v.prototype.params=[{param_name:"device",value:"",safe:!0},{param_name:"equal",value:"",safe:!0},{param_name:"reverse_horizontal",value:"",safe:!0},{param_name:"an_start",value:"",safe:!0},{param_name:"an_in",value:"",safe:!0},{param_name:"an_out",value:"",safe:!0},{param_name:"an_hidden",value:"",safe:!0},{param_name:"an_infinite",value:"",safe:!0},{param_name:"an_offset",value:"100",safe:!0},{param_name:"an_duration",value:"1000",safe:!0},{param_name:"an_in_delay",value:"0",safe:!0},{param_name:"an_out_delay",value:"0",safe:!0},{param_name:"an_parent",value:"1",safe:!0},{param_name:"an_name",value:"",safe:!0},{param_name:"box_model",value:"",safe:!0},{param_name:"hash",value:"",safe:!0},{param_name:"el_class",value:"",safe:!0},{param_name:"style",value:"",safe:!0},{param_name:"shadow",value:"0",safe:!0},{param_name:"hover_style",value:"",safe:!0},{param_name:"hover_shadow",value:"0",safe:!0},{param_name:"pos_left",value:"",safe:!0},{param_name:"pos_right",value:"",safe:!0},{param_name:"pos_top",value:"",safe:!0},{param_name:"pos_bottom",value:"",safe:!0},{param_name:"pos_width",value:"",safe:!0},{param_name:"pos_height",value:"",safe:!0},{param_name:"pos_zindex",value:"",safe:!0}],v.prototype.showed=function(a){v.baseclass.prototype.showed.apply(this,arguments)},v.prototype.set_columns=function(a){},l("az_column",!0,h),h.prototype.params=[{param_name:"width",value:"",safe:!0},{param_name:"vertical_centering",value:"",safe:!0},{param_name:"box_model",value:"",safe:!0},{param_name:"hash",value:"",safe:!0},{param_name:"el_class",value:"",safe:!0},{param_name:"style",value:"",safe:!0},{param_name:"shadow",value:"0",safe:!0},{param_name:"hover_style",value:"",safe:!0},{param_name:"hover_shadow",value:"0",safe:!0},{param_name:"pos_left",value:"",safe:!0},{param_name:"pos_right",value:"",safe:!0},{param_name:"pos_top",value:"",safe:!0},{param_name:"pos_bottom",value:"",safe:!0},{param_name:"pos_width",value:"",safe:!0},{param_name:"pos_height",value:"",safe:!0},{param_name:"pos_zindex",value:"",safe:!0}],d("az_container",!0,c),c.prototype.params=[{param_name:"an_start",value:"",safe:!0},{param_name:"an_in",value:"",safe:!0},{param_name:"an_out",value:"",safe:!0},{param_name:"an_hidden",value:"",safe:!0},{param_name:"an_infinite",value:"",safe:!0},{param_name:"an_offset",value:"100",safe:!0},{param_name:"an_duration",value:"1000",safe:!0},{param_name:"an_in_delay",value:"0",safe:!0},{param_name:"an_out_delay",value:"0",safe:!0},{param_name:"an_parent",value:"1",safe:!0},{param_name:"an_name",value:"",safe:!0},{param_name:"box_model",value:"",safe:!0},{param_name:"hash",value:"",safe:!0},{param_name:"el_class",value:"",safe:!0},{param_name:"style",value:"",safe:!0},{param_name:"shadow",value:"0",safe:!0},{param_name:"hover_style",value:"",safe:!0},{param_name:"hover_shadow",value:"0",safe:!0},{param_name:"pos_left",value:"",safe:!0},{param_name:"pos_right",value:"",safe:!0},{param_name:"pos_top",value:"",safe:!0},{param_name:"pos_bottom",value:"",safe:!0},{param_name:"pos_width",value:"",safe:!0},{param_name:"pos_height",value:"",safe:!0},{param_name:"pos_zindex",value:"",safe:!0}],c.prototype.showed=function(a){c.baseclass.prototype.showed.apply(this,arguments);var e=this;null==this.parent?e.rendered||(e.rendered=!0,e.load_container()):this.add_js({path:"vendor/managed/jquery.waypoints/lib/jquery.waypoints.min.js",loaded:"waypoint"in a.fn,callback:function(){a(e.dom_element).waypoint((function(a){e.rendered||(e.rendered=!0,e.load_container())}),{offset:"100%",handler:function(a){this.destroy()}}),a(document).trigger("scroll")}})},c.prototype.load_container=function(){var e=this;window.dxprBuilder.loadedContainers=window.dxprBuilder.loadedContainers||{},window.dxprBuilder.loadedContainers[e.id]||(window.dxprBuilder.loadedContainers[e.id]=!0,""!=this.attrs.container&&function(e,t,n){window.dxprBuilder.dxpr_containers_loaded.hasOwnProperty(e+"/"+t)?n(window.dxprBuilder.dxpr_containers_loaded[e+"/"+t]):window.dxprBuilder.dxpr_online&&a.ajax({type:"get",url:drupalSettings.dxprBuilder.dxprCsrfUrl,dataType:"json",cache:!1,context:this}).done((function(r){a.ajax({type:"POST",url:r,data:{action:"dxpr_load_container",type:e,name:t},cache:!drupalSettings.dxprBuilder.dxprEditor}).done((function(a){window.dxprBuilder.dxpr_containers_loaded[e+"/"+t]=a,n(a)})).fail((function(){n("")}))}))}(this.attrs.container.split("/")[0],this.attrs.container.split("/")[1],(function(t){if(/^\s*\<[\s\S]*\>\s*$/.exec(t)){e.loaded_container=e.attrs.container,a(t).appendTo(e.dom_content_element),a(e.dom_content_element).find("> script").detach().appendTo("head"),a(e.dom_content_element).find("> link[href]").detach().appendTo("head"),a(e.dom_element).css("display",""),a(e.dom_element).addClass("dxpr"),e.parse_html(e.dom_content_element),a(e.dom_element).attr("data-az-id",e.id),e.html_content=!0,drupalSettings.dxprBuilder.dxprEditor&&(e.show_controls(),e.update_sortable(),e.parent.attach_children(),e.attach_children(),window.dxprBuilder.dxprElements.try_render_unknown_elements());for(var n=0;n<e.children.length;n++)e.children[n].recursive_showed();dxprBuilder.attachBehaviors(),a(document).trigger("scroll")}else if(!window.dxprBuilder.dxpr_frontend){e.loaded_container=e.attrs.container,e.parse_shortcode(t),a(e.dom_element).attr("data-az-id",e.id),drupalSettings.dxprBuilder.dxprEditor&&(e.show_controls(),e.update_sortable());for(n=0;n<e.children.length;n++)e.children[n].recursive_render();e.attach_children(),null!=e.parent&&e.parent.update_dom();for(n=0;n<e.children.length;n++)e.children[n].recursive_showed();dxprBuilder.attachBehaviors(),a(document).trigger("scroll")}})))},c.prototype.update_dom=function(){this.loaded_container!=this.attrs.container&&(this.children=[],a(this.dom_content_element).empty(),this.rendered=!1,null!=this.parent&&c.baseclass.prototype.update_dom.apply(this,arguments))},d("az_tabs",!0,f),f.prototype.params=[{param_name:"az_dirrection",value:"",safe:!0},{param_name:"responsive",value:"",safe:!0},{param_name:"an_start",value:"",safe:!0},{param_name:"an_in",value:"",safe:!0},{param_name:"an_out",value:"",safe:!0},{param_name:"an_hidden",value:"",safe:!0},{param_name:"an_infinite",value:"",safe:!0},{param_name:"an_offset",value:"100",safe:!0},{param_name:"an_duration",value:"1000",safe:!0},{param_name:"an_in_delay",value:"0",safe:!0},{param_name:"an_out_delay",value:"0",safe:!0},{param_name:"an_parent",value:"1",safe:!0},{param_name:"an_name",value:"",safe:!0},{param_name:"box_model",value:"",safe:!0},{param_name:"hash",value:"",safe:!0},{param_name:"el_class",value:"",safe:!0},{param_name:"style",value:"",safe:!0},{param_name:"shadow",value:"0",safe:!0},{param_name:"hover_style",value:"",safe:!0},{param_name:"hover_shadow",value:"0",safe:!0},{param_name:"pos_left",value:"",safe:!0},{param_name:"pos_right",value:"",safe:!0},{param_name:"pos_top",value:"",safe:!0},{param_name:"pos_bottom",value:"",safe:!0},{param_name:"pos_width",value:"",safe:!0},{param_name:"pos_height",value:"",safe:!0},{param_name:"pos_zindex",value:"",safe:!0}],f.prototype.postRenderingTasks={onFirstLoad:async function(a){if(!a.loaded)return a.loaded=new Promise(((e,t)=>{const n=a.dom_element.find("ul.nav-tabs a:first");if("5"===bootstrapVersion())return bootstrap.Tab.getOrCreateInstance(n).show(),void e(!0);n.tab("show"),e(!0)})),await a.loaded}},f.prototype.showed=function(a){f.baseclass.prototype.showed.apply(this,arguments);const e=this.dom_element[0];e.classList.contains("bs4-left-vtabs")||e.classList.contains("bs5-left-vtabs")?(e.classList.add("az-tabs--grid","az-tabs--grid--left"),e.classList.remove("bs4-left-vtabs","bs5-left-vtabs")):(e.classList.contains("bs4-right-vtabs")||e.classList.contains("bs5-right-vtabs"))&&(e.classList.add("az-tabs--grid","az-tabs--grid--right"),e.classList.remove("bs4-right-vtabs","bs5-right-vtabs"));const t=function(a,e){for(let t=0;t<a.children.length;t++){let n=a.children[t];if(n.attrs.showed)return e(n,t),delete n.attrs.showed,a.dom_element.find(`a[href="#${n.get_element_id()}"]`).text(n.attrs.title),!0}return!1};var n,r;this._resizeListenerSet||(n=this,r=arguments,window.onresize=_.debounce((function(){dispatchEvent(new CustomEvent("dxpr_resize"))}),50,!0),window.addEventListener("dxpr_resize",_.debounce((function(){n.showed.apply(n,r)}),700)),n._resizeListenerSet=!0);const o=this.get_element_id(),s=this.get_dom_element().querySelectorAll(`#${o} .tab-pane div[id^="tab-"] > div`);let m=".accordion-header";"4"===bootstrapVersion()?m=".card-header":"3"===bootstrapVersion()&&(m=".panel-heading");const l=document.querySelector(`#${o} .az-tab:nth-child(1) ${m}`);if(!!l&&"none"!==window.getComputedStyle(l,null).display)this.dom_content_element.addClass("panel-group"),this.dom_element.find("[id*='tab-']").addClass("panel-collapse collapse"),this.dom_element.find(".az-tab").addClass("panel panel-default"),"5"===bootstrapVersion()&&(this.dom_content_element.addClass("accordion"),s.forEach((a=>{a.classList.add("accordion-body")}))),this.get_dom_element().style.display="block",setTimeout((()=>{"5"!==bootstrapVersion()&&a(this.dom_element).find(".az-tab .collapse").collapse({toggle:!1,parent:`#panel-group-${o}`});t(this,(a=>{a.dom_element.find(".collapse").collapse("show")}))||a(this.dom_element).find(".az-tab:first .collapse:first").collapse("show")}),500);else{const a=this.get_dom_element().querySelectorAll('[role="tabpanel"]');for(let e=0;e<a.length;++e)a[e].style.height="auto";this.dom_content_element.removeClass("panel-group"),this.dom_element.find("[id*='tab-']").removeClass("panel-collapse collapse"),this.dom_element.find(".az-tab").removeClass("panel panel-default");this.dom_element[0].querySelectorAll(".az-element").forEach((a=>{a.classList.remove("az-element--controls-spacer")})),"5"===bootstrapVersion()&&(this.dom_content_element.removeClass("accordion"),s.forEach((a=>{a.classList.remove("accordion-body")}))),this.get_dom_element().style.display="block";const e=(a,e)=>{if(listItem=this.dom_element.find(`ul.nav-tabs a:nth(${e})`),listItem.removeClass("active").parent().removeClass("active"),"5"===bootstrapVersion())return listItem.attr("aria-selected",!1).attr("data-bs-target",`#${a.get_element_id()}`).attr("href",`#${a.get_element_id()}`),void bootstrap.Tab.getOrCreateInstance(listItem).show();listItem.attr("aria-expanded",!1).attr("href",`#${a.get_element_id()}`).tab("show")};setTimeout((()=>{this.postRenderingTasks.onFirstLoad(this),t(this,e.bind(this))}),200)}},l("az_tab",!0,w),w.prototype.params=[{param_name:"title",value:"Title",safe:!0},{param_name:"box_model",value:"",safe:!0},{param_name:"hash",value:"",safe:!0},{param_name:"el_class",value:"",safe:!0},{param_name:"style",value:"",safe:!0},{param_name:"shadow",value:"0",safe:!0},{param_name:"hover_style",value:"",safe:!0},{param_name:"hover_shadow",value:"0",safe:!0},{param_name:"pos_left",value:"",safe:!0},{param_name:"pos_right",value:"",safe:!0},{param_name:"pos_top",value:"",safe:!0},{param_name:"pos_bottom",value:"",safe:!0},{param_name:"pos_width",value:"",safe:!0},{param_name:"pos_height",value:"",safe:!0},{param_name:"pos_zindex",value:"",safe:!0}],"dxpr_elements"in window.dxprBuilder||(window.dxprBuilder.dxpr_elements=[]),window.dxprBuilder.dxpr_elements.push({base:"az_accordion",showed(...e){this.baseclass.prototype.showed.apply(this,e);const t="3"!==bootstrapVersion()?"show":"in",n=this.attrs.pid?this.attrs.pid:this.id,r=this;a(this.dom_element).find("> .az-toggle > .collapse").removeClass(`${t}`);const o=this.dom_element[0].querySelector(".az-toggle > .collapse");collapsibleInit(o,n,"yes"!==this.attrs.collapsed);const s=function(a){BaseEvent.ignoreEvent("User Clicked");const e=a.target.getAttribute("aria-expanded");let t={data:{container:r.get_my_container()},state:{event:"User Opened DXPR Builder Collapsible"},propertiesExclude:["elementPath"],propertiesOverride:{eventGroup:a=>"Elements"}};0===a.detail&&(t.propertiesOverride={...t.propertiesOverride,clickType:a=>"keyboard shortcut"}),"true"===e&&(t={...t,state:{event:"User Closed DXPR Builder Collapsible"}}),analytics.track(new ClickEvent(a,t))};drupalSettings.dxprBuilder.dxprEditor&&this.dom_element[0].querySelectorAll(".az-toggle .panel-title a").forEach((a=>{a.addEventListener("click",s)}))},params:[{param_name:"collapsed",value:""},{param_name:"expandicon",value:""},{param_name:"an_start",value:""},{param_name:"an_in",value:""},{param_name:"an_out",value:""},{param_name:"an_hidden",value:""},{param_name:"an_infinite",value:""},{param_name:"an_offset",value:"100"},{param_name:"an_duration",value:"1000"},{param_name:"an_in_delay",value:"0"},{param_name:"an_out_delay",value:"0"},{param_name:"an_parent",value:"1"},{param_name:"an_name",value:""},{param_name:"box_model",value:""},{param_name:"hash",value:""},{param_name:"el_class",value:""},{param_name:"style",value:""},{param_name:"shadow",value:"0"},{param_name:"hover_style",value:""},{param_name:"hover_shadow",value:"0"},{param_name:"pos_left",value:""},{param_name:"pos_right",value:""},{param_name:"pos_top",value:""},{param_name:"pos_bottom",value:""},{param_name:"pos_width",value:""},{param_name:"pos_height",value:""},{param_name:"pos_zindex",value:""}],is_container:!0}),window.dxprBuilder.dxpr_elements.push({base:"az_alert",params:[{param_name:"message",value:"This is a placeholder text. Your actual content will go here. Edit this to include your own information."},{param_name:"type",value:""},{param_name:"an_start",value:""},{param_name:"an_in",value:""},{param_name:"an_out",value:""},{param_name:"an_hidden",value:""},{param_name:"an_infinite",value:""},{param_name:"an_offset",value:"100"},{param_name:"an_duration",value:"1000"},{param_name:"an_in_delay",value:"0"},{param_name:"an_out_delay",value:"0"},{param_name:"an_parent",value:"1"},{param_name:"an_name",value:""},{param_name:"box_model",value:""},{param_name:"hash",value:""},{param_name:"el_class",value:""},{param_name:"style",value:""},{param_name:"shadow",value:"0"},{param_name:"hover_style",value:""},{param_name:"hover_shadow",value:"0"},{param_name:"pos_left",value:""},{param_name:"pos_right",value:""},{param_name:"pos_top",value:""},{param_name:"pos_bottom",value:""},{param_name:"pos_width",value:""},{param_name:"pos_height",value:""},{param_name:"pos_zindex",value:""}]}),window.dxprBuilder.dxpr_elements.push({base:"az_blockquote",params:[{param_name:"content",value:"This is a placeholder text. Your actual content will go here. Edit this to include your own information."},{param_name:"cite",value:""},{param_name:"reverse",value:""},{param_name:"an_start",value:""},{param_name:"an_in",value:""},{param_name:"an_out",value:""},{param_name:"an_hidden",value:""},{param_name:"an_infinite",value:""},{param_name:"an_offset",value:"100"},{param_name:"an_duration",value:"1000"},{param_name:"an_in_delay",value:"0"},{param_name:"an_out_delay",value:"0"},{param_name:"an_parent",value:"1"},{param_name:"an_name",value:""},{param_name:"box_model",value:""},{param_name:"hash",value:""},{param_name:"el_class",value:""},{param_name:"style",value:""},{param_name:"shadow",value:"0"},{param_name:"hover_style",value:""},{param_name:"hover_shadow",value:"0"},{param_name:"pos_left",value:""},{param_name:"pos_right",value:""},{param_name:"pos_top",value:""},{param_name:"pos_bottom",value:""},{param_name:"pos_width",value:""},{param_name:"pos_height",value:""},{param_name:"pos_zindex",value:""}],is_container:!0,has_content:!0}),window.dxprBuilder.dxpr_elements.push({base:"az_button",params:[{param_name:"title",value:""},{param_name:"link",value:""},{param_name:"link_target",value:""},{param_name:"type",value:""},{param_name:"block",value:""},{param_name:"size",value:""},{param_name:"an_start",value:""},{param_name:"an_in",value:""},{param_name:"an_out",value:""},{param_name:"an_hidden",value:""},{param_name:"an_infinite",value:""},{param_name:"an_offset",value:"100"},{param_name:"an_duration",value:"1000"},{param_name:"an_in_delay",value:"0"},{param_name:"an_out_delay",value:"0"},{param_name:"an_parent",value:"1"},{param_name:"an_name",value:""},{param_name:"box_model",value:""},{param_name:"hash",value:""},{param_name:"el_class",value:""},{param_name:"style",value:""},{param_name:"shadow",value:"0"},{param_name:"hover_style",value:""},{param_name:"hover_shadow",value:"0"},{param_name:"pos_left",value:""},{param_name:"pos_right",value:""},{param_name:"pos_top",value:""},{param_name:"pos_bottom",value:""},{param_name:"pos_width",value:""},{param_name:"pos_height",value:""},{param_name:"pos_zindex",value:""}]}),window.dxprBuilder.dxpr_elements.push({base:"az_card",params:[{param_name:"header",value:""},{param_name:"title",value:""},{param_name:"type",value:""},{param_name:"an_start",value:""},{param_name:"an_in",value:""},{param_name:"an_out",value:""},{param_name:"an_hidden",value:""},{param_name:"an_infinite",value:""},{param_name:"an_offset",value:"100"},{param_name:"an_duration",value:"1000"},{param_name:"an_in_delay",value:"0"},{param_name:"an_out_delay",value:"0"},{param_name:"an_parent",value:"1"},{param_name:"an_name",value:""},{param_name:"box_model",value:""},{param_name:"hash",value:""},{param_name:"el_class",value:""},{param_name:"style",value:""},{param_name:"shadow",value:"0"},{param_name:"hover_style",value:""},{param_name:"hover_shadow",value:"0"},{param_name:"pos_left",value:""},{param_name:"pos_right",value:""},{param_name:"pos_top",value:""},{param_name:"pos_bottom",value:""},{param_name:"pos_width",value:""},{param_name:"pos_height",value:""},{param_name:"pos_zindex",value:""}],is_container:!0}),window.dxprBuilder.dxpr_elements.push({base:"az_carousel",showed(...e){this.baseclass.prototype.showed.apply(this,e),0===this.children.length&&this.add_slide(),window.dxprBuilder.dxpr_frontend&&(a(this.dom_element).find(".owl-item").children(":first-child").unwrap(),a(this.dom_element).find(".owl-wrapper").children(":first-child").unwrap(),a(this.dom_element).find(".owl-wrapper-outer").children(":first-child").unwrap(),a(this.dom_element).find(".owl-controls").remove(),a(this.dom_element).find(".owl-buttons").remove());this.add_css("vendor/unmanaged/owl.carousel/owl-carousel/owl.carousel.css","owlCarousel"in a.fn,(()=>{})),this.add_css("css/st-owl-carousel.css","owlCarousel"in a.fn,(()=>{})),this.add_css("vendor/unmanaged/owl.carousel/owl-carousel/owl.transitions.css","owlCarousel"in a.fn,(()=>{}));const t=this;this.add_js({path:"vendor/unmanaged/owl.carousel/owl-carousel/owl.carousel.js",loaded:"owlCarousel"in a.fn,callback(){const e=function(e){let t=null;t="userItems"in e?e.userItems:e.$userItems;let n=null;n="visibleItems"in e?e.visibleItems:e.$visibleItems;for(let e=0;e<t.length;e++)if(_.indexOf(n,e)<0){const n=t[e],r=a(n).attr("data-az-id"),o=window.dxprBuilder.dxprElements.get_element(r);_.isUndefined(o)||"trigger_start_out_animation"in o&&o.trigger_start_out_animation()}for(let e=0;e<n.length;e++)if(n[e]<t.length){const r=t[n[e]],o=a(r).attr("data-az-id"),s=window.dxprBuilder.dxprElements.get_element(o);_.isUndefined(s)||"trigger_start_in_animation"in s&&s.trigger_start_in_animation()}};let n="st-owl-theme";const r=(a,e)=>"yes"===a.attrs[e]||"on"===a.attrs[e];r(t,"pagination")&&(t.attrs.pagination_orientation&&(n+=` st-owl-pager-${t.attrs.pagination_orientation}`),t.attrs.pagination_shape&&(n+=` st-owl-pager-${t.attrs.pagination_shape}`),t.attrs.pagination_transform&&(n+=` st-owl-pager-${t.attrs.pagination_transform}`)),r(t,"navigation")&&(t.attrs.navigation_orientation&&(n+=` st-owl-navigation-${t.attrs.navigation_orientation}`),t.attrs.navigation_shape&&(n+=` st-owl-navigation-${t.attrs.navigation_shape}`),t.attrs.navigation_position&&(n+=` st-owl-navigation-${t.attrs.navigation_position}`));const o=(m="autoplay",("no"===(s=t).attrs[m]||""===s.attrs[m])&&parseInt(t.attrs.interval,10)>0&&parseInt(t.attrs.interval,10));var s,m;a(t.dom_content_element).owlCarousel({addClassActive:!0,afterAction(){e(this.owl)},afterMove(){},autoPlay:o,beforeMove(){},items:t.attrs.items,mouseDrag:!0,navigation:r(t,"navigation"),navigationText:!1,pagination:r(t,"pagination"),singleItem:"1"===t.attrs.items,startDragging(){},stopOnHover:r(t,"stoponhover"),theme:n,touchDrag:!0,transitionStyle:""!==t.attrs.transition&&t.attrs.transition}),e(t.dom_content_element.data("owlCarousel")),"outside"!==t.attrs.navigation_orientation||"topLeft"!==t.attrs.navigation_position&&"topRight"!==t.attrs.navigation_position&&"topCenter"!==t.attrs.navigation_position||a(t.dom_content_element).find(".owl-buttons").prependTo(a(t.dom_content_element)),a("head").find(`#carousel-style-${t.id}`).remove(),a("head").append(function(a){const e=`[data-az-id=${a.id}] .st-owl-theme`;let t=`<style id="carousel-style-${a.id}">\x3c!-- `;return t="triangle"===a.attrs.pagination_shape?`${t}${e}  .owl-page { background:transparent !important; border-bottom-color: ${a.attrs.pagination_color} !important }${e} .owl-page.active { background:transparent !important; border-bottom-color: ${a.attrs.pagination_active_color} !important }`:`${t}${e} .owl-page { background: ${a.attrs.pagination_color} !important}${e} .owl-page.active { background: ${a.attrs.pagination_active_color} !important }`,t=`${t}${e} .owl-buttons .owl-prev::after, ${e} .owl-buttons .owl-next::after, ${e} .owl-buttons .owl-prev::before, ${e} .owl-buttons .owl-next::before { background: ${a.attrs.navigation_icon_color};width: ${a.attrs.navigation_thickness}px;}${e} .owl-buttons .owl-prev:hover::after, ${e} .owl-buttons .owl-next:hover::after, ${e} .owl-buttons .owl-prev:hover::before, ${e} .owl-buttons .owl-next:hover::before { background: ${a.attrs.navigation_icon_hover_color} }${e} .owl-buttons .owl-prev, ${e} .owl-buttons .owl-next { background: ${a.attrs.navigation_background_color}; border-color: ${a.attrs.navigation_background_color} }${e} .owl-buttons .owl-prev:hover, ${e} .owl-buttons .owl-next:hover { background: ${a.attrs.navigation_background_hover_color}; border-color: ${a.attrs.navigation_background_hover_color} } --\x3e</style>`,t}(t))}})},params:[{param_name:"items",value:"1"},{param_name:"autoplay",value:""},{param_name:"pagination",value:""},{param_name:"pagination_orientation",value:""},{param_name:"pagination_shape",value:""},{param_name:"pagination_transform",value:""},{param_name:"pagination_color",value:""},{param_name:"pagination_active_color",value:""},{param_name:"navigation",value:""},{param_name:"navigation_orientation",value:""},{param_name:"navigation_shape",value:""},{param_name:"navigation_icon_color",value:""},{param_name:"navigation_icon_hover_color",value:""},{param_name:"navigation_background_color",value:""},{param_name:"navigation_background_hover_color",value:""},{param_name:"navigation_thickness",value:"2"},{param_name:"navigation_position",value:""},{param_name:"interval",value:"5000"},{param_name:"transition",value:""},{param_name:"stoponhover",value:""},{param_name:"options",value:""},{param_name:"an_start",value:""},{param_name:"an_in",value:""},{param_name:"an_out",value:""},{param_name:"an_hidden",value:""},{param_name:"an_infinite",value:""},{param_name:"an_offset",value:"100"},{param_name:"an_duration",value:"1000"},{param_name:"an_in_delay",value:"0"},{param_name:"an_out_delay",value:"0"},{param_name:"an_parent",value:"1"},{param_name:"an_name",value:""},{param_name:"box_model",value:""},{param_name:"hash",value:""},{param_name:"el_class",value:""},{param_name:"style",value:""},{param_name:"shadow",value:"0"},{param_name:"hover_style",value:""},{param_name:"hover_shadow",value:"0"},{param_name:"pos_left",value:""},{param_name:"pos_right",value:""},{param_name:"pos_top",value:""},{param_name:"pos_bottom",value:""},{param_name:"pos_width",value:""},{param_name:"pos_height",value:""},{param_name:"pos_zindex",value:""}],is_container:!0}),window.dxprBuilder.dxpr_elements.push({base:"az_circle_counter",showed(...e){this.baseclass.prototype.showed.apply(this,e);let t=0;this.dom_element&&(t=this.dom_element.parent().width()),this.dom_element.css({"max-height":`${t}px`,"max-width":`${t}px`});const n=this;window.dxprBuilder.dxpr_frontend&&a(this.dom_element).find(".circliful").empty(),this.add_css("vendor/unmanaged/jquery.circliful/css/jquery.circliful.css","circliful"in a.fn,(()=>{})),this.add_js_list({paths:["vendor/unmanaged/jquery.circliful/js/jquery.circliful.min.js","vendor/managed/jquery.waypoints/lib/jquery.waypoints.min.js"],loaded:"waypoint"in a.fn&&"circliful"in a.fn,callback(){a(n.dom_element).waypoint((e=>{const t=once(`#${n.id}`,`.az-element.az-circle-counter > #${n.id}`);t.length&&a(t).circliful({complete:()=>{n.dom_element[0].classList.add("dxpr-builder--animation-complete"),setTimeout((()=>{n.dom_element[0].classList.remove("dxpr-builder--animation-complete")}),1e3)}})}),{offset:"100%",handler(a){this.destroy()}}),a(document).trigger("scroll")}})},params:[{param_name:"fgcolor",value:"#333333"},{param_name:"bgcolor",value:"#999999"},{param_name:"fill",value:""},{param_name:"percent",value:"50"},{param_name:"dimension",value:"250"},{param_name:"text",value:""},{param_name:"fontsize",value:"16"},{param_name:"info",value:""},{param_name:"bordersize",value:"10"},{param_name:"width",value:"5"},{param_name:"border",value:""},{param_name:"type",value:""},{param_name:"icon",value:""},{param_name:"icon_size",value:"16"},{param_name:"icon_color",value:""},{param_name:"an_start",value:""},{param_name:"an_in",value:""},{param_name:"an_out",value:""},{param_name:"an_hidden",value:""},{param_name:"an_infinite",value:""},{param_name:"an_offset",value:"100"},{param_name:"an_duration",value:"1000"},{param_name:"an_in_delay",value:"0"},{param_name:"an_out_delay",value:"0"},{param_name:"an_parent",value:"1"},{param_name:"an_name",value:""},{param_name:"box_model",value:""},{param_name:"hash",value:""},{param_name:"el_class",value:""},{param_name:"style",value:""},{param_name:"shadow",value:"0"},{param_name:"hover_style",value:""},{param_name:"hover_shadow",value:"0"},{param_name:"pos_left",value:""},{param_name:"pos_right",value:""},{param_name:"pos_top",value:""},{param_name:"pos_bottom",value:""},{param_name:"pos_width",value:""},{param_name:"pos_height",value:""},{param_name:"pos_zindex",value:""}]}),window.dxprBuilder.dxpr_elements.push({base:"az_countdown",showed(...e){this.baseclass.prototype.showed.apply(this,e);const t=this;this.add_css("vendor/managed/counteverest/css/counteverest.dxpr.css","countEverest"in a.fn,(()=>{})),this.add_js_list({paths:["vendor/managed/counteverest/js/vendor/jquery.counteverest.min.js","vendor/managed/datetimepicker/build/jquery.datetimepicker.full.js"],loaded:"countEverest"in a.fn&&"datetimepicker"in a.fn,callback(){const n={yearsLabel:Drupal.t("Years"),yearLabel:Drupal.t("Year"),daysLabel:Drupal.t("Days"),dayLabel:Drupal.t("Day"),hoursLabel:Drupal.t("Hours"),hourLabel:Drupal.t("Hour"),minutesLabel:Drupal.t("Minutes"),minuteLabel:Drupal.t("Minute"),secondsLabel:Drupal.t("Seconds"),secondLabel:Drupal.t("Second"),decisecondsLabel:Drupal.t("Deciseconds"),decisecondLabel:Drupal.t("Decisecond"),millisecondsLabel:Drupal.t("Milliseconds"),millisecondLabel:Drupal.t("Millisecond")};let r={};const o=a=>{const e=a.split(" "),t=e[0].split("."),[n,r,o]=t,s=e[1];return s?new Date(o,r,n,s):new Date(o,r,n)},s=function(a){return Math.PI/180*a-Math.PI/2},m=function(a,e,t){if(a){const n=a.getContext("2d");n.clearRect(0,0,a.width,a.height),n.lineWidth=6,n.beginPath(),n.arc(a.width/2,a.height/2,a.width/2-n.lineWidth,s(0),s(360/t*(t-e)),!1),n.strokeStyle="#282828",n.stroke(),n.beginPath(),n.arc(a.width/2,a.height/2,a.width/2-n.lineWidth,s(0),s(360/t*(t-e)),!0),n.strokeStyle="#1488cb",n.stroke()}};switch(t.attrs.countdown_style){case"style6":r=a.extend(n,{yearsWrapper:".ce-years .ce-flip-back",daysWrapper:".ce-days .ce-flip-back",hoursWrapper:".ce-hours .ce-flip-back",minutesWrapper:".ce-minutes .ce-flip-back",secondsWrapper:".ce-seconds .ce-flip-back",wrapDigits:!1,onChange(){a(t.dom_element).find(".ce-countdown .ce-col>div").each((function(e){const t=a(this),n=t.find(".ce-flip-front"),r=t.find(".ce-flip-back").text(),o=t.attr("data-old");void 0===o&&t.attr("data-old",r),r!==o&&(t.addClass("ce-animate"),window.setTimeout((()=>{n.text(r),t.removeClass("ce-animate").attr("data-old",r)}),800))}))}});break;case"style9":r=a.extend(n,{leftHandZeros:!1,onChange(){m(a(t.dom_element).find("#ce-years").get(0),this.years,100),m(a(t.dom_element).find("#ce-days").get(0),this.days,365),m(a(t.dom_element).find("#ce-hours").get(0),this.hours,24),m(a(t.dom_element).find("#ce-minutes").get(0),this.minutes,60),m(a(t.dom_element).find("#ce-seconds").get(0),this.seconds,60)}});break;case"style10":{const e=a(t.dom_element).find(".ce-countdown");let o=!0;r=a.extend(n,{leftHandZeros:!0,yearLabel:null,dayLabel:null,hourLabel:null,minuteLabel:null,secondLabel:null,afterCalculation(){const t=this,n={years:this.years,days:this.days,hours:this.hours,minutes:this.minutes,seconds:this.seconds},r={years:"100",hours:"23",minutes:"59",seconds:"59"},s="active",m="before";!0===o&&(o=!1,e.find(".ce-unit-wrap div").each((function(){const e=a(this),t=e.attr("class").substring(3),r=n[t];let o="",s="";for(let a=0;a<10;++a)o+=['<div class="ce-digits-inner">','<div class="ce-flip-wrap">','<div class="ce-up">','<div class="ce-shadow"></div>',`<div class="ce-inn">${a}</div>`,"</div>",'<div class="ce-down">','<div class="ce-shadow"></div>',`<div class="ce-inn">${a}</div>`,"</div>","</div>","</div>"].join("");for(let a=0;a<r.length;++a)s+=`<div class="ce-digits">${o}</div>`;e.append(s)}))),a.each(n,(function(a){const n=e.find(`.ce-${a} .ce-digits`).length,o=r[a],l=t.strPad(this,n,"0");for(let t=l.length-1;t>=0;t--){const n=e.find(`.ce-${a} .ce-digits:eq(${t})`).find("div.ce-digits-inner"),r=o&&0!==o[t]?o[t]:9,i=parseInt(l[t],10),_=i===r?0:i+1;n.eq(_).hasClass(s)&&n.parent().addClass("play"),n.removeClass(s).removeClass(m),n.eq(i).addClass(s),n.eq(_).addClass(m)}}))}});break}}switch(t.attrs.counter_scope){case"date":{const e=o(t.attrs.date);null!=e&&a(t.dom_element).countEverest(a.extend(r,n,{day:e.getDate(),month:e.getMonth(),year:e.getFullYear()}));break}case"date_time":{const e=o(t.attrs.date_time);null!=e&&a(t.dom_element).countEverest(a.extend(r,n,{day:e.getDate(),month:e.getMonth(),year:e.getFullYear(),hour:e.getHours()}));break}case"repeating":{const e=new Date;e.setHours(t.attrs.time),null!=e&&a(t.dom_element).countEverest(a.extend(r,n,{day:e.getDate(),month:e.getMonth()+1,year:e.getFullYear(),hour:e.getHours(),onComplete(){""!==t.attrs.referrer&&window.location.replace(t.attrs.referrer)}}));break}case"resetting":{if(""===t.attrs.saved)return;const o=new Date(t.attrs.saved),s=1e3*(60*Math.round(t.attrs.reset_hours)*60+60*Math.round(t.attrs.reset_minutes)+Math.round(t.attrs.reset_seconds));let m=new Date(o.getTime()+s),l=function(){""!==t.attrs.referrer&&window.location.replace(t.attrs.referrer)};if("yes"===t.attrs.restart){const n=new Date,r=n.getTime()-o.getTime(),i=s-(r-parseInt(r/s,10)*s);m=new Date(n.getTime()+i),l=function(){a(t.dom_element).countEverest("destroy"),t.showed(e)}}a(t.dom_element).countEverest(a.extend(r,n,{day:m.getDate(),month:m.getMonth()+1,year:m.getFullYear(),hour:m.getHours(),minute:m.getMinutes(),second:m.getSeconds(),onComplete:l}));break}}}})},params:[{param_name:"countdown_style",value:""},{param_name:"counter_scope",value:""},{param_name:"date",value:""},{param_name:"date_time",value:""},{param_name:"time",value:""},{param_name:"reset_hours",value:""},{param_name:"reset_minutes",value:""},{param_name:"reset_seconds",value:""},{param_name:"referrer",value:""},{param_name:"restart",value:""},{param_name:"saved",value:""},{param_name:"display",value:""},{param_name:"an_start",value:""},{param_name:"an_in",value:""},{param_name:"an_out",value:""},{param_name:"an_hidden",value:""},{param_name:"an_infinite",value:""},{param_name:"an_offset",value:"100"},{param_name:"an_duration",value:"1000"},{param_name:"an_in_delay",value:"0"},{param_name:"an_out_delay",value:"0"},{param_name:"an_parent",value:"1"},{param_name:"an_name",value:""},{param_name:"box_model",value:""},{param_name:"hash",value:""},{param_name:"el_class",value:""},{param_name:"style",value:""},{param_name:"shadow",value:"0"},{param_name:"hover_style",value:""},{param_name:"hover_shadow",value:"0"},{param_name:"pos_left",value:""},{param_name:"pos_right",value:""},{param_name:"pos_top",value:""},{param_name:"pos_bottom",value:""},{param_name:"pos_width",value:""},{param_name:"pos_height",value:""},{param_name:"pos_zindex",value:""}]}),window.dxprBuilder.dxpr_elements.push({base:"az_counter",showed(...e){this.baseclass.prototype.showed.apply(this,e);const t=this;this.add_js_list({paths:["vendor/managed/jquery-countTo/jquery.countTo.js","vendor/managed/jquery.waypoints/lib/jquery.waypoints.min.js"],loaded:"waypoint"in a.fn&&"countTo"in a.fn,callback(){a(t.dom_element).waypoint((e=>{a(t.dom_element).find(`#${t.id}`).countTo({from:Math.round(t.attrs.start),to:Math.round(t.attrs.end),speed:Math.round(t.attrs.speed),refreshInterval:50,seperator:t.attrs.seperator,formatter:(a,e)=>t.attrs.prefix+a.toFixed(0).replace(/\B(?=(?:\d{3})+(?!\d))/g,e.seperator)+t.attrs.postfix})}),{offset:"100%",handler(a){this.destroy()}}),a(document).trigger("scroll")}})},params:[{param_name:"start",value:"0"},{param_name:"end",value:"100"},{param_name:"fontsize",value:"30"},{param_name:"speed",value:"2000"},{param_name:"seperator",value:""},{param_name:"prefix",value:""},{param_name:"postfix",value:""},{param_name:"an_start",value:""},{param_name:"an_in",value:""},{param_name:"an_out",value:""},{param_name:"an_hidden",value:""},{param_name:"an_infinite",value:""},{param_name:"an_offset",value:"100"},{param_name:"an_duration",value:"1000"},{param_name:"an_in_delay",value:"0"},{param_name:"an_out_delay",value:"0"},{param_name:"an_parent",value:"1"},{param_name:"an_name",value:""},{param_name:"box_model",value:""},{param_name:"hash",value:""},{param_name:"el_class",value:""},{param_name:"style",value:""},{param_name:"shadow",value:"0"},{param_name:"hover_style",value:""},{param_name:"hover_shadow",value:"0"},{param_name:"pos_left",value:""},{param_name:"pos_right",value:""},{param_name:"pos_top",value:""},{param_name:"pos_bottom",value:""},{param_name:"pos_width",value:""},{param_name:"pos_height",value:""},{param_name:"pos_zindex",value:""}]}),window.dxprBuilder.dxpr_elements.push({base:"az_html",params:[{param_name:"content",value:"<p>Click the edit button to change this HTML</p>"},{param_name:"an_start",value:""},{param_name:"an_in",value:""},{param_name:"an_out",value:""},{param_name:"an_hidden",value:""},{param_name:"an_infinite",value:""},{param_name:"an_offset",value:"100"},{param_name:"an_duration",value:"1000"},{param_name:"an_in_delay",value:"0"},{param_name:"an_out_delay",value:"0"},{param_name:"an_parent",value:"1"},{param_name:"an_name",value:""},{param_name:"box_model",value:""},{param_name:"hash",value:""},{param_name:"el_class",value:""},{param_name:"style",value:""},{param_name:"shadow",value:"0"},{param_name:"hover_style",value:""},{param_name:"hover_shadow",value:"0"},{param_name:"pos_left",value:""},{param_name:"pos_right",value:""},{param_name:"pos_top",value:""},{param_name:"pos_bottom",value:""},{param_name:"pos_width",value:""},{param_name:"pos_height",value:""},{param_name:"pos_zindex",value:""}],is_container:!0,has_content:!0}),window.dxprBuilder.dxpr_elements.push({base:"az_icon",params:[{param_name:"icon",value:""},{param_name:"size",value:""},{param_name:"st_style",value:""},{param_name:"animation",value:""},{param_name:"orientation",value:""},{param_name:"link",value:""},{param_name:"link_target",value:""},{param_name:"an_start",value:""},{param_name:"an_in",value:""},{param_name:"an_out",value:""},{param_name:"an_hidden",value:""},{param_name:"an_infinite",value:""},{param_name:"an_offset",value:"100"},{param_name:"an_duration",value:"1000"},{param_name:"an_in_delay",value:"0"},{param_name:"an_out_delay",value:"0"},{param_name:"an_parent",value:"1"},{param_name:"an_name",value:""},{param_name:"box_model",value:""},{param_name:"hash",value:""},{param_name:"el_class",value:""},{param_name:"style",value:""},{param_name:"shadow",value:"0"},{param_name:"hover_style",value:""},{param_name:"hover_shadow",value:"0"},{param_name:"pos_left",value:""},{param_name:"pos_right",value:""},{param_name:"pos_top",value:""},{param_name:"pos_bottom",value:""},{param_name:"pos_width",value:""},{param_name:"pos_height",value:""},{param_name:"pos_zindex",value:""}]}),window.dxprBuilder.dxpr_elements.push({base:"az_image",params:[{param_name:"image",value:""},{param_name:"width",value:"100%"},{param_name:"height",value:""},{param_name:"link",value:""},{param_name:"link_target",value:""},{param_name:"alt",value:""},{param_name:"title",value:""},{param_name:"an_start",value:""},{param_name:"an_in",value:""},{param_name:"an_out",value:""},{param_name:"an_hidden",value:""},{param_name:"an_infinite",value:""},{param_name:"an_offset",value:"100"},{param_name:"an_duration",value:"1000"},{param_name:"an_in_delay",value:"0"},{param_name:"an_out_delay",value:"0"},{param_name:"an_parent",value:"1"},{param_name:"an_name",value:""},{param_name:"box_model",value:""},{param_name:"hash",value:""},{param_name:"el_class",value:""},{param_name:"style",value:""},{param_name:"shadow",value:"0"},{param_name:"hover_style",value:""},{param_name:"hover_shadow",value:"0"},{param_name:"pos_left",value:""},{param_name:"pos_right",value:""},{param_name:"pos_top",value:""},{param_name:"pos_bottom",value:""},{param_name:"pos_width",value:""},{param_name:"pos_height",value:""},{param_name:"pos_zindex",value:""}]}),window.dxprBuilder.dxpr_elements.push({base:"az_images_carousel",showed(...a){this.baseclass.prototype.showed.apply(this,a),carouselInit(this.dom_element[0],{interval:parseInt(this.attrs.interval,10),pause:"hover"});const e=this.dom_element[0],t=e.querySelector(".carousel-inner > :first-child");t&&t.classList.add("active");const n=e.querySelector(`.carousel-indicators ${"5"===bootstrapVersion()?"button":"li"}:first-child`);n&&n.classList.add("active")},params:[{param_name:"images",value:""},{param_name:"interval",value:"5000"},{param_name:"hide",value:""},{param_name:"alt",value:""},{param_name:"title",value:""},{param_name:"an_start",value:""},{param_name:"an_in",value:""},{param_name:"an_out",value:""},{param_name:"an_hidden",value:""},{param_name:"an_infinite",value:""},{param_name:"an_offset",value:"100"},{param_name:"an_duration",value:"1000"},{param_name:"an_in_delay",value:"0"},{param_name:"an_out_delay",value:"0"},{param_name:"an_parent",value:"1"},{param_name:"an_name",value:""},{param_name:"box_model",value:""},{param_name:"hash",value:""},{param_name:"el_class",value:""},{param_name:"style",value:""},{param_name:"shadow",value:"0"},{param_name:"hover_style",value:""},{param_name:"hover_shadow",value:"0"},{param_name:"pos_left",value:""},{param_name:"pos_right",value:""},{param_name:"pos_top",value:""},{param_name:"pos_bottom",value:""},{param_name:"pos_width",value:""},{param_name:"pos_height",value:""},{param_name:"pos_zindex",value:""}]}),window.dxprBuilder.dxpr_elements.push({base:"az_jumbotron",params:[{param_name:"an_start",value:""},{param_name:"an_in",value:""},{param_name:"an_out",value:""},{param_name:"an_hidden",value:""},{param_name:"an_infinite",value:""},{param_name:"an_offset",value:"100"},{param_name:"an_duration",value:"1000"},{param_name:"an_in_delay",value:"0"},{param_name:"an_out_delay",value:"0"},{param_name:"an_parent",value:"1"},{param_name:"an_name",value:""},{param_name:"box_model",value:""},{param_name:"hash",value:""},{param_name:"el_class",value:""},{param_name:"style",value:""},{param_name:"shadow",value:"0"},{param_name:"hover_style",value:""},{param_name:"hover_shadow",value:"0"},{param_name:"pos_left",value:""},{param_name:"pos_right",value:""},{param_name:"pos_top",value:""},{param_name:"pos_bottom",value:""},{param_name:"pos_width",value:""},{param_name:"pos_height",value:""},{param_name:"pos_zindex",value:""}],is_container:!0}),window.dxprBuilder.dxpr_elements.push({base:"az_layers",showed(...e){this.baseclass.prototype.showed.apply(this,e);const t=this;let n,r;a(window).off(`resize.az_layers${t.id}`),"yes"===this.attrs.responsive&&(n=function(a,e){let t="";const n=a.attrs[e].match(/font-size[: ]*([\-\d\.]*)(px|%|em) *;/);if(null!==n){const[,a]=n;t=a}return t},r=function(e,o){let s=n(e,"style");""!==s&&(s*=o,a(e.dom_content_element).css("font-size",`${s}px`));for(let a=0;a<e.children.length;a++)r(t.children[a],o)},a(window).on(`resize.az_layers${t.id}`,(()=>{const e=a(t.dom_element).width();"o_width"in t.attrs&&""!==t.attrs.o_width||(t.attrs.o_width=e);const n=e/t.attrs.o_width;a(t.dom_element).css("font-size",100*n+"%"),a(t.dom_content_element).css("height",t.attrs.height*n+"px"),r(t,n)})),a(window).trigger("resize"))},params:[{param_name:"width",value:"100%"},{param_name:"height",value:"500"},{param_name:"responsive",value:""},{param_name:"o_width",value:""},{param_name:"an_start",value:""},{param_name:"an_in",value:""},{param_name:"an_out",value:""},{param_name:"an_hidden",value:""},{param_name:"an_infinite",value:""},{param_name:"an_offset",value:"100"},{param_name:"an_duration",value:"1000"},{param_name:"an_in_delay",value:"0"},{param_name:"an_out_delay",value:"0"},{param_name:"an_parent",value:"1"},{param_name:"an_name",value:""},{param_name:"box_model",value:""},{param_name:"hash",value:""},{param_name:"el_class",value:""},{param_name:"style",value:""},{param_name:"shadow",value:"0"},{param_name:"hover_style",value:""},{param_name:"hover_shadow",value:"0"},{param_name:"pos_left",value:""},{param_name:"pos_right",value:""},{param_name:"pos_top",value:""},{param_name:"pos_bottom",value:""},{param_name:"pos_width",value:""},{param_name:"pos_height",value:""},{param_name:"pos_zindex",value:""}],is_container:!0}),window.dxprBuilder.dxpr_elements.push({base:"az_link",params:[{param_name:"link",value:""},{param_name:"link_target",value:""},{param_name:"title",value:""},{param_name:"nofollow",value:""},{param_name:"an_start",value:""},{param_name:"an_in",value:""},{param_name:"an_out",value:""},{param_name:"an_hidden",value:""},{param_name:"an_infinite",value:""},{param_name:"an_offset",value:"100"},{param_name:"an_duration",value:"1000"},{param_name:"an_in_delay",value:"0"},{param_name:"an_out_delay",value:"0"},{param_name:"an_parent",value:"1"},{param_name:"an_name",value:""},{param_name:"box_model",value:""},{param_name:"hash",value:""},{param_name:"el_class",value:""},{param_name:"style",value:""},{param_name:"shadow",value:"0"},{param_name:"hover_style",value:""},{param_name:"hover_shadow",value:"0"},{param_name:"pos_left",value:""},{param_name:"pos_right",value:""},{param_name:"pos_top",value:""},{param_name:"pos_bottom",value:""},{param_name:"pos_width",value:""},{param_name:"pos_height",value:""},{param_name:"pos_zindex",value:""}],is_container:!0}),window.dxprBuilder.dxpr_elements.push({base:"az_map",params:[{param_name:"address",value:""},{param_name:"width",value:"100%"},{param_name:"height",value:"400px"},{param_name:"an_start",value:""},{param_name:"an_in",value:""},{param_name:"an_out",value:""},{param_name:"an_hidden",value:""},{param_name:"an_infinite",value:""},{param_name:"an_offset",value:"100"},{param_name:"an_duration",value:"1000"},{param_name:"an_in_delay",value:"0"},{param_name:"an_out_delay",value:"0"},{param_name:"an_parent",value:"1"},{param_name:"an_name",value:""},{param_name:"box_model",value:""},{param_name:"hash",value:""},{param_name:"el_class",value:""},{param_name:"style",value:""},{param_name:"shadow",value:"0"},{param_name:"hover_style",value:""},{param_name:"hover_shadow",value:"0"},{param_name:"pos_left",value:""},{param_name:"pos_right",value:""},{param_name:"pos_top",value:""},{param_name:"pos_bottom",value:""},{param_name:"pos_width",value:""},{param_name:"pos_height",value:""},{param_name:"pos_zindex",value:""}],is_container:!0,has_content:!0}),window.dxprBuilder.dxpr_elements.push({base:"az_panel",params:[{param_name:"title",value:""},{param_name:"type",value:""},{param_name:"an_start",value:""},{param_name:"an_in",value:""},{param_name:"an_out",value:""},{param_name:"an_hidden",value:""},{param_name:"an_infinite",value:""},{param_name:"an_offset",value:"100"},{param_name:"an_duration",value:"1000"},{param_name:"an_in_delay",value:"0"},{param_name:"an_out_delay",value:"0"},{param_name:"an_parent",value:"1"},{param_name:"an_name",value:""},{param_name:"box_model",value:""},{param_name:"hash",value:""},{param_name:"el_class",value:""},{param_name:"style",value:""},{param_name:"shadow",value:"0"},{param_name:"hover_style",value:""},{param_name:"hover_shadow",value:"0"},{param_name:"pos_left",value:""},{param_name:"pos_right",value:""},{param_name:"pos_top",value:""},{param_name:"pos_bottom",value:""},{param_name:"pos_width",value:""},{param_name:"pos_height",value:""},{param_name:"pos_zindex",value:""}],is_container:!0}),window.dxprBuilder.dxpr_elements.push({base:"az_progress_bar",params:[{param_name:"label",value:""},{param_name:"width",value:"50"},{param_name:"height",value:"20"},{param_name:"bgcolor",value:""},{param_name:"fcolor",value:""},{param_name:"type",value:""},{param_name:"options",value:""},{param_name:"an_start",value:""},{param_name:"an_in",value:""},{param_name:"an_out",value:""},{param_name:"an_hidden",value:""},{param_name:"an_infinite",value:""},{param_name:"an_offset",value:"100"},{param_name:"an_duration",value:"1000"},{param_name:"an_in_delay",value:"0"},{param_name:"an_out_delay",value:"0"},{param_name:"an_parent",value:"1"},{param_name:"an_name",value:""},{param_name:"box_model",value:""},{param_name:"hash",value:""},{param_name:"el_class",value:""},{param_name:"style",value:""},{param_name:"shadow",value:"0"},{param_name:"hover_style",value:""},{param_name:"hover_shadow",value:"0"},{param_name:"pos_left",value:""},{param_name:"pos_right",value:""},{param_name:"pos_top",value:""},{param_name:"pos_bottom",value:""},{param_name:"pos_width",value:""},{param_name:"pos_height",value:""},{param_name:"pos_zindex",value:""}]}),window.dxprBuilder.dxpr_elements.push({base:"az_separator",params:[{param_name:"bgcolor",value:""},{param_name:"thickness",value:""},{param_name:"custom_thickness",value:"3"},{param_name:"width",value:""},{param_name:"custom_width",value:"100"},{param_name:"align",value:""},{param_name:"an_start",value:""},{param_name:"an_in",value:""},{param_name:"an_out",value:""},{param_name:"an_hidden",value:""},{param_name:"an_infinite",value:""},{param_name:"an_offset",value:"100"},{param_name:"an_duration",value:"1000"},{param_name:"an_in_delay",value:"0"},{param_name:"an_out_delay",value:"0"},{param_name:"an_parent",value:"1"},{param_name:"an_name",value:""},{param_name:"box_model",value:""},{param_name:"hash",value:""},{param_name:"el_class",value:""},{param_name:"style",value:""},{param_name:"shadow",value:"0"},{param_name:"hover_style",value:""},{param_name:"hover_shadow",value:"0"},{param_name:"pos_left",value:""},{param_name:"pos_right",value:""},{param_name:"pos_top",value:""},{param_name:"pos_bottom",value:""},{param_name:"pos_width",value:""},{param_name:"pos_height",value:""},{param_name:"pos_zindex",value:""}]}),window.dxprBuilder.dxpr_elements.push({base:"az_text",params:[{param_name:"content",value:"\n        <h2>This is a placeholder text.</h2>\n        <p>Your actual content will go here. Edit this to include your own information."},{param_name:"an_start",value:""},{param_name:"an_in",value:""},{param_name:"an_out",value:""},{param_name:"an_hidden",value:""},{param_name:"an_infinite",value:""},{param_name:"an_offset",value:"100"},{param_name:"an_duration",value:"1000"},{param_name:"an_in_delay",value:"0"},{param_name:"an_out_delay",value:"0"},{param_name:"an_parent",value:"1"},{param_name:"an_name",value:""},{param_name:"box_model",value:""},{param_name:"hash",value:""},{param_name:"el_class",value:""},{param_name:"style",value:""},{param_name:"shadow",value:"0"},{param_name:"hover_style",value:""},{param_name:"hover_shadow",value:"0"},{param_name:"pos_left",value:""},{param_name:"pos_right",value:""},{param_name:"pos_top",value:""},{param_name:"pos_bottom",value:""},{param_name:"pos_width",value:""},{param_name:"pos_height",value:""},{param_name:"pos_zindex",value:""}],is_container:!0,has_content:!0}),window.dxprBuilder.dxpr_elements.push({base:"az_video_local",params:[{param_name:"video",value:""},{param_name:"autoplay",value:""},{param_name:"muted",value:""},{param_name:"controls",value:""},{param_name:"loop",value:""},{param_name:"width",value:"100%"},{param_name:"image",value:""},{param_name:"an_start",value:""},{param_name:"an_in",value:""},{param_name:"an_out",value:""},{param_name:"an_hidden",value:""},{param_name:"an_infinite",value:""},{param_name:"an_offset",value:"100"},{param_name:"an_duration",value:"1000"},{param_name:"an_in_delay",value:"0"},{param_name:"an_out_delay",value:"0"},{param_name:"an_parent",value:"1"},{param_name:"an_name",value:""},{param_name:"box_model",value:""},{param_name:"hash",value:""},{param_name:"el_class",value:""},{param_name:"style",value:""},{param_name:"shadow",value:"0"},{param_name:"hover_style",value:""},{param_name:"hover_shadow",value:"0"},{param_name:"pos_left",value:""},{param_name:"pos_right",value:""},{param_name:"pos_top",value:""},{param_name:"pos_bottom",value:""},{param_name:"pos_width",value:""},{param_name:"pos_height",value:""},{param_name:"pos_zindex",value:""}]}),window.dxprBuilder.dxpr_elements.push({base:"az_video",showed(...e){this.baseclass.prototype.showed.apply(this,e);const t=a(this.dom_element);t.find(".az-video-play, .az-video-icon").bind("click",(()=>{t.find(".lazy-video").trigger("click");const e=t.find(".lazy-video");if(e.length){const n=function(e,t,n,r,o){const s=a(`\n          <iframe src="${e}"\n                  type="text/html"\n                  webkitallowfullscreen\n                  mozallowfullscreen\n                  allowfullscreen\n                  frameborder="0">\n          </iframe>`);return s.attr("style",t),a.isNumeric(n)&&(n+="px"),n.length>0&&s.css("width",n),""!==o&&s.css("z-index",1).hide(),s}(e.data("url"),e.data("style"),e.data("width"),e.data("height"),e.data("image")),r="5"===bootstrapVersion()?".ratio":".embed-responsive";n.appendTo(t.find(r))}const n=t.find("iframe"),r=n.attr("src"),o=-1===r.indexOf("?")?"?":"&";n.attr("src",`${r+o}autoplay=1&muted=1&mute=1`).show(),t.find(".az-video-play, .az-video-icon").hide()}))},params:[{param_name:"link",value:""},{param_name:"width",value:"100%"},{param_name:"image",value:""},{param_name:"play",value:""},{param_name:"an_start",value:""},{param_name:"an_in",value:""},{param_name:"an_out",value:""},{param_name:"an_hidden",value:""},{param_name:"an_infinite",value:""},{param_name:"an_offset",value:"100"},{param_name:"an_duration",value:"1000"},{param_name:"an_in_delay",value:"0"},{param_name:"an_out_delay",value:"0"},{param_name:"an_parent",value:"1"},{param_name:"an_name",value:""},{param_name:"box_model",value:""},{param_name:"hash",value:""},{param_name:"el_class",value:""},{param_name:"style",value:""},{param_name:"shadow",value:"0"},{param_name:"hover_style",value:""},{param_name:"hover_shadow",value:"0"},{param_name:"pos_left",value:""},{param_name:"pos_right",value:""},{param_name:"pos_top",value:""},{param_name:"pos_bottom",value:""},{param_name:"pos_width",value:""},{param_name:"pos_height",value:""},{param_name:"pos_zindex",value:""}]}),window.dxprBuilder.dxpr_elements.push({base:"az_well",params:[{param_name:"type",value:""},{param_name:"an_start",value:""},{param_name:"an_in",value:""},{param_name:"an_out",value:""},{param_name:"an_hidden",value:""},{param_name:"an_infinite",value:""},{param_name:"an_offset",value:"100"},{param_name:"an_duration",value:"1000"},{param_name:"an_in_delay",value:"0"},{param_name:"an_out_delay",value:"0"},{param_name:"an_parent",value:"1"},{param_name:"an_name",value:""},{param_name:"box_model",value:""},{param_name:"hash",value:""},{param_name:"el_class",value:""},{param_name:"style",value:""},{param_name:"shadow",value:"0"},{param_name:"hover_style",value:""},{param_name:"hover_shadow",value:"0"},{param_name:"pos_left",value:""},{param_name:"pos_right",value:""},{param_name:"pos_top",value:""},{param_name:"pos_bottom",value:""},{param_name:"pos_width",value:""},{param_name:"pos_height",value:""},{param_name:"pos_zindex",value:""}],is_container:!0}),window.dxprBuilder.dxpr_elements.push({base:"st_social",params:[{param_name:"st_social_links",value:"Facebook='https://www.facebook.com/'\nYouTube='https://www.youtube.com/'"},{param_name:"st_type",value:""},{param_name:"st_style",value:""},{param_name:"st_size",value:""},{param_name:"st_theme_color",value:""},{param_name:"st_color",value:""},{param_name:"st_theme_bgcolor",value:""},{param_name:"st_bgcolor",value:""},{param_name:"st_css3_hover_effects",value:""},{param_name:"an_start",value:""},{param_name:"an_in",value:""},{param_name:"an_out",value:""},{param_name:"an_hidden",value:""},{param_name:"an_infinite",value:""},{param_name:"an_offset",value:"100"},{param_name:"an_duration",value:"1000"},{param_name:"an_in_delay",value:"0"},{param_name:"an_out_delay",value:"0"},{param_name:"an_parent",value:"1"},{param_name:"an_name",value:""},{param_name:"box_model",value:""},{param_name:"hash",value:""},{param_name:"el_class",value:""},{param_name:"style",value:""},{param_name:"shadow",value:"0"},{param_name:"hover_style",value:""},{param_name:"hover_shadow",value:"0"},{param_name:"pos_left",value:""},{param_name:"pos_right",value:""},{param_name:"pos_top",value:""},{param_name:"pos_bottom",value:""},{param_name:"pos_width",value:""},{param_name:"pos_height",value:""},{param_name:"pos_zindex",value:""}]}),function(){if("dxpr_elements"in window.dxprBuilder)for(var a=0;a<window.dxprBuilder.dxpr_elements.length;a++){var e=window.dxprBuilder.dxpr_elements[a],n=function(a,e){n.baseclass.apply(this,arguments)};d(e.base,e.is_container,n),e.baseclass=n.baseclass,e.params=e.params.concat(n.prototype.params),t(n.prototype,e);for(var r=0;r<n.prototype.params.length;r++){var s=o(n.prototype.params[r]);n.prototype.params[r]=s}}}(),function(){if("dxpr_extend"in window.dxprBuilder)for(var a in window.dxprBuilder.dxpr_extend){var e=window.dxprBuilder.dxpr_extend[a],n=[];"params"in e&&(n=e.params),delete e.params;var r=m.prototype.elements[a];if(!("extended"in r)){r.extended=!0,t(r.prototype,e);for(var s=0;s<n.length;s++){var l=o(n[s]);r.prototype.params.push(l)}}}}(),a(document).ready((function(){a('[data-az-mode="dynamic"]').each((function(){!function(e){if(a(e).length>0){var t=a(e).html();if(/^\s*\<[\s\S]*\>\s*$/.exec(t)||""==t&&drupalSettings.dxprBuilder.dxprAjaxUrl){if(a(e).find("> script").detach().appendTo("head"),a(e).find("> link[href]").detach().appendTo("head"),(r=new c(null,!1)).attrs.container=a(e).attr("data-az-type")+"/"+a(e).attr("data-az-name"),r.attrs.langcode=a(e).attr("data-az-langcode"),a(e).attr("data-az-human-readable")&&(r.attrs.human_readable=atob(a(e).attr("data-az-human-readable"))),r.dom_element=a(e),a(r.dom_element).attr("data-az-id",r.id),a(r.dom_element).attr("data-azb",r.base),a(r.dom_element).attr("data-az-human-readable",r.name),r.dom_content_element=a(e),a(r.dom_element).css("display",""),a(r.dom_element).addClass("dxpr"),a(r.dom_element).addClass("az-ctnr"),r.parse_html(r.dom_content_element),r.html_content=!0,r.loaded_container=r.attrs.container,!window.dxprBuilder.dxpr_frontend){for(var n=0;n<r.children.length;n++)r.children[n].recursive_render();r.dom_content_element.empty(),drupalSettings.dxprBuilder.dxprEditor&&(r.show_controls(),r.update_sortable()),r.attach_children()}for(r.rendered=!0,n=0;n<r.children.length;n++)r.children[n].recursive_showed()}else{var r;""!=t.replace(/^\s+|\s+$/g,"")&&(window.dxprBuilder.dxpr_containers_loaded[a(e).attr("data-az-type")+"/"+a(e).attr("data-az-name")]=t.replace(/^\s+|\s+$/g,"")),(r=new c(null,!1)).attrs.container=a(e).attr("data-az-type")+"/"+a(e).attr("data-az-name"),r.attrs.langcode=a(e).attr("data-az-langcode"),r.render(a);var o=a(r.dom_element).attr("class")+" "+a(e).attr("class");o=a.unique(o.split(" ")).join(" "),a(r.dom_element).attr("class",o),a(r.dom_element).attr("style",a(e).attr("style")),a(r.dom_element).css("display",""),a(r.dom_element).addClass("dxpr"),a(r.dom_element).addClass("az-ctnr");var s=a(e).attr("data-az-type"),m=a(e).attr("data-az-name");a(e).replaceWith(r.dom_element),a(r.dom_element).attr("data-az-type",s),a(r.dom_element).attr("data-az-name",m),r.showed(a),drupalSettings.dxprBuilder.dxprEditor&&r.show_controls()}return drupalSettings.dxprBuilder.dxprEditor&&(a(r.dom_element).addClass("dxpr-editor"),a(r.dom_element).on("click contextmenu touchstart",{language:r.attrs.langcode},ClickEvent.undefinedClickHandler.bind(r))),r}}(a(this))}))})),window.dxprBuilder.attachBehaviors=function(a){a=a||document;var e=dxprBuilder.behaviors||{};Object.keys(e).forEach((function(t){if("function"==typeof e[t].attach)try{e[t].attach(a)}catch(a){console.log(a)}}))},window.dxprBuilder.smoothScroll=function(e){e=e||".az-container";let t=window.location.hash,n=a(t,e);if(n.length<1)return!1;var r=n.closest(".az-tabs");if(r.length>0){if(a('ul.nav-tabs a[href="'+t+'"]',r).length>0)a('ul.nav-tabs a[href="'+t+'"]',r).tab("show");else{var o=a(t,s).closest(".az-tab").attr("id");a('ul.nav-tabs a[href="#'+o+'"]',r).tab("show")}n="3"===bootstrapVersion()?a("li.active",r):a("li .active",r)}var s=n.closest(".az-toggle");if(s.length>0){if(a(t+".az-toggle").length>0)a(t+"-collapse",s).collapse("show");else{var m=a(t,s).closest(".az-toggle").attr("id");a("#"+m+"-collapse").collapse("show")}n=n.parent()}var l=n.closest(".az-slide");if(l.length>0){if(a(t+".az-slide").length>0)var i=Array.prototype.indexOf.call(document.getElementById(t.substring(1)).parentNode.parentNode.children,document.getElementById(t.substring(1)).parentNode);else i=Array.prototype.indexOf.call(a(t,l).closest(".az-slide")[0].parentNode.parentNode.children,a(t,l).closest(".az-slide")[0].parentNode);let e=a(t).closest(".owl-carousel").data("owlCarousel");e.reinit({afterInit:a=>{e.goTo(i)}})}let _=window.innerWidth>480?get_sticky_height():0;setTimeout((function(){a("html, body").animate({scrollTop:n.offset().top-_-5},300)}),300)},a(document).ready((function(){var e=".az-container ";location.hash&&a(location.hash,e).length>0&&(window.scrollTo(0,0),setTimeout((function(){dxprBuilder.smoothScroll(e)}),1500)),a(document).on("click",e+'a[href^="#"]',(function(t){if("tab"==a(this).attr("role")||"collapse"==a(this).attr("data-toggle"))return!1;t.preventDefault(),history.pushState(null,null,a.attr(this,"href")),dxprBuilder.smoothScroll(e)}))})))}(window.jQuery);;
/**
 * @file
 * Progress bar.
 */

(function ($, Drupal) {
  /**
   * Theme function for the progress bar.
   *
   * @param {string} id
   *   The id for the progress bar.
   *
   * @return {string}
   *   The HTML for the progress bar.
   */
  Drupal.theme.progressBar = function (id) {
    return (
      `<div id="${id}" class="progress" aria-live="polite">` +
      '<div class="progress__label">&nbsp;</div>' +
      '<div class="progress__track"><div class="progress__bar"></div></div>' +
      '<div class="progress__percentage"></div>' +
      '<div class="progress__description">&nbsp;</div>' +
      '</div>'
    );
  };

  /**
   * A progressbar object. Initialized with the given id. Must be inserted into
   * the DOM afterwards through progressBar.element.
   *
   * Method is the function which will perform the HTTP request to get the
   * progress bar state. Either "GET" or "POST".
   *
   * @example
   * pb = new Drupal.ProgressBar('myProgressBar');
   * some_element.appendChild(pb.element);
   *
   * @constructor
   *
   * @param {string} id
   *   The id for the progressbar.
   * @param {function} updateCallback
   *   Callback to run on update.
   * @param {string} method
   *   HTTP method to use.
   * @param {function} errorCallback
   *   Callback to call on error.
   */
  Drupal.ProgressBar = function (id, updateCallback, method, errorCallback) {
    this.id = id;
    this.method = method || 'GET';
    this.updateCallback = updateCallback;
    this.errorCallback = errorCallback;

    // The WAI-ARIA setting aria-live="polite" will announce changes after
    // users
    // have completed their current activity and not interrupt the screen
    // reader.
    this.element = $(Drupal.theme('progressBar', id));
  };

  $.extend(
    Drupal.ProgressBar.prototype,
    /** @lends Drupal.ProgressBar# */ {
      /**
       * Set the percentage and status message for the progressbar.
       *
       * @param {number} percentage
       *   The progress percentage.
       * @param {string} message
       *   The message to show the user.
       * @param {string} label
       *   The text for the progressbar label.
       */
      setProgress(percentage, message, label) {
        if (percentage >= 0 && percentage <= 100) {
          $(this.element)
            .find('div.progress__bar')
            .css('width', `${percentage}%`);
          $(this.element)
            .find('div.progress__percentage')
            .html(`${percentage}%`);
        }
        $('div.progress__description', this.element).html(message);
        $('div.progress__label', this.element).html(label);
        if (this.updateCallback) {
          this.updateCallback(percentage, message, this);
        }
      },

      /**
       * Start monitoring progress via Ajax.
       *
       * @param {string} uri
       *   The URI to use for monitoring.
       * @param {number} delay
       *   The delay for calling the monitoring URI.
       */
      startMonitoring(uri, delay) {
        this.delay = delay;
        this.uri = uri;
        this.sendPing();
      },

      /**
       * Stop monitoring progress via Ajax.
       */
      stopMonitoring() {
        clearTimeout(this.timer);
        // This allows monitoring to be stopped from within the callback.
        this.uri = null;
      },

      /**
       * Request progress data from server.
       */
      sendPing() {
        if (this.timer) {
          clearTimeout(this.timer);
        }
        if (this.uri) {
          const pb = this;
          // When doing a post request, you need non-null data. Otherwise a
          // HTTP 411 or HTTP 406 (with Apache mod_security) error may result.
          let uri = this.uri;
          if (uri.indexOf('?') === -1) {
            uri += '?';
          } else {
            uri += '&';
          }
          uri += '_format=json';
          $.ajax({
            type: this.method,
            url: uri,
            data: '',
            dataType: 'json',
            success(progress) {
              // Display errors.
              if (progress.status === 0) {
                pb.displayError(progress.data);
                return;
              }
              // Update display.
              pb.setProgress(
                progress.percentage,
                progress.message,
                progress.label,
              );
              // Schedule next timer.
              pb.timer = setTimeout(() => {
                pb.sendPing();
              }, pb.delay);
            },
            error(xmlhttp) {
              const e = new Drupal.AjaxError(xmlhttp, pb.uri);
              pb.displayError(`<pre>${e.message}</pre>`);
            },
          });
        }
      },

      /**
       * Display errors on the page.
       *
       * @param {string} string
       *   The error message to show the user.
       */
      displayError(string) {
        const error = $('<div class="messages messages--error"></div>').html(
          string,
        );
        $(this.element).before(error).hide();

        if (this.errorCallback) {
          this.errorCallback(this);
        }
      },
    },
  );
})(jQuery, Drupal);
;
/**
 * @file
 * Extends methods from core/misc/progress.js.
 */

(function ($, Drupal) {

  'use strict';

  /**
   * Theme function for the progress bar.
   *
   * @param {string} id
   *
   * @return {string}
   *   The HTML for the progress bar.
   */
  Drupal.theme.progressBar = function (id) {
    return '<div class="progress-wrapper" aria-live="polite">' +
             '<div class="message"></div>'+
             '<div id ="' + id + '" class="progress progress-striped active">' +
               '<div class="progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">' +
                 '<span class="percentage"></span>' +
               '</div>' +
             '</div>' +
             '<div class="progress-label"></div>' +
           '</div>';
  };

  $.extend(Drupal.ProgressBar.prototype, /** @lends Drupal.ProgressBar */{

    /**
     * Set the percentage and status message for the progressbar.
     *
     * @param {number} percentage
     * @param {string} message
     * @param {string} label
     */
    setProgress: function (percentage, message, label) {
      if (percentage >= 0 && percentage <= 100) {
        $(this.element).find('.progress-bar').css('width', percentage + '%').attr('aria-valuenow', percentage);
        $(this.element).find('.percentage').html(percentage + '%');
      }
      if (message) {
        // Remove the unnecessary whitespace at the end of the message.
        message = message.replace(/<br\/>&nbsp;|\s*$/, '');

        $('.message', this.element).html(message);
      }
      if (label) {
        $('.progress-label', this.element).html(label);
      }
      if (this.updateCallback) {
        this.updateCallback(percentage, message, this);
      }
    },

    /**
     * Display errors on the page.
     *
     * @param {string} string
     */
    displayError: function (string) {
      var error = $('<div class="alert alert-block alert-error"><button class="close" data-dismiss="alert">&times;</button><h4>' + Drupal.t('Error message') + '</h4></div>').append(string);
      $(this.element).before(error).hide();

      if (this.errorCallback) {
        this.errorCallback(this);
      }
    }
  });

})(jQuery, Drupal);
;
loadjs=function(){var h=function(){},c={},u={},f={};function o(e,n){if(e){var r=f[e];if(u[e]=n,r)for(;r.length;)r[0](e,n),r.splice(0,1)}}function l(e,n){e.call&&(e={success:e}),n.length?(e.error||h)(n):(e.success||h)(e)}function d(r,t,s,i){var c,o,e=document,n=s.async,u=(s.numRetries||0)+1,f=s.before||h,l=r.replace(/[\?|#].*$/,""),a=r.replace(/^(css|img)!/,"");i=i||0,/(^css!|\.css$)/.test(l)?((o=e.createElement("link")).rel="stylesheet",o.href=a,(c="hideFocus"in o)&&o.relList&&(c=0,o.rel="preload",o.as="style")):/(^img!|\.(png|gif|jpg|svg|webp)$)/.test(l)?(o=e.createElement("img")).src=a:((o=e.createElement("script")).src=r,o.async=void 0===n||n),!(o.onload=o.onerror=o.onbeforeload=function(e){var n=e.type[0];if(c)try{o.sheet.cssText.length||(n="e")}catch(e){18!=e.code&&(n="e")}if("e"==n){if((i+=1)<u)return d(r,t,s,i)}else if("preload"==o.rel&&"style"==o.as)return o.rel="stylesheet";t(r,n,e.defaultPrevented)})!==f(r,o)&&e.head.appendChild(o)}function r(e,n,r){var t,s;if(n&&n.trim&&(t=n),s=(t?r:n)||{},t){if(t in c)throw"LoadJS";c[t]=!0}function i(n,r){!function(e,t,n){var r,s,i=(e=e.push?e:[e]).length,c=i,o=[];for(r=function(e,n,r){if("e"==n&&o.push(e),"b"==n){if(!r)return;o.push(e)}--i||t(o)},s=0;s<c;s++)d(e[s],r,n)}(e,function(e){l(s,e),n&&l({success:n,error:r},e),o(t,e)},s)}if(s.returnPromise)return new Promise(i);i()}return r.ready=function(e,n){return function(e,r){e=e.push?e:[e];var n,t,s,i=[],c=e.length,o=c;for(n=function(e,n){n.length&&i.push(e),--o||r(i)};c--;)t=e[c],(s=u[t])?n(t,s):(f[t]=f[t]||[]).push(n)}(e,function(e){l(n,e)}),r},r.done=function(e){o(e,[])},r.reset=function(){c={},u={},f={}},r.isDefined=function(e){return e in c},r}();;
/**
 * @file
 * Provides Ajax page updating via jQuery $.ajax.
 *
 * Ajax is a method of making a request via JavaScript while viewing an HTML
 * page. The request returns an array of commands encoded in JSON, which is
 * then executed to make any changes that are necessary to the page.
 *
 * Drupal uses this file to enhance form elements with `#ajax['url']` and
 * `#ajax['wrapper']` properties. If set, this file will automatically be
 * included to provide Ajax capabilities.
 */

(function (
  $,
  window,
  Drupal,
  drupalSettings,
  loadjs,
  { isFocusable, tabbable },
) {
  /**
   * Attaches the Ajax behavior to each Ajax form element.
   *
   * @type {Drupal~behavior}
   *
   * @prop {Drupal~behaviorAttach} attach
   *   Initialize all {@link Drupal.Ajax} objects declared in
   *   `drupalSettings.ajax` or initialize {@link Drupal.Ajax} objects from
   *   DOM elements having the `use-ajax-submit` or `use-ajax` css class.
   * @prop {Drupal~behaviorDetach} detach
   *   During `unload` remove all {@link Drupal.Ajax} objects related to
   *   the removed content.
   */
  Drupal.behaviors.AJAX = {
    attach(context, settings) {
      function loadAjaxBehavior(base) {
        const elementSettings = settings.ajax[base];
        if (typeof elementSettings.selector === 'undefined') {
          elementSettings.selector = `#${base}`;
        }
        // Use jQuery selector instead of a native selector for
        // backwards compatibility.
        once('drupal-ajax', $(elementSettings.selector)).forEach((el) => {
          elementSettings.element = el;
          elementSettings.base = base;
          Drupal.ajax(elementSettings);
        });
      }

      // Load all Ajax behaviors specified in the settings.
      Object.keys(settings.ajax || {}).forEach(loadAjaxBehavior);

      Drupal.ajax.bindAjaxLinks(document.body);

      // This class means to submit the form to the action using Ajax.
      once('ajax', '.use-ajax-submit').forEach((el) => {
        const elementSettings = {};

        // Ajax submits specified in this manner automatically submit to the
        // normal form action.
        elementSettings.url = $(el.form).attr('action');
        // Form submit button clicks need to tell the form what was clicked so
        // it gets passed in the POST request.
        elementSettings.setClick = true;
        // Form buttons use the 'click' event rather than mousedown.
        elementSettings.event = 'click';
        // Clicked form buttons look better with the throbber than the progress
        // bar.
        elementSettings.progress = { type: 'throbber' };
        elementSettings.base = el.id;
        elementSettings.element = el;

        Drupal.ajax(elementSettings);
      });
    },

    detach(context, settings, trigger) {
      if (trigger === 'unload') {
        Drupal.ajax.expired().forEach((instance) => {
          // Set this to null and allow garbage collection to reclaim
          // the memory.
          Drupal.ajax.instances[instance.instanceIndex] = null;
        });
      }
    },
  };

  /**
   * Extends Error to provide handling for Errors in Ajax.
   *
   * @constructor
   *
   * @augments Error
   *
   * @param {XMLHttpRequest} xmlhttp
   *   XMLHttpRequest object used for the failed request.
   * @param {string} uri
   *   The URI where the error occurred.
   * @param {string} customMessage
   *   The custom message.
   */
  Drupal.AjaxError = function (xmlhttp, uri, customMessage) {
    let statusCode;
    let statusText;
    let responseText;
    if (xmlhttp.status) {
      statusCode = `\n${Drupal.t('An AJAX HTTP error occurred.')}\n${Drupal.t(
        'HTTP Result Code: !status',
        {
          '!status': xmlhttp.status,
        },
      )}`;
    } else {
      statusCode = `\n${Drupal.t(
        'An AJAX HTTP request terminated abnormally.',
      )}`;
    }
    statusCode += `\n${Drupal.t('Debugging information follows.')}`;
    const pathText = `\n${Drupal.t('Path: !uri', { '!uri': uri })}`;
    statusText = '';
    // In some cases, when statusCode === 0, xmlhttp.statusText may not be
    // defined. Unfortunately, testing for it with typeof, etc, doesn't seem to
    // catch that and the test causes an exception. So we need to catch the
    // exception here.
    try {
      statusText = `\n${Drupal.t('StatusText: !statusText', {
        '!statusText': xmlhttp.statusText.trim(),
      })}`;
    } catch (e) {
      // Empty.
    }

    responseText = '';
    // Again, we don't have a way to know for sure whether accessing
    // xmlhttp.responseText is going to throw an exception. So we'll catch it.
    try {
      responseText = `\n${Drupal.t('ResponseText: !responseText', {
        '!responseText': xmlhttp.responseText.trim(),
      })}`;
    } catch (e) {
      // Empty.
    }

    // Make the responseText more readable by stripping HTML tags and newlines.
    responseText = responseText.replace(/<("[^"]*"|'[^']*'|[^'">])*>/gi, '');
    responseText = responseText.replace(/[\n]+\s+/g, '\n');

    // We don't need readyState except for status == 0.
    const readyStateText =
      xmlhttp.status === 0
        ? `\n${Drupal.t('ReadyState: !readyState', {
            '!readyState': xmlhttp.readyState,
          })}`
        : '';

    customMessage = customMessage
      ? `\n${Drupal.t('CustomMessage: !customMessage', {
          '!customMessage': customMessage,
        })}`
      : '';

    /**
     * Formatted and translated error message.
     *
     * @type {string}
     */
    this.message =
      statusCode +
      pathText +
      statusText +
      customMessage +
      responseText +
      readyStateText;

    /**
     * Used by some browsers to display a more accurate stack trace.
     *
     * @type {string}
     */
    this.name = 'AjaxError';
  };

  Drupal.AjaxError.prototype = new Error();
  Drupal.AjaxError.prototype.constructor = Drupal.AjaxError;

  /**
   * Provides Ajax page updating via jQuery $.ajax.
   *
   * This function is designed to improve developer experience by wrapping the
   * initialization of {@link Drupal.Ajax} objects and storing all created
   * objects in the {@link Drupal.ajax.instances} array.
   *
   * @example
   * Drupal.behaviors.myCustomAJAXStuff = {
   *   attach: function (context, settings) {
   *
   *     var ajaxSettings = {
   *       url: 'my/url/path',
   *       // If the old version of Drupal.ajax() needs to be used those
   *       // properties can be added
   *       base: 'myBase',
   *       element: $(context).find('.someElement')
   *     };
   *
   *     var myAjaxObject = Drupal.ajax(ajaxSettings);
   *
   *     // Declare a new Ajax command specifically for this Ajax object.
   *     myAjaxObject.commands.insert = function (ajax, response, status) {
   *       $('#my-wrapper').append(response.data);
   *       alert('New content was appended to #my-wrapper');
   *     };
   *
   *     // This command will remove this Ajax object from the page.
   *     myAjaxObject.commands.destroyObject = function (ajax, response, status) {
   *       Drupal.ajax.instances[this.instanceIndex] = null;
   *     };
   *
   *     // Programmatically trigger the Ajax request.
   *     myAjaxObject.execute();
   *   }
   * };
   *
   * @param {object} settings
   *   The settings object passed to {@link Drupal.Ajax} constructor.
   * @param {string} [settings.base]
   *   Base is passed to {@link Drupal.Ajax} constructor as the 'base'
   *   parameter.
   * @param {HTMLElement} [settings.element]
   *   Element parameter of {@link Drupal.Ajax} constructor, element on which
   *   event listeners will be bound.
   *
   * @return {Drupal.Ajax}
   *   The created Ajax object.
   *
   * @see Drupal.AjaxCommands
   */
  Drupal.ajax = function (settings) {
    if (arguments.length !== 1) {
      throw new Error(
        'Drupal.ajax() function must be called with one configuration object only',
      );
    }
    // Map those config keys to variables for the old Drupal.ajax function.
    const base = settings.base || false;
    const element = settings.element || false;
    delete settings.base;
    delete settings.element;

    // By default do not display progress for ajax calls without an element.
    if (!settings.progress && !element) {
      settings.progress = false;
    }

    const ajax = new Drupal.Ajax(base, element, settings);
    ajax.instanceIndex = Drupal.ajax.instances.length;
    Drupal.ajax.instances.push(ajax);

    return ajax;
  };

  /**
   * Contains all created Ajax objects.
   *
   * @type {Array.<Drupal.Ajax|null>}
   */
  Drupal.ajax.instances = [];

  /**
   * List all objects where the associated element is not in the DOM
   *
   * This method ignores {@link Drupal.Ajax} objects not bound to DOM elements
   * when created with {@link Drupal.ajax}.
   *
   * @return {Array.<Drupal.Ajax>}
   *   The list of expired {@link Drupal.Ajax} objects.
   */
  Drupal.ajax.expired = function () {
    return Drupal.ajax.instances.filter(
      (instance) =>
        instance &&
        instance.element !== false &&
        !document.body.contains(instance.element),
    );
  };

  /**
   * Bind Ajax functionality to links that use the 'use-ajax' class.
   *
   * @param {HTMLElement} element
   *   Element to enable Ajax functionality for.
   */
  Drupal.ajax.bindAjaxLinks = (element) => {
    // Bind Ajax behaviors to all items showing the class.
    once('ajax', '.use-ajax', element).forEach((ajaxLink) => {
      const $linkElement = $(ajaxLink);

      const elementSettings = {
        // Clicked links look better with the throbber than the progress bar.
        progress: { type: 'throbber' },
        dialogType: $linkElement.data('dialog-type'),
        dialog: $linkElement.data('dialog-options'),
        dialogRenderer: $linkElement.data('dialog-renderer'),
        base: $linkElement.attr('id'),
        element: ajaxLink,
      };
      const href = $linkElement.attr('href');
      /**
       * For anchor tags, these will go to the target of the anchor rather than
       * the usual location.
       */
      if (href) {
        elementSettings.url = href;
        elementSettings.event = 'click';
      }
      Drupal.ajax(elementSettings);
    });
  };

  /**
   * Settings for an Ajax object.
   *
   * @typedef {object} Drupal.Ajax~elementSettings
   *
   * @prop {string} url
   *   Target of the Ajax request.
   * @prop {?string} [event]
   *   Event bound to settings.element which will trigger the Ajax request.
   * @prop {boolean} [keypress=true]
   *   Triggers a request on keypress events.
   * @prop {?string} selector
   *   jQuery selector targeting the element to bind events to or used with
   *   {@link Drupal.AjaxCommands}.
   * @prop {string} [effect='none']
   *   Name of the jQuery method to use for displaying new Ajax content.
   * @prop {string|number} [speed='none']
   *   Speed with which to apply the effect.
   * @prop {string} [method]
   *   Name of the jQuery method used to insert new content in the targeted
   *   element.
   * @prop {object} [progress]
   *   Settings for the display of a user-friendly loader.
   * @prop {string} [progress.type='throbber']
   *   Type of progress element, core provides `'bar'`, `'throbber'` and
   *   `'fullscreen'`.
   * @prop {string} [progress.message=Drupal.t('Please wait...')]
   *   Custom message to be used with the bar indicator.
   * @prop {object} [submit]
   *   Extra data to be sent with the Ajax request.
   * @prop {boolean} [submit.js=true]
   *   Allows the PHP side to know this comes from an Ajax request.
   * @prop {object} [dialog]
   *   Options for {@link Drupal.dialog}.
   * @prop {string} [dialogType]
   *   One of `'modal'` or `'dialog'`.
   * @prop {string} [prevent]
   *   List of events on which to stop default action and stop propagation.
   */

  /**
   * Ajax constructor.
   *
   * The Ajax request returns an array of commands encoded in JSON, which is
   * then executed to make any changes that are necessary to the page.
   *
   * Drupal uses this file to enhance form elements with `#ajax['url']` and
   * `#ajax['wrapper']` properties. If set, this file will automatically be
   * included to provide Ajax capabilities.
   *
   * @constructor
   *
   * @param {string} [base]
   *   Base parameter of {@link Drupal.Ajax} constructor
   * @param {HTMLElement} [element]
   *   Element parameter of {@link Drupal.Ajax} constructor, element on which
   *   event listeners will be bound.
   * @param {Drupal.Ajax~elementSettings} elementSettings
   *   Settings for this Ajax object.
   */
  Drupal.Ajax = function (base, element, elementSettings) {
    const defaults = {
      event: element ? 'mousedown' : null,
      keypress: true,
      selector: base ? `#${base}` : null,
      effect: 'none',
      speed: 'none',
      method: 'replaceWith',
      progress: {
        type: 'throbber',
        message: Drupal.t('Please wait...'),
      },
      submit: {
        js: true,
      },
    };

    $.extend(this, defaults, elementSettings);

    /**
     * @type {Drupal.AjaxCommands}
     */
    this.commands = new Drupal.AjaxCommands();

    /**
     * @type {boolean|number}
     */
    this.instanceIndex = false;

    // @todo Remove this after refactoring the PHP code to:
    //   - Call this 'selector'.
    //   - Include the '#' for ID-based selectors.
    //   - Support non-ID-based selectors.
    if (this.wrapper) {
      /**
       * @type {string}
       */
      this.wrapper = `#${this.wrapper}`;
    }

    /**
     * @type {HTMLElement}
     */
    this.element = element;

    /**
     * @type {Drupal.Ajax~elementSettings}
     */
    this.elementSettings = elementSettings;

    // If there isn't a form, jQuery.ajax() will be used instead, allowing us to
    // bind Ajax to links as well.
    if (this.element && this.element.form) {
      /**
       * @type {jQuery}
       */
      this.$form = $(this.element.form);
    }

    // If no Ajax callback URL was given, use the link href or form action.
    if (!this.url) {
      const $element = $(this.element);
      if ($element.is('a')) {
        this.url = $element.attr('href');
      } else if (this.element && element.form) {
        this.url = this.$form.attr('action');
      }
    }

    // Replacing 'nojs' with 'ajax' in the URL allows for an easy method to let
    // the server detect when it needs to degrade gracefully.
    // There are four scenarios to check for:
    // 1. /nojs/
    // 2. /nojs$ - The end of a URL string.
    // 3. /nojs? - Followed by a query (e.g. path/nojs?destination=foobar).
    // 4. /nojs# - Followed by a fragment (e.g.: path/nojs#my-fragment).
    const originalUrl = this.url;

    /**
     * Processed Ajax URL.
     *
     * @type {string}
     */
    this.url = this.url.replace(/\/nojs(\/|$|\?|#)/, '/ajax$1');
    // If the 'nojs' version of the URL is trusted, also trust the 'ajax'
    // version.
    if (drupalSettings.ajaxTrustedUrl[originalUrl]) {
      drupalSettings.ajaxTrustedUrl[this.url] = true;
    }

    // Set the options for the ajaxSubmit function.
    // The 'this' variable will not persist inside of the options object.
    const ajax = this;

    /**
     * Options for the jQuery.ajax function.
     *
     * @name Drupal.Ajax#options
     *
     * @type {object}
     *
     * @prop {string} url
     *   Ajax URL to be called.
     * @prop {object} data
     *   Ajax payload.
     * @prop {function} beforeSerialize
     *   Implement jQuery beforeSerialize function to call
     *   {@link Drupal.Ajax#beforeSerialize}.
     * @prop {function} beforeSubmit
     *   Implement jQuery beforeSubmit function to call
     *   {@link Drupal.Ajax#beforeSubmit}.
     * @prop {function} beforeSend
     *   Implement jQuery beforeSend function to call
     *   {@link Drupal.Ajax#beforeSend}.
     * @prop {function} success
     *   Implement jQuery success function to call
     *   {@link Drupal.Ajax#success}.
     * @prop {function} complete
     *   Implement jQuery success function to clean up ajax state and trigger an
     *   error if needed.
     * @prop {string} dataType='json'
     *   Type of the response expected.
     * @prop {string} type='POST'
     *   HTTP method to use for the Ajax request.
     */
    ajax.options = {
      url: ajax.url,
      data: ajax.submit,
      isInProgress() {
        return ajax.ajaxing;
      },
      beforeSerialize(elementSettings, options) {
        return ajax.beforeSerialize(elementSettings, options);
      },
      beforeSubmit(formValues, elementSettings, options) {
        ajax.ajaxing = true;
        return ajax.beforeSubmit(formValues, elementSettings, options);
      },
      beforeSend(xmlhttprequest, options) {
        ajax.ajaxing = true;
        return ajax.beforeSend(xmlhttprequest, options);
      },
      success(response, status, xmlhttprequest) {
        // Sanity check for browser support (object expected).
        // When using iFrame uploads, responses must be returned as a string.
        if (typeof response === 'string') {
          response = $.parseJSON(response);
        }

        // Prior to invoking the response's commands, verify that they can be
        // trusted by checking for a response header. See
        // \Drupal\Core\EventSubscriber\AjaxResponseSubscriber for details.
        // - Empty responses are harmless so can bypass verification. This
        //   avoids an alert message for server-generated no-op responses that
        //   skip Ajax rendering.
        // - Ajax objects with trusted URLs (e.g., ones defined server-side via
        //   #ajax) can bypass header verification. This is especially useful
        //   for Ajax with multipart forms. Because IFRAME transport is used,
        //   the response headers cannot be accessed for verification.
        if (response !== null && !drupalSettings.ajaxTrustedUrl[ajax.url]) {
          if (xmlhttprequest.getResponseHeader('X-Drupal-Ajax-Token') !== '1') {
            const customMessage = Drupal.t(
              'The response failed verification so will not be processed.',
            );
            return ajax.error(xmlhttprequest, ajax.url, customMessage);
          }
        }

        return (
          // Ensure that the return of the success callback is a Promise.
          // When the return is a Promise, using resolve will unwrap it, and
          // when the return is not a Promise we make sure it can be used as
          // one. This is useful for code that overrides the success method.
          Promise.resolve(ajax.success(response, status))
            // Ajaxing status is back to false when all the AJAX commands have
            // finished executing.
            .then(() => {
              ajax.ajaxing = false;
              // jQuery normally triggers the ajaxSuccess, ajaxComplete, and
              // ajaxStop events after the "success" function passed to $.ajax()
              // returns, but we prevented that via
              // $.event.special[EVENT_NAME].trigger in order to wait for the
              // commands to finish executing. Now that they have, re-trigger
              // those events.
              $(document).trigger('ajaxSuccess', [xmlhttprequest, this]);
              $(document).trigger('ajaxComplete', [xmlhttprequest, this]);
              if (--$.active === 0) {
                $(document).trigger('ajaxStop');
              }
            })
        );
      },
      error(xmlhttprequest, status, error) {
        ajax.ajaxing = false;
      },
      complete(xmlhttprequest, status) {
        if (status === 'error' || status === 'parsererror') {
          return ajax.error(xmlhttprequest, ajax.url);
        }
      },
      dataType: 'json',
      jsonp: false,
      type: 'POST',
    };

    if (elementSettings.dialog) {
      ajax.options.data.dialogOptions = elementSettings.dialog;
    }

    // Ensure that we have a valid URL by adding ? when no query parameter is
    // yet available, otherwise append using &.
    if (ajax.options.url.indexOf('?') === -1) {
      ajax.options.url += '?';
    } else {
      ajax.options.url += '&';
    }
    // If this element has a dialog type use if for the wrapper if not use 'ajax'.
    let wrapper = `drupal_${elementSettings.dialogType || 'ajax'}`;
    if (elementSettings.dialogRenderer) {
      wrapper += `.${elementSettings.dialogRenderer}`;
    }
    ajax.options.url += `${Drupal.ajax.WRAPPER_FORMAT}=${wrapper}`;

    // Bind the ajaxSubmit function to the element event.
    $(ajax.element).on(elementSettings.event, function (event) {
      if (
        !drupalSettings.ajaxTrustedUrl[ajax.url] &&
        !Drupal.url.isLocal(ajax.url)
      ) {
        throw new Error(
          Drupal.t('The callback URL is not local and not trusted: !url', {
            '!url': ajax.url,
          }),
        );
      }
      return ajax.eventResponse(this, event);
    });

    // If necessary, enable keyboard submission so that Ajax behaviors
    // can be triggered through keyboard input as well as e.g. a mousedown
    // action.
    if (elementSettings.keypress) {
      $(ajax.element).on('keypress', function (event) {
        return ajax.keypressResponse(this, event);
      });
    }

    // If necessary, prevent the browser default action of an additional event.
    // For example, prevent the browser default action of a click, even if the
    // Ajax behavior binds to mousedown.
    if (elementSettings.prevent) {
      $(ajax.element).on(elementSettings.prevent, false);
    }
  };

  /**
   * URL query attribute to indicate the wrapper used to render a request.
   *
   * The wrapper format determines how the HTML is wrapped, for example in a
   * modal dialog.
   *
   * @const {string}
   *
   * @default
   */
  Drupal.ajax.WRAPPER_FORMAT = '_wrapper_format';

  /**
   * Request parameter to indicate that a request is a Drupal Ajax request.
   *
   * @const {string}
   *
   * @default
   */
  Drupal.Ajax.AJAX_REQUEST_PARAMETER = '_drupal_ajax';

  /**
   * Execute the ajax request.
   *
   * Allows developers to execute an Ajax request manually without specifying
   * an event to respond to.
   *
   * @return {object}
   *   Returns the jQuery.Deferred object underlying the Ajax request. If
   *   pre-serialization fails, the Deferred will be returned in the rejected
   *   state.
   */
  Drupal.Ajax.prototype.execute = function () {
    // Do not perform another ajax command if one is already in progress.
    if (this.ajaxing) {
      return;
    }

    try {
      this.beforeSerialize(this.element, this.options);
      // Return the jqXHR so that external code can hook into the Deferred API.
      return $.ajax(this.options);
    } catch (e) {
      // Unset the ajax.ajaxing flag here because it won't be unset during
      // the complete response.
      this.ajaxing = false;
      window.alert(
        `An error occurred while attempting to process ${this.options.url}: ${e.message}`,
      );
      // For consistency, return a rejected Deferred (i.e., jqXHR's superclass)
      // so that calling code can take appropriate action.
      return $.Deferred().reject();
    }
  };

  /**
   * Handle a key press.
   *
   * The Ajax object will, if instructed, bind to a key press response. This
   * will test to see if the key press is valid to trigger this event and
   * if it is, trigger it for us and prevent other keypresses from triggering.
   * In this case we're handling RETURN and SPACEBAR keypresses (event codes 13
   * and 32. RETURN is often used to submit a form when in a textfield, and
   * SPACE is often used to activate an element without submitting.
   *
   * @param {HTMLElement} element
   *   Element the event was triggered on.
   * @param {jQuery.Event} event
   *   Triggered event.
   */
  Drupal.Ajax.prototype.keypressResponse = function (element, event) {
    // Create a synonym for this to reduce code confusion.
    const ajax = this;

    // Detect enter key and space bar and allow the standard response for them,
    // except for form elements of type 'text', 'tel', 'number' and 'textarea',
    // where the spacebar activation causes inappropriate activation if
    // #ajax['keypress'] is TRUE. On a text-type widget a space should always
    // be a space.
    if (
      event.which === 13 ||
      (event.which === 32 &&
        element.type !== 'text' &&
        element.type !== 'textarea' &&
        element.type !== 'tel' &&
        element.type !== 'number')
    ) {
      event.preventDefault();
      event.stopPropagation();
      $(element).trigger(ajax.elementSettings.event);
    }
  };

  /**
   * Handle an event that triggers an Ajax response.
   *
   * When an event that triggers an Ajax response happens, this method will
   * perform the actual Ajax call. It is bound to the event using
   * bind() in the constructor, and it uses the options specified on the
   * Ajax object.
   *
   * @param {HTMLElement} element
   *   Element the event was triggered on.
   * @param {jQuery.Event} event
   *   Triggered event.
   */
  Drupal.Ajax.prototype.eventResponse = function (element, event) {
    event.preventDefault();
    event.stopPropagation();

    // Create a synonym for this to reduce code confusion.
    const ajax = this;

    // Do not perform another Ajax command if one is already in progress.
    if (ajax.ajaxing) {
      return;
    }

    try {
      if (ajax.$form) {
        // If setClick is set, we must set this to ensure that the button's
        // value is passed.
        if (ajax.setClick) {
          // Mark the clicked button. 'form.clk' is a special variable for
          // ajaxSubmit that tells the system which element got clicked to
          // trigger the submit. Without it there would be no 'op' or
          // equivalent.
          element.form.clk = element;
        }

        ajax.$form.ajaxSubmit(ajax.options);
      } else {
        ajax.beforeSerialize(ajax.element, ajax.options);
        $.ajax(ajax.options);
      }
    } catch (e) {
      // Unset the ajax.ajaxing flag here because it won't be unset during
      // the complete response.
      ajax.ajaxing = false;
      window.alert(
        `An error occurred while attempting to process ${ajax.options.url}: ${e.message}`,
      );
    }
  };

  /**
   * Handler for the form serialization.
   *
   * Runs before the beforeSend() handler (see below), and unlike that one, runs
   * before field data is collected.
   *
   * @param {object} [element]
   *   Ajax object's `elementSettings`.
   * @param {object} options
   *   jQuery.ajax options.
   */
  Drupal.Ajax.prototype.beforeSerialize = function (element, options) {
    // Allow detaching behaviors to update field values before collecting them.
    // This is only needed when field values are added to the POST data, so only
    // when there is a form such that this.$form.ajaxSubmit() is used instead of
    // $.ajax(). When there is no form and $.ajax() is used, beforeSerialize()
    // isn't called, but don't rely on that: explicitly check this.$form.
    if (this.$form && document.body.contains(this.$form.get(0))) {
      const settings = this.settings || drupalSettings;
      Drupal.detachBehaviors(this.$form.get(0), settings, 'serialize');
    }

    // Inform Drupal that this is an AJAX request.
    options.data[Drupal.Ajax.AJAX_REQUEST_PARAMETER] = 1;

    // Allow Drupal to return new JavaScript and CSS files to load without
    // returning the ones already loaded.
    // @see \Drupal\Core\Theme\AjaxBasePageNegotiator
    // @see \Drupal\Core\Asset\LibraryDependencyResolverInterface::getMinimalRepresentativeSubset()
    // @see system_js_settings_alter()
    const pageState = drupalSettings.ajaxPageState;
    options.data['ajax_page_state[theme]'] = pageState.theme;
    options.data['ajax_page_state[theme_token]'] = pageState.theme_token;
    options.data['ajax_page_state[libraries]'] = pageState.libraries;
  };

  /**
   * Modify form values prior to form submission.
   *
   * @param {Array.<object>} formValues
   *   Processed form values.
   * @param {jQuery} element
   *   The form node as a jQuery object.
   * @param {object} options
   *   jQuery.ajax options.
   */
  Drupal.Ajax.prototype.beforeSubmit = function (formValues, element, options) {
    // This function is left empty to make it simple to override for modules
    // that wish to add functionality here.
  };

  /**
   * Prepare the Ajax request before it is sent.
   *
   * @param {XMLHttpRequest} xmlhttprequest
   *   Native Ajax object.
   * @param {object} options
   *   jQuery.ajax options.
   */
  Drupal.Ajax.prototype.beforeSend = function (xmlhttprequest, options) {
    // For forms without file inputs, the jQuery Form plugin serializes the
    // form values, and then calls jQuery's $.ajax() function, which invokes
    // this handler. In this circumstance, options.extraData is never used. For
    // forms with file inputs, the jQuery Form plugin uses the browser's normal
    // form submission mechanism, but captures the response in a hidden IFRAME.
    // In this circumstance, it calls this handler first, and then appends
    // hidden fields to the form to submit the values in options.extraData.
    // There is no simple way to know which submission mechanism will be used,
    // so we add to extraData regardless, and allow it to be ignored in the
    // former case.
    if (this.$form) {
      options.extraData = options.extraData || {};

      // Let the server know when the IFRAME submission mechanism is used. The
      // server can use this information to wrap the JSON response in a
      // TEXTAREA, as per http://jquery.malsup.com/form/#file-upload.
      options.extraData.ajax_iframe_upload = '1';

      // The triggering element is about to be disabled (see below), but if it
      // contains a value (e.g., a checkbox, textfield, select, etc.), ensure
      // that value is included in the submission. As per above, submissions
      // that use $.ajax() are already serialized prior to the element being
      // disabled, so this is only needed for IFRAME submissions.
      const v = $.fieldValue(this.element);
      if (v !== null) {
        options.extraData[this.element.name] = v;
      }
    }

    // Disable the element that received the change to prevent user interface
    // interaction while the Ajax request is in progress. ajax.ajaxing prevents
    // the element from triggering a new request, but does not prevent the user
    // from changing its value.
    $(this.element).prop('disabled', true);

    if (!this.progress || !this.progress.type) {
      return;
    }

    // Insert progress indicator.
    const progressIndicatorMethod = `setProgressIndicator${this.progress.type
      .slice(0, 1)
      .toUpperCase()}${this.progress.type.slice(1).toLowerCase()}`;
    if (
      progressIndicatorMethod in this &&
      typeof this[progressIndicatorMethod] === 'function'
    ) {
      this[progressIndicatorMethod].call(this);
    }
  };

  /**
   * An animated progress throbber and container element for AJAX operations.
   *
   * @param {string} [message]
   *   (optional) The message shown on the UI.
   * @return {string}
   *   The HTML markup for the throbber.
   */
  Drupal.theme.ajaxProgressThrobber = (message) => {
    // Build markup without adding extra white space since it affects rendering.
    const messageMarkup =
      typeof message === 'string'
        ? Drupal.theme('ajaxProgressMessage', message)
        : '';
    const throbber = '<div class="throbber">&nbsp;</div>';

    return `<div class="ajax-progress ajax-progress-throbber">${throbber}${messageMarkup}</div>`;
  };

  /**
   * An animated progress throbber and container element for AJAX operations.
   *
   * @return {string}
   *   The HTML markup for the throbber.
   */
  Drupal.theme.ajaxProgressIndicatorFullscreen = () =>
    '<div class="ajax-progress ajax-progress-fullscreen">&nbsp;</div>';

  /**
   * Formats text accompanying the AJAX progress throbber.
   *
   * @param {string} message
   *   The message shown on the UI.
   * @return {string}
   *   The HTML markup for the throbber.
   */
  Drupal.theme.ajaxProgressMessage = (message) =>
    `<div class="message">${message}</div>`;

  /**
   * Provide a wrapper for the AJAX progress bar element.
   *
   * @param {jQuery} $element
   *   Progress bar element.
   * @return {string}
   *   The HTML markup for the progress bar.
   */
  Drupal.theme.ajaxProgressBar = ($element) =>
    $('<div class="ajax-progress ajax-progress-bar"></div>').append($element);

  /**
   * Sets the progress bar progress indicator.
   */
  Drupal.Ajax.prototype.setProgressIndicatorBar = function () {
    const progressBar = new Drupal.ProgressBar(
      `ajax-progress-${this.element.id}`,
      $.noop,
      this.progress.method,
      $.noop,
    );
    if (this.progress.message) {
      progressBar.setProgress(-1, this.progress.message);
    }
    if (this.progress.url) {
      progressBar.startMonitoring(
        this.progress.url,
        this.progress.interval || 1500,
      );
    }
    this.progress.element = $(
      Drupal.theme('ajaxProgressBar', progressBar.element),
    );
    this.progress.object = progressBar;
    $(this.element).after(this.progress.element);
  };

  /**
   * Sets the throbber progress indicator.
   */
  Drupal.Ajax.prototype.setProgressIndicatorThrobber = function () {
    this.progress.element = $(
      Drupal.theme('ajaxProgressThrobber', this.progress.message),
    );
    if ($(this.element).closest('[data-drupal-ajax-container]').length) {
      $(this.element)
        .closest('[data-drupal-ajax-container]')
        .after(this.progress.element);
    } else {
      $(this.element).after(this.progress.element);
    }
  };

  /**
   * Sets the fullscreen progress indicator.
   */
  Drupal.Ajax.prototype.setProgressIndicatorFullscreen = function () {
    this.progress.element = $(Drupal.theme('ajaxProgressIndicatorFullscreen'));
    $('body').append(this.progress.element);
  };

  /**
   * Helper method to make sure commands are executed in sequence.
   *
   * @param {Array.<Drupal.AjaxCommands~commandDefinition>} response
   *   Drupal Ajax response.
   * @param {number} status
   *   XMLHttpRequest status.
   *
   * @return {Promise}
   *  The promise that will resolve once all commands have finished executing.
   */
  Drupal.Ajax.prototype.commandExecutionQueue = function (response, status) {
    const ajaxCommands = this.commands;
    return Object.keys(response || {}).reduce(
      // Add all commands to a single execution queue.
      (executionQueue, key) =>
        executionQueue.then(() => {
          const { command } = response[key];
          if (command && ajaxCommands[command]) {
            // When a command returns a promise, the remaining commands will not
            // execute until that promise has been fulfilled. This is typically
            // used to ensure JavaScript files added via the 'add_js' command
            // have loaded before subsequent commands execute.
            return ajaxCommands[command](this, response[key], status);
          }
        }),
      Promise.resolve(),
    );
  };

  /**
   * Handler for the form redirection completion.
   *
   * @param {Array.<Drupal.AjaxCommands~commandDefinition>} response
   *   Drupal Ajax response.
   * @param {number} status
   *   XMLHttpRequest status.
   *
   * @return {Promise}
   * The promise that will resolve once all commands have finished executing.
   */
  Drupal.Ajax.prototype.success = function (response, status) {
    // Remove the progress element.
    if (this.progress.element) {
      $(this.progress.element).remove();
    }
    if (this.progress.object) {
      this.progress.object.stopMonitoring();
    }
    $(this.element).prop('disabled', false);

    // Save element's ancestors tree so if the element is removed from the dom
    // we can try to refocus one of its parents. Using addBack reverse the
    // result array, meaning that index 0 is the highest parent in the hierarchy
    // in this situation it is usually a <form> element.
    const elementParents = $(this.element)
      .parents('[data-drupal-selector]')
      .addBack()
      .toArray();

    // Track if any command is altering the focus so we can avoid changing the
    // focus set by the Ajax command.
    const focusChanged = Object.keys(response || {}).some((key) => {
      const { command, method } = response[key];
      return (
        command === 'focusFirst' || (command === 'invoke' && method === 'focus')
      );
    });

    return (
      this.commandExecutionQueue(response, status)
        // If the focus hasn't been changed by the AJAX commands, try to refocus
        // the triggering element or one of its parents if that element does not
        // exist anymore.
        .then(() => {
          if (
            !focusChanged &&
            this.element &&
            !$(this.element).data('disable-refocus')
          ) {
            let target = false;

            for (let n = elementParents.length - 1; !target && n >= 0; n--) {
              target = document.querySelector(
                `[data-drupal-selector="${elementParents[n].getAttribute(
                  'data-drupal-selector',
                )}"]`,
              );
            }
            if (target) {
              $(target).trigger('focus');
            }
          }
          // Reattach behaviors, if they were detached in beforeSerialize(). The
          // attachBehaviors() called on the new content from processing the
          // response commands is not sufficient, because behaviors from the
          // entire form need to be reattached.
          if (this.$form && document.body.contains(this.$form.get(0))) {
            const settings = this.settings || drupalSettings;
            Drupal.attachBehaviors(this.$form.get(0), settings);
          }
          // Remove any response-specific settings so they don't get used on the
          // next call by mistake.
          this.settings = null;
        })
        .catch((error) =>
          // eslint-disable-next-line no-console
          console.error(
            Drupal.t(
              'An error occurred during the execution of the Ajax response: !error',
              {
                '!error': error,
              },
            ),
          ),
        )
    );
  };

  /**
   * Build an effect object to apply an effect when adding new HTML.
   *
   * @param {object} response
   *   Drupal Ajax response.
   * @param {string} [response.effect]
   *   Override the default value of {@link Drupal.Ajax#elementSettings}.
   * @param {string|number} [response.speed]
   *   Override the default value of {@link Drupal.Ajax#elementSettings}.
   *
   * @return {object}
   *   Returns an object with `showEffect`, `hideEffect` and `showSpeed`
   *   properties.
   */
  Drupal.Ajax.prototype.getEffect = function (response) {
    const type = response.effect || this.effect;
    const speed = response.speed || this.speed;

    const effect = {};
    if (type === 'none') {
      effect.showEffect = 'show';
      effect.hideEffect = 'hide';
      effect.showSpeed = '';
    } else if (type === 'fade') {
      effect.showEffect = 'fadeIn';
      effect.hideEffect = 'fadeOut';
      effect.showSpeed = speed;
    } else {
      effect.showEffect = `${type}Toggle`;
      effect.hideEffect = `${type}Toggle`;
      effect.showSpeed = speed;
    }

    return effect;
  };

  /**
   * Handler for the form redirection error.
   *
   * @param {object} xmlhttprequest
   *   Native XMLHttpRequest object.
   * @param {string} uri
   *   Ajax Request URI.
   * @param {string} [customMessage]
   *   Extra message to print with the Ajax error.
   */
  Drupal.Ajax.prototype.error = function (xmlhttprequest, uri, customMessage) {
    // Remove the progress element.
    if (this.progress.element) {
      $(this.progress.element).remove();
    }
    if (this.progress.object) {
      this.progress.object.stopMonitoring();
    }
    // Undo hide.
    $(this.wrapper).show();
    // Re-enable the element.
    $(this.element).prop('disabled', false);
    // Reattach behaviors, if they were detached in beforeSerialize(), and the
    // form is still part of the document.
    if (this.$form && document.body.contains(this.$form.get(0))) {
      const settings = this.settings || drupalSettings;
      Drupal.attachBehaviors(this.$form.get(0), settings);
    }
    throw new Drupal.AjaxError(xmlhttprequest, uri, customMessage);
  };

  /**
   * Provide a wrapper for new content via Ajax.
   *
   * Wrap the inserted markup when inserting multiple root elements with an
   * ajax effect.
   *
   * @param {jQuery} $newContent
   *   Response elements after parsing.
   * @param {Drupal.Ajax} ajax
   *   {@link Drupal.Ajax} object created by {@link Drupal.ajax}.
   * @param {object} response
   *   The response from the Ajax request.
   *
   * @deprecated in drupal:8.6.0 and is removed from drupal:10.0.0.
   *   Use data with desired wrapper.
   *
   * @see https://www.drupal.org/node/2940704
   *
   * @todo Add deprecation warning after it is possible. For more information
   *   see: https://www.drupal.org/project/drupal/issues/2973400
   */
  Drupal.theme.ajaxWrapperNewContent = ($newContent, ajax, response) =>
    (response.effect || ajax.effect) !== 'none' &&
    $newContent.filter(
      (i) =>
        !(
          // We can not consider HTML comments or whitespace text as separate
          // roots, since they do not cause visual regression with effect.
          (
            $newContent[i].nodeName === '#comment' ||
            ($newContent[i].nodeName === '#text' &&
              /^(\s|\n|\r)*$/.test($newContent[i].textContent))
          )
        ),
    ).length > 1
      ? Drupal.theme('ajaxWrapperMultipleRootElements', $newContent)
      : $newContent;

  /**
   * Provide a wrapper for multiple root elements via Ajax.
   *
   * @param {jQuery} $elements
   *   Response elements after parsing.
   *
   * @deprecated in drupal:8.6.0 and is removed from drupal:10.0.0.
   *   Use data with desired wrapper.
   *
   * @see https://www.drupal.org/node/2940704
   *
   * @todo Add deprecation warning after it is possible. For more information
   *   see: https://www.drupal.org/project/drupal/issues/2973400
   */
  Drupal.theme.ajaxWrapperMultipleRootElements = ($elements) =>
    $('<div></div>').append($elements);

  /**
   * @typedef {object} Drupal.AjaxCommands~commandDefinition
   *
   * @prop {string} command
   * @prop {string} [method]
   * @prop {string} [selector]
   * @prop {string} [data]
   * @prop {object} [settings]
   * @prop {boolean} [asterisk]
   * @prop {string} [text]
   * @prop {string} [title]
   * @prop {string} [url]
   * @prop {object} [argument]
   * @prop {string} [name]
   * @prop {string} [value]
   * @prop {string} [old]
   * @prop {string} [new]
   * @prop {boolean} [merge]
   * @prop {Array} [args]
   *
   * @see Drupal.AjaxCommands
   */

  /**
   * Provide a series of commands that the client will perform.
   *
   * @constructor
   */
  Drupal.AjaxCommands = function () {};
  Drupal.AjaxCommands.prototype = {
    /**
     * Command to insert new content into the DOM.
     *
     * @param {Drupal.Ajax} ajax
     *   {@link Drupal.Ajax} object created by {@link Drupal.ajax}.
     * @param {object} response
     *   The response from the Ajax request.
     * @param {string} response.data
     *   The data to use with the jQuery method.
     * @param {string} [response.method]
     *   The jQuery DOM manipulation method to be used.
     * @param {string} [response.selector]
     *   An optional jQuery selector string.
     * @param {object} [response.settings]
     *   An optional array of settings that will be used.
     */
    insert(ajax, response) {
      // Get information from the response. If it is not there, default to
      // our presets.
      const $wrapper = response.selector
        ? $(response.selector)
        : $(ajax.wrapper);
      const method = response.method || ajax.method;
      const effect = ajax.getEffect(response);

      // Apply any settings from the returned JSON if available.
      const settings = response.settings || ajax.settings || drupalSettings;

      // Parse response.data into an element collection.
      let $newContent = $($.parseHTML(response.data, document, true));
      // For backward compatibility, in some cases a wrapper will be added. This
      // behavior will be removed before Drupal 9.0.0. If different behavior is
      // needed, the theme functions can be overridden.
      // @see https://www.drupal.org/node/2940704
      $newContent = Drupal.theme(
        'ajaxWrapperNewContent',
        $newContent,
        ajax,
        response,
      );

      // If removing content from the wrapper, detach behaviors first.
      switch (method) {
        case 'html':
        case 'replaceWith':
        case 'replaceAll':
        case 'empty':
        case 'remove':
          Drupal.detachBehaviors($wrapper.get(0), settings);
          break;
        default:
          break;
      }

      // Add the new content to the page.
      $wrapper[method]($newContent);

      // Immediately hide the new content if we're using any effects.
      if (effect.showEffect !== 'show') {
        $newContent.hide();
      }

      // Determine which effect to use and what content will receive the
      // effect, then show the new content.
      const $ajaxNewContent = $newContent.find('.ajax-new-content');
      if ($ajaxNewContent.length) {
        $ajaxNewContent.hide();
        $newContent.show();
        $ajaxNewContent[effect.showEffect](effect.showSpeed);
      } else if (effect.showEffect !== 'show') {
        $newContent[effect.showEffect](effect.showSpeed);
      }

      // Attach all JavaScript behaviors to the new content, if it was
      // successfully added to the page, this if statement allows
      // `#ajax['wrapper']` to be optional.
      if ($newContent.parents('html').length) {
        // Attach behaviors to all element nodes.
        $newContent.each((index, element) => {
          if (element.nodeType === Node.ELEMENT_NODE) {
            Drupal.attachBehaviors(element, settings);
          }
        });
      }
    },

    /**
     * Command to remove a chunk from the page.
     *
     * @param {Drupal.Ajax} [ajax]
     *   {@link Drupal.Ajax} object created by {@link Drupal.ajax}.
     * @param {object} response
     *   The response from the Ajax request.
     * @param {string} response.selector
     *   A jQuery selector string.
     * @param {object} [response.settings]
     *   An optional array of settings that will be used.
     * @param {number} [status]
     *   The XMLHttpRequest status.
     */
    remove(ajax, response, status) {
      const settings = response.settings || ajax.settings || drupalSettings;
      $(response.selector)
        .each(function () {
          Drupal.detachBehaviors(this, settings);
        })
        .remove();
    },

    /**
     * Command to mark a chunk changed.
     *
     * @param {Drupal.Ajax} [ajax]
     *   {@link Drupal.Ajax} object created by {@link Drupal.ajax}.
     * @param {object} response
     *   The JSON response object from the Ajax request.
     * @param {string} response.selector
     *   A jQuery selector string.
     * @param {boolean} [response.asterisk]
     *   An optional CSS selector. If specified, an asterisk will be
     *   appended to the HTML inside the provided selector.
     * @param {number} [status]
     *   The request status.
     */
    changed(ajax, response, status) {
      const $element = $(response.selector);
      if (!$element.hasClass('ajax-changed')) {
        $element.addClass('ajax-changed');
        if (response.asterisk) {
          $element
            .find(response.asterisk)
            .append(
              ` <abbr class="ajax-changed" title="${Drupal.t(
                'Changed',
              )}">*</abbr> `,
            );
        }
      }
    },

    /**
     * Command to provide an alert.
     *
     * @param {Drupal.Ajax} [ajax]
     *   {@link Drupal.Ajax} object created by {@link Drupal.ajax}.
     * @param {object} response
     *   The JSON response from the Ajax request.
     * @param {string} response.text
     *   The text that will be displayed in an alert dialog.
     * @param {number} [status]
     *   The XMLHttpRequest status.
     */
    alert(ajax, response, status) {
      window.alert(response.text);
    },

    /**
     * Command to provide triggers audio UAs to read the supplied text.
     *
     * @param {Drupal.Ajax} [ajax]
     *   {@link Drupal.Ajax} object created by {@link Drupal.ajax}.
     * @param {object} response
     *   The JSON response from the Ajax request.
     * @param {string} [response.text]
     *   The text that will be read.
     * @param {string} [response.priority]
     *   An optional priority that will be used for the announcement.
     */
    announce(ajax, response) {
      if (response.priority) {
        Drupal.announce(response.text, response.priority);
      } else {
        Drupal.announce(response.text);
      }
    },

    /**
     * Command to set the window.location, redirecting the browser.
     *
     * @param {Drupal.Ajax} [ajax]
     *   {@link Drupal.Ajax} object created by {@link Drupal.ajax}.
     * @param {object} response
     *   The response from the Ajax request.
     * @param {string} response.url
     *   The URL to redirect to.
     * @param {number} [status]
     *   The XMLHttpRequest status.
     */
    redirect(ajax, response, status) {
      window.location = response.url;
    },

    /**
     * Command to provide the jQuery css() function.
     *
     * @param {Drupal.Ajax} [ajax]
     *   {@link Drupal.Ajax} object created by {@link Drupal.ajax}.
     * @param {object} response
     *   The response from the Ajax request.
     * @param {string} response.selector
     *   A jQuery selector string.
     * @param {object} response.argument
     *   An array of key/value pairs to set in the CSS for the selector.
     * @param {number} [status]
     *   The XMLHttpRequest status.
     */
    css(ajax, response, status) {
      $(response.selector).css(response.argument);
    },

    /**
     * Command to set the settings used for other commands in this response.
     *
     * This method will also remove expired `drupalSettings.ajax` settings.
     *
     * @param {Drupal.Ajax} [ajax]
     *   {@link Drupal.Ajax} object created by {@link Drupal.ajax}.
     * @param {object} response
     *   The response from the Ajax request.
     * @param {boolean} response.merge
     *   Determines whether the additional settings should be merged to the
     *   global settings.
     * @param {object} response.settings
     *   Contains additional settings to add to the global settings.
     * @param {number} [status]
     *   The XMLHttpRequest status.
     */
    settings(ajax, response, status) {
      const ajaxSettings = drupalSettings.ajax;

      // Clean up drupalSettings.ajax.
      if (ajaxSettings) {
        Drupal.ajax.expired().forEach((instance) => {
          // If the Ajax object has been created through drupalSettings.ajax
          // it will have a selector. When there is no selector the object
          // has been initialized with a special class name picked up by the
          // Ajax behavior.

          if (instance.selector) {
            const selector = instance.selector.replace('#', '');
            if (selector in ajaxSettings) {
              delete ajaxSettings[selector];
            }
          }
        });
      }

      if (response.merge) {
        $.extend(true, drupalSettings, response.settings);
      } else {
        ajax.settings = response.settings;
      }
    },

    /**
     * Command to attach data using jQuery's data API.
     *
     * @param {Drupal.Ajax} [ajax]
     *   {@link Drupal.Ajax} object created by {@link Drupal.ajax}.
     * @param {object} response
     *   The response from the Ajax request.
     * @param {string} response.name
     *   The name or key (in the key value pair) of the data attached to this
     *   selector.
     * @param {string} response.selector
     *   A jQuery selector string.
     * @param {string|object} response.value
     *   The value of to be attached.
     * @param {number} [status]
     *   The XMLHttpRequest status.
     */
    data(ajax, response, status) {
      $(response.selector).data(response.name, response.value);
    },

    /**
     * Command to focus the first tabbable element within a container.
     *
     * If no tabbable elements are found and the container is focusable, then
     * focus will move to that container.
     *
     * @param {Drupal.Ajax} [ajax]
     *   {@link Drupal.Ajax} object created by {@link Drupal.ajax}.
     * @param {object} response
     *   The response from the Ajax request.
     * @param {string} response.selector
     *   A query selector string of the container to focus within.
     * @param {number} [status]
     *   The XMLHttpRequest status.
     */
    focusFirst(ajax, response, status) {
      let focusChanged = false;
      const container = document.querySelector(response.selector);
      if (container) {
        // Find all tabbable elements within the container.
        const tabbableElements = tabbable(container);

        // Move focus to the first tabbable item found.
        if (tabbableElements.length) {
          tabbableElements[0].focus();
          focusChanged = true;
        } else if (isFocusable(container)) {
          // If no tabbable elements are found, but the container is focusable,
          // move focus to the container.
          container.focus();
          focusChanged = true;
        }
      }

      // If no items were available to receive focus, return focus to the
      // triggering element.
      if (ajax.hasOwnProperty('element') && !focusChanged) {
        ajax.element.focus();
      }
    },

    /**
     * Command to apply a jQuery method.
     *
     * @param {Drupal.Ajax} [ajax]
     *   {@link Drupal.Ajax} object created by {@link Drupal.ajax}.
     * @param {object} response
     *   The response from the Ajax request.
     * @param {Array} response.args
     *   An array of arguments to the jQuery method, if any.
     * @param {string} response.method
     *   The jQuery method to invoke.
     * @param {string} response.selector
     *   A jQuery selector string.
     * @param {number} [status]
     *   The XMLHttpRequest status.
     */
    invoke(ajax, response, status) {
      const $element = $(response.selector);
      $element[response.method](...response.args);
    },

    /**
     * Command to restripe a table.
     *
     * @param {Drupal.Ajax} [ajax]
     *   {@link Drupal.Ajax} object created by {@link Drupal.ajax}.
     * @param {object} response
     *   The response from the Ajax request.
     * @param {string} response.selector
     *   A jQuery selector string.
     * @param {number} [status]
     *   The XMLHttpRequest status.
     */
    restripe(ajax, response, status) {
      // :even and :odd are reversed because jQuery counts from 0 and
      // we count from 1, so we're out of sync.
      // Match immediate children of the parent element to allow nesting.
      $(response.selector)
        .find('> tbody > tr:visible, > tr:visible')
        .removeClass('odd even')
        .filter(':even')
        .addClass('odd')
        .end()
        .filter(':odd')
        .addClass('even');
    },

    /**
     * Command to update a form's build ID.
     *
     * @param {Drupal.Ajax} [ajax]
     *   {@link Drupal.Ajax} object created by {@link Drupal.ajax}.
     * @param {object} response
     *   The response from the Ajax request.
     * @param {string} response.old
     *   The old form build ID.
     * @param {string} response.new
     *   The new form build ID.
     * @param {number} [status]
     *   The XMLHttpRequest status.
     */
    update_build_id(ajax, response, status) {
      document
        .querySelectorAll(
          `input[name="form_build_id"][value="${response.old}"]`,
        )
        .forEach((item) => {
          item.value = response.new;
        });
    },

    /**
     * Command to add css.
     *
     * @param {Drupal.Ajax} [ajax]
     *   {@link Drupal.Ajax} object created by {@link Drupal.ajax}.
     * @param {object} response
     *   The response from the Ajax request.
     * @param {string} response.data
     *   A string that contains the styles to be added.
     * @param {number} [status]
     *   The XMLHttpRequest status.
     */
    add_css(ajax, response, status) {
      $('head').prepend(response.data);
    },

    /**
     * Command to add a message to the message area.
     *
     * @param {Drupal.Ajax} [ajax]
     *   {@link Drupal.Ajax} object created by {@link Drupal.ajax}.
     * @param {object} response
     *   The response from the Ajax request.
     * @param {string} response.messageWrapperQuerySelector
     *   The zone where to add the message. If null, the default will be used.
     * @param {string} response.message
     *   The message text.
     * @param {string} response.messageOptions
     *   The options argument for Drupal.Message().add().
     * @param {boolean} response.clearPrevious
     *   If true, clear previous messages.
     */
    message(ajax, response) {
      const messages = new Drupal.Message(
        document.querySelector(response.messageWrapperQuerySelector),
      );
      if (response.clearPrevious) {
        messages.clear();
      }
      messages.add(response.message, response.messageOptions);
    },

    /**
     * Command to add JS.
     *
     * @param {Drupal.Ajax} [ajax]
     *   {@link Drupal.Ajax} object created by {@link Drupal.ajax}.
     * @param {object} response
     *   The response from the Ajax request.
     * @param {Array} response.data
     *   An array of objects of script attributes.
     * @param {number} [status]
     *   The XMLHttpRequest status.
     */
    add_js(ajax, response, status) {
      const parentEl = document.querySelector(response.selector || 'body');
      const settings = ajax.settings || drupalSettings;
      const allUniqueBundleIds = response.data.map((script) => {
        // loadjs requires a unique ID, and an AJAX instance's `instanceIndex`
        // is guaranteed to be unique.
        // @see Drupal.behaviors.AJAX.detach
        const uniqueBundleId = script.src + ajax.instanceIndex;
        loadjs(script.src, uniqueBundleId, {
          // The default loadjs behavior is to load script with async, in Drupal
          // we need to explicitly tell scripts to load async, this is set in
          // the before callback below if necessary.
          async: false,
          before(path, scriptEl) {
            // This allows all attributes to be added, like defer, async and
            // crossorigin.
            Object.keys(script).forEach((attributeKey) => {
              scriptEl.setAttribute(attributeKey, script[attributeKey]);
            });

            // By default, loadjs appends the script to the head. When scripts
            // are loaded via AJAX, their location has no impact on
            // functionality. But, since non-AJAX loaded scripts can choose
            // their parent element, we provide that option here for the sake of
            // consistency.
            parentEl.appendChild(scriptEl);
            // Return false to bypass loadjs' default DOM insertion mechanism.
            return false;
          },
        });
        return uniqueBundleId;
      });
      // Returns the promise so that the next AJAX command waits on the
      // completion of this one to execute, ensuring the JS is loaded before
      // executing.
      return new Promise((resolve, reject) => {
        loadjs.ready(allUniqueBundleIds, {
          success() {
            Drupal.attachBehaviors(parentEl, settings);
            // All JS files were loaded and new and old behaviors have
            // been attached. Resolve the promise and let the remaining
            // commands execute.
            resolve();
          },
          error(depsNotFound) {
            const message = Drupal.t(
              `The following files could not be loaded: @dependencies`,
              { '@dependencies': depsNotFound.join(', ') },
            );
            reject(message);
          },
        });
      });
    },
  };

  /**
   * Delay jQuery's global completion events until after commands have executed.
   *
   * jQuery triggers the ajaxSuccess, ajaxComplete, and ajaxStop events after
   * a successful response is returned and local success and complete events
   * are triggered. However, Drupal Ajax responses contain commands that run
   * asynchronously in a queue, so the following stops these events from getting
   * triggered until after the Promise that executes the command queue is
   * resolved.
   */
  const stopEvent = (xhr, settings) => {
    return (
      // Only interfere with Drupal's Ajax responses.
      xhr.getResponseHeader('X-Drupal-Ajax-Token') === '1' &&
      // The isInProgress() function might not be defined if the Ajax request
      // was initiated without Drupal.ajax() or new Drupal.Ajax().
      settings.isInProgress &&
      // Until this is false, the Ajax request isn't completely done (the
      // response's commands might still be running).
      settings.isInProgress()
    );
  };
  $.extend(true, $.event.special, {
    ajaxSuccess: {
      trigger(event, xhr, settings) {
        if (stopEvent(xhr, settings)) {
          return false;
        }
      },
    },
    ajaxComplete: {
      trigger(event, xhr, settings) {
        if (stopEvent(xhr, settings)) {
          // jQuery decrements its internal active ajax counter even when we
          // stop the ajaxComplete event, but we don't want that counter
          // decremented, because for our purposes this request is still active
          // while commands are executing. By incrementing it here, the net
          // effect is that it remains unchanged. By remaining above 0, the
          // ajaxStop event is also prevented.
          $.active++;
          return false;
        }
      },
    },
  });
})(jQuery, window, Drupal, drupalSettings, loadjs, window.tabbable);
;
/**
 * @file
 * Extends methods from core/misc/ajax.js.
 */

(function ($, window, Drupal, drupalSettings) {

  /**
   * Attempts to find the closest glyphicon progress indicator.
   *
   * @param {jQuery|Element} element
   *   A DOM element.
   *
   * @returns {jQuery}
   *   A jQuery object.
   */
  Drupal.Ajax.prototype.findGlyphicon = function (element) {
    return $(element).closest('.form-item').find('.ajax-progress.glyphicon')
  };

  /**
   * Starts the spinning of the glyphicon progress indicator.
   *
   * @param {jQuery|Element} element
   *   A DOM element.
   * @param {string} [message]
   *   An optional message to display (tooltip) for the progress.
   *
   * @returns {jQuery}
   *   A jQuery object.
   */
  Drupal.Ajax.prototype.glyphiconStart = function (element, message) {
    var $glyphicon = this.findGlyphicon(element);
    if ($glyphicon[0]) {
      $glyphicon.addClass('glyphicon-spin');

      // Add any message as a tooltip to the glyphicon.
      if ($.fn.tooltip && drupalSettings.bootstrap.tooltip_enabled) {
        $glyphicon
          .removeAttr('data-toggle')
          .removeAttr('data-original-title')
          .removeAttr('title')
          .tooltip('destroy')
        ;

        if (message) {
          $glyphicon.attr('data-toggle', 'tooltip').attr('title', message).tooltip();
        }
      }

      // Append a message for screen readers.
      if (message) {
        $glyphicon.parent().append('<div class="sr-only message">' + message + '</div>');
      }
    }
    return $glyphicon;
  };

  /**
   * Stop the spinning of a glyphicon progress indicator.
   *
   * @param {jQuery|Element} element
   *   A DOM element.
   */
  Drupal.Ajax.prototype.glyphiconStop = function (element) {
    var $glyphicon = this.findGlyphicon(element);
    if ($glyphicon[0]) {
      $glyphicon.removeClass('glyphicon-spin');
      if ($.fn.tooltip && drupalSettings.bootstrap.tooltip_enabled) {
        $glyphicon
          .removeAttr('data-toggle')
          .removeAttr('data-original-title')
          .removeAttr('title')
          .tooltip('destroy')
        ;
      }
    }
  };

  /**
   * Sets the throbber progress indicator.
   */
  Drupal.Ajax.prototype.setProgressIndicatorThrobber = function () {
    var $element = $(this.element);

    // Find an existing glyphicon progress indicator.
    var $glyphicon = this.glyphiconStart($element, this.progress.message);
    if ($glyphicon[0]) {
      this.progress.element = $glyphicon.parent();
      this.progress.glyphicon = true;
      return;
    }

    // Otherwise, add a glyphicon throbber after the element.
    if (!this.progress.element) {
      this.progress.element = $(Drupal.theme('ajaxThrobber'));
    }
    if (this.progress.message) {
      this.progress.element.after('<div class="message">' + this.progress.message + '</div>');
    }

    // If element is an input DOM element type (not :input), append after.
    if ($element.is('input')) {
      $element.after(this.progress.element);
    }
    // Otherwise append the throbber inside the element.
    else {
      $element.append(this.progress.element);
    }
  };


  /**
   * Handler for the form redirection completion.
   *
   * @param {Array.<Drupal.AjaxCommands~commandDefinition>} response
   * @param {number} status
   */
  var success = Drupal.Ajax.prototype.success;
  Drupal.Ajax.prototype.success = function (response, status) {
    if (this.progress.element) {

      // Stop a glyphicon throbber.
      if (this.progress.glyphicon) {
        this.glyphiconStop(this.progress.element);
      }
      // Remove the progress element.
      else {
        this.progress.element.remove();
      }

      // Remove any message set.
      this.progress.element.parent().find('.message').remove();
    }

    // Invoke the original success handler.
    return success.apply(this, [response, status]);
  };

})(jQuery, this, Drupal, drupalSettings);
;
/**
 * @file
 * Adapted from underscore.js with the addition Drupal namespace.
 */

/**
 * Limits the invocations of a function in a given time frame.
 *
 * The debounce function wrapper should be used sparingly. One clear use case
 * is limiting the invocation of a callback attached to the window resize event.
 *
 * Before using the debounce function wrapper, consider first whether the
 * callback could be attached to an event that fires less frequently or if the
 * function can be written in such a way that it is only invoked under specific
 * conditions.
 *
 * @param {function} func
 *   The function to be invoked.
 * @param {number} wait
 *   The time period within which the callback function should only be
 *   invoked once. For example if the wait period is 250ms, then the callback
 *   will only be called at most 4 times per second.
 * @param {boolean} immediate
 *   Whether we wait at the beginning or end to execute the function.
 *
 * @return {function}
 *   The debounced function.
 */
Drupal.debounce = function (func, wait, immediate) {
  let timeout;
  let result;
  return function (...args) {
    const context = this;
    const later = function () {
      timeout = null;
      if (!immediate) {
        result = func.apply(context, args);
      }
    };
    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) {
      result = func.apply(context, args);
    }
    return result;
  };
};
;
/**
 * @file
 * Manages elements that can offset the size of the viewport.
 *
 * Measures and reports viewport offset dimensions from elements like the
 * toolbar that can potentially displace the positioning of other elements.
 */

/**
 * @typedef {object} Drupal~displaceOffset
 *
 * @prop {number} top
 * @prop {number} left
 * @prop {number} right
 * @prop {number} bottom
 */

/**
 * Triggers when layout of the page changes.
 *
 * This is used to position fixed element on the page during page resize and
 * Toolbar toggling.
 *
 * @event drupalViewportOffsetChange
 */
(function ($, Drupal, debounce) {
  /**
   *
   * @type {Drupal~displaceOffset}
   */
  const cache = {
    right: 0,
    left: 0,
    bottom: 0,
    top: 0,
  };
  /**
   * The prefix used for the css custom variable name.
   *
   * @type {string}
   */
  const cssVarPrefix = '--drupal-displace-offset';
  const documentStyle = document.documentElement.style;
  const offsetKeys = Object.keys(cache);
  /**
   * The object with accessors that update the CSS variable on value update.
   *
   * @type {Drupal~displaceOffset}
   */
  const offsetProps = {};
  offsetKeys.forEach((edge) => {
    offsetProps[edge] = {
      // Show this property when using Object.keys().
      enumerable: true,
      get() {
        return cache[edge];
      },
      set(value) {
        // Only update the CSS custom variable when the value changed.
        if (value !== cache[edge]) {
          documentStyle.setProperty(`${cssVarPrefix}-${edge}`, `${value}px`);
        }
        cache[edge] = value;
      },
    };
  });

  /**
   * Current value of the size of margins on the page.
   *
   * This property is read-only and the object is sealed to prevent key name
   * modifications since key names are used to dynamically construct CSS custom
   * variable names.
   *
   * @name Drupal.displace.offsets
   *
   * @type {Drupal~displaceOffset}
   */
  const offsets = Object.seal(Object.defineProperties({}, offsetProps));

  /**
   * Calculates displacement for element based on its dimensions and placement.
   *
   * @param {HTMLElement} el
   *   The element whose dimensions and placement will be measured.
   *
   * @param {string} edge
   *   The name of the edge of the viewport that the element is associated
   *   with.
   *
   * @return {number}
   *   The viewport displacement distance for the requested edge.
   */
  function getRawOffset(el, edge) {
    const $el = $(el);
    const documentElement = document.documentElement;
    let displacement = 0;
    const horizontal = edge === 'left' || edge === 'right';
    // Get the offset of the element itself.
    let placement = $el.offset()[horizontal ? 'left' : 'top'];
    // Subtract scroll distance from placement to get the distance
    // to the edge of the viewport.
    placement -=
      window[`scroll${horizontal ? 'X' : 'Y'}`] ||
      document.documentElement[`scroll${horizontal ? 'Left' : 'Top'}`] ||
      0;
    // Find the displacement value according to the edge.
    switch (edge) {
      // Left and top elements displace as a sum of their own offset value
      // plus their size.
      case 'top':
        // Total displacement is the sum of the elements placement and size.
        displacement = placement + $el.outerHeight();
        break;

      case 'left':
        // Total displacement is the sum of the elements placement and size.
        displacement = placement + $el.outerWidth();
        break;

      // Right and bottom elements displace according to their left and
      // top offset. Their size isn't important.
      case 'bottom':
        displacement = documentElement.clientHeight - placement;
        break;

      case 'right':
        displacement = documentElement.clientWidth - placement;
        break;

      default:
        displacement = 0;
    }
    return displacement;
  }

  /**
   * Gets a specific edge's offset.
   *
   * Any element with the attribute data-offset-{edge} e.g. data-offset-top will
   * be considered in the viewport offset calculations. If the attribute has a
   * numeric value, that value will be used. If no value is provided, one will
   * be calculated using the element's dimensions and placement.
   *
   * @function Drupal.displace.calculateOffset
   *
   * @param {string} edge
   *   The name of the edge to calculate. Can be 'top', 'right',
   *   'bottom' or 'left'.
   *
   * @return {number}
   *   The viewport displacement distance for the requested edge.
   */
  function calculateOffset(edge) {
    let edgeOffset = 0;
    const displacingElements = document.querySelectorAll(
      `[data-offset-${edge}]`,
    );
    const n = displacingElements.length;
    for (let i = 0; i < n; i++) {
      const el = displacingElements[i];
      // If the element is not visible, do consider its dimensions.
      if (el.style.display === 'none') {
        continue;
      }
      // If the offset data attribute contains a displacing value, use it.
      let displacement = parseInt(el.getAttribute(`data-offset-${edge}`), 10);
      // If the element's offset data attribute exits
      // but is not a valid number then get the displacement
      // dimensions directly from the element.
      // eslint-disable-next-line no-restricted-globals
      if (isNaN(displacement)) {
        displacement = getRawOffset(el, edge);
      }
      // If the displacement value is larger than the current value for this
      // edge, use the displacement value.
      edgeOffset = Math.max(edgeOffset, displacement);
    }

    return edgeOffset;
  }

  /**
   * Informs listeners of the current offset dimensions.
   *
   * Corresponding CSS custom variables are also updated.
   * Corresponding CSS custom variables names are:
   *  - `--drupal-displace-offset-top`
   *  - `--drupal-displace-offset-right`
   *  - `--drupal-displace-offset-bottom`
   *  - `--drupal-displace-offset-left`
   *
   * @function Drupal.displace
   *
   * @prop {Drupal~displaceOffset} offsets
   *
   * @param {boolean} [broadcast=true]
   *   When true, causes the recalculated offsets values to be
   *   broadcast to listeners. If none is given, defaults to true.
   *
   * @return {Drupal~displaceOffset}
   *   An object whose keys are the for sides an element -- top, right, bottom
   *   and left. The value of each key is the viewport displacement distance for
   *   that edge.
   *
   * @fires event:drupalViewportOffsetChange
   */
  function displace(broadcast = true) {
    const newOffsets = {};
    // Getting the offset and setting the offset needs to be separated because
    // of performance concerns. Only do DOM/style reading happening here.
    offsetKeys.forEach((edge) => {
      newOffsets[edge] = calculateOffset(edge);
    });
    // Once we have all the values, write to the DOM/style.
    offsetKeys.forEach((edge) => {
      // Updating the value in place also update Drupal.displace.offsets.
      offsets[edge] = newOffsets[edge];
    });

    if (broadcast) {
      $(document).trigger('drupalViewportOffsetChange', offsets);
    }
    return offsets;
  }

  /**
   * Registers a resize handler on the window.
   *
   * @type {Drupal~behavior}
   */
  Drupal.behaviors.drupalDisplace = {
    attach() {
      // Mark this behavior as processed on the first pass.
      if (this.displaceProcessed) {
        return;
      }
      this.displaceProcessed = true;
      $(window).on('resize.drupalDisplace', debounce(displace, 200));
    },
  };

  /**
   * Assign the displace function to a property of the Drupal global object.
   *
   * @ignore
   */
  Drupal.displace = displace;

  /**
   * Expose offsets to other scripts to avoid having to recalculate offsets.
   *
   * @ignore
   */
  Object.defineProperty(Drupal.displace, 'offsets', {
    value: offsets,
    // Make sure other scripts don't replace this object.
    writable: false,
  });

  /**
   * Expose method to compute a single edge offsets.
   *
   * @ignore
   */
  Drupal.displace.calculateOffset = calculateOffset;
})(jQuery, Drupal, Drupal.debounce);
;
/**
 * @file
 * Defines a backwards-compatible shim for the jQuery UI :tabbable selector.
 */

(($, Drupal, { isTabbable }) => {
  $.extend($.expr[':'], {
    tabbable(element) {
      Drupal.deprecationError({
        message:
          'The :tabbable selector is deprecated in Drupal 9.2.0 and will be removed in Drupal 11.0.0. Use the core/tabbable library instead. See https://www.drupal.org/node/3183730',
      });

      // The tabbable library considers the summary element tabbable, and also
      // considers a details element without a summary tabbable. The jQuery UI
      // :tabbable selector does not. This is due to those element types being
      // inert in IE/Edge.
      // @see https://allyjs.io/data-tables/focusable.html
      if (element.tagName === 'SUMMARY' || element.tagName === 'DETAILS') {
        const tabIndex = element.getAttribute('tabIndex');
        if (tabIndex === null || tabIndex < 0) {
          return false;
        }
      }
      return isTabbable(element);
    },
  });
})(jQuery, Drupal, window.tabbable);
;
/**
 * @file
 * A modified version of jQuery UI position.
 *
 * Per jQuery UI's public domain license, it is permissible to run modified
 * versions of their code. This file offers the same functionality as what is
 * provided by jQuery UI position, but refactored to meet Drupal coding
 * standards, and restructured so it extends jQuery core instead of jQuery UI.
 *
 * This is provided to support pre-existing code that expects the jQuery
 * position API.
 *
 * @see https://github.com/jquery/jquery-ui/blob/1.12.1/LICENSE.txt
 * @see https://raw.githubusercontent.com/jquery/jquery-ui/1.12.1/ui/position.js
 */

/**
 * This provides ported version of jQuery UI position, refactored to not depend
 * on jQuery UI and to meet Drupal JavaScript coding standards. Functionality
 * and usage is identical. It positions an element relative to another. The
 * `position()` function can be called by any jQuery object. Additional details
 * on using `position()` are provided in this file in the docblock for
 * $.fn.position.
 */
(($) => {
  let cachedScrollbarWidth = null;
  const { max, abs } = Math;
  const regexHorizontal = /left|center|right/;
  const regexVertical = /top|center|bottom/;
  const regexOffset = /[+-]\d+(\.[\d]+)?%?/;
  const regexPosition = /^\w+/;
  const regexPercent = /%$/;
  const _position = $.fn.position;

  function getOffsets(offsets, width, height) {
    return [
      parseFloat(offsets[0]) *
        (regexPercent.test(offsets[0]) ? width / 100 : 1),
      parseFloat(offsets[1]) *
        (regexPercent.test(offsets[1]) ? height / 100 : 1),
    ];
  }

  function parseCss(element, property) {
    return parseInt($.css(element, property), 10) || 0;
  }

  function getDimensions(elem) {
    const raw = elem[0];
    if (raw.nodeType === 9) {
      return {
        width: elem.width(),
        height: elem.height(),
        offset: { top: 0, left: 0 },
      };
    }
    if ($.isWindow(raw)) {
      return {
        width: elem.width(),
        height: elem.height(),
        offset: { top: elem.scrollTop(), left: elem.scrollLeft() },
      };
    }
    if (raw.preventDefault) {
      return {
        width: 0,
        height: 0,
        offset: { top: raw.pageY, left: raw.pageX },
      };
    }
    return {
      width: elem.outerWidth(),
      height: elem.outerHeight(),
      offset: elem.offset(),
    };
  }

  const collisions = {
    fit: {
      left(position, data) {
        const { within } = data;
        const withinOffset = within.isWindow
          ? within.scrollLeft
          : within.offset.left;
        const outerWidth = within.width;
        const collisionPosLeft =
          position.left - data.collisionPosition.marginLeft;
        const overLeft = withinOffset - collisionPosLeft;
        const overRight =
          collisionPosLeft + data.collisionWidth - outerWidth - withinOffset;
        let newOverRight;

        // Element is wider than within
        if (data.collisionWidth > outerWidth) {
          // Element is initially over the left side of within
          if (overLeft > 0 && overRight <= 0) {
            newOverRight =
              position.left +
              overLeft +
              data.collisionWidth -
              outerWidth -
              withinOffset;
            position.left += overLeft - newOverRight;

            // Element is initially over right side of within
          } else if (overRight > 0 && overLeft <= 0) {
            position.left = withinOffset;

            // Element is initially over both left and right sides of within
          } else if (overLeft > overRight) {
            position.left = withinOffset + outerWidth - data.collisionWidth;
          } else {
            position.left = withinOffset;
          }

          // Too far left -> align with left edge
        } else if (overLeft > 0) {
          position.left += overLeft;

          // Too far right -> align with right edge
        } else if (overRight > 0) {
          position.left -= overRight;

          // Adjust based on position and margin
        } else {
          position.left = max(position.left - collisionPosLeft, position.left);
        }
      },
      top(position, data) {
        const { within } = data;
        const withinOffset = within.isWindow
          ? within.scrollTop
          : within.offset.top;
        const outerHeight = data.within.height;
        const collisionPosTop = position.top - data.collisionPosition.marginTop;
        const overTop = withinOffset - collisionPosTop;
        const overBottom =
          collisionPosTop + data.collisionHeight - outerHeight - withinOffset;
        let newOverBottom;

        // Element is taller than within
        if (data.collisionHeight > outerHeight) {
          // Element is initially over the top of within
          if (overTop > 0 && overBottom <= 0) {
            newOverBottom =
              position.top +
              overTop +
              data.collisionHeight -
              outerHeight -
              withinOffset;
            position.top += overTop - newOverBottom;

            // Element is initially over bottom of within
          } else if (overBottom > 0 && overTop <= 0) {
            position.top = withinOffset;

            // Element is initially over both top and bottom of within
          } else if (overTop > overBottom) {
            position.top = withinOffset + outerHeight - data.collisionHeight;
          } else {
            position.top = withinOffset;
          }

          // Too far up -> align with top
        } else if (overTop > 0) {
          position.top += overTop;

          // Too far down -> align with bottom edge
        } else if (overBottom > 0) {
          position.top -= overBottom;

          // Adjust based on position and margin
        } else {
          position.top = max(position.top - collisionPosTop, position.top);
        }
      },
    },
    flip: {
      left(position, data) {
        const { within } = data;
        const withinOffset = within.offset.left + within.scrollLeft;
        const outerWidth = within.width;
        const offsetLeft = within.isWindow
          ? within.scrollLeft
          : within.offset.left;
        const collisionPosLeft =
          position.left - data.collisionPosition.marginLeft;
        const overLeft = collisionPosLeft - offsetLeft;
        const overRight =
          collisionPosLeft + data.collisionWidth - outerWidth - offsetLeft;
        const myOffset =
          // eslint-disable-next-line no-nested-ternary
          data.my[0] === 'left'
            ? -data.elemWidth
            : data.my[0] === 'right'
            ? data.elemWidth
            : 0;
        const atOffset =
          // eslint-disable-next-line no-nested-ternary
          data.at[0] === 'left'
            ? data.targetWidth
            : data.at[0] === 'right'
            ? -data.targetWidth
            : 0;
        const offset = -2 * data.offset[0];
        let newOverRight;
        let newOverLeft;

        if (overLeft < 0) {
          newOverRight =
            position.left +
            myOffset +
            atOffset +
            offset +
            data.collisionWidth -
            outerWidth -
            withinOffset;
          if (newOverRight < 0 || newOverRight < abs(overLeft)) {
            position.left += myOffset + atOffset + offset;
          }
        } else if (overRight > 0) {
          newOverLeft =
            position.left -
            data.collisionPosition.marginLeft +
            myOffset +
            atOffset +
            offset -
            offsetLeft;
          if (newOverLeft > 0 || abs(newOverLeft) < overRight) {
            position.left += myOffset + atOffset + offset;
          }
        }
      },
      top(position, data) {
        const { within } = data;
        const withinOffset = within.offset.top + within.scrollTop;
        const outerHeight = within.height;
        const offsetTop = within.isWindow
          ? within.scrollTop
          : within.offset.top;
        const collisionPosTop = position.top - data.collisionPosition.marginTop;
        const overTop = collisionPosTop - offsetTop;
        const overBottom =
          collisionPosTop + data.collisionHeight - outerHeight - offsetTop;
        const top = data.my[1] === 'top';
        // eslint-disable-next-line no-nested-ternary
        const myOffset = top
          ? -data.elemHeight
          : data.my[1] === 'bottom'
          ? data.elemHeight
          : 0;
        const atOffset =
          // eslint-disable-next-line no-nested-ternary
          data.at[1] === 'top'
            ? data.targetHeight
            : data.at[1] === 'bottom'
            ? -data.targetHeight
            : 0;
        const offset = -2 * data.offset[1];
        let newOverTop;
        let newOverBottom;
        if (overTop < 0) {
          newOverBottom =
            position.top +
            myOffset +
            atOffset +
            offset +
            data.collisionHeight -
            outerHeight -
            withinOffset;
          if (newOverBottom < 0 || newOverBottom < abs(overTop)) {
            position.top += myOffset + atOffset + offset;
          }
        } else if (overBottom > 0) {
          newOverTop =
            position.top -
            data.collisionPosition.marginTop +
            myOffset +
            atOffset +
            offset -
            offsetTop;
          if (newOverTop > 0 || abs(newOverTop) < overBottom) {
            position.top += myOffset + atOffset + offset;
          }
        }
      },
    },
    flipfit: {
      left(...args) {
        collisions.flip.left.apply(this, args);
        collisions.fit.left.apply(this, args);
      },
      top(...args) {
        collisions.flip.top.apply(this, args);
        collisions.fit.top.apply(this, args);
      },
    },
  };

  $.position = {
    scrollbarWidth() {
      if (cachedScrollbarWidth !== undefined) {
        return cachedScrollbarWidth;
      }
      const div = $(
        '<div ' +
          "style='display:block;position:absolute;width:50px;height:50px;overflow:hidden;'>" +
          "<div style='height:100px;width:auto;'></div></div>",
      );
      const innerDiv = div.children()[0];

      $('body').append(div);
      const w1 = innerDiv.offsetWidth;
      div.css('overflow', 'scroll');

      let w2 = innerDiv.offsetWidth;

      if (w1 === w2) {
        w2 = div[0].clientWidth;
      }

      div.remove();
      cachedScrollbarWidth = w1 - w2;
      return cachedScrollbarWidth;
    },
    getScrollInfo(within) {
      const overflowX =
        within.isWindow || within.isDocument
          ? ''
          : within.element.css('overflow-x');
      const overflowY =
        within.isWindow || within.isDocument
          ? ''
          : within.element.css('overflow-y');
      const hasOverflowX =
        overflowX === 'scroll' ||
        (overflowX === 'auto' && within.width < within.element[0].scrollWidth);
      const hasOverflowY =
        overflowY === 'scroll' ||
        (overflowY === 'auto' &&
          within.height < within.element[0].scrollHeight);
      return {
        width: hasOverflowY ? $.position.scrollbarWidth() : 0,
        height: hasOverflowX ? $.position.scrollbarWidth() : 0,
      };
    },
    getWithinInfo(element) {
      const withinElement = $(element || window);
      const isWindow = $.isWindow(withinElement[0]);
      const isDocument = !!withinElement[0] && withinElement[0].nodeType === 9;
      const hasOffset = !isWindow && !isDocument;
      return {
        element: withinElement,
        isWindow,
        isDocument,
        offset: hasOffset ? $(element).offset() : { left: 0, top: 0 },
        scrollLeft: withinElement.scrollLeft(),
        scrollTop: withinElement.scrollTop(),
        width: withinElement.outerWidth(),
        height: withinElement.outerHeight(),
      };
    },
  };

  // eslint-disable-next-line func-names
  /**
   * Positions an element relative to another.
   *
   * The following documentation is originally from
   * {@link https://api.jqueryui.com/position/}.
   *
   * @param {Object} options - the options object.
   * @param {string} options.my - Defines which position on the element being
   *   positioned to align with the target element: "horizontal vertical"
   *   alignment. A single value such as "right" will be normalized to "right
   *   center", "top" will be normalized to "center top" (following CSS
   *   convention). Acceptable horizontal values: "left", "center", "right".
   *   Acceptable vertical values: "top", "center", "bottom". Example: "left
   *   top" or "center center". Each dimension can also contain offsets, in
   *   pixels or percent, e.g., "right+10 top-25%". Percentage offsets are
   *   relative to the element being positioned. Default value is "center".
   * @param {string} options.at - Defines which position on the target element
   *   to align the positioned element against: "horizontal vertical" alignment.
   *   See the `my` option for full details on possible values. Percentage
   *   offsets are relative to the target element. Default value is "center".
   * @param {string|Element|jQuery|Event|null} options.of - Which element to
   *   position against. If you provide a selector or jQuery object, the first
   *   matching element will be used. If you provide an event object, the pageX
   *   and pageY properties will be used. Example: "#top-menu". Default value is
   *   null.
   * @param {string} options.collision - When the positioned element overflows
   *   the window in some direction, move it to an alternative position. Similar
   *   to `my` and `at`, this accepts a single value or a pair for
   *   horizontal/vertical, e.g., "flip", "fit", "fit flip", "fit none". Default
   *   value is "flip". The options work as follows:
   *   - "flip": Flips the element to the opposite side of the target and the
   *     collision detection is run again to see if it will fit. Whichever side
   *     allows more of the element to be visible will be used.
   *   - "fit": Shift the element away from the edge of the window.
   *   - "flipfit": First applies the flip logic, placing the element on
   *     whichever side allows more of the element to be visible. Then the fit
   *     logic is applied to ensure as much of the element is visible as
   *     possible.
   *     "none": Does not apply any collision detection.
   * @param {function|null} options.using - When specified, the actual property
   *   setting is delegated to this callback. Receives two parameters: The first
   *   is a hash of top and left values for the position that should be set and
   *   can be forwarded to .css() or .animate().The second provides feedback
   *   about the position and dimensions of both elements, as well as
   *   calculations to their relative position. Both target and element have
   *   these properties: element, left, top, width, height. In addition, there's
   *   horizontal, vertical and important, providing twelve potential directions
   *   like { horizontal: "center", vertical: "left", important: "horizontal" }.
   *   Default value is null.
   * @param {string|Element|jQuery} options.within - Element to position within,
   *   affecting collision detection. If you provide a selector or jQuery
   *   object, the first matching element will be used. Default value is window.
   *
   * @return {jQuery}
   *  The jQuery object that called called this function.
   */
  $.fn.position = function (options) {
    if (!options || !options.of) {
      // eslint-disable-next-line prefer-rest-params
      return _position.apply(this, arguments);
    }

    // Make a copy, we don't want to modify arguments
    options = $.extend({}, options);

    const within = $.position.getWithinInfo(options.within);
    const scrollInfo = $.position.getScrollInfo(within);
    const collision = (options.collision || 'flip').split(' ');
    const offsets = {};

    // Make sure string options are treated as CSS selectors
    const target =
      typeof options.of === 'string'
        ? $(document).find(options.of)
        : $(options.of);
    const dimensions = getDimensions(target);
    const targetWidth = dimensions.width;
    const targetHeight = dimensions.height;
    const targetOffset = dimensions.offset;

    if (target[0].preventDefault) {
      // Force left top to allow flipping
      options.at = 'left top';
    }

    // Clone to reuse original targetOffset later
    const basePosition = $.extend({}, targetOffset);

    // Force my and at to have valid horizontal and vertical positions
    // if a value is missing or invalid, it will be converted to center
    // eslint-disable-next-line func-names
    $.each(['my', 'at'], function () {
      let pos = (options[this] || '').split(' ');

      if (pos.length === 1) {
        // eslint-disable-next-line no-nested-ternary
        pos = regexHorizontal.test(pos[0])
          ? pos.concat(['center'])
          : regexVertical.test(pos[0])
          ? ['center'].concat(pos)
          : ['center', 'center'];
      }
      pos[0] = regexHorizontal.test(pos[0]) ? pos[0] : 'center';
      pos[1] = regexVertical.test(pos[1]) ? pos[1] : 'center';

      // Calculate offsets
      const horizontalOffset = regexOffset.exec(pos[0]);
      const verticalOffset = regexOffset.exec(pos[1]);
      offsets[this] = [
        horizontalOffset ? horizontalOffset[0] : 0,
        verticalOffset ? verticalOffset[0] : 0,
      ];

      // Reduce to just the positions without the offsets
      options[this] = [
        regexPosition.exec(pos[0])[0],
        regexPosition.exec(pos[1])[0],
      ];
    });

    // Normalize collision option
    if (collision.length === 1) {
      // eslint-disable-next-line prefer-destructuring
      collision[1] = collision[0];
    }

    if (options.at[0] === 'right') {
      basePosition.left += targetWidth;
    } else if (options.at[0] === 'center') {
      basePosition.left += targetWidth / 2;
    }

    if (options.at[1] === 'bottom') {
      basePosition.top += targetHeight;
    } else if (options.at[1] === 'center') {
      basePosition.top += targetHeight / 2;
    }

    const atOffset = getOffsets(offsets.at, targetWidth, targetHeight);
    basePosition.left += atOffset[0];
    basePosition.top += atOffset[1];

    // eslint-disable-next-line func-names
    return this.each(function () {
      let using;
      const elem = $(this);
      const elemWidth = elem.outerWidth();
      const elemHeight = elem.outerHeight();
      const marginLeft = parseCss(this, 'marginLeft');
      const marginTop = parseCss(this, 'marginTop');
      const collisionWidth =
        elemWidth +
        marginLeft +
        parseCss(this, 'marginRight') +
        scrollInfo.width;
      const collisionHeight =
        elemHeight +
        marginTop +
        parseCss(this, 'marginBottom') +
        scrollInfo.height;
      const position = $.extend({}, basePosition);
      const myOffset = getOffsets(
        offsets.my,
        elem.outerWidth(),
        elem.outerHeight(),
      );

      if (options.my[0] === 'right') {
        position.left -= elemWidth;
      } else if (options.my[0] === 'center') {
        position.left -= elemWidth / 2;
      }

      if (options.my[1] === 'bottom') {
        position.top -= elemHeight;
      } else if (options.my[1] === 'center') {
        position.top -= elemHeight / 2;
      }

      position.left += myOffset[0];
      position.top += myOffset[1];

      const collisionPosition = {
        marginLeft,
        marginTop,
      };

      // eslint-disable-next-line func-names
      $.each(['left', 'top'], function (i, dir) {
        if (collisions[collision[i]]) {
          collisions[collision[i]][dir](position, {
            targetWidth,
            targetHeight,
            elemWidth,
            elemHeight,
            collisionPosition,
            collisionWidth,
            collisionHeight,
            offset: [atOffset[0] + myOffset[0], atOffset[1] + myOffset[1]],
            my: options.my,
            at: options.at,
            within,
            elem,
          });
        }
      });

      if (options.using) {
        // Adds feedback as second argument to using callback, if present
        // eslint-disable-next-line func-names
        using = function (props) {
          const left = targetOffset.left - position.left;
          const right = left + targetWidth - elemWidth;
          const top = targetOffset.top - position.top;
          const bottom = top + targetHeight - elemHeight;
          const feedback = {
            target: {
              element: target,
              left: targetOffset.left,
              top: targetOffset.top,
              width: targetWidth,
              height: targetHeight,
            },
            element: {
              element: elem,
              left: position.left,
              top: position.top,
              width: elemWidth,
              height: elemHeight,
            },
            // eslint-disable-next-line no-nested-ternary
            horizontal: right < 0 ? 'left' : left > 0 ? 'right' : 'center',
            // eslint-disable-next-line no-nested-ternary
            vertical: bottom < 0 ? 'top' : top > 0 ? 'bottom' : 'middle',
          };
          if (targetWidth < elemWidth && abs(left + right) < targetWidth) {
            feedback.horizontal = 'center';
          }
          if (targetHeight < elemHeight && abs(top + bottom) < targetHeight) {
            feedback.vertical = 'middle';
          }
          if (max(abs(left), abs(right)) > max(abs(top), abs(bottom))) {
            feedback.important = 'horizontal';
          } else {
            feedback.important = 'vertical';
          }
          options.using.call(this, props, feedback);
        };
      }

      elem.offset($.extend(position, { using }));
    });
  };

  // Although $.ui.position is not built to be called directly, some legacy code
  // may have checks for the presence of $.ui.position, which can be used to
  // confirm the presence of jQuery UI position's API, as opposed to the more
  // limited version provided by jQuery.
  if (!$.hasOwnProperty('ui')) {
    $.ui = {};
  }
  $.ui.position = collisions;
})(jQuery);
;
/**
 * @file
 * Bootstrap Modals.
 *
 * @param {jQuery} $
 * @param {Drupal} Drupal
 * @param {Drupal.bootstrap} Bootstrap
 * @param {Attributes} Attributes
 */
(function ($, Drupal, Bootstrap, Attributes) {
  'use strict';

  /**
   * Document jQuery object.
   *
   * @type {jQuery}
   */
  var $document = $(document);

  /**
   * Finds the first available and visible focusable input element.
   *
   * This is abstracted from the main code below so sub-themes can override
   * this method to return their own element if desired.
   *
   * @param {Modal} modal
   *   The Bootstrap modal instance.
   *
   * @return {jQuery}
   *   A jQuery object containing the element that should be focused. Note: if
   *   this object contains multiple elements, only the first visible one will
   *   be used.
   */
  Bootstrap.modalFindFocusableElement = function (modal) {
    return modal.$dialogBody.find(':input,:button,.btn').not('.visually-hidden,.sr-only');
  };

  $document.on('shown.bs.modal', function (e) {
    var $modal = $(e.target);
    var modal = $modal.data('bs.modal');

    // Check if there are any CKEditor 5 instances
    var $ckeditor = $modal.find('[data-ckeditor5-id]');
    if ($ckeditor.length) {

      // Move the overlay wrapper inside the modal so it can be interacted with
      $('.ck-body-wrapper').appendTo($modal);
    }

    // Focus the first input element found.
    if (modal && modal.options.focusInput) {
      var $focusable = Bootstrap.modalFindFocusableElement(modal);
      if ($focusable && $focusable[0]) {
        var $input = $focusable.filter(':visible:first').focus();

        // Select text if input is text.
        if (modal.options.selectText && $input.is(':text')) {
          $input[0].setSelectionRange(0, $input[0].value.length)
        }
      }
      else if (modal.$close.is(':visible')) {
        modal.$close.focus();
      }
    }
  });

  /**
   * Only process this once.
   */
  Bootstrap.once('modal', function (settings) {

    /**
     * Replace the Bootstrap Modal jQuery plugin definition.
     *
     * This adds a little bit of functionality so it works better with Drupal.
     */
    Bootstrap.replacePlugin('modal', function () {
      var BootstrapModal = this;

      // Override the Modal constructor.
      Bootstrap.Modal = function (element, options) {
        this.$body               = $(document.body);
        this.$element            = $(element);
        this.$dialog             = this.$element.find('.modal-dialog');
        this.$header             = this.$dialog.find('.modal-header');
        this.$title              = this.$dialog.find('.modal-title');
        this.$close              = this.$header.find('.close');
        this.$footer             = this.$dialog.find('.modal-footer');
        this.$content            = this.$dialog.find('.modal-content');
        this.$dialogBody         = this.$dialog.find('.modal-body');
        this.$backdrop           = null;
        this.isShown             = null;
        this.originalBodyPad     = null;
        this.scrollbarWidth      = 0;
        this.ignoreBackdropClick = false;
        this.options             = this.mapDialogOptions(options);
      };

      // Extend defaults to take into account for theme settings.
      Bootstrap.Modal.DEFAULTS = $.extend({}, BootstrapModal.DEFAULTS, {
        animation: !!settings.modal_animation,
        backdrop: settings.modal_backdrop === 'static' ? 'static' : !!settings.modal_backdrop,
        focusInput: !!settings.modal_focus_input,
        selectText: !!settings.modal_select_text,
        keyboard: !!settings.modal_keyboard,
        remote: null,
        show: !!settings.modal_show,
        size: settings.modal_size
      });

      // Copy over the original prototype methods.
      Bootstrap.Modal.prototype = BootstrapModal.prototype;

      /**
       * Handler for $.fn.modal('destroy').
       */
      Bootstrap.Modal.prototype.destroy = function () {
        this.hide();
        Drupal.detachBehaviors(this.$element[0]);
        this.$element.removeData('bs.modal').remove();
      };

      /**
       * Initialize the modal.
       */
      Bootstrap.Modal.prototype.init = function () {
        if (this.options.remote) {
          this.$content.load(this.options.remote, $.proxy(function () {
            this.$element.trigger('loaded.bs.modal');
          }, this));
        }
      };

      /**
       * Map dialog options.
       *
       * Note: this is primarily for use in modal.jquery.ui.bridge.js.
       *
       * @param {Object} options
       *   The passed options.
       */
      Bootstrap.Modal.prototype.mapDialogOptions = function (options) {
        return options || {};
      }

      // Modal jQuery Plugin Definition.
      var Plugin = function () {
        // Extract the arguments.
        var args = Array.prototype.slice.call(arguments);
        var method = args[0];
        var options = args[1] || {};
        var relatedTarget = args[2] || null;
        // Move arguments down if no method was passed.
        if ($.isPlainObject(method)) {
          relatedTarget = options || null;
          options = method;
          method = null;
        }
        var ret = void 0;
        this.each(function () {
          var $this   = $(this);
          var data    = $this.data('bs.modal');
          var initialize = false;

          // Immediately return if there's no instance to invoke a valid method.
          var showMethods = ['open', 'show', 'toggle'];
          if (!data && method && showMethods.indexOf(method) === -1) {
            return;
          }

          options = Bootstrap.normalizeObject($.extend({}, Bootstrap.Modal.DEFAULTS, data && data.options, $this.data(), options));
          delete options['bs.modal'];

          if (!data) {
            $this.data('bs.modal', (data = new Bootstrap.Modal(this, options)));
            initialize = true;
          }

          // Initialize the modal.
          if (initialize || (!method && !args.length)) {
            data.init();
          }

          // Explicit method passed.
          if (method) {
            if (typeof data[method] === 'function') {
              try {
                ret = data[method].apply(data, args.slice(1));
              }
              catch (e) {
                Drupal.throwError(e);
              }
            }
            else {
              Bootstrap.unsupported('method', method);
            }
          }
          // No method, set options and open if necessary.
          else {
            data.option(options);
            if (options.show && !data.isShown) {
              data.show(relatedTarget);
            }
          }
        });

        // If just one element and there was a result returned for the option passed,
        // then return the result. Otherwise, just return the jQuery object.
        return this.length === 1 && ret !== void 0 ? ret : this;
      };

      // Replace the plugin constructor with the new Modal constructor.
      Plugin.Constructor = Bootstrap.Modal;

      // Replace the data API so that it calls $.fn.modal rather than Plugin.
      // This allows sub-themes to replace the jQuery Plugin if they like with
      // out having to redo all this boilerplate.
      $document
        .off('click.bs.modal.data-api')
        .on('click.bs.modal.data-api', '[data-toggle="modal"]', function (e) {
          var $this   = $(this);
          var href    = $this.attr('href');
          var target  = $this.attr('data-target') || (href && href.replace(/.*(?=#[^\s]+$)/, '')); // strip for ie7
          var $target = $document.find(target);
          var options  = $target.data('bs.modal') ? 'toggle' : $.extend({ remote: !/#/.test(href) && href }, $target.data(), $this.data());

          if ($this.is('a')) e.preventDefault();

          $target.one('show.bs.modal', function (showEvent) {
            // Only register focus restorer if modal will actually get shown.
            if (showEvent.isDefaultPrevented()) return;
            $target.one('hidden.bs.modal', function () {
              $this.is(':visible') && $this.trigger('focus');
            });
          });
          $target.modal(options, this);
        });

      return Plugin;
    });

    /**
     * Extend Drupal theming functions.
     */
    $.extend(Drupal.theme, /** @lend Drupal.theme */ {
      /**
       * Theme function for a Bootstrap Modal.
       *
       * @param {Object} [variables]
       *   An object containing key/value pairs of variables.
       *
       * @return {string}
       *   The HTML for the modal.
       */
      bootstrapModal: function (variables) {
        var output = '';
        var settings = drupalSettings.bootstrap || {};
        var defaults = {
          attributes: {
            class: ['modal'],
            tabindex: -1,
            role: 'dialog'
          },
          body: '',
          closeButton: true,
          description: {
            attributes: {
              class: ['help-block']
            },
            content: null,
            position: 'before'
          },
          footer: '',
          id: 'drupal-modal',
          size: settings.modal_size ? settings.modal_size : '',
          title: {
            attributes: {
              class: ['modal-title']
            },
            content: Drupal.t('Loading...'),
            html: false,
            tag: 'h4'
          }
        };
        variables = $.extend(true, {}, defaults, variables);

        var attributes = Attributes.create(defaults.attributes).merge(variables.attributes);
        attributes.set('id', attributes.get('id', variables.id));

        if (settings.modal_animation) {
          attributes.addClass('fade');
        }

        // Build the modal wrapper.
        output += '<div' + attributes + '>';

        // Build the modal-dialog wrapper.
        output += Drupal.theme('bootstrapModalDialog', _.omit(variables, 'attributes'));

        // Close the modal wrapper.
        output += '</div>';

        // Return the constructed modal.
        return output;
      },

      /**
       * Theme function for a Bootstrap Modal dialog markup.
       *
       * @param {Object} [variables]
       *   An object containing key/value pairs of variables.
       *
       * @return {string}
       *   The HTML for the modal close button.
       */
      bootstrapModalDialog: function (variables) {
        var output = '';

        var defaults = {
          attributes: {
            class: ['modal-dialog'],
            role: 'document'
          },
          id: 'drupal-modal'
        };
        variables = $.extend(true, {}, defaults, variables);

        var attributes = Attributes.create(defaults.attributes).merge(variables.attributes);
        attributes.set('id', attributes.get('id', variables.id + '--dialog'));

        if (variables.size) {
          attributes.addClass(variables.size);
        }
        output += '<div' + attributes + '>';

        // Build the modal-content wrapper.
        output += Drupal.theme('bootstrapModalContent', _.omit(variables, 'attributes'));

        // Close the modal-dialog wrapper.
        output += '</div>';
        return output;
      },

      /**
       * Theme function for a Bootstrap Modal content markup.
       *
       * @param {Object} [variables]
       *   An object containing key/value pairs of variables.
       *
       * @return {string}
       *   The HTML for the modal close button.
       */
      bootstrapModalContent: function (variables) {
        var output = '';

        var defaults = {
          attributes: {
            class: ['modal-content']
          },
          id: 'drupal-modal'
        };
        variables = $.extend(true, {}, defaults, variables);

        var attributes = Attributes.create(defaults.attributes).merge(variables.attributes);
        attributes.set('id', attributes.get('id', variables.id + '--content'));

        // Build the modal-content wrapper.
        output += '<div' + attributes + '>';
        variables = _.omit(variables, 'attributes');

        // Build the header wrapper and title.
        output += Drupal.theme('bootstrapModalHeader', variables);

        // Build the body.
        output += Drupal.theme('bootstrapModalBody', variables);

        // Build the footer.
        output += Drupal.theme('bootstrapModalFooter', variables);

        // Close the modal-content wrapper.
        output += '</div>';

        return output;
      },

      /**
       * Theme function for a Bootstrap Modal body markup.
       *
       * @param {Object} [variables]
       *   An object containing key/value pairs of variables.
       *
       * @return {string}
       *   The HTML for the modal close button.
       */
      bootstrapModalBody: function (variables) {
        var output = '';

        var defaults = {
          attributes: {
            class: ['modal-body']
          },
          body: '',
          description: {
            attributes: {
              class: ['help-block']
            },
            content: null,
            position: 'before'
          },
          id: 'drupal-modal'
        };
        variables = $.extend(true, {}, defaults, variables);

        var attributes = Attributes.create(defaults.attributes).merge(variables.attributes);
        attributes.set('id', attributes.get('id', variables.id + '--body'));

        output += '<div' + attributes + '>';

        if (typeof variables.description === 'string') {
          variables.description = $.extend({}, defaults.description, { content: variables.description });
        }

        var description = variables.description;
        description.attributes = Attributes.create(defaults.description.attributes).merge(description.attributes);

        if (description.content && description.position === 'invisible') {
          description.attributes.addClass('sr-only');
        }

        if (description.content && description.position === 'before') {
          output += '<p' + description.attributes + '>' + description.content + '</p>';
        }

        output += variables.body;

        if (description.content && (description.position === 'after' || description.position === 'invisible')) {
          output += '<p' + description.attributes + '>' + description.content + '</p>';
        }

        output += '</div>';

        return output;
      },

      /**
       * Theme function for a Bootstrap Modal close button.
       *
       * @param {Object} [variables]
       *   An object containing key/value pairs of variables.
       *
       * @return {string}
       *   The HTML for the modal close button.
       */
      bootstrapModalClose: function (variables) {
        var defaults = {
          attributes: {
            'aria-label': Drupal.t('Close'),
            class: ['close'],
            'data-dismiss': 'modal',
            type: 'button'
          }
        };
        variables = $.extend(true, {}, defaults, variables);
        var attributes = Attributes.create(defaults.attributes).merge(variables.attributes);
        return '<button' + attributes + '><span aria-hidden="true">&times;</span></button>';
      },

      /**
       * Theme function for a Bootstrap Modal footer.
       *
       * @param {Object} [variables]
       *   An object containing key/value pairs of variables.
       * @param {boolean} [force]
       *   Flag to force rendering the footer, regardless if there's content.
       *
       * @return {string}
       *   The HTML for the modal footer.
       */
      bootstrapModalFooter: function (variables, force) {
        var output = '';
        var defaults = {
          attributes: {
            class: ['modal-footer']
          },
          footer: '',
          id: 'drupal-modal'
        };

        variables = $.extend(true, {}, defaults, variables);

        if (force || variables.footer) {
          var attributes = Attributes.create(defaults.attributes).merge(variables.attributes);
          attributes.set('id', attributes.get('id', variables.id + '--footer'));
          output += '<div' + attributes + '>';
          output += variables.footer;
          output += '</div>';
        }

        return output;
      },

      /**
       * Theme function for a Bootstrap Modal header.
       *
       * @param {Object} [variables]
       *   An object containing key/value pairs of variables.
       *
       * @return {string}
       *   The HTML for the modal header.
       */
      bootstrapModalHeader: function (variables) {
        var output = '';

        var defaults = {
          attributes: {
            class: ['modal-header']
          },
          closeButton: true,
          id: 'drupal-modal',
          title: {
            attributes: {
              class: ['modal-title']
            },
            content: Drupal.t('Loading...'),
            html: false,
            tag: 'h4'
          }
        };
        variables = $.extend(true, {}, defaults, variables);

        if (typeof variables.title === 'string') {
          variables.title = $.extend({}, defaults.title, { content: variables.title });
        }

        var title = Drupal.theme('bootstrapModalTitle', variables.title);
        if (title) {
          var attributes = Attributes.create(defaults.attributes).merge(variables.attributes);
          attributes.set('id', attributes.get('id', variables.id + '--header'));

          output += '<div' + attributes + '>';

          if (variables.closeButton) {
            output += Drupal.theme('bootstrapModalClose', _.omit(variables, 'attributes'));
          }

          output += title;

          output += '</div>';
        }

        return output;
      },

      /**
       * Theme function for a Bootstrap Modal title.
       *
       * @param {Object} [variables]
       *   An object containing key/value pairs of variables.
       *
       * @return {string}
       *   The HTML for the modal title.
       */
      bootstrapModalTitle: function (variables) {
        var output = '';

        var defaults = {
          attributes: {
            class: ['modal-title']
          },
          closeButton: true,
          id: 'drupal-modal',
          content: Drupal.t('Loading...'),
          html: false,
          tag: 'h4'
        };

        if (typeof variables === 'string') {
          variables = $.extend({}, defaults, { content: title });
        }

        variables = $.extend(true, {}, defaults, variables);

        var attributes = Attributes.create(defaults.attributes).merge(variables.attributes);
        attributes.set('id', attributes.get('id', variables.id + '--title'));

        output += '<' + Drupal.checkPlain(variables.tag) + Attributes.create(defaults.attributes).merge(variables.attributes) + '>';

        if (variables.closeButton) {
          output += Drupal.theme('bootstrapModalClose', _.omit(variables, 'attributes'));
        }

        output += (variables.html ? variables.content : Drupal.checkPlain(variables.content));

        output += '</' + Drupal.checkPlain(variables.tag) + '>';

        return output;
      }

    })

  });

})(window.jQuery, window.Drupal, window.Drupal.bootstrap, window.Attributes);
;
/**
 * @file
 * dialog.js
 */
(function ($, Drupal, Bootstrap, Attributes) {

  Bootstrap.Dialog = Bootstrap.Dialog || {};

  /**
   * A collection of Drupal dialog handlers.
   *
   * @type {Object<String, Drupal.bootstrap.Dialog.Handler>}
   */
  Bootstrap.Dialog.handlers = {};

  /**
   * @class Drupal.bootstrap.Dialog.Handler
   *
   * @param type
   * @param data
   */
  Bootstrap.Dialog.Handler = function (type, data) {
    this.ctor = $.fn.modal;
    this.extend = null;
    this.plugin = 'modal';
    this.prefix = 'modal';
    this.themeHooks = {
      modal: 'bootstrapModal',
      dialog: 'bootstrapModalDialog',
      header: 'bootstrapModalHeader',
      title: 'bootstrapModalTitle',
      close: 'bootstrapModalClose',
      content: 'bootstrapModalContent',
      body: 'bootstrapModalBody',
      footer: 'bootstrapModalFooter',
    };
    this.type = type;
    this.selectors = {
      dialog: '.modal-dialog',
      header: '.modal-header',
      title: '.modal-title',
      close: '.close',
      content: '.modal-content',
      body: '.modal-body',
      footer: '.modal-footer',
      buttons: '.modal-buttons'
    };

    // Extend the object with subclassed data.
    $.extend(this, data);

    // Extend the jQuery plugin.
    if (this.extend) {
      Bootstrap.extend(this.plugin, this.extend);
    }
  };

  /**
   * Retrieves a Drupal dialog type handler.
   *
   * @param {String|HTMLElement|jQuery} type
   *   The dialog type to retrieve.
   *
   * @return {Drupal.bootstrap.Dialog.Handler}
   *   A Bootstrap.Dialog.Handler instance.
   */
  Bootstrap.Dialog.Handler.get = function (type) {
    if (type instanceof $) {
      type = type[0];
    }
    if (type instanceof HTMLElement) {
      type = type.dialogType;
    }
    if (!type) {
      type = 'modal';
    }
    if (!Bootstrap.Dialog.handlers[type]) {
      Bootstrap.Dialog.handlers[type] = new Bootstrap.Dialog.Handler();
    }
    return Bootstrap.Dialog.handlers[type];
  };

  /**
   * Registers a Drupal dialog type handler.
   *
   * @param {String} type
   *   The dialog type to
   * @param {Object} [data]
   *   Optional. Additional data to use to create the dialog handler. By
   *   default, this assumes values relative to the Bootstrap Modal plugin.
   */
  Bootstrap.Dialog.Handler.register = function (type, data) {
    Bootstrap.Dialog.handlers[type] = new Bootstrap.Dialog.Handler(type, data);
  };

  Bootstrap.Dialog.Handler.prototype.invoke = function (context) {
    var args = Array.prototype.slice.call(arguments);
    return this.ctor.apply(context, args.slice(1));
  };

  Bootstrap.Dialog.Handler.prototype.theme = function (hook) {
    var args = Array.prototype.slice.call(arguments);
    return $(Drupal.theme.apply(Drupal.theme, [this.themeHooks[hook]].concat(args.slice(1))));
  };

  /**
   * Ensures a DOM element has the appropriate structure for a modal.
   *
   * Note: this can get a little tricky. Core potentially already
   * semi-processes a "dialog" if was created using an Ajax command
   * (i.e. prepareDialogButtons in drupal.ajax.js). Because of this, the
   * contents (HTML) of the existing element cannot simply be dumped into a
   * newly created modal. This would destroy any existing event bindings.
   * Instead, the contents must be "moved" (appended) to the new modal and
   * then "moved" again back to the to the existing container as needed.
   *
   * @param {HTMLElement|jQuery} element
   *   The element to ensure is a modal structure.
   * @param {Object} options
   *   THe dialog options to use to construct the modal.
   */
  Bootstrap.Dialog.Handler.prototype.ensureModalStructure = function (element, options) {
    var $element = $(element);

    // Immediately return if the modal was already converted into a proper modal.
    if ($element.is('[data-drupal-theme="' + this.themeHooks.modal + '"]')) {
      return;
    }

    var attributes = Attributes.create(element).remove('style').set('data-drupal-theme', this.themeHooks.modal);

    // Merge in trigger data attributes.
    if (options.$trigger && options.$trigger[0]) {
      /** @var {HTMLElement} trigger */
      var trigger = options.$trigger[0];
      var data = {};
      for (var i = 0, l = trigger.attributes.length; i < l; i++) {
        var name = trigger.attributes[i].name;
        if (name && name.substring(0, 5) === 'data-') {
          data[name] = trigger.getAttribute(name);
        }
      }
      attributes.merge(data);
    }

    options = $.extend(true, {}, options, {
      attributes: attributes,
    });

    // Create a new modal.
    var $modal = this.theme('modal', options);

    // Store a reference to the content inside the existing element container.
    // This references the actual DOM node elements which will allow
    // jQuery to "move" then when appending below. Using $.fn.children()
    // does not return any text nodes present and $.fn.html() only returns
    // a string representation of the content, which effectively destroys
    // any prior event bindings or processing.
    var $body = $element.find(this.selectors.body);
    var $existing = $body[0] ? $body.contents() : $element.contents();

    // Set the attributes of the dialog to that of the newly created modal.
    $element.attr(Attributes.create($modal).toPlainObject());

    // Append the newly created modal markup.
    $element.append($modal.html());

    // Move the existing HTML into the modal markup that was just appended.
    $element.find(this.selectors.body).append($existing);
  };

})(jQuery, Drupal, Drupal.bootstrap, Attributes);
;
/**
 * @file
 * Bootstrap Modals.
 *
 * @param {jQuery} $
 * @param {Drupal} Drupal
 * @param {Drupal.bootstrap} Bootstrap
 * @param {Attributes} Attributes
 * @param {drupalSettings} drupalSettings
 */
(function ($, Drupal, Bootstrap, Attributes, drupalSettings) {
  'use strict';

  /**
   * Only process this once.
   */
  Bootstrap.once('modal.jquery.ui.bridge', function (settings) {
    // RTL support.
    var rtl = document.documentElement.getAttribute('dir').toLowerCase() === 'rtl';

    // Override drupal.dialog button classes. This must be done on DOM ready
    // since core/drupal.dialog technically depends on this file and has not
    // yet set their default settings.
    $(function () {
      drupalSettings.dialog.buttonClass = 'btn';
      drupalSettings.dialog.buttonPrimaryClass = 'btn-primary';
    });

    // Create the "dialog" plugin bridge.
    Bootstrap.Dialog.Bridge = function (options) {
      var args = Array.prototype.slice.call(arguments);
      var $element = $(this);
      var type = options && options.dialogType || $element[0].dialogType || 'modal';

      $element[0].dialogType = type;

      var handler = Bootstrap.Dialog.Handler.get(type);

      // When only options are passed, jQuery UI dialog treats this like a
      // initialization method. Destroy any existing Bootstrap modal and
      // recreate it using the contents of the dialog HTML.
      if (args.length === 1 && typeof options === 'object') {
        this.each(function () {
          handler.ensureModalStructure(this, options);
        });

        // Proxy to the Bootstrap Modal plugin, indicating that this is a
        // jQuery UI dialog bridge.
        return handler.invoke(this, {
          dialogOptions: options,
          jQueryUiBridge: true
        });
      }

      // Otherwise, proxy all arguments to the Bootstrap Modal plugin.
      var ret;
      try {
        ret = handler.invoke.apply(handler, [this].concat(args));
      }
      catch (e) {
        Bootstrap.warn(e);
      }

      // If just one element and there was a result returned for the option passed,
      // then return the result. Otherwise, just return the jQuery object.
      return this.length === 1 && ret !== void 0 ? ret : this;
    };

    // Assign the jQuery "dialog" plugin to use to the bridge.
    Bootstrap.createPlugin('dialog', Bootstrap.Dialog.Bridge);

    // Create the "modal" plugin bridge.
    Bootstrap.Modal.Bridge = function () {
      var Modal = this;

      return {
        DEFAULTS: {
          // By default, this option is disabled. It's only flagged when a modal
          // was created using $.fn.dialog above.
          jQueryUiBridge: false
        },
        prototype: {

          /**
           * Handler for $.fn.dialog('close').
           */
          close: function () {
            var _this = this;

            this.hide.apply(this, arguments);

            // For some reason (likely due to the transition event not being
            // registered properly), the backdrop doesn't always get removed
            // after the above "hide" method is invoked . Instead, ensure the
            // backdrop is removed after the transition duration by manually
            // invoking the internal "hideModal" method shortly thereafter.
            setTimeout(function () {
              if (!_this.isShown && _this.$backdrop) {
                _this.hideModal();
              }
            }, (Modal.TRANSITION_DURATION !== void 0 ? Modal.TRANSITION_DURATION : 300) + 10);
          },

          /**
           * Creates any necessary buttons from dialog options.
           */
          createButtons: function () {
            var handler = Bootstrap.Dialog.Handler.get(this.$element);
            this.$footer.find(handler.selectors.buttons).remove();

            // jQuery UI supports both objects and arrays. Unfortunately
            // developers have misunderstood and abused this by simply placing
            // the objects that should be in an array inside an object with
            // arbitrary keys (likely to target specific buttons as a hack).
            var buttons = this.options.dialogOptions && this.options.dialogOptions.buttons || [];
            if (!Array.isArray(buttons)) {
              var array = [];
              for (var k in buttons) {
                // Support the proper object values: label => click callback.
                if (typeof buttons[k] === 'function') {
                  array.push({
                    label: k,
                    click: buttons[k],
                  });
                }
                // Support nested objects, but log a warning.
                else if (buttons[k].text || buttons[k].label) {
                  Bootstrap.warn('Malformed jQuery UI dialog button: @key. The button object should be inside an array.', {
                    '@key': k
                  });
                  array.push(buttons[k]);
                }
                else {
                  Bootstrap.unsupported('button', k, buttons[k]);
                }
              }
              buttons = array;
            }

            if (buttons.length) {
              var $buttons = $('<div class="modal-buttons"/>').appendTo(this.$footer);
              for (var i = 0, l = buttons.length; i < l; i++) {
                var button = buttons[i];
                var $button = $(Drupal.theme('bootstrapModalDialogButton', button));

                // Invoke the "create" method for jQuery UI buttons.
                if (typeof button.create === 'function') {
                  button.create.call($button[0]);
                }

                // Bind the "click" method for jQuery UI buttons to the modal.
                if (typeof button.click === 'function') {
                  $button.on('click', button.click.bind(this.$element));
                }

                $buttons.append($button);
              }
            }

            // Toggle footer visibility based on whether it has child elements.
            this.$footer[this.$footer.children()[0] ? 'show' : 'hide']();
          },

          /**
           * Initializes the Bootstrap Modal.
           */
          init: function () {
            var handler = Bootstrap.Dialog.Handler.get(this.$element);
            if (!this.$dialog) {
              this.$dialog = this.$element.find(handler.selectors.dialog);
            }
            this.$dialog.addClass('js-drupal-dialog');

            if (!this.$header) {
              this.$header = this.$dialog.find(handler.selectors.header);
            }
            if (!this.$title) {
              this.$title = this.$dialog.find(handler.selectors.title);
            }
            if (!this.$close) {
              this.$close = this.$header.find(handler.selectors.close);
            }
            if (!this.$footer) {
              this.$footer = this.$dialog.find(handler.selectors.footer);
            }
            if (!this.$content) {
              this.$content = this.$dialog.find(handler.selectors.content);
            }
            if (!this.$dialogBody) {
              this.$dialogBody = this.$dialog.find(handler.selectors.body);
            }

            // Relay necessary events.
            if (this.options.jQueryUiBridge) {
              this.$element.on('hide.bs.modal',   Bootstrap.relayEvent(this.$element, 'dialogbeforeclose', false));
              this.$element.on('hidden.bs.modal', Bootstrap.relayEvent(this.$element, 'dialogclose', false));
              this.$element.on('show.bs.modal',   Bootstrap.relayEvent(this.$element, 'dialogcreate', false));
              this.$element.on('shown.bs.modal',  Bootstrap.relayEvent(this.$element, 'dialogopen', false));
            }

            // Create a footer if one doesn't exist.
            // This is necessary in case dialog.ajax.js decides to add buttons.
            if (!this.$footer[0]) {
              this.$footer = handler.theme('footer', {}, true).insertAfter(this.$dialogBody);
            }

            // Map the initial options.
            $.extend(true, this.options, this.mapDialogOptions(this.options));

            // Update buttons.
            this.createButtons();

            // Now call the parent init method.
            this.super();

            // Handle autoResize option (this is a drupal.dialog option).
            if (this.options.dialogOptions && this.options.dialogOptions.autoResize && this.options.dialogOptions.position) {
              this.position(this.options.dialogOptions.position);
            }

            // If show is enabled and currently not shown, show it.
            if (this.options.jQueryUiBridge && this.options.show && !this.isShown) {
              this.show();
            }
          },

          /**
           * Handler for $.fn.dialog('instance').
           */
          instance: function () {
            Bootstrap.unsupported('method', 'instance', arguments);
          },

          /**
           * Handler for $.fn.dialog('isOpen').
           */
          isOpen: function () {
            return !!this.isShown;
          },

          /**
           * Maps dialog options to the modal.
           *
           * @param {Object} options
           *   The options to map.
           */
          mapDialogOptions: function (options) {
            // Retrieve the dialog handler for this type.
            var handler = Bootstrap.Dialog.Handler.get(this.$element);

            var mappedOptions = {};
            var dialogOptions = options.dialogOptions || {};

            // Remove any existing dialog options.
            delete options.dialogOptions;

            // Separate Bootstrap modal options from jQuery UI dialog options.
            for (var k in options) {
              if (Modal.DEFAULTS.hasOwnProperty(k)) {
                mappedOptions[k] = options[k];
              }
              else {
                dialogOptions[k] = options[k];
              }
            }


            // Handle CSS properties.
            var cssUnitRegExp = /^([+-]?(?:\d+|\d*\.\d+))([a-z]*|%)?$/;
            var parseCssUnit = function (value, defaultUnit) {
              var parts = ('' + value).match(cssUnitRegExp);
              return parts && parts[1] !== void 0 ? parts[1] + (parts[2] || defaultUnit || 'px') : null;
            };
            var styles = {};
            var cssProperties = ['height', 'maxHeight', 'maxWidth', 'minHeight', 'minWidth', 'width'];
            for (var i = 0, l = cssProperties.length; i < l; i++) {
              var prop = cssProperties[i];
              if (dialogOptions[prop] !== void 0) {
                var value = parseCssUnit(dialogOptions[prop]);
                if (value) {
                  styles[prop] = value;

                  // If there's a defined height of some kind, enforce the modal
                  // to use flex (on modern browsers). This will ensure that
                  // the core autoResize calculations don't cause the content
                  // to overflow.
                  if (dialogOptions.autoResize && (prop === 'height' || prop === 'maxHeight')) {
                    styles.display = 'flex';
                    styles.flexDirection = 'column';
                    this.$dialogBody.css('overflow', 'scroll');
                  }
                }
              }
            }

            // Apply mapped CSS styles to the modal-content container.
            this.$content.css(styles);

            // Handle deprecated "dialogClass" option by merging it with "classes".
            var classesMap = {
              'ui-dialog': 'modal-content',
              'ui-dialog-titlebar': 'modal-header',
              'ui-dialog-title': 'modal-title',
              'ui-dialog-titlebar-close': 'close',
              'ui-dialog-content': 'modal-body',
              'ui-dialog-buttonpane': 'modal-footer'
            };
            if (dialogOptions.dialogClass) {
              if (dialogOptions.classes === void 0) {
                dialogOptions.classes = {};
              }
              if (dialogOptions.classes['ui-dialog'] === void 0) {
                dialogOptions.classes['ui-dialog'] = '';
              }
              var dialogClass = dialogOptions.classes['ui-dialog'].split(' ');
              dialogClass.push(dialogOptions.dialogClass);
              dialogOptions.classes['ui-dialog'] = dialogClass.join(' ');
              delete dialogOptions.dialogClass;
            }

            // Add jQuery UI classes to elements in case developers target them
            // in callbacks.
            for (k in classesMap) {
              this.$element.find('.' + classesMap[k]).addClass(k);
            }

            // Bind events.
            var events = [
              'beforeClose', 'close',
              'create',
              'drag', 'dragStart', 'dragStop',
              'focus',
              'open',
              'resize', 'resizeStart', 'resizeStop'
            ];
            for (i = 0, l = events.length; i < l; i++) {
              var event = events[i].toLowerCase();
              if (dialogOptions[event] === void 0 || typeof dialogOptions[event] !== 'function') continue;
              this.$element.on('dialog' + event, dialogOptions[event]);
            }

            // Support title attribute on the modal.
            var title;
            if ((dialogOptions.title === null || dialogOptions.title === void 0) && (title = this.$element.attr('title'))) {
              dialogOptions.title = title;
            }

            // Handle the reset of the options.
            for (var name in dialogOptions) {
              if (!dialogOptions.hasOwnProperty(name) || dialogOptions[name] === void 0) continue;

              switch (name) {
                case 'appendTo':
                  Bootstrap.unsupported('option', name, dialogOptions.appendTo);
                  break;

                case 'autoOpen':
                  mappedOptions.show = dialogOptions.show = !!dialogOptions.autoOpen;
                  break;

                case 'classes':
                  if (dialogOptions.classes) {
                    for (var key in dialogOptions.classes) {
                      if (dialogOptions.classes.hasOwnProperty(key) && classesMap[key] !== void 0) {
                        // Run through Attributes to sanitize classes.
                        var attributes = Attributes.create().addClass(dialogOptions.classes[key]).toPlainObject();
                        var selector = '.' + classesMap[key];
                        this.$element.find(selector).addClass(attributes['class']);
                      }
                    }
                  }
                  break;

                case 'closeOnEscape':
                  mappedOptions.keyboard = !!dialogOptions.closeOnEscape;
                  if (!dialogOptions.closeOnEscape && dialogOptions.modal) {
                    mappedOptions.backdrop = 'static';
                  }
                  break;

                case 'closeText':
                  Bootstrap.unsupported('option', name, dialogOptions.closeText);
                  break;

                case 'draggable':
                  this.$content
                    .draggable({
                      handle: handler.selectors.header,
                      drag: Bootstrap.relayEvent(this.$element, 'dialogdrag'),
                      start: Bootstrap.relayEvent(this.$element, 'dialogdragstart'),
                      end: Bootstrap.relayEvent(this.$element, 'dialogdragend')
                    })
                    .draggable(dialogOptions.draggable ? 'enable' : 'disable');
                  break;

                case 'hide':
                  if (dialogOptions.hide === false || dialogOptions.hide === true) {
                    this.$element[dialogOptions.hide ? 'addClass' : 'removeClass']('fade');
                    mappedOptions.animation = dialogOptions.hide;
                  }
                  else {
                    Bootstrap.unsupported('option', name + ' (complex animation)', dialogOptions.hide);
                  }
                  break;

                case 'modal':
                  if (!dialogOptions.closeOnEscape && dialogOptions.modal) {
                    mappedOptions.backdrop = 'static';
                  }
                  else {
                    mappedOptions.backdrop = dialogOptions.modal;
                  }

                  // If not a modal and no initial position, center it.
                  if (!dialogOptions.modal && !dialogOptions.position) {
                    this.position({ my: 'center', of: window });
                  }
                  break;

                case 'position':
                  this.position(dialogOptions.position);
                  break;

                // Resizable support (must initialize first).
                case 'resizable':
                  this.$content
                    .resizable({
                      resize: Bootstrap.relayEvent(this.$element, 'dialogresize'),
                      start: Bootstrap.relayEvent(this.$element, 'dialogresizestart'),
                      end: Bootstrap.relayEvent(this.$element, 'dialogresizeend')
                    })
                    .resizable(dialogOptions.resizable ? 'enable' : 'disable');
                  break;

                case 'show':
                  if (dialogOptions.show === false || dialogOptions.show === true) {
                    this.$element[dialogOptions.show ? 'addClass' : 'removeClass']('fade');
                    mappedOptions.animation = dialogOptions.show;
                  }
                  else {
                    Bootstrap.unsupported('option', name + ' (complex animation)', dialogOptions.show);
                  }
                  break;

                case 'title':
                  this.$title.text(dialogOptions.title);
                  break;

              }
            }

            // Add the supported dialog options to the mapped options.
            mappedOptions.dialogOptions = dialogOptions;

            return mappedOptions;
          },

          /**
           * Handler for $.fn.dialog('moveToTop').
           */
          moveToTop: function () {
            Bootstrap.unsupported('method', 'moveToTop', arguments);
          },

          /**
           * Handler for $.fn.dialog('option').
           */
          option: function () {
            var clone = {options: {}};

            // Apply the parent option method to the clone of current options.
            this.super.apply(clone, arguments);

            // Merge in the cloned mapped options.
            $.extend(true, this.options, this.mapDialogOptions(clone.options));

            // Update buttons.
            this.createButtons();
          },

          position: function(position) {
            // Reset modal styling.
            this.$element.css({
              bottom: 'initial',
              overflow: 'visible',
              right: 'initial'
            });

            // Position the modal.
            this.$element.position(position);
          },

          /**
           * Handler for $.fn.dialog('open').
           */
          open: function () {
            this.show.apply(this, arguments);
          },

          /**
           * Handler for $.fn.dialog('widget').
           */
          widget: function () {
            return this.$element;
          }
        }
      };
    };

    // Extend the Bootstrap Modal plugin constructor class.
    Bootstrap.extendPlugin('modal', Bootstrap.Modal.Bridge);

    // Register default core dialog type handlers.
    Bootstrap.Dialog.Handler.register('dialog');
    Bootstrap.Dialog.Handler.register('modal');

    /**
     * Extend Drupal theming functions.
     */
    $.extend(Drupal.theme, /** @lend Drupal.theme */ {

      /**
       * Renders a jQuery UI Dialog compatible button element.
       *
       * @param {Object} button
       *   The button object passed in the dialog options.
       *
       * @return {String}
       *   The modal dialog button markup.
       *
       * @see http://api.jqueryui.com/dialog/#option-buttons
       * @see http://api.jqueryui.com/button/
       */
      bootstrapModalDialogButton: function (button) {
        var attributes = Attributes.create();

        var icon = '';
        var iconPosition = button.iconPosition || 'beginning';
        iconPosition = (iconPosition === 'end' && !rtl) || (iconPosition === 'beginning' && rtl) ? 'after' : 'before';

        // Handle Bootstrap icons differently.
        if (button.bootstrapIcon) {
          icon = Drupal.theme('icon', 'bootstrap', button.icon);
        }
        // Otherwise, assume it's a jQuery UI icon.
        // @todo Map jQuery UI icons to Bootstrap icons?
        else if (button.icon) {
          var iconAttributes = Attributes.create()
            .addClass(['ui-icon', button.icon])
            .set('aria-hidden', 'true');
          icon = '<span' + iconAttributes + '></span>';
        }

        // Label. Note: jQuery UI dialog has an inconsistency where it uses
        // "text" instead of "label", so both need to be supported.
        var value = button.label || button.text;

        // Show/hide label.
        if (icon && ((button.showLabel !== void 0 && !button.showLabel) || (button.text !== void 0 && !button.text))) {
          value = '<span' + Attributes.create().addClass('sr-only') + '>' + value + '</span>';
        }
        attributes.set('value', iconPosition === 'before' ? icon + value : value + icon);

        // Handle disabled.
        attributes[button.disabled ? 'set' :'remove']('disabled', 'disabled');

        if (button.classes) {
          attributes.addClass(Object.keys(button.classes).map(function(key) { return button.classes[key]; }));
        }
        if (button['class']) {
          attributes.addClass(button['class']);
        }
        if (button.primary) {
          attributes.addClass('btn-primary');
        }

        return Drupal.theme('button', attributes);
      }

    });

  });


})(window.jQuery, window.Drupal, window.Drupal.bootstrap, window.Attributes, window.drupalSettings);
;
/**
 * @file
 * Dialog API inspired by HTML5 dialog element.
 *
 * @see http://www.whatwg.org/specs/web-apps/current-work/multipage/commands.html#the-dialog-element
 */

(function ($, Drupal, drupalSettings) {
  /**
   * Default dialog options.
   *
   * @type {object}
   *
   * @prop {boolean} [autoOpen=true]
   * @prop {string} [dialogClass='']
   * @prop {string} [buttonClass='button']
   * @prop {string} [buttonPrimaryClass='button--primary']
   * @prop {function} close
   */
  drupalSettings.dialog = {
    autoOpen: true,
    dialogClass: '',
    // Drupal-specific extensions: see dialog.jquery-ui.js.
    buttonClass: 'button',
    buttonPrimaryClass: 'button--primary',
    // When using this API directly (when generating dialogs on the client
    // side), you may want to override this method and do
    // `jQuery(event.target).remove()` as well, to remove the dialog on
    // closing.
    close(event) {
      Drupal.dialog(event.target).close();
      Drupal.detachBehaviors(event.target, null, 'unload');
    },
  };

  /**
   * @typedef {object} Drupal.dialog~dialogDefinition
   *
   * @prop {boolean} open
   *   Is the dialog open or not.
   * @prop {*} returnValue
   *   Return value of the dialog.
   * @prop {function} show
   *   Method to display the dialog on the page.
   * @prop {function} showModal
   *   Method to display the dialog as a modal on the page.
   * @prop {function} close
   *   Method to hide the dialog from the page.
   */

  /**
   * Polyfill HTML5 dialog element with jQueryUI.
   *
   * @param {HTMLElement} element
   *   The element that holds the dialog.
   * @param {object} options
   *   jQuery UI options to be passed to the dialog.
   *
   * @return {Drupal.dialog~dialogDefinition}
   *   The dialog instance.
   */
  Drupal.dialog = function (element, options) {
    let undef;
    const $element = $(element);
    const dialog = {
      open: false,
      returnValue: undef,
    };

    function openDialog(settings) {
      settings = $.extend({}, drupalSettings.dialog, options, settings);
      // Trigger a global event to allow scripts to bind events to the dialog.
      $(window).trigger('dialog:beforecreate', [dialog, $element, settings]);
      $element.dialog(settings);
      dialog.open = true;
      $(window).trigger('dialog:aftercreate', [dialog, $element, settings]);
    }

    function closeDialog(value) {
      $(window).trigger('dialog:beforeclose', [dialog, $element]);
      $element.dialog('close');
      dialog.returnValue = value;
      dialog.open = false;
      $(window).trigger('dialog:afterclose', [dialog, $element]);
    }

    dialog.show = () => {
      openDialog({ modal: false });
    };
    dialog.showModal = () => {
      openDialog({ modal: true });
    };
    dialog.close = closeDialog;

    return dialog;
  };
})(jQuery, Drupal, drupalSettings);
;
/**
 * @file
 * Positioning extensions for dialogs.
 */

/**
 * Triggers when content inside a dialog changes.
 *
 * @event dialogContentResize
 */

(function ($, Drupal, drupalSettings, debounce, displace) {
  // autoResize option will turn off resizable and draggable.
  drupalSettings.dialog = $.extend(
    { autoResize: true, maxHeight: '95%' },
    drupalSettings.dialog,
  );

  /**
   * Position the dialog's center at the center of displace.offsets boundaries.
   *
   * @function Drupal.dialog~resetPosition
   *
   * @param {object} options
   *   Options object.
   *
   * @return {object}
   *   Altered options object.
   */
  function resetPosition(options) {
    const offsets = displace.offsets;
    const left = offsets.left - offsets.right;
    const top = offsets.top - offsets.bottom;

    const leftString = `${
      (left > 0 ? '+' : '-') + Math.abs(Math.round(left / 2))
    }px`;
    const topString = `${
      (top > 0 ? '+' : '-') + Math.abs(Math.round(top / 2))
    }px`;
    options.position = {
      my: `center${left !== 0 ? leftString : ''} center${
        top !== 0 ? topString : ''
      }`,
      of: window,
    };
    return options;
  }

  /**
   * Resets the current options for positioning.
   *
   * This is used as a window resize and scroll callback to reposition the
   * jQuery UI dialog. Although not a built-in jQuery UI option, this can
   * be disabled by setting autoResize: false in the options array when creating
   * a new {@link Drupal.dialog}.
   *
   * @function Drupal.dialog~resetSize
   *
   * @param {jQuery.Event} event
   *   The event triggered.
   *
   * @fires event:dialogContentResize
   */
  function resetSize(event) {
    const positionOptions = [
      'width',
      'height',
      'minWidth',
      'minHeight',
      'maxHeight',
      'maxWidth',
      'position',
    ];
    let adjustedOptions = {};
    let windowHeight = $(window).height();
    let option;
    let optionValue;
    let adjustedValue;
    for (let n = 0; n < positionOptions.length; n++) {
      option = positionOptions[n];
      optionValue = event.data.settings[option];
      if (optionValue) {
        // jQuery UI does not support percentages on heights, convert to pixels.
        if (
          typeof optionValue === 'string' &&
          /%$/.test(optionValue) &&
          /height/i.test(option)
        ) {
          // Take offsets in account.
          windowHeight -= displace.offsets.top + displace.offsets.bottom;
          adjustedValue = parseInt(
            0.01 * parseInt(optionValue, 10) * windowHeight,
            10,
          );
          // Don't force the dialog to be bigger vertically than needed.
          if (
            option === 'height' &&
            event.data.$element.parent().outerHeight() < adjustedValue
          ) {
            adjustedValue = 'auto';
          }
          adjustedOptions[option] = adjustedValue;
        }
      }
    }
    // Offset the dialog center to be at the center of Drupal.displace.offsets.
    if (!event.data.settings.modal) {
      adjustedOptions = resetPosition(adjustedOptions);
    }
    event.data.$element
      .dialog('option', adjustedOptions)
      .trigger('dialogContentResize');
  }

  $(window).on({
    'dialog:aftercreate': function (event, dialog, $element, settings) {
      const autoResize = debounce(resetSize, 20);
      const eventData = { settings, $element };
      if (settings.autoResize === true || settings.autoResize === 'true') {
        $element
          .dialog('option', { resizable: false, draggable: false })
          .dialog('widget')
          .css('position', 'fixed');
        $(window)
          .on('resize.dialogResize scroll.dialogResize', eventData, autoResize)
          .trigger('resize.dialogResize');
        $(document).on(
          'drupalViewportOffsetChange.dialogResize',
          eventData,
          autoResize,
        );
      }
    },
    'dialog:beforeclose': function (event, dialog, $element) {
      $(window).off('.dialogResize');
      $(document).off('.dialogResize');
    },
  });
})(jQuery, Drupal, drupalSettings, Drupal.debounce, Drupal.displace);
;
/**
 * @file
 * This file overrides the way jQuery UI focus trap works.
 *
 * When a focus event is fired while a CKEditor 5 instance is focused, do not
 * trap the focus and let CKEditor 5 manage that focus.
 */

(($) => {
  $.widget('ui.dialog', $.ui.dialog, {
    // Override core override of jQuery UI's `_allowInteraction()` so that
    // CKEditor 5 in modals can work as expected.
    // @see https://api.jqueryui.com/dialog/#method-_allowInteraction
    _allowInteraction(event) {
      return event.target.classList.contains('ck') || this._super(event);
    },
  });
})(jQuery);
;
/**
 * @file
 * Extends the Drupal AJAX functionality to integrate the dialog API.
 */

(function ($, Drupal) {
  /**
   * Initialize dialogs for Ajax purposes.
   *
   * @type {Drupal~behavior}
   *
   * @prop {Drupal~behaviorAttach} attach
   *   Attaches the behaviors for dialog ajax functionality.
   */
  Drupal.behaviors.dialog = {
    attach(context, settings) {
      const $context = $(context);

      // Provide a known 'drupal-modal' DOM element for Drupal-based modal
      // dialogs. Non-modal dialogs are responsible for creating their own
      // elements, since there can be multiple non-modal dialogs at a time.
      if (!$('#drupal-modal').length) {
        // Add 'ui-front' jQuery UI class so jQuery UI widgets like autocomplete
        // sit on top of dialogs. For more information see
        // http://api.jqueryui.com/theming/stacking-elements/.
        $('<div id="drupal-modal" class="ui-front"></div>')
          .hide()
          .appendTo('body');
      }

      // Special behaviors specific when attaching content within a dialog.
      // These behaviors usually fire after a validation error inside a dialog.
      const $dialog = $context.closest('.ui-dialog-content');
      if ($dialog.length) {
        // Remove and replace the dialog buttons with those from the new form.
        if ($dialog.dialog('option', 'drupalAutoButtons')) {
          // Trigger an event to detect/sync changes to buttons.
          $dialog.trigger('dialogButtonsChange');
        }

        // Force focus on the modal when the behavior is run.
        $dialog.dialog('widget').trigger('focus');
      }

      const originalClose = settings.dialog.close;
      // Overwrite the close method to remove the dialog on closing.
      settings.dialog.close = function (event, ...args) {
        originalClose.apply(settings.dialog, [event, ...args]);
        $(event.target).remove();
      };
    },

    /**
     * Scan a dialog for any primary buttons and move them to the button area.
     *
     * @param {jQuery} $dialog
     *   A jQuery object containing the element that is the dialog target.
     *
     * @return {Array}
     *   An array of buttons that need to be added to the button area.
     */
    prepareDialogButtons($dialog) {
      const buttons = [];
      const $buttons = $dialog.find(
        '.form-actions input[type=submit], .form-actions a.button',
      );
      $buttons.each(function () {
        const $originalButton = $(this).css({ display: 'none' });
        buttons.push({
          text: $originalButton.html() || $originalButton.attr('value'),
          class: $originalButton.attr('class'),
          click(e) {
            // If the original button is an anchor tag, triggering the "click"
            // event will not simulate a click. Use the click method instead.
            if ($originalButton.is('a')) {
              $originalButton[0].click();
            } else {
              $originalButton
                .trigger('mousedown')
                .trigger('mouseup')
                .trigger('click');
              e.preventDefault();
            }
          },
        });
      });
      return buttons;
    },
  };

  /**
   * Command to open a dialog.
   *
   * @param {Drupal.Ajax} ajax
   *   The Drupal Ajax object.
   * @param {object} response
   *   Object holding the server response.
   * @param {number} [status]
   *   The HTTP status code.
   *
   * @return {boolean|undefined}
   *   Returns false if there was no selector property in the response object.
   */
  Drupal.AjaxCommands.prototype.openDialog = function (ajax, response, status) {
    if (!response.selector) {
      return false;
    }
    let $dialog = $(response.selector);
    if (!$dialog.length) {
      // Create the element if needed.
      $dialog = $(
        `<div id="${response.selector.replace(
          /^#/,
          '',
        )}" class="ui-front"></div>`,
      ).appendTo('body');
    }
    // Set up the wrapper, if there isn't one.
    if (!ajax.wrapper) {
      ajax.wrapper = $dialog.attr('id');
    }

    // Use the ajax.js insert command to populate the dialog contents.
    response.command = 'insert';
    response.method = 'html';
    ajax.commands.insert(ajax, response, status);

    // Move the buttons to the jQuery UI dialog buttons area.
    if (!response.dialogOptions.buttons) {
      response.dialogOptions.drupalAutoButtons = true;
      response.dialogOptions.buttons =
        Drupal.behaviors.dialog.prepareDialogButtons($dialog);
    }

    // Bind dialogButtonsChange.
    $dialog.on('dialogButtonsChange', () => {
      const buttons = Drupal.behaviors.dialog.prepareDialogButtons($dialog);
      $dialog.dialog('option', 'buttons', buttons);
    });

    // Open the dialog itself.
    response.dialogOptions = response.dialogOptions || {};
    const dialog = Drupal.dialog($dialog.get(0), response.dialogOptions);
    if (response.dialogOptions.modal) {
      dialog.showModal();
    } else {
      dialog.show();
    }

    // Add the standard Drupal class for buttons for style consistency.
    $dialog.parent().find('.ui-dialog-buttonset').addClass('form-actions');
  };

  /**
   * Command to close a dialog.
   *
   * If no selector is given, it defaults to trying to close the modal.
   *
   * @param {Drupal.Ajax} [ajax]
   *   The ajax object.
   * @param {object} response
   *   Object holding the server response.
   * @param {string} response.selector
   *   The selector of the dialog.
   * @param {boolean} response.persist
   *   Whether to persist the dialog element or not.
   * @param {number} [status]
   *   The HTTP status code.
   */
  Drupal.AjaxCommands.prototype.closeDialog = function (
    ajax,
    response,
    status,
  ) {
    const $dialog = $(response.selector);
    if ($dialog.length) {
      Drupal.dialog($dialog.get(0)).close();
      if (!response.persist) {
        $dialog.remove();
      }
    }

    // Unbind dialogButtonsChange.
    $dialog.off('dialogButtonsChange');
  };

  /**
   * Command to set a dialog property.
   *
   * JQuery UI specific way of setting dialog options.
   *
   * @param {Drupal.Ajax} [ajax]
   *   The Drupal Ajax object.
   * @param {object} response
   *   Object holding the server response.
   * @param {string} response.selector
   *   Selector for the dialog element.
   * @param {string} response.optionsName
   *   Name of a key to set.
   * @param {string} response.optionValue
   *   Value to set.
   * @param {number} [status]
   *   The HTTP status code.
   */
  Drupal.AjaxCommands.prototype.setDialogOption = function (
    ajax,
    response,
    status,
  ) {
    const $dialog = $(response.selector);
    if ($dialog.length) {
      $dialog.dialog('option', response.optionName, response.optionValue);
    }
  };

  /**
   * Binds a listener on dialog creation to handle the cancel link.
   *
   * @param {jQuery.Event} e
   *   The event triggered.
   * @param {Drupal.dialog~dialogDefinition} dialog
   *   The dialog instance.
   * @param {jQuery} $element
   *   The jQuery collection of the dialog element.
   * @param {object} [settings]
   *   Dialog settings.
   */
  $(window).on('dialog:aftercreate', (e, dialog, $element, settings) => {
    $element.on('click.dialog', '.dialog-cancel', (e) => {
      dialog.close('cancel');
      e.preventDefault();
      e.stopPropagation();
    });
  });

  /**
   * Removes all 'dialog' listeners.
   *
   * @param {jQuery.Event} e
   *   The event triggered.
   * @param {Drupal.dialog~dialogDefinition} dialog
   *   The dialog instance.
   * @param {jQuery} $element
   *   jQuery collection of the dialog element.
   */
  $(window).on('dialog:beforeclose', (e, dialog, $element) => {
    $element.off('.dialog');
  });
})(jQuery, Drupal);
;
/**
 * @file
 * dialog.ajax.js
 */
(function ($, Drupal, Bootstrap) {

  Drupal.behaviors.dialog.ajaxCurrentButton = null;
  Drupal.behaviors.dialog.ajaxOriginalButton = null;

  // Intercept the success event to add the dialog type to commands.
  var success = Drupal.Ajax.prototype.success;
  Drupal.Ajax.prototype.success = function (response, status) {
    if (this.dialogType) {
      for (var i = 0, l = response.length; i < l; i++) {
        if (response[i].dialogOptions) {
          response[i].dialogType = response[i].dialogOptions.dialogType = this.dialogType;
          response[i].$trigger = response[i].dialogOptions.$trigger = $(this.element);
        }
      }
    }
    return success.apply(this, [response, status]);
  };

  var beforeSerialize = Drupal.Ajax.prototype.beforeSerialize;
  Drupal.Ajax.prototype.beforeSerialize = function (element, options) {
    // Add the dialog type currently in use.
    if (this.dialogType) {
      options.data['ajax_page_state[dialogType]'] = this.dialogType;

      // Add the dialog element ID if it can be found (useful for closing it).
      var id = $(this.element).parents('.js-drupal-dialog:first').attr('id');
      if (id) {
        options.data['ajax_page_state[dialogId]'] = id;
      }
    }
    return beforeSerialize.apply(this, arguments);
  };

  /**
   * Synchronizes a faux button with its original counterpart.
   *
   * @param {Boolean} [reset = false]
   *   Whether to reset the current and original buttons after synchronizing.
   */
  Drupal.behaviors.dialog.ajaxUpdateButtons = function (reset) {
    if (this.ajaxCurrentButton && this.ajaxOriginalButton) {
      this.ajaxCurrentButton.html(this.ajaxOriginalButton.html() || this.ajaxOriginalButton.attr('value'));
      this.ajaxCurrentButton.prop('disabled', this.ajaxOriginalButton.prop('disabled'));
    }
    if (reset) {
      this.ajaxCurrentButton = null;
      this.ajaxOriginalButton = null;
    }
  };

  $(document)
    .ajaxSend(function () {
      Drupal.behaviors.dialog.ajaxUpdateButtons();
    })
    .ajaxComplete(function () {
      Drupal.behaviors.dialog.ajaxUpdateButtons(true);
    })
  ;

  /**
   * {@inheritdoc}
   */
  Drupal.behaviors.dialog.prepareDialogButtons = function prepareDialogButtons($dialog) {
    var _this = this;
    var buttons = [];
    var $buttons = $dialog.find('.form-actions').find('button, input[type=submit], a.button, .btn');
    $buttons.each(function () {
      var $originalButton = $(this)
        // Prevent original button from being tabbed to.
        .attr('tabindex', -1)
        // Visually make the original button invisible, but don't actually hide
        // or remove it from the DOM because the click needs to be proxied from
        // the faux button created in the footer to its original counterpart.
        .css({
          display: 'block',
          width: 0,
          height: 0,
          padding: 0,
          border: 0,
          overflow: 'hidden'
        });

      buttons.push({
        // Strip all HTML from the actual text value. This value is escaped.
        // It actual HTML value will be synced with the original button's HTML
        // below in the "create" method.
        text: Bootstrap.stripHtml($originalButton) || $originalButton.attr('value'),
        class: $originalButton.attr('class').replace('use-ajax-submit', ''),
        click: function click(e) {
          e.preventDefault();
          e.stopPropagation();
          _this.ajaxCurrentButton = $(e.target);
          _this.ajaxOriginalButton = $originalButton;
          // Some core JS binds dialog buttons to the mousedown or mouseup
          // events instead of click; all three events must be simulated here.
          // @see https://www.drupal.org/project/bootstrap/issues/3016254
          Bootstrap.simulate($originalButton, ['mousedown', 'mouseup', 'click']);
        },
        create: function () {
          _this.ajaxCurrentButton = $(this);
          _this.ajaxOriginalButton = $originalButton;
          _this.ajaxUpdateButtons(true);
        }
      });
    });

    return buttons;
  };

})(window.jQuery, window.Drupal, window.Drupal.bootstrap);
;
/**
 * @file entity_browser.common.js
 *
 * Common helper functions used by various parts of entity browser.
 */

(function ($, Drupal, drupalSettings) {

  'use strict';

  Drupal.entityBrowser = {};

  /**
   * Command to refresh an entity_browser_entity_reference field widget.
   *
   * @param {Drupal.Ajax} [ajax]
   *   The ajax object.
   * @param {object} response
   *   Object holding the server response.
   * @param {string} response.details_id
   *   The ID for the details element.
   * @param {number} [status]
   *   The HTTP status code.
   */
  Drupal.AjaxCommands.prototype.entity_browser_value_updated = function (ajax, response, status) {
    $('#' + response.details_id)
      .find('input[type="hidden"][name$="[target_id]"]')
      .trigger('entity_browser_value_updated');
  };

  /**
   * Reacts on "entities selected" event.
   *
   * @param {object} event
   *   Event object.
   * @param {string} uuid
   *   Entity browser UUID.
   * @param {array} entities
   *   Array of selected entities.
   */
  Drupal.entityBrowser.selectionCompleted = function (event, uuid, entities) {
    var selected_entities = $.map(entities, function (item) {
      return item[2] + ':' + item[0];
    });
    // @todo Use uuid here. But for this to work we need to move eb uuid
    // generation from display to eb directly. When we do this, we can change
    // \Drupal\entity_browser\Plugin\Field\FieldWidget\EntityReferenceBrowserWidget::formElement
    // also.
    // Checking if cardinality is set - assume unlimited.
    var cardinality = isNaN(parseInt(drupalSettings['entity_browser'][uuid]['cardinality'])) ? -1 : parseInt(drupalSettings['entity_browser'][uuid]['cardinality']);

    // Get field widget selection mode.
    var selection_mode = drupalSettings['entity_browser'][uuid]['selection_mode'];

    // Update value form element with new entity IDs.
    var selector = drupalSettings['entity_browser'][uuid]['selector'] ? $(drupalSettings['entity_browser'][uuid]['selector']) : $(this).parent().parent().find('input[type*=hidden]');
    var entity_ids = selector.val();
    var existing_entities = (entity_ids.length !== 0) ? entity_ids.split(' ') : [];

    entity_ids = Drupal.entityBrowser.updateEntityIds(
      existing_entities,
      selected_entities,
      selection_mode,
      cardinality
    );

    selector.val(entity_ids);
    selector.trigger('entity_browser_value_updated');
  };

  /**
   * Updates the list of selected entities.
   *
   * It uses existing selection and selected entities in entity browser. Also
   * considers cardinality and used selection mode.
   *
   * Note: Selection modes are defined in EntityBrowserElement class and same
   * options should be used here to determine what action will be performed.
   * Default action is append ('selection_append').
   *
   * @param {Array} existing_entities
   *   List of existing entity IDs.
   * @param {Array} selected_entities
   *   The entities that are selected and entity browser.
   * @param {string} selection_mode
   *   Selection mode defined by entity browser field widget.
   * @param {int} cardinality
   *   The maximal amount of items the field can store.
   *
   * @return {string}
   *   List of entities as a string, separated by space.
   */
  Drupal.entityBrowser.updateEntityIds = function (existing_entities, selected_entities, selection_mode, cardinality) {
    var combined_entities;

    if (selection_mode === 'selection_edit') {
      // Propagate new selected entities.
      combined_entities = selected_entities;
    }
    else if (selection_mode === 'selection_prepend') {
      // Prepend selected entities to existing list of entities.
      combined_entities = selected_entities.concat(existing_entities);
    }
    else {
      // Append selected entities to existing list of entities.
      combined_entities = existing_entities.concat(selected_entities);
    }

    // Having more elements than cardinality should never happen, because
    // server side authentication should prevent it, but we handle it here
    // anyway.
    if (cardinality > 0 && combined_entities.length > cardinality) {
      combined_entities = combined_entities.slice(0, cardinality);
    }

    return combined_entities.join(' ');
  };

  /**
   * Reacts on "entities selected" event.
   *
   * @param {object} element
   *   Element to bind on.
   * @param {array} callbacks
   *   List of callbacks.
   * @param {string} event_name
   *   Name of event to bind to.
   */
  Drupal.entityBrowser.registerJsCallbacks = function (element, callbacks, event_name) {
    // JS callbacks are registred as strings. We need to split their names and
    // find actual functions.
    for (var i = 0; i < callbacks.length; i++) {
      var callback = callbacks[i].split('.');
      var fn = window;

      for (var j = 0; j < callback.length; j++) {
        fn = fn[callback[j]];
      }

      if (typeof fn === 'function') {
        $(element).bind(event_name, fn);
      }
    }
  };

}(jQuery, Drupal, drupalSettings));
;
