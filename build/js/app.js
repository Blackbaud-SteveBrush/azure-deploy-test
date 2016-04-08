/**!
 * Sortable
 * @author	RubaXa   <trash@rubaxa.org>
 * @license MIT
 */


(function (factory) {
	"use strict";

	if (typeof define === "function" && define.amd) {
		define(factory);
	}
	else if (typeof module != "undefined" && typeof module.exports != "undefined") {
		module.exports = factory();
	}
	else if (typeof Package !== "undefined") {
		Sortable = factory();  // export for Meteor.js
	}
	else {
		/* jshint sub:true */
		window["Sortable"] = factory();
	}
})(function () {
	"use strict";

	var dragEl,
		parentEl,
		ghostEl,
		cloneEl,
		rootEl,
		nextEl,

		scrollEl,
		scrollParentEl,

		lastEl,
		lastCSS,
		lastParentCSS,

		oldIndex,
		newIndex,

		activeGroup,
		autoScroll = {},

		tapEvt,
		touchEvt,

		moved,

		/** @const */
		RSPACE = /\s+/g,

		expando = 'Sortable' + (new Date).getTime(),

		win = window,
		document = win.document,
		parseInt = win.parseInt,

		supportDraggable = !!('draggable' in document.createElement('div')),
		supportCssPointerEvents = (function (el) {
			el = document.createElement('x');
			el.style.cssText = 'pointer-events:auto';
			return el.style.pointerEvents === 'auto';
		})(),

		_silent = false,

		abs = Math.abs,
		slice = [].slice,

		touchDragOverListeners = [],

		_autoScroll = _throttle(function (/**Event*/evt, /**Object*/options, /**HTMLElement*/rootEl) {
			// Bug: https://bugzilla.mozilla.org/show_bug.cgi?id=505521
			if (rootEl && options.scroll) {
				var el,
					rect,
					sens = options.scrollSensitivity,
					speed = options.scrollSpeed,

					x = evt.clientX,
					y = evt.clientY,

					winWidth = window.innerWidth,
					winHeight = window.innerHeight,

					vx,
					vy
				;

				// Delect scrollEl
				if (scrollParentEl !== rootEl) {
					scrollEl = options.scroll;
					scrollParentEl = rootEl;

					if (scrollEl === true) {
						scrollEl = rootEl;

						do {
							if ((scrollEl.offsetWidth < scrollEl.scrollWidth) ||
								(scrollEl.offsetHeight < scrollEl.scrollHeight)
							) {
								break;
							}
							/* jshint boss:true */
						} while (scrollEl = scrollEl.parentNode);
					}
				}

				if (scrollEl) {
					el = scrollEl;
					rect = scrollEl.getBoundingClientRect();
					vx = (abs(rect.right - x) <= sens) - (abs(rect.left - x) <= sens);
					vy = (abs(rect.bottom - y) <= sens) - (abs(rect.top - y) <= sens);
				}


				if (!(vx || vy)) {
					vx = (winWidth - x <= sens) - (x <= sens);
					vy = (winHeight - y <= sens) - (y <= sens);

					/* jshint expr:true */
					(vx || vy) && (el = win);
				}


				if (autoScroll.vx !== vx || autoScroll.vy !== vy || autoScroll.el !== el) {
					autoScroll.el = el;
					autoScroll.vx = vx;
					autoScroll.vy = vy;

					clearInterval(autoScroll.pid);

					if (el) {
						autoScroll.pid = setInterval(function () {
							if (el === win) {
								win.scrollTo(win.pageXOffset + vx * speed, win.pageYOffset + vy * speed);
							} else {
								vy && (el.scrollTop += vy * speed);
								vx && (el.scrollLeft += vx * speed);
							}
						}, 24);
					}
				}
			}
		}, 30),

		_prepareGroup = function (options) {
			var group = options.group;

			if (!group || typeof group != 'object') {
				group = options.group = {name: group};
			}

			['pull', 'put'].forEach(function (key) {
				if (!(key in group)) {
					group[key] = true;
				}
			});

			options.groups = ' ' + group.name + (group.put.join ? ' ' + group.put.join(' ') : '') + ' ';
		}
	;



	/**
	 * @class  Sortable
	 * @param  {HTMLElement}  el
	 * @param  {Object}       [options]
	 */
	function Sortable(el, options) {
		if (!(el && el.nodeType && el.nodeType === 1)) {
			throw 'Sortable: `el` must be HTMLElement, and not ' + {}.toString.call(el);
		}

		this.el = el; // root element
		this.options = options = _extend({}, options);


		// Export instance
		el[expando] = this;


		// Default options
		var defaults = {
			group: Math.random(),
			sort: true,
			disabled: false,
			store: null,
			handle: null,
			scroll: true,
			scrollSensitivity: 30,
			scrollSpeed: 10,
			draggable: /[uo]l/i.test(el.nodeName) ? 'li' : '>*',
			ghostClass: 'sortable-ghost',
			chosenClass: 'sortable-chosen',
			ignore: 'a, img',
			filter: null,
			animation: 0,
			setData: function (dataTransfer, dragEl) {
				dataTransfer.setData('Text', dragEl.textContent);
			},
			dropBubble: false,
			dragoverBubble: false,
			dataIdAttr: 'data-id',
			delay: 0,
			forceFallback: false,
			fallbackClass: 'sortable-fallback',
			fallbackOnBody: false
		};


		// Set default options
		for (var name in defaults) {
			!(name in options) && (options[name] = defaults[name]);
		}

		_prepareGroup(options);

		// Bind all private methods
		for (var fn in this) {
			if (fn.charAt(0) === '_') {
				this[fn] = this[fn].bind(this);
			}
		}

		// Setup drag mode
		this.nativeDraggable = options.forceFallback ? false : supportDraggable;

		// Bind events
		_on(el, 'mousedown', this._onTapStart);
		_on(el, 'touchstart', this._onTapStart);

		if (this.nativeDraggable) {
			_on(el, 'dragover', this);
			_on(el, 'dragenter', this);
		}

		touchDragOverListeners.push(this._onDragOver);

		// Restore sorting
		options.store && this.sort(options.store.get(this));
	}


	Sortable.prototype = /** @lends Sortable.prototype */ {
		constructor: Sortable,

		_onTapStart: function (/** Event|TouchEvent */evt) {
			var _this = this,
				el = this.el,
				options = this.options,
				type = evt.type,
				touch = evt.touches && evt.touches[0],
				target = (touch || evt).target,
				originalTarget = target,
				filter = options.filter;


			if (type === 'mousedown' && evt.button !== 0 || options.disabled) {
				return; // only left button or enabled
			}

			target = _closest(target, options.draggable, el);

			if (!target) {
				return;
			}

			// get the index of the dragged element within its parent
			oldIndex = _index(target);

			// Check filter
			if (typeof filter === 'function') {
				if (filter.call(this, evt, target, this)) {
					_dispatchEvent(_this, originalTarget, 'filter', target, el, oldIndex);
					evt.preventDefault();
					return; // cancel dnd
				}
			}
			else if (filter) {
				filter = filter.split(',').some(function (criteria) {
					criteria = _closest(originalTarget, criteria.trim(), el);

					if (criteria) {
						_dispatchEvent(_this, criteria, 'filter', target, el, oldIndex);
						return true;
					}
				});

				if (filter) {
					evt.preventDefault();
					return; // cancel dnd
				}
			}


			if (options.handle && !_closest(originalTarget, options.handle, el)) {
				return;
			}


			// Prepare `dragstart`
			this._prepareDragStart(evt, touch, target);
		},

		_prepareDragStart: function (/** Event */evt, /** Touch */touch, /** HTMLElement */target) {
			var _this = this,
				el = _this.el,
				options = _this.options,
				ownerDocument = el.ownerDocument,
				dragStartFn;

			if (target && !dragEl && (target.parentNode === el)) {
				tapEvt = evt;

				rootEl = el;
				dragEl = target;
				parentEl = dragEl.parentNode;
				nextEl = dragEl.nextSibling;
				activeGroup = options.group;

				dragStartFn = function () {
					// Delayed drag has been triggered
					// we can re-enable the events: touchmove/mousemove
					_this._disableDelayedDrag();

					// Make the element draggable
					dragEl.draggable = true;

					// Chosen item
					_toggleClass(dragEl, _this.options.chosenClass, true);

					// Bind the events: dragstart/dragend
					_this._triggerDragStart(touch);
				};

				// Disable "draggable"
				options.ignore.split(',').forEach(function (criteria) {
					_find(dragEl, criteria.trim(), _disableDraggable);
				});

				_on(ownerDocument, 'mouseup', _this._onDrop);
				_on(ownerDocument, 'touchend', _this._onDrop);
				_on(ownerDocument, 'touchcancel', _this._onDrop);

				if (options.delay) {
					// If the user moves the pointer or let go the click or touch
					// before the delay has been reached:
					// disable the delayed drag
					_on(ownerDocument, 'mouseup', _this._disableDelayedDrag);
					_on(ownerDocument, 'touchend', _this._disableDelayedDrag);
					_on(ownerDocument, 'touchcancel', _this._disableDelayedDrag);
					_on(ownerDocument, 'mousemove', _this._disableDelayedDrag);
					_on(ownerDocument, 'touchmove', _this._disableDelayedDrag);

					_this._dragStartTimer = setTimeout(dragStartFn, options.delay);
				} else {
					dragStartFn();
				}
			}
		},

		_disableDelayedDrag: function () {
			var ownerDocument = this.el.ownerDocument;

			clearTimeout(this._dragStartTimer);
			_off(ownerDocument, 'mouseup', this._disableDelayedDrag);
			_off(ownerDocument, 'touchend', this._disableDelayedDrag);
			_off(ownerDocument, 'touchcancel', this._disableDelayedDrag);
			_off(ownerDocument, 'mousemove', this._disableDelayedDrag);
			_off(ownerDocument, 'touchmove', this._disableDelayedDrag);
		},

		_triggerDragStart: function (/** Touch */touch) {
			if (touch) {
				// Touch device support
				tapEvt = {
					target: dragEl,
					clientX: touch.clientX,
					clientY: touch.clientY
				};

				this._onDragStart(tapEvt, 'touch');
			}
			else if (!this.nativeDraggable) {
				this._onDragStart(tapEvt, true);
			}
			else {
				_on(dragEl, 'dragend', this);
				_on(rootEl, 'dragstart', this._onDragStart);
			}

			try {
				if (document.selection) {
					document.selection.empty();
				} else {
					window.getSelection().removeAllRanges();
				}
			} catch (err) {
			}
		},

		_dragStarted: function () {
			if (rootEl && dragEl) {
				// Apply effect
				_toggleClass(dragEl, this.options.ghostClass, true);

				Sortable.active = this;

				// Drag start event
				_dispatchEvent(this, rootEl, 'start', dragEl, rootEl, oldIndex);
			}
		},

		_emulateDragOver: function () {
			if (touchEvt) {
				if (this._lastX === touchEvt.clientX && this._lastY === touchEvt.clientY) {
					return;
				}

				this._lastX = touchEvt.clientX;
				this._lastY = touchEvt.clientY;

				if (!supportCssPointerEvents) {
					_css(ghostEl, 'display', 'none');
				}

				var target = document.elementFromPoint(touchEvt.clientX, touchEvt.clientY),
					parent = target,
					groupName = ' ' + this.options.group.name + '',
					i = touchDragOverListeners.length;

				if (parent) {
					do {
						if (parent[expando] && parent[expando].options.groups.indexOf(groupName) > -1) {
							while (i--) {
								touchDragOverListeners[i]({
									clientX: touchEvt.clientX,
									clientY: touchEvt.clientY,
									target: target,
									rootEl: parent
								});
							}

							break;
						}

						target = parent; // store last element
					}
					/* jshint boss:true */
					while (parent = parent.parentNode);
				}

				if (!supportCssPointerEvents) {
					_css(ghostEl, 'display', '');
				}
			}
		},


		_onTouchMove: function (/**TouchEvent*/evt) {
			if (tapEvt) {
				// only set the status to dragging, when we are actually dragging
				if (!Sortable.active) {
					this._dragStarted();
				}

				// as well as creating the ghost element on the document body
				this._appendGhost();

				var touch = evt.touches ? evt.touches[0] : evt,
					dx = touch.clientX - tapEvt.clientX,
					dy = touch.clientY - tapEvt.clientY,
					translate3d = evt.touches ? 'translate3d(' + dx + 'px,' + dy + 'px,0)' : 'translate(' + dx + 'px,' + dy + 'px)';

				moved = true;
				touchEvt = touch;

				_css(ghostEl, 'webkitTransform', translate3d);
				_css(ghostEl, 'mozTransform', translate3d);
				_css(ghostEl, 'msTransform', translate3d);
				_css(ghostEl, 'transform', translate3d);

				evt.preventDefault();
			}
		},

		_appendGhost: function () {
			if (!ghostEl) {
				var rect = dragEl.getBoundingClientRect(),
					css = _css(dragEl),
					options = this.options,
					ghostRect;

				ghostEl = dragEl.cloneNode(true);

				_toggleClass(ghostEl, options.ghostClass, false);
				_toggleClass(ghostEl, options.fallbackClass, true);

				_css(ghostEl, 'top', rect.top - parseInt(css.marginTop, 10));
				_css(ghostEl, 'left', rect.left - parseInt(css.marginLeft, 10));
				_css(ghostEl, 'width', rect.width);
				_css(ghostEl, 'height', rect.height);
				_css(ghostEl, 'opacity', '0.8');
				_css(ghostEl, 'position', 'fixed');
				_css(ghostEl, 'zIndex', '100000');
				_css(ghostEl, 'pointerEvents', 'none');

				options.fallbackOnBody && document.body.appendChild(ghostEl) || rootEl.appendChild(ghostEl);

				// Fixing dimensions.
				ghostRect = ghostEl.getBoundingClientRect();
				_css(ghostEl, 'width', rect.width * 2 - ghostRect.width);
				_css(ghostEl, 'height', rect.height * 2 - ghostRect.height);
			}
		},

		_onDragStart: function (/**Event*/evt, /**boolean*/useFallback) {
			var dataTransfer = evt.dataTransfer,
				options = this.options;

			this._offUpEvents();

			if (activeGroup.pull == 'clone') {
				cloneEl = dragEl.cloneNode(true);
				_css(cloneEl, 'display', 'none');
				rootEl.insertBefore(cloneEl, dragEl);
			}

			if (useFallback) {

				if (useFallback === 'touch') {
					// Bind touch events
					_on(document, 'touchmove', this._onTouchMove);
					_on(document, 'touchend', this._onDrop);
					_on(document, 'touchcancel', this._onDrop);
				} else {
					// Old brwoser
					_on(document, 'mousemove', this._onTouchMove);
					_on(document, 'mouseup', this._onDrop);
				}

				this._loopId = setInterval(this._emulateDragOver, 50);
			}
			else {
				if (dataTransfer) {
					dataTransfer.effectAllowed = 'move';
					options.setData && options.setData.call(this, dataTransfer, dragEl);
				}

				_on(document, 'drop', this);
				setTimeout(this._dragStarted, 0);
			}
		},

		_onDragOver: function (/**Event*/evt) {
			var el = this.el,
				target,
				dragRect,
				revert,
				options = this.options,
				group = options.group,
				groupPut = group.put,
				isOwner = (activeGroup === group),
				canSort = options.sort;

			if (evt.preventDefault !== void 0) {
				evt.preventDefault();
				!options.dragoverBubble && evt.stopPropagation();
			}

			moved = true;

			if (activeGroup && !options.disabled &&
				(isOwner
					? canSort || (revert = !rootEl.contains(dragEl)) // Reverting item into the original list
					: activeGroup.pull && groupPut && (
						(activeGroup.name === group.name) || // by Name
						(groupPut.indexOf && ~groupPut.indexOf(activeGroup.name)) // by Array
					)
				) &&
				(evt.rootEl === void 0 || evt.rootEl === this.el) // touch fallback
			) {
				// Smart auto-scrolling
				_autoScroll(evt, options, this.el);

				if (_silent) {
					return;
				}

				target = _closest(evt.target, options.draggable, el);
				dragRect = dragEl.getBoundingClientRect();

				if (revert) {
					_cloneHide(true);

					if (cloneEl || nextEl) {
						rootEl.insertBefore(dragEl, cloneEl || nextEl);
					}
					else if (!canSort) {
						rootEl.appendChild(dragEl);
					}

					return;
				}


				if ((el.children.length === 0) || (el.children[0] === ghostEl) ||
					(el === evt.target) && (target = _ghostIsLast(el, evt))
				) {

					if (target) {
						if (target.animated) {
							return;
						}

						targetRect = target.getBoundingClientRect();
					}

					_cloneHide(isOwner);

					if (_onMove(rootEl, el, dragEl, dragRect, target, targetRect) !== false) {
						if (!dragEl.contains(el)) {
							el.appendChild(dragEl);
							parentEl = el; // actualization
						}

						this._animate(dragRect, dragEl);
						target && this._animate(targetRect, target);
					}
				}
				else if (target && !target.animated && target !== dragEl && (target.parentNode[expando] !== void 0)) {
					if (lastEl !== target) {
						lastEl = target;
						lastCSS = _css(target);
						lastParentCSS = _css(target.parentNode);
					}


					var targetRect = target.getBoundingClientRect(),
						width = targetRect.right - targetRect.left,
						height = targetRect.bottom - targetRect.top,
						floating = /left|right|inline/.test(lastCSS.cssFloat + lastCSS.display)
							|| (lastParentCSS.display == 'flex' && lastParentCSS['flex-direction'].indexOf('row') === 0),
						isWide = (target.offsetWidth > dragEl.offsetWidth),
						isLong = (target.offsetHeight > dragEl.offsetHeight),
						halfway = (floating ? (evt.clientX - targetRect.left) / width : (evt.clientY - targetRect.top) / height) > 0.5,
						nextSibling = target.nextElementSibling,
						moveVector = _onMove(rootEl, el, dragEl, dragRect, target, targetRect),
						after
					;

					if (moveVector !== false) {
						_silent = true;
						setTimeout(_unsilent, 30);

						_cloneHide(isOwner);

						if (moveVector === 1 || moveVector === -1) {
							after = (moveVector === 1);
						}
						else if (floating) {
							var elTop = dragEl.offsetTop,
								tgTop = target.offsetTop;

							if (elTop === tgTop) {
								after = (target.previousElementSibling === dragEl) && !isWide || halfway && isWide;
							} else {
								after = tgTop > elTop;
							}
						} else {
							after = (nextSibling !== dragEl) && !isLong || halfway && isLong;
						}

						if (!dragEl.contains(el)) {
							if (after && !nextSibling) {
								el.appendChild(dragEl);
							} else {
								target.parentNode.insertBefore(dragEl, after ? nextSibling : target);
							}
						}

						parentEl = dragEl.parentNode; // actualization

						this._animate(dragRect, dragEl);
						this._animate(targetRect, target);
					}
				}
			}
		},

		_animate: function (prevRect, target) {
			var ms = this.options.animation;

			if (ms) {
				var currentRect = target.getBoundingClientRect();

				_css(target, 'transition', 'none');
				_css(target, 'transform', 'translate3d('
					+ (prevRect.left - currentRect.left) + 'px,'
					+ (prevRect.top - currentRect.top) + 'px,0)'
				);

				target.offsetWidth; // repaint

				_css(target, 'transition', 'all ' + ms + 'ms');
				_css(target, 'transform', 'translate3d(0,0,0)');

				clearTimeout(target.animated);
				target.animated = setTimeout(function () {
					_css(target, 'transition', '');
					_css(target, 'transform', '');
					target.animated = false;
				}, ms);
			}
		},

		_offUpEvents: function () {
			var ownerDocument = this.el.ownerDocument;

			_off(document, 'touchmove', this._onTouchMove);
			_off(ownerDocument, 'mouseup', this._onDrop);
			_off(ownerDocument, 'touchend', this._onDrop);
			_off(ownerDocument, 'touchcancel', this._onDrop);
		},

		_onDrop: function (/**Event*/evt) {
			var el = this.el,
				options = this.options;

			clearInterval(this._loopId);
			clearInterval(autoScroll.pid);
			clearTimeout(this._dragStartTimer);

			// Unbind events
			_off(document, 'mousemove', this._onTouchMove);

			if (this.nativeDraggable) {
				_off(document, 'drop', this);
				_off(el, 'dragstart', this._onDragStart);
			}

			this._offUpEvents();

			if (evt) {
				if (moved) {
					evt.preventDefault();
					!options.dropBubble && evt.stopPropagation();
				}

				ghostEl && ghostEl.parentNode.removeChild(ghostEl);

				if (dragEl) {
					if (this.nativeDraggable) {
						_off(dragEl, 'dragend', this);
					}

					_disableDraggable(dragEl);

					// Remove class's
					_toggleClass(dragEl, this.options.ghostClass, false);
					_toggleClass(dragEl, this.options.chosenClass, false);

					if (rootEl !== parentEl) {
						newIndex = _index(dragEl);

						if (newIndex >= 0) {
							// drag from one list and drop into another
							_dispatchEvent(null, parentEl, 'sort', dragEl, rootEl, oldIndex, newIndex);
							_dispatchEvent(this, rootEl, 'sort', dragEl, rootEl, oldIndex, newIndex);

							// Add event
							_dispatchEvent(null, parentEl, 'add', dragEl, rootEl, oldIndex, newIndex);

							// Remove event
							_dispatchEvent(this, rootEl, 'remove', dragEl, rootEl, oldIndex, newIndex);
						}
					}
					else {
						// Remove clone
						cloneEl && cloneEl.parentNode.removeChild(cloneEl);

						if (dragEl.nextSibling !== nextEl) {
							// Get the index of the dragged element within its parent
							newIndex = _index(dragEl);

							if (newIndex >= 0) {
								// drag & drop within the same list
								_dispatchEvent(this, rootEl, 'update', dragEl, rootEl, oldIndex, newIndex);
								_dispatchEvent(this, rootEl, 'sort', dragEl, rootEl, oldIndex, newIndex);
							}
						}
					}

					if (Sortable.active) {
						if (newIndex === null || newIndex === -1) {
							newIndex = oldIndex;
						}

						_dispatchEvent(this, rootEl, 'end', dragEl, rootEl, oldIndex, newIndex);

						// Save sorting
						this.save();
					}
				}

				// Nulling
				rootEl =
				dragEl =
				parentEl =
				ghostEl =
				nextEl =
				cloneEl =

				scrollEl =
				scrollParentEl =

				tapEvt =
				touchEvt =

				moved =
				newIndex =

				lastEl =
				lastCSS =

				activeGroup =
				Sortable.active = null;
			}
		},


		handleEvent: function (/**Event*/evt) {
			var type = evt.type;

			if (type === 'dragover' || type === 'dragenter') {
				if (dragEl) {
					this._onDragOver(evt);
					_globalDragOver(evt);
				}
			}
			else if (type === 'drop' || type === 'dragend') {
				this._onDrop(evt);
			}
		},


		/**
		 * Serializes the item into an array of string.
		 * @returns {String[]}
		 */
		toArray: function () {
			var order = [],
				el,
				children = this.el.children,
				i = 0,
				n = children.length,
				options = this.options;

			for (; i < n; i++) {
				el = children[i];
				if (_closest(el, options.draggable, this.el)) {
					order.push(el.getAttribute(options.dataIdAttr) || _generateId(el));
				}
			}

			return order;
		},


		/**
		 * Sorts the elements according to the array.
		 * @param  {String[]}  order  order of the items
		 */
		sort: function (order) {
			var items = {}, rootEl = this.el;

			this.toArray().forEach(function (id, i) {
				var el = rootEl.children[i];

				if (_closest(el, this.options.draggable, rootEl)) {
					items[id] = el;
				}
			}, this);

			order.forEach(function (id) {
				if (items[id]) {
					rootEl.removeChild(items[id]);
					rootEl.appendChild(items[id]);
				}
			});
		},


		/**
		 * Save the current sorting
		 */
		save: function () {
			var store = this.options.store;
			store && store.set(this);
		},


		/**
		 * For each element in the set, get the first element that matches the selector by testing the element itself and traversing up through its ancestors in the DOM tree.
		 * @param   {HTMLElement}  el
		 * @param   {String}       [selector]  default: `options.draggable`
		 * @returns {HTMLElement|null}
		 */
		closest: function (el, selector) {
			return _closest(el, selector || this.options.draggable, this.el);
		},


		/**
		 * Set/get option
		 * @param   {string} name
		 * @param   {*}      [value]
		 * @returns {*}
		 */
		option: function (name, value) {
			var options = this.options;

			if (value === void 0) {
				return options[name];
			} else {
				options[name] = value;

				if (name === 'group') {
					_prepareGroup(options);
				}
			}
		},


		/**
		 * Destroy
		 */
		destroy: function () {
			var el = this.el;

			el[expando] = null;

			_off(el, 'mousedown', this._onTapStart);
			_off(el, 'touchstart', this._onTapStart);

			if (this.nativeDraggable) {
				_off(el, 'dragover', this);
				_off(el, 'dragenter', this);
			}

			// Remove draggable attributes
			Array.prototype.forEach.call(el.querySelectorAll('[draggable]'), function (el) {
				el.removeAttribute('draggable');
			});

			touchDragOverListeners.splice(touchDragOverListeners.indexOf(this._onDragOver), 1);

			this._onDrop();

			this.el = el = null;
		}
	};


	function _cloneHide(state) {
		if (cloneEl && (cloneEl.state !== state)) {
			_css(cloneEl, 'display', state ? 'none' : '');
			!state && cloneEl.state && rootEl.insertBefore(cloneEl, dragEl);
			cloneEl.state = state;
		}
	}


	function _closest(/**HTMLElement*/el, /**String*/selector, /**HTMLElement*/ctx) {
		if (el) {
			ctx = ctx || document;
			selector = selector.split('.');

			var tag = selector.shift().toUpperCase(),
				re = new RegExp('\\s(' + selector.join('|') + ')(?=\\s)', 'g');

			do {
				if (
					(tag === '>*' && el.parentNode === ctx) || (
						(tag === '' || el.nodeName.toUpperCase() == tag) &&
						(!selector.length || ((' ' + el.className + ' ').match(re) || []).length == selector.length)
					)
				) {
					return el;
				}
			}
			while (el !== ctx && (el = el.parentNode));
		}

		return null;
	}


	function _globalDragOver(/**Event*/evt) {
		if (evt.dataTransfer) {
			evt.dataTransfer.dropEffect = 'move';
		}
		evt.preventDefault();
	}


	function _on(el, event, fn) {
		el.addEventListener(event, fn, false);
	}


	function _off(el, event, fn) {
		el.removeEventListener(event, fn, false);
	}


	function _toggleClass(el, name, state) {
		if (el) {
			if (el.classList) {
				el.classList[state ? 'add' : 'remove'](name);
			}
			else {
				var className = (' ' + el.className + ' ').replace(RSPACE, ' ').replace(' ' + name + ' ', ' ');
				el.className = (className + (state ? ' ' + name : '')).replace(RSPACE, ' ');
			}
		}
	}


	function _css(el, prop, val) {
		var style = el && el.style;

		if (style) {
			if (val === void 0) {
				if (document.defaultView && document.defaultView.getComputedStyle) {
					val = document.defaultView.getComputedStyle(el, '');
				}
				else if (el.currentStyle) {
					val = el.currentStyle;
				}

				return prop === void 0 ? val : val[prop];
			}
			else {
				if (!(prop in style)) {
					prop = '-webkit-' + prop;
				}

				style[prop] = val + (typeof val === 'string' ? '' : 'px');
			}
		}
	}


	function _find(ctx, tagName, iterator) {
		if (ctx) {
			var list = ctx.getElementsByTagName(tagName), i = 0, n = list.length;

			if (iterator) {
				for (; i < n; i++) {
					iterator(list[i], i);
				}
			}

			return list;
		}

		return [];
	}



	function _dispatchEvent(sortable, rootEl, name, targetEl, fromEl, startIndex, newIndex) {
		var evt = document.createEvent('Event'),
			options = (sortable || rootEl[expando]).options,
			onName = 'on' + name.charAt(0).toUpperCase() + name.substr(1);

		evt.initEvent(name, true, true);

		evt.to = rootEl;
		evt.from = fromEl || rootEl;
		evt.item = targetEl || rootEl;
		evt.clone = cloneEl;

		evt.oldIndex = startIndex;
		evt.newIndex = newIndex;

		rootEl.dispatchEvent(evt);

		if (options[onName]) {
			options[onName].call(sortable, evt);
		}
	}


	function _onMove(fromEl, toEl, dragEl, dragRect, targetEl, targetRect) {
		var evt,
			sortable = fromEl[expando],
			onMoveFn = sortable.options.onMove,
			retVal;

		evt = document.createEvent('Event');
		evt.initEvent('move', true, true);

		evt.to = toEl;
		evt.from = fromEl;
		evt.dragged = dragEl;
		evt.draggedRect = dragRect;
		evt.related = targetEl || toEl;
		evt.relatedRect = targetRect || toEl.getBoundingClientRect();

		fromEl.dispatchEvent(evt);

		if (onMoveFn) {
			retVal = onMoveFn.call(sortable, evt);
		}

		return retVal;
	}


	function _disableDraggable(el) {
		el.draggable = false;
	}


	function _unsilent() {
		_silent = false;
	}


	/** @returns {HTMLElement|false} */
	function _ghostIsLast(el, evt) {
		var lastEl = el.lastElementChild,
				rect = lastEl.getBoundingClientRect();

		return ((evt.clientY - (rect.top + rect.height) > 5) || (evt.clientX - (rect.right + rect.width) > 5)) && lastEl; // min delta
	}


	/**
	 * Generate id
	 * @param   {HTMLElement} el
	 * @returns {String}
	 * @private
	 */
	function _generateId(el) {
		var str = el.tagName + el.className + el.src + el.href + el.textContent,
			i = str.length,
			sum = 0;

		while (i--) {
			sum += str.charCodeAt(i);
		}

		return sum.toString(36);
	}

	/**
	 * Returns the index of an element within its parent
	 * @param  {HTMLElement} el
	 * @return {number}
	 */
	function _index(el) {
		var index = 0;

		if (!el || !el.parentNode) {
			return -1;
		}

		while (el && (el = el.previousElementSibling)) {
			if (el.nodeName.toUpperCase() !== 'TEMPLATE') {
				index++;
			}
		}

		return index;
	}

	function _throttle(callback, ms) {
		var args, _this;

		return function () {
			if (args === void 0) {
				args = arguments;
				_this = this;

				setTimeout(function () {
					if (args.length === 1) {
						callback.call(_this, args[0]);
					} else {
						callback.apply(_this, args);
					}

					args = void 0;
				}, ms);
			}
		};
	}

	function _extend(dst, src) {
		if (dst && src) {
			for (var key in src) {
				if (src.hasOwnProperty(key)) {
					dst[key] = src[key];
				}
			}
		}

		return dst;
	}


	// Export utils
	Sortable.utils = {
		on: _on,
		off: _off,
		css: _css,
		find: _find,
		is: function (el, selector) {
			return !!_closest(el, selector, el);
		},
		extend: _extend,
		throttle: _throttle,
		closest: _closest,
		toggleClass: _toggleClass,
		index: _index
	};


	/**
	 * Create sortable instance
	 * @param {HTMLElement}  el
	 * @param {Object}      [options]
	 */
	Sortable.create = function (el, options) {
		return new Sortable(el, options);
	};


	// Export
	Sortable.version = '1.4.2';
	return Sortable;
});

/**
 * @author RubaXa <trash@rubaxa.org>
 * @licence MIT
 */
(function (factory) {
	'use strict';

	if (typeof define === 'function' && define.amd) {
		define(['angular', './Sortable'], factory);
	}
	else if (typeof require === 'function' && typeof exports === 'object' && typeof module === 'object') {
		require('angular');
		factory(angular, require('./Sortable'));
		module.exports = 'ng-sortable';
	}
	else if (window.angular && window.Sortable) {
		factory(angular, Sortable);
	}
})(function (angular, Sortable) {
	'use strict';


	/**
	 * @typedef   {Object}        ngSortEvent
	 * @property  {*}             model      List item
	 * @property  {Object|Array}  models     List of items
	 * @property  {number}        oldIndex   before sort
	 * @property  {number}        newIndex   after sort
	 */

	var expando = 'Sortable:ng-sortable';

	angular.module('ng-sortable', [])
		.constant('ngSortableVersion', '0.4.0')
		.constant('ngSortableConfig', {})
		.directive('ngSortable', ['$parse', 'ngSortableConfig', function ($parse, ngSortableConfig) {
			var removed,
				nextSibling,
				getSourceFactory = function getSourceFactory(el, scope) {
					var ngRepeat = [].filter.call(el.childNodes, function (node) {
						return (
								(node.nodeType === 8) &&
								(node.nodeValue.indexOf('ngRepeat:') !== -1)
							);
					})[0];

					if (!ngRepeat) {
						// Without ng-repeat
						return function () {
							return null;
						};
					}

					// tests: http://jsbin.com/kosubutilo/1/edit?js,output
					ngRepeat = ngRepeat.nodeValue.match(/ngRepeat:\s*(?:\(.*?,\s*)?([^\s)]+)[\s)]+in\s+([^\s|]+)/);

					var itemsExpr = $parse(ngRepeat[2]);

					return function () {
						return itemsExpr(scope.$parent) || [];
					};
				};


			// Export
			return {
				restrict: 'AC',
				scope: { ngSortable: "=?" },
				link: function (scope, $el) {
					var el = $el[0],
						options = angular.extend(scope.ngSortable || {}, ngSortableConfig),
						watchers = [],
						getSource = getSourceFactory(el, scope),
						sortable
					;

					el[expando] = getSource;

					function _emitEvent(/**Event*/evt, /*Mixed*/item) {
						var name = 'on' + evt.type.charAt(0).toUpperCase() + evt.type.substr(1);
						var source = getSource();

						/* jshint expr:true */
						options[name] && options[name]({
							model: item || source[evt.newIndex],
							models: source,
							oldIndex: evt.oldIndex,
							newIndex: evt.newIndex
						});
					}


					function _sync(/**Event*/evt) {
						var items = getSource();

						if (!items) {
							// Without ng-repeat
							return;
						}

						var oldIndex = evt.oldIndex,
							newIndex = evt.newIndex;

						if (el !== evt.from) {
							var prevItems = evt.from[expando]();

							removed = prevItems[oldIndex];

							if (evt.clone) {
								removed = angular.copy(removed);
								prevItems.splice(Sortable.utils.index(evt.clone), 0, prevItems.splice(oldIndex, 1)[0]);
								evt.from.removeChild(evt.clone);
							}
							else {
								prevItems.splice(oldIndex, 1);
							}

							items.splice(newIndex, 0, removed);

							evt.from.insertBefore(evt.item, nextSibling); // revert element
						}
						else {
							items.splice(newIndex, 0, items.splice(oldIndex, 1)[0]);
						}

						scope.$apply();
					}


					sortable = Sortable.create(el, Object.keys(options).reduce(function (opts, name) {
						opts[name] = opts[name] || options[name];
						return opts;
					}, {
						onStart: function (/**Event*/evt) {
							nextSibling = evt.item.nextSibling;
							_emitEvent(evt);
							scope.$apply();
						},
						onEnd: function (/**Event*/evt) {
							_emitEvent(evt, removed);
							scope.$apply();
						},
						onAdd: function (/**Event*/evt) {
							_sync(evt);
							_emitEvent(evt, removed);
							scope.$apply();
						},
						onUpdate: function (/**Event*/evt) {
							_sync(evt);
							_emitEvent(evt);
						},
						onRemove: function (/**Event*/evt) {
							_emitEvent(evt, removed);
						},
						onSort: function (/**Event*/evt) {
							_emitEvent(evt);
						}
					}));

					$el.on('$destroy', function () {
						angular.forEach(watchers, function (/** Function */unwatch) {
							unwatch();
						});

						sortable.destroy();

						el[expando] = null;
						el = null;
						watchers = null;
						sortable = null;
						nextSibling = null;
					});

					angular.forEach([
						'sort', 'disabled', 'draggable', 'handle', 'animation', 'group', 'ghostClass', 'filter',
						'onStart', 'onEnd', 'onAdd', 'onUpdate', 'onRemove', 'onSort'
					], function (name) {
						watchers.push(scope.$watch('ngSortable.' + name, function (value) {
							if (value !== void 0) {
								options[name] = value;

								if (!/^on[A-Z]/.test(name)) {
									sortable.option(name, value);
								}
							}
						}));
					});
				}
			};
		}]);
});

/*jslint browser: true*/
/*jslint jquery: true*/

/*
 * jQuery Hotkeys Plugin
 * Copyright 2010, John Resig
 * Dual licensed under the MIT or GPL Version 2 licenses.
 *
 * Based upon the plugin by Tzury Bar Yochay:
 * http://github.com/tzuryby/hotkeys
 *
 * Original idea by:
 * Binny V A, http://www.openjs.com/scripts/events/keyboard_shortcuts/
 */

/*
 * One small change is: now keys are passed by object { keys: '...' }
 * Might be useful, when you want to pass some other data to your handler
 */

(function(jQuery) {

  jQuery.hotkeys = {
    version: "0.8",

    specialKeys: {
      8: "backspace",
      9: "tab",
      10: "return",
      13: "return",
      16: "shift",
      17: "ctrl",
      18: "alt",
      19: "pause",
      20: "capslock",
      27: "esc",
      32: "space",
      33: "pageup",
      34: "pagedown",
      35: "end",
      36: "home",
      37: "left",
      38: "up",
      39: "right",
      40: "down",
      45: "insert",
      46: "del",
      59: ";",
      61: "=",
      96: "0",
      97: "1",
      98: "2",
      99: "3",
      100: "4",
      101: "5",
      102: "6",
      103: "7",
      104: "8",
      105: "9",
      106: "*",
      107: "+",
      109: "-",
      110: ".",
      111: "/",
      112: "f1",
      113: "f2",
      114: "f3",
      115: "f4",
      116: "f5",
      117: "f6",
      118: "f7",
      119: "f8",
      120: "f9",
      121: "f10",
      122: "f11",
      123: "f12",
      144: "numlock",
      145: "scroll",
      173: "-",
      186: ";",
      187: "=",
      188: ",",
      189: "-",
      190: ".",
      191: "/",
      192: "`",
      219: "[",
      220: "\\",
      221: "]",
      222: "'"
    },

    shiftNums: {
      "`": "~",
      "1": "!",
      "2": "@",
      "3": "#",
      "4": "$",
      "5": "%",
      "6": "^",
      "7": "&",
      "8": "*",
      "9": "(",
      "0": ")",
      "-": "_",
      "=": "+",
      ";": ": ",
      "'": "\"",
      ",": "<",
      ".": ">",
      "/": "?",
      "\\": "|"
    },

    // excludes: button, checkbox, file, hidden, image, password, radio, reset, search, submit, url
    textAcceptingInputTypes: [
      "text", "password", "number", "email", "url", "range", "date", "month", "week", "time", "datetime",
      "datetime-local", "search", "color", "tel"],

    options: {
      filterTextInputs: true
    }
  };

  function keyHandler(handleObj) {
    if (typeof handleObj.data === "string") {
      handleObj.data = {
        keys: handleObj.data
      };
    }

    // Only care when a possible input has been specified
    if (!handleObj.data || !handleObj.data.keys || typeof handleObj.data.keys !== "string") {
      return;
    }

    var origHandler = handleObj.handler,
      keys = handleObj.data.keys.toLowerCase().split(" ");

    handleObj.handler = function(event) {
      //      Don't fire in text-accepting inputs that we didn't directly bind to
      if (this !== event.target && (/textarea|select/i.test(event.target.nodeName) ||
          (jQuery.hotkeys.options.filterTextInputs &&
            jQuery.inArray(event.target.type, jQuery.hotkeys.textAcceptingInputTypes) > -1))) {
        return;
      }

      var special = event.type !== "keypress" && jQuery.hotkeys.specialKeys[event.which],
        character = String.fromCharCode(event.which).toLowerCase(),
        modif = "",
        possible = {};

      jQuery.each(["alt", "ctrl", "shift"], function(index, specialKey) {

        if (event[specialKey + 'Key'] && special !== specialKey) {
          modif += specialKey + '+';
        }
      });

      // metaKey is triggered off ctrlKey erronously
      if (event.metaKey && !event.ctrlKey && special !== "meta") {
        modif += "meta+";
      }

      if (event.metaKey && special !== "meta" && modif.indexOf("alt+ctrl+shift+") > -1) {
        modif = modif.replace("alt+ctrl+shift+", "hyper+");
      }

      if (special) {
        possible[modif + special] = true;
      }
      else {
        possible[modif + character] = true;
        possible[modif + jQuery.hotkeys.shiftNums[character]] = true;

        // "$" can be triggered as "Shift+4" or "Shift+$" or just "$"
        if (modif === "shift+") {
          possible[jQuery.hotkeys.shiftNums[character]] = true;
        }
      }

      for (var i = 0, l = keys.length; i < l; i++) {
        if (possible[keys[i]]) {
          return origHandler.apply(this, arguments);
        }
      }
    };
  }

  jQuery.each(["keydown", "keyup", "keypress"], function() {
    jQuery.event.special[this] = {
      add: keyHandler
    };
  });

})(jQuery || this.jQuery || window.jQuery);

/**
 * marked - a markdown parser
 * Copyright (c) 2011-2014, Christopher Jeffrey. (MIT Licensed)
 * https://github.com/chjj/marked
 */

;(function() {

/**
 * Block-Level Grammar
 */

var block = {
  newline: /^\n+/,
  code: /^( {4}[^\n]+\n*)+/,
  fences: noop,
  hr: /^( *[-*_]){3,} *(?:\n+|$)/,
  heading: /^ *(#{1,6}) *([^\n]+?) *#* *(?:\n+|$)/,
  nptable: noop,
  lheading: /^([^\n]+)\n *(=|-){2,} *(?:\n+|$)/,
  blockquote: /^( *>[^\n]+(\n(?!def)[^\n]+)*\n*)+/,
  list: /^( *)(bull) [\s\S]+?(?:hr|def|\n{2,}(?! )(?!\1bull )\n*|\s*$)/,
  html: /^ *(?:comment *(?:\n|\s*$)|closed *(?:\n{2,}|\s*$)|closing *(?:\n{2,}|\s*$))/,
  def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +["(]([^\n]+)[")])? *(?:\n+|$)/,
  table: noop,
  paragraph: /^((?:[^\n]+\n?(?!hr|heading|lheading|blockquote|tag|def))+)\n*/,
  text: /^[^\n]+/
};

block.bullet = /(?:[*+-]|\d+\.)/;
block.item = /^( *)(bull) [^\n]*(?:\n(?!\1bull )[^\n]*)*/;
block.item = replace(block.item, 'gm')
  (/bull/g, block.bullet)
  ();

block.list = replace(block.list)
  (/bull/g, block.bullet)
  ('hr', '\\n+(?=\\1?(?:[-*_] *){3,}(?:\\n+|$))')
  ('def', '\\n+(?=' + block.def.source + ')')
  ();

block.blockquote = replace(block.blockquote)
  ('def', block.def)
  ();

block._tag = '(?!(?:'
  + 'a|em|strong|small|s|cite|q|dfn|abbr|data|time|code'
  + '|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo'
  + '|span|br|wbr|ins|del|img)\\b)\\w+(?!:/|[^\\w\\s@]*@)\\b';

block.html = replace(block.html)
  ('comment', /<!--[\s\S]*?-->/)
  ('closed', /<(tag)[\s\S]+?<\/\1>/)
  ('closing', /<tag(?:"[^"]*"|'[^']*'|[^'">])*?>/)
  (/tag/g, block._tag)
  ();

block.paragraph = replace(block.paragraph)
  ('hr', block.hr)
  ('heading', block.heading)
  ('lheading', block.lheading)
  ('blockquote', block.blockquote)
  ('tag', '<' + block._tag)
  ('def', block.def)
  ();

/**
 * Normal Block Grammar
 */

block.normal = merge({}, block);

/**
 * GFM Block Grammar
 */

block.gfm = merge({}, block.normal, {
  fences: /^ *(`{3,}|~{3,})[ \.]*(\S+)? *\n([\s\S]*?)\s*\1 *(?:\n+|$)/,
  paragraph: /^/,
  heading: /^ *(#{1,6}) +([^\n]+?) *#* *(?:\n+|$)/
});

block.gfm.paragraph = replace(block.paragraph)
  ('(?!', '(?!'
    + block.gfm.fences.source.replace('\\1', '\\2') + '|'
    + block.list.source.replace('\\1', '\\3') + '|')
  ();

/**
 * GFM + Tables Block Grammar
 */

block.tables = merge({}, block.gfm, {
  nptable: /^ *(\S.*\|.*)\n *([-:]+ *\|[-| :]*)\n((?:.*\|.*(?:\n|$))*)\n*/,
  table: /^ *\|(.+)\n *\|( *[-:]+[-| :]*)\n((?: *\|.*(?:\n|$))*)\n*/
});

/**
 * Block Lexer
 */

function Lexer(options) {
  this.tokens = [];
  this.tokens.links = {};
  this.options = options || marked.defaults;
  this.rules = block.normal;

  if (this.options.gfm) {
    if (this.options.tables) {
      this.rules = block.tables;
    } else {
      this.rules = block.gfm;
    }
  }
}

/**
 * Expose Block Rules
 */

Lexer.rules = block;

/**
 * Static Lex Method
 */

Lexer.lex = function(src, options) {
  var lexer = new Lexer(options);
  return lexer.lex(src);
};

/**
 * Preprocessing
 */

Lexer.prototype.lex = function(src) {
  src = src
    .replace(/\r\n|\r/g, '\n')
    .replace(/\t/g, '    ')
    .replace(/\u00a0/g, ' ')
    .replace(/\u2424/g, '\n');

  return this.token(src, true);
};

/**
 * Lexing
 */

Lexer.prototype.token = function(src, top, bq) {
  var src = src.replace(/^ +$/gm, '')
    , next
    , loose
    , cap
    , bull
    , b
    , item
    , space
    , i
    , l;

  while (src) {
    // newline
    if (cap = this.rules.newline.exec(src)) {
      src = src.substring(cap[0].length);
      if (cap[0].length > 1) {
        this.tokens.push({
          type: 'space'
        });
      }
    }

    // code
    if (cap = this.rules.code.exec(src)) {
      src = src.substring(cap[0].length);
      cap = cap[0].replace(/^ {4}/gm, '');
      this.tokens.push({
        type: 'code',
        text: !this.options.pedantic
          ? cap.replace(/\n+$/, '')
          : cap
      });
      continue;
    }

    // fences (gfm)
    if (cap = this.rules.fences.exec(src)) {
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: 'code',
        lang: cap[2],
        text: cap[3] || ''
      });
      continue;
    }

    // heading
    if (cap = this.rules.heading.exec(src)) {
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: 'heading',
        depth: cap[1].length,
        text: cap[2]
      });
      continue;
    }

    // table no leading pipe (gfm)
    if (top && (cap = this.rules.nptable.exec(src))) {
      src = src.substring(cap[0].length);

      item = {
        type: 'table',
        header: cap[1].replace(/^ *| *\| *$/g, '').split(/ *\| */),
        align: cap[2].replace(/^ *|\| *$/g, '').split(/ *\| */),
        cells: cap[3].replace(/\n$/, '').split('\n')
      };

      for (i = 0; i < item.align.length; i++) {
        if (/^ *-+: *$/.test(item.align[i])) {
          item.align[i] = 'right';
        } else if (/^ *:-+: *$/.test(item.align[i])) {
          item.align[i] = 'center';
        } else if (/^ *:-+ *$/.test(item.align[i])) {
          item.align[i] = 'left';
        } else {
          item.align[i] = null;
        }
      }

      for (i = 0; i < item.cells.length; i++) {
        item.cells[i] = item.cells[i].split(/ *\| */);
      }

      this.tokens.push(item);

      continue;
    }

    // lheading
    if (cap = this.rules.lheading.exec(src)) {
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: 'heading',
        depth: cap[2] === '=' ? 1 : 2,
        text: cap[1]
      });
      continue;
    }

    // hr
    if (cap = this.rules.hr.exec(src)) {
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: 'hr'
      });
      continue;
    }

    // blockquote
    if (cap = this.rules.blockquote.exec(src)) {
      src = src.substring(cap[0].length);

      this.tokens.push({
        type: 'blockquote_start'
      });

      cap = cap[0].replace(/^ *> ?/gm, '');

      // Pass `top` to keep the current
      // "toplevel" state. This is exactly
      // how markdown.pl works.
      this.token(cap, top, true);

      this.tokens.push({
        type: 'blockquote_end'
      });

      continue;
    }

    // list
    if (cap = this.rules.list.exec(src)) {
      src = src.substring(cap[0].length);
      bull = cap[2];

      this.tokens.push({
        type: 'list_start',
        ordered: bull.length > 1
      });

      // Get each top-level item.
      cap = cap[0].match(this.rules.item);

      next = false;
      l = cap.length;
      i = 0;

      for (; i < l; i++) {
        item = cap[i];

        // Remove the list item's bullet
        // so it is seen as the next token.
        space = item.length;
        item = item.replace(/^ *([*+-]|\d+\.) +/, '');

        // Outdent whatever the
        // list item contains. Hacky.
        if (~item.indexOf('\n ')) {
          space -= item.length;
          item = !this.options.pedantic
            ? item.replace(new RegExp('^ {1,' + space + '}', 'gm'), '')
            : item.replace(/^ {1,4}/gm, '');
        }

        // Determine whether the next list item belongs here.
        // Backpedal if it does not belong in this list.
        if (this.options.smartLists && i !== l - 1) {
          b = block.bullet.exec(cap[i + 1])[0];
          if (bull !== b && !(bull.length > 1 && b.length > 1)) {
            src = cap.slice(i + 1).join('\n') + src;
            i = l - 1;
          }
        }

        // Determine whether item is loose or not.
        // Use: /(^|\n)(?! )[^\n]+\n\n(?!\s*$)/
        // for discount behavior.
        loose = next || /\n\n(?!\s*$)/.test(item);
        if (i !== l - 1) {
          next = item.charAt(item.length - 1) === '\n';
          if (!loose) loose = next;
        }

        this.tokens.push({
          type: loose
            ? 'loose_item_start'
            : 'list_item_start'
        });

        // Recurse.
        this.token(item, false, bq);

        this.tokens.push({
          type: 'list_item_end'
        });
      }

      this.tokens.push({
        type: 'list_end'
      });

      continue;
    }

    // html
    if (cap = this.rules.html.exec(src)) {
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: this.options.sanitize
          ? 'paragraph'
          : 'html',
        pre: !this.options.sanitizer
          && (cap[1] === 'pre' || cap[1] === 'script' || cap[1] === 'style'),
        text: cap[0]
      });
      continue;
    }

    // def
    if ((!bq && top) && (cap = this.rules.def.exec(src))) {
      src = src.substring(cap[0].length);
      this.tokens.links[cap[1].toLowerCase()] = {
        href: cap[2],
        title: cap[3]
      };
      continue;
    }

    // table (gfm)
    if (top && (cap = this.rules.table.exec(src))) {
      src = src.substring(cap[0].length);

      item = {
        type: 'table',
        header: cap[1].replace(/^ *| *\| *$/g, '').split(/ *\| */),
        align: cap[2].replace(/^ *|\| *$/g, '').split(/ *\| */),
        cells: cap[3].replace(/(?: *\| *)?\n$/, '').split('\n')
      };

      for (i = 0; i < item.align.length; i++) {
        if (/^ *-+: *$/.test(item.align[i])) {
          item.align[i] = 'right';
        } else if (/^ *:-+: *$/.test(item.align[i])) {
          item.align[i] = 'center';
        } else if (/^ *:-+ *$/.test(item.align[i])) {
          item.align[i] = 'left';
        } else {
          item.align[i] = null;
        }
      }

      for (i = 0; i < item.cells.length; i++) {
        item.cells[i] = item.cells[i]
          .replace(/^ *\| *| *\| *$/g, '')
          .split(/ *\| */);
      }

      this.tokens.push(item);

      continue;
    }

    // top-level paragraph
    if (top && (cap = this.rules.paragraph.exec(src))) {
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: 'paragraph',
        text: cap[1].charAt(cap[1].length - 1) === '\n'
          ? cap[1].slice(0, -1)
          : cap[1]
      });
      continue;
    }

    // text
    if (cap = this.rules.text.exec(src)) {
      // Top-level should never reach here.
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: 'text',
        text: cap[0]
      });
      continue;
    }

    if (src) {
      throw new
        Error('Infinite loop on byte: ' + src.charCodeAt(0));
    }
  }

  return this.tokens;
};

/**
 * Inline-Level Grammar
 */

var inline = {
  escape: /^\\([\\`*{}\[\]()#+\-.!_>])/,
  autolink: /^<([^ >]+(@|:\/)[^ >]+)>/,
  url: noop,
  tag: /^<!--[\s\S]*?-->|^<\/?\w+(?:"[^"]*"|'[^']*'|[^'">])*?>/,
  link: /^!?\[(inside)\]\(href\)/,
  reflink: /^!?\[(inside)\]\s*\[([^\]]*)\]/,
  nolink: /^!?\[((?:\[[^\]]*\]|[^\[\]])*)\]/,
  strong: /^__([\s\S]+?)__(?!_)|^\*\*([\s\S]+?)\*\*(?!\*)/,
  em: /^\b_((?:[^_]|__)+?)_\b|^\*((?:\*\*|[\s\S])+?)\*(?!\*)/,
  code: /^(`+)\s*([\s\S]*?[^`])\s*\1(?!`)/,
  br: /^ {2,}\n(?!\s*$)/,
  del: noop,
  text: /^[\s\S]+?(?=[\\<!\[_*`]| {2,}\n|$)/
};

inline._inside = /(?:\[[^\]]*\]|[^\[\]]|\](?=[^\[]*\]))*/;
inline._href = /\s*<?([\s\S]*?)>?(?:\s+['"]([\s\S]*?)['"])?\s*/;

inline.link = replace(inline.link)
  ('inside', inline._inside)
  ('href', inline._href)
  ();

inline.reflink = replace(inline.reflink)
  ('inside', inline._inside)
  ();

/**
 * Normal Inline Grammar
 */

inline.normal = merge({}, inline);

/**
 * Pedantic Inline Grammar
 */

inline.pedantic = merge({}, inline.normal, {
  strong: /^__(?=\S)([\s\S]*?\S)__(?!_)|^\*\*(?=\S)([\s\S]*?\S)\*\*(?!\*)/,
  em: /^_(?=\S)([\s\S]*?\S)_(?!_)|^\*(?=\S)([\s\S]*?\S)\*(?!\*)/
});

/**
 * GFM Inline Grammar
 */

inline.gfm = merge({}, inline.normal, {
  escape: replace(inline.escape)('])', '~|])')(),
  url: /^(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/,
  del: /^~~(?=\S)([\s\S]*?\S)~~/,
  text: replace(inline.text)
    (']|', '~]|')
    ('|', '|https?://|')
    ()
});

/**
 * GFM + Line Breaks Inline Grammar
 */

inline.breaks = merge({}, inline.gfm, {
  br: replace(inline.br)('{2,}', '*')(),
  text: replace(inline.gfm.text)('{2,}', '*')()
});

/**
 * Inline Lexer & Compiler
 */

function InlineLexer(links, options) {
  this.options = options || marked.defaults;
  this.links = links;
  this.rules = inline.normal;
  this.renderer = this.options.renderer || new Renderer;
  this.renderer.options = this.options;

  if (!this.links) {
    throw new
      Error('Tokens array requires a `links` property.');
  }

  if (this.options.gfm) {
    if (this.options.breaks) {
      this.rules = inline.breaks;
    } else {
      this.rules = inline.gfm;
    }
  } else if (this.options.pedantic) {
    this.rules = inline.pedantic;
  }
}

/**
 * Expose Inline Rules
 */

InlineLexer.rules = inline;

/**
 * Static Lexing/Compiling Method
 */

InlineLexer.output = function(src, links, options) {
  var inline = new InlineLexer(links, options);
  return inline.output(src);
};

/**
 * Lexing/Compiling
 */

InlineLexer.prototype.output = function(src) {
  var out = ''
    , link
    , text
    , href
    , cap;

  while (src) {
    // escape
    if (cap = this.rules.escape.exec(src)) {
      src = src.substring(cap[0].length);
      out += cap[1];
      continue;
    }

    // autolink
    if (cap = this.rules.autolink.exec(src)) {
      src = src.substring(cap[0].length);
      if (cap[2] === '@') {
        text = cap[1].charAt(6) === ':'
          ? this.mangle(cap[1].substring(7))
          : this.mangle(cap[1]);
        href = this.mangle('mailto:') + text;
      } else {
        text = escape(cap[1]);
        href = text;
      }
      out += this.renderer.link(href, null, text);
      continue;
    }

    // url (gfm)
    if (!this.inLink && (cap = this.rules.url.exec(src))) {
      src = src.substring(cap[0].length);
      text = escape(cap[1]);
      href = text;
      out += this.renderer.link(href, null, text);
      continue;
    }

    // tag
    if (cap = this.rules.tag.exec(src)) {
      if (!this.inLink && /^<a /i.test(cap[0])) {
        this.inLink = true;
      } else if (this.inLink && /^<\/a>/i.test(cap[0])) {
        this.inLink = false;
      }
      src = src.substring(cap[0].length);
      out += this.options.sanitize
        ? this.options.sanitizer
          ? this.options.sanitizer(cap[0])
          : escape(cap[0])
        : cap[0]
      continue;
    }

    // link
    if (cap = this.rules.link.exec(src)) {
      src = src.substring(cap[0].length);
      this.inLink = true;
      out += this.outputLink(cap, {
        href: cap[2],
        title: cap[3]
      });
      this.inLink = false;
      continue;
    }

    // reflink, nolink
    if ((cap = this.rules.reflink.exec(src))
        || (cap = this.rules.nolink.exec(src))) {
      src = src.substring(cap[0].length);
      link = (cap[2] || cap[1]).replace(/\s+/g, ' ');
      link = this.links[link.toLowerCase()];
      if (!link || !link.href) {
        out += cap[0].charAt(0);
        src = cap[0].substring(1) + src;
        continue;
      }
      this.inLink = true;
      out += this.outputLink(cap, link);
      this.inLink = false;
      continue;
    }

    // strong
    if (cap = this.rules.strong.exec(src)) {
      src = src.substring(cap[0].length);
      out += this.renderer.strong(this.output(cap[2] || cap[1]));
      continue;
    }

    // em
    if (cap = this.rules.em.exec(src)) {
      src = src.substring(cap[0].length);
      out += this.renderer.em(this.output(cap[2] || cap[1]));
      continue;
    }

    // code
    if (cap = this.rules.code.exec(src)) {
      src = src.substring(cap[0].length);
      out += this.renderer.codespan(escape(cap[2], true));
      continue;
    }

    // br
    if (cap = this.rules.br.exec(src)) {
      src = src.substring(cap[0].length);
      out += this.renderer.br();
      continue;
    }

    // del (gfm)
    if (cap = this.rules.del.exec(src)) {
      src = src.substring(cap[0].length);
      out += this.renderer.del(this.output(cap[1]));
      continue;
    }

    // text
    if (cap = this.rules.text.exec(src)) {
      src = src.substring(cap[0].length);
      out += this.renderer.text(escape(this.smartypants(cap[0])));
      continue;
    }

    if (src) {
      throw new
        Error('Infinite loop on byte: ' + src.charCodeAt(0));
    }
  }

  return out;
};

/**
 * Compile Link
 */

InlineLexer.prototype.outputLink = function(cap, link) {
  var href = escape(link.href)
    , title = link.title ? escape(link.title) : null;

  return cap[0].charAt(0) !== '!'
    ? this.renderer.link(href, title, this.output(cap[1]))
    : this.renderer.image(href, title, escape(cap[1]));
};

/**
 * Smartypants Transformations
 */

InlineLexer.prototype.smartypants = function(text) {
  if (!this.options.smartypants) return text;
  return text
    // em-dashes
    .replace(/---/g, '\u2014')
    // en-dashes
    .replace(/--/g, '\u2013')
    // opening singles
    .replace(/(^|[-\u2014/(\[{"\s])'/g, '$1\u2018')
    // closing singles & apostrophes
    .replace(/'/g, '\u2019')
    // opening doubles
    .replace(/(^|[-\u2014/(\[{\u2018\s])"/g, '$1\u201c')
    // closing doubles
    .replace(/"/g, '\u201d')
    // ellipses
    .replace(/\.{3}/g, '\u2026');
};

/**
 * Mangle Links
 */

InlineLexer.prototype.mangle = function(text) {
  if (!this.options.mangle) return text;
  var out = ''
    , l = text.length
    , i = 0
    , ch;

  for (; i < l; i++) {
    ch = text.charCodeAt(i);
    if (Math.random() > 0.5) {
      ch = 'x' + ch.toString(16);
    }
    out += '&#' + ch + ';';
  }

  return out;
};

/**
 * Renderer
 */

function Renderer(options) {
  this.options = options || {};
}

Renderer.prototype.code = function(code, lang, escaped) {
  if (this.options.highlight) {
    var out = this.options.highlight(code, lang);
    if (out != null && out !== code) {
      escaped = true;
      code = out;
    }
  }

  if (!lang) {
    return '<pre><code>'
      + (escaped ? code : escape(code, true))
      + '\n</code></pre>';
  }

  return '<pre><code class="'
    + this.options.langPrefix
    + escape(lang, true)
    + '">'
    + (escaped ? code : escape(code, true))
    + '\n</code></pre>\n';
};

Renderer.prototype.blockquote = function(quote) {
  return '<blockquote>\n' + quote + '</blockquote>\n';
};

Renderer.prototype.html = function(html) {
  return html;
};

Renderer.prototype.heading = function(text, level, raw) {
  return '<h'
    + level
    + ' id="'
    + this.options.headerPrefix
    + raw.toLowerCase().replace(/[^\w]+/g, '-')
    + '">'
    + text
    + '</h'
    + level
    + '>\n';
};

Renderer.prototype.hr = function() {
  return this.options.xhtml ? '<hr/>\n' : '<hr>\n';
};

Renderer.prototype.list = function(body, ordered) {
  var type = ordered ? 'ol' : 'ul';
  return '<' + type + '>\n' + body + '</' + type + '>\n';
};

Renderer.prototype.listitem = function(text) {
  return '<li>' + text + '</li>\n';
};

Renderer.prototype.paragraph = function(text) {
  return '<p>' + text + '</p>\n';
};

Renderer.prototype.table = function(header, body) {
  return '<table>\n'
    + '<thead>\n'
    + header
    + '</thead>\n'
    + '<tbody>\n'
    + body
    + '</tbody>\n'
    + '</table>\n';
};

Renderer.prototype.tablerow = function(content) {
  return '<tr>\n' + content + '</tr>\n';
};

Renderer.prototype.tablecell = function(content, flags) {
  var type = flags.header ? 'th' : 'td';
  var tag = flags.align
    ? '<' + type + ' style="text-align:' + flags.align + '">'
    : '<' + type + '>';
  return tag + content + '</' + type + '>\n';
};

// span level renderer
Renderer.prototype.strong = function(text) {
  return '<strong>' + text + '</strong>';
};

Renderer.prototype.em = function(text) {
  return '<em>' + text + '</em>';
};

Renderer.prototype.codespan = function(text) {
  return '<code>' + text + '</code>';
};

Renderer.prototype.br = function() {
  return this.options.xhtml ? '<br/>' : '<br>';
};

Renderer.prototype.del = function(text) {
  return '<del>' + text + '</del>';
};

Renderer.prototype.link = function(href, title, text) {
  if (this.options.sanitize) {
    try {
      var prot = decodeURIComponent(unescape(href))
        .replace(/[^\w:]/g, '')
        .toLowerCase();
    } catch (e) {
      return '';
    }
    if (prot.indexOf('javascript:') === 0 || prot.indexOf('vbscript:') === 0) {
      return '';
    }
  }
  var out = '<a href="' + href + '"';
  if (title) {
    out += ' title="' + title + '"';
  }
  out += '>' + text + '</a>';
  return out;
};

Renderer.prototype.image = function(href, title, text) {
  var out = '<img src="' + href + '" alt="' + text + '"';
  if (title) {
    out += ' title="' + title + '"';
  }
  out += this.options.xhtml ? '/>' : '>';
  return out;
};

Renderer.prototype.text = function(text) {
  return text;
};

/**
 * Parsing & Compiling
 */

function Parser(options) {
  this.tokens = [];
  this.token = null;
  this.options = options || marked.defaults;
  this.options.renderer = this.options.renderer || new Renderer;
  this.renderer = this.options.renderer;
  this.renderer.options = this.options;
}

/**
 * Static Parse Method
 */

Parser.parse = function(src, options, renderer) {
  var parser = new Parser(options, renderer);
  return parser.parse(src);
};

/**
 * Parse Loop
 */

Parser.prototype.parse = function(src) {
  this.inline = new InlineLexer(src.links, this.options, this.renderer);
  this.tokens = src.reverse();

  var out = '';
  while (this.next()) {
    out += this.tok();
  }

  return out;
};

/**
 * Next Token
 */

Parser.prototype.next = function() {
  return this.token = this.tokens.pop();
};

/**
 * Preview Next Token
 */

Parser.prototype.peek = function() {
  return this.tokens[this.tokens.length - 1] || 0;
};

/**
 * Parse Text Tokens
 */

Parser.prototype.parseText = function() {
  var body = this.token.text;

  while (this.peek().type === 'text') {
    body += '\n' + this.next().text;
  }

  return this.inline.output(body);
};

/**
 * Parse Current Token
 */

Parser.prototype.tok = function() {
  switch (this.token.type) {
    case 'space': {
      return '';
    }
    case 'hr': {
      return this.renderer.hr();
    }
    case 'heading': {
      return this.renderer.heading(
        this.inline.output(this.token.text),
        this.token.depth,
        this.token.text);
    }
    case 'code': {
      return this.renderer.code(this.token.text,
        this.token.lang,
        this.token.escaped);
    }
    case 'table': {
      var header = ''
        , body = ''
        , i
        , row
        , cell
        , flags
        , j;

      // header
      cell = '';
      for (i = 0; i < this.token.header.length; i++) {
        flags = { header: true, align: this.token.align[i] };
        cell += this.renderer.tablecell(
          this.inline.output(this.token.header[i]),
          { header: true, align: this.token.align[i] }
        );
      }
      header += this.renderer.tablerow(cell);

      for (i = 0; i < this.token.cells.length; i++) {
        row = this.token.cells[i];

        cell = '';
        for (j = 0; j < row.length; j++) {
          cell += this.renderer.tablecell(
            this.inline.output(row[j]),
            { header: false, align: this.token.align[j] }
          );
        }

        body += this.renderer.tablerow(cell);
      }
      return this.renderer.table(header, body);
    }
    case 'blockquote_start': {
      var body = '';

      while (this.next().type !== 'blockquote_end') {
        body += this.tok();
      }

      return this.renderer.blockquote(body);
    }
    case 'list_start': {
      var body = ''
        , ordered = this.token.ordered;

      while (this.next().type !== 'list_end') {
        body += this.tok();
      }

      return this.renderer.list(body, ordered);
    }
    case 'list_item_start': {
      var body = '';

      while (this.next().type !== 'list_item_end') {
        body += this.token.type === 'text'
          ? this.parseText()
          : this.tok();
      }

      return this.renderer.listitem(body);
    }
    case 'loose_item_start': {
      var body = '';

      while (this.next().type !== 'list_item_end') {
        body += this.tok();
      }

      return this.renderer.listitem(body);
    }
    case 'html': {
      var html = !this.token.pre && !this.options.pedantic
        ? this.inline.output(this.token.text)
        : this.token.text;
      return this.renderer.html(html);
    }
    case 'paragraph': {
      return this.renderer.paragraph(this.inline.output(this.token.text));
    }
    case 'text': {
      return this.renderer.paragraph(this.parseText());
    }
  }
};

/**
 * Helpers
 */

function escape(html, encode) {
  return html
    .replace(!encode ? /&(?!#?\w+;)/g : /&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function unescape(html) {
  return html.replace(/&([#\w]+);/g, function(_, n) {
    n = n.toLowerCase();
    if (n === 'colon') return ':';
    if (n.charAt(0) === '#') {
      return n.charAt(1) === 'x'
        ? String.fromCharCode(parseInt(n.substring(2), 16))
        : String.fromCharCode(+n.substring(1));
    }
    return '';
  });
}

function replace(regex, opt) {
  regex = regex.source;
  opt = opt || '';
  return function self(name, val) {
    if (!name) return new RegExp(regex, opt);
    val = val.source || val;
    val = val.replace(/(^|[^\[])\^/g, '$1');
    regex = regex.replace(name, val);
    return self;
  };
}

function noop() {}
noop.exec = noop;

function merge(obj) {
  var i = 1
    , target
    , key;

  for (; i < arguments.length; i++) {
    target = arguments[i];
    for (key in target) {
      if (Object.prototype.hasOwnProperty.call(target, key)) {
        obj[key] = target[key];
      }
    }
  }

  return obj;
}


/**
 * Marked
 */

function marked(src, opt, callback) {
  if (callback || typeof opt === 'function') {
    if (!callback) {
      callback = opt;
      opt = null;
    }

    opt = merge({}, marked.defaults, opt || {});

    var highlight = opt.highlight
      , tokens
      , pending
      , i = 0;

    try {
      tokens = Lexer.lex(src, opt)
    } catch (e) {
      return callback(e);
    }

    pending = tokens.length;

    var done = function(err) {
      if (err) {
        opt.highlight = highlight;
        return callback(err);
      }

      var out;

      try {
        out = Parser.parse(tokens, opt);
      } catch (e) {
        err = e;
      }

      opt.highlight = highlight;

      return err
        ? callback(err)
        : callback(null, out);
    };

    if (!highlight || highlight.length < 3) {
      return done();
    }

    delete opt.highlight;

    if (!pending) return done();

    for (; i < tokens.length; i++) {
      (function(token) {
        if (token.type !== 'code') {
          return --pending || done();
        }
        return highlight(token.text, token.lang, function(err, code) {
          if (err) return done(err);
          if (code == null || code === token.text) {
            return --pending || done();
          }
          token.text = code;
          token.escaped = true;
          --pending || done();
        });
      })(tokens[i]);
    }

    return;
  }
  try {
    if (opt) opt = merge({}, marked.defaults, opt);
    return Parser.parse(Lexer.lex(src, opt), opt);
  } catch (e) {
    e.message += '\nPlease report this to https://github.com/chjj/marked.';
    if ((opt || marked.defaults).silent) {
      return '<p>An error occured:</p><pre>'
        + escape(e.message + '', true)
        + '</pre>';
    }
    throw e;
  }
}

/**
 * Options
 */

marked.options =
marked.setOptions = function(opt) {
  merge(marked.defaults, opt);
  return marked;
};

marked.defaults = {
  gfm: true,
  tables: true,
  breaks: false,
  pedantic: false,
  sanitize: false,
  sanitizer: null,
  mangle: true,
  smartLists: false,
  silent: false,
  highlight: null,
  langPrefix: 'lang-',
  smartypants: false,
  headerPrefix: '',
  renderer: new Renderer,
  xhtml: false
};

/**
 * Expose
 */

marked.Parser = Parser;
marked.parser = Parser.parse;

marked.Renderer = Renderer;

marked.Lexer = Lexer;
marked.lexer = Lexer.lex;

marked.InlineLexer = InlineLexer;
marked.inlineLexer = InlineLexer.output;

marked.parse = marked;

if (typeof module !== 'undefined' && typeof exports === 'object') {
  module.exports = marked;
} else if (typeof define === 'function' && define.amd) {
  define(function() { return marked; });
} else {
  this.marked = marked;
}

}).call(function() {
  return this || (typeof window !== 'undefined' ? window : global);
}());

(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.toMarkdown = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/*
 * to-markdown - an HTML to Markdown converter
 *
 * Copyright 2011+, Dom Christie
 * Licenced under the MIT licence
 *
 */

'use strict';

var toMarkdown;
var converters;
var mdConverters = require('./lib/md-converters');
var gfmConverters = require('./lib/gfm-converters');
var HtmlParser = require('./lib/html-parser');
var collapse = require('collapse-whitespace');

/*
 * Utilities
 */

var blocks = ['address', 'article', 'aside', 'audio', 'blockquote', 'body',
  'canvas', 'center', 'dd', 'dir', 'div', 'dl', 'dt', 'fieldset', 'figcaption',
  'figure', 'footer', 'form', 'frameset', 'h1', 'h2', 'h3', 'h4','h5', 'h6',
  'header', 'hgroup', 'hr', 'html', 'isindex', 'li', 'main', 'menu', 'nav',
  'noframes', 'noscript', 'ol', 'output', 'p', 'pre', 'section', 'table',
  'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'ul'
];

function isBlock(node) {
  return blocks.indexOf(node.nodeName.toLowerCase()) !== -1;
}

var voids = [
  'area', 'base', 'br', 'col', 'command', 'embed', 'hr', 'img', 'input',
  'keygen', 'link', 'meta', 'param', 'source', 'track', 'wbr'
];

function isVoid(node) {
  return voids.indexOf(node.nodeName.toLowerCase()) !== -1;
}

function htmlToDom(string) {
  var tree = new HtmlParser().parseFromString(string, 'text/html');
  collapse(tree.documentElement, isBlock);
  return tree;
}

/*
 * Flattens DOM tree into single array
 */

function bfsOrder(node) {
  var inqueue = [node],
      outqueue = [],
      elem, children, i;

  while (inqueue.length > 0) {
    elem = inqueue.shift();
    outqueue.push(elem);
    children = elem.childNodes;
    for (i = 0 ; i < children.length; i++) {
      if (children[i].nodeType === 1) { inqueue.push(children[i]); }
    }
  }
  outqueue.shift();
  return outqueue;
}

/*
 * Contructs a Markdown string of replacement text for a given node
 */

function getContent(node) {
  var text = '';
  for (var i = 0; i < node.childNodes.length; i++) {
    if (node.childNodes[i].nodeType === 1) {
      text += node.childNodes[i]._replacement;
    }
    else if (node.childNodes[i].nodeType === 3) {
      text += node.childNodes[i].data;
    }
    else { continue; }
  }
  return text;
}

/*
 * Returns the HTML string of an element with its contents converted
 */

function outer(node, content) {
  return node.cloneNode(false).outerHTML.replace('><', '>'+ content +'<');
}

function canConvert(node, filter) {
  if (typeof filter === 'string') {
    return filter === node.nodeName.toLowerCase();
  }
  if (Array.isArray(filter)) {
    return filter.indexOf(node.nodeName.toLowerCase()) !== -1;
  }
  else if (typeof filter === 'function') {
    return filter.call(toMarkdown, node);
  }
  else {
    throw new TypeError('`filter` needs to be a string, array, or function');
  }
}

function isFlankedByWhitespace(side, node) {
  var sibling, regExp, isFlanked;

  if (side === 'left') {
    sibling = node.previousSibling;
    regExp = / $/;
  }
  else {
    sibling = node.nextSibling;
    regExp = /^ /;
  }

  if (sibling) {
    if (sibling.nodeType === 3) {
      isFlanked = regExp.test(sibling.nodeValue);
    }
    else if(sibling.nodeType === 1 && !isBlock(sibling)) {
      isFlanked = regExp.test(sibling.textContent);
    }
  }
  return isFlanked;
}

function flankingWhitespace(node) {
  var leading = '', trailing = '';

  if (!isBlock(node)) {
    var hasLeading = /^[ \r\n\t]/.test(node.innerHTML),
        hasTrailing = /[ \r\n\t]$/.test(node.innerHTML);

    if (hasLeading && !isFlankedByWhitespace('left', node)) {
      leading = ' ';
    }
    if (hasTrailing && !isFlankedByWhitespace('right', node)) {
      trailing = ' ';
    }
  }

  return { leading: leading, trailing: trailing };
}

/*
 * Finds a Markdown converter, gets the replacement, and sets it on
 * `_replacement`
 */

function process(node) {
  var replacement, content = getContent(node);

  // Remove blank nodes
  if (!isVoid(node) && !/A|TH|TD/.test(node.nodeName) && /^\s*$/i.test(content)) {
    node._replacement = '';
    return;
  }

  for (var i = 0; i < converters.length; i++) {
    var converter = converters[i];

    if (canConvert(node, converter.filter)) {
      if (typeof converter.replacement !== 'function') {
        throw new TypeError(
          '`replacement` needs to be a function that returns a string'
        );
      }

      var whitespace = flankingWhitespace(node);

      if (whitespace.leading || whitespace.trailing) {
        content = content.trim();
      }
      replacement = whitespace.leading +
                    converter.replacement.call(toMarkdown, content, node) +
                    whitespace.trailing;
      break;
    }
  }

  node._replacement = replacement;
}

toMarkdown = function (input, options) {
  options = options || {};

  if (typeof input !== 'string') {
    throw new TypeError(input + ' is not a string');
  }

  // Escape potential ol triggers
  input = input.replace(/(\d+)\. /g, '$1\\. ');

  var clone = htmlToDom(input).body,
      nodes = bfsOrder(clone),
      output;

  converters = mdConverters.slice(0);
  if (options.gfm) {
    converters = gfmConverters.concat(converters);
  }

  if (options.converters) {
    converters = options.converters.concat(converters);
  }

  // Process through nodes in reverse (so deepest child elements are first).
  for (var i = nodes.length - 1; i >= 0; i--) {
    process(nodes[i]);
  }
  output = getContent(clone);

  return output.replace(/^[\t\r\n]+|[\t\r\n\s]+$/g, '')
               .replace(/\n\s+\n/g, '\n\n')
               .replace(/\n{3,}/g, '\n\n');
};

toMarkdown.isBlock = isBlock;
toMarkdown.isVoid = isVoid;
toMarkdown.outer = outer;

module.exports = toMarkdown;

},{"./lib/gfm-converters":2,"./lib/html-parser":3,"./lib/md-converters":4,"collapse-whitespace":7}],2:[function(require,module,exports){
'use strict';

function cell(content, node) {
  var index = Array.prototype.indexOf.call(node.parentNode.childNodes, node);
  var prefix = ' ';
  if (index === 0) { prefix = '| '; }
  return prefix + content + ' |';
}

var highlightRegEx = /highlight highlight-(\S+)/;

module.exports = [
  {
    filter: 'br',
    replacement: function () {
      return '\n';
    }
  },
  {
    filter: ['del', 's', 'strike'],
    replacement: function (content) {
      return '~~' + content + '~~';
    }
  },

  {
    filter: function (node) {
      return node.type === 'checkbox' && node.parentNode.nodeName === 'LI';
    },
    replacement: function (content, node) {
      return (node.checked ? '[x]' : '[ ]') + ' ';
    }
  },

  {
    filter: ['th', 'td'],
    replacement: function (content, node) {
      return cell(content, node);
    }
  },

  {
    filter: 'tr',
    replacement: function (content, node) {
      var borderCells = '';
      var alignMap = { left: ':--', right: '--:', center: ':-:' };

      if (node.parentNode.nodeName === 'THEAD') {
        for (var i = 0; i < node.childNodes.length; i++) {
          var align = node.childNodes[i].attributes.align;
          var border = '---';

          if (align) { border = alignMap[align.value] || border; }

          borderCells += cell(border, node.childNodes[i]);
        }
      }
      return '\n' + content + (borderCells ? '\n' + borderCells : '');
    }
  },

  {
    filter: 'table',
    replacement: function (content) {
      return '\n\n' + content + '\n\n';
    }
  },

  {
    filter: ['thead', 'tbody', 'tfoot'],
    replacement: function (content) {
      return content;
    }
  },

  // Fenced code blocks
  {
    filter: function (node) {
      return node.nodeName === 'PRE' &&
             node.firstChild &&
             node.firstChild.nodeName === 'CODE';
    },
    replacement: function(content, node) {
      return '\n\n```\n' + node.firstChild.textContent + '\n```\n\n';
    }
  },

  // Syntax-highlighted code blocks
  {
    filter: function (node) {
      return node.nodeName === 'PRE' &&
             node.parentNode.nodeName === 'DIV' &&
             highlightRegEx.test(node.parentNode.className);
    },
    replacement: function (content, node) {
      var language = node.parentNode.className.match(highlightRegEx)[1];
      return '\n\n```' + language + '\n' + node.textContent + '\n```\n\n';
    }
  },

  {
    filter: function (node) {
      return node.nodeName === 'DIV' &&
             highlightRegEx.test(node.className);
    },
    replacement: function (content) {
      return '\n\n' + content + '\n\n';
    }
  }
];

},{}],3:[function(require,module,exports){
/*
 * Set up window for Node.js
 */

var _window = (typeof window !== 'undefined' ? window : this);

/*
 * Parsing HTML strings
 */

function canParseHtmlNatively () {
  var Parser = _window.DOMParser
  var canParse = false;

  // Adapted from https://gist.github.com/1129031
  // Firefox/Opera/IE throw errors on unsupported types
  try {
    // WebKit returns null on unsupported types
    if (new Parser().parseFromString('', 'text/html')) {
      canParse = true;
    }
  } catch (e) {}

  return canParse;
}

function createHtmlParser () {
  var Parser = function () {};
  
  // For Node.js environments
  if (typeof document === 'undefined') {
    var jsdom = require('jsdom');
    Parser.prototype.parseFromString = function (string) {
      return jsdom.jsdom(string, {
        features: {
          FetchExternalResources: [],
          ProcessExternalResources: false
        }
      });
    };
  } else {
    if (!shouldUseActiveX()) {
      Parser.prototype.parseFromString = function (string) {
        var doc = document.implementation.createHTMLDocument('');
        doc.open();
        doc.write(string);
        doc.close();
        return doc;
      };
    } else {
      Parser.prototype.parseFromString = function (string) {
        var doc = new ActiveXObject('htmlfile');
        doc.designMode = 'on'; // disable on-page scripts
        doc.open();
        doc.write(string);
        doc.close();
        return doc;
      };
    }
  }
  return Parser;
}

function shouldUseActiveX () {
  var useActiveX = false;

  try {
    document.implementation.createHTMLDocument('').open();
  } catch (e) {
    if (window.ActiveXObject) useActiveX = true;
  }

  return useActiveX;
}

module.exports = canParseHtmlNatively() ? _window.DOMParser : createHtmlParser()

},{"jsdom":6}],4:[function(require,module,exports){
'use strict';

module.exports = [
  {
    filter: 'p',
    replacement: function (content) {
      return '\n\n' + content + '\n\n';
    }
  },

  {
    filter: 'br',
    replacement: function () {
      return '  \n';
    }
  },

  {
    filter: ['h1', 'h2', 'h3', 'h4','h5', 'h6'],
    replacement: function(content, node) {
      var hLevel = node.nodeName.charAt(1);
      var hPrefix = '';
      for(var i = 0; i < hLevel; i++) {
        hPrefix += '#';
      }
      return '\n\n' + hPrefix + ' ' + content + '\n\n';
    }
  },

  {
    filter: 'hr',
    replacement: function () {
      return '\n\n* * *\n\n';
    }
  },

  {
    filter: ['em', 'i'],
    replacement: function (content) {
      return '_' + content + '_';
    }
  },

  {
    filter: ['strong', 'b'],
    replacement: function (content) {
      return '**' + content + '**';
    }
  },

  // Inline code
  {
    filter: function (node) {
      var hasSiblings = node.previousSibling || node.nextSibling;
      var isCodeBlock = node.parentNode.nodeName === 'PRE' && !hasSiblings;

      return node.nodeName === 'CODE' && !isCodeBlock;
    },
    replacement: function(content) {
      return '`' + content + '`';
    }
  },

  {
    filter: function (node) {
      return node.nodeName === 'A' && node.getAttribute('href');
    },
    replacement: function(content, node) {
      var titlePart = node.title ? ' "'+ node.title +'"' : '';
      return '[' + content + '](' + node.getAttribute('href') + titlePart + ')';
    }
  },

  {
    filter: 'img',
    replacement: function(content, node) {
      var alt = node.alt || '';
      var src = node.getAttribute('src') || '';
      var title = node.title || '';
      var titlePart = title ? ' "'+ title +'"' : '';
      return src ? '![' + alt + ']' + '(' + src + titlePart + ')' : '';
    }
  },

  // Code blocks
  {
    filter: function (node) {
      return node.nodeName === 'PRE' && node.firstChild.nodeName === 'CODE';
    },
    replacement: function(content, node) {
      return '\n\n    ' + node.firstChild.textContent.replace(/\n/g, '\n    ') + '\n\n';
    }
  },

  {
    filter: 'blockquote',
    replacement: function (content) {
      content = content.trim();
      content = content.replace(/\n{3,}/g, '\n\n');
      content = content.replace(/^/gm, '> ');
      return '\n\n' + content + '\n\n';
    }
  },

  {
    filter: 'li',
    replacement: function (content, node) {
      content = content.replace(/^\s+/, '').replace(/\n/gm, '\n    ');
      var prefix = '*   ';
      var parent = node.parentNode;
      var index = Array.prototype.indexOf.call(parent.children, node) + 1;

      prefix = /ol/i.test(parent.nodeName) ? index + '.  ' : '*   ';
      return prefix + content;
    }
  },

  {
    filter: ['ul', 'ol'],
    replacement: function (content, node) {
      var strings = [];
      for (var i = 0; i < node.childNodes.length; i++) {
        strings.push(node.childNodes[i]._replacement);
      }

      if (/li/i.test(node.parentNode.nodeName)) {
        return '\n' + strings.join('\n');
      }
      return '\n\n' + strings.join('\n') + '\n\n';
    }
  },

  {
    filter: function (node) {
      return this.isBlock(node);
    },
    replacement: function (content, node) {
      return '\n\n' + this.outer(node, content) + '\n\n';
    }
  },

  // Anything else!
  {
    filter: function () {
      return true;
    },
    replacement: function (content, node) {
      return this.outer(node, content);
    }
  }
];

},{}],5:[function(require,module,exports){
/**
 * This file automatically generated from `build.js`.
 * Do not manually edit.
 */

module.exports = [
  "address",
  "article",
  "aside",
  "audio",
  "blockquote",
  "canvas",
  "dd",
  "div",
  "dl",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hgroup",
  "hr",
  "main",
  "nav",
  "noscript",
  "ol",
  "output",
  "p",
  "pre",
  "section",
  "table",
  "tfoot",
  "ul",
  "video"
];

},{}],6:[function(require,module,exports){

},{}],7:[function(require,module,exports){
'use strict';

var voidElements = require('void-elements');
Object.keys(voidElements).forEach(function (name) {
  voidElements[name.toUpperCase()] = 1;
});

var blockElements = {};
require('block-elements').forEach(function (name) {
  blockElements[name.toUpperCase()] = 1;
});

/**
 * isBlockElem(node) determines if the given node is a block element.
 *
 * @param {Node} node
 * @return {Boolean}
 */
function isBlockElem(node) {
  return !!(node && blockElements[node.nodeName]);
}

/**
 * isVoid(node) determines if the given node is a void element.
 *
 * @param {Node} node
 * @return {Boolean}
 */
function isVoid(node) {
  return !!(node && voidElements[node.nodeName]);
}

/**
 * whitespace(elem [, isBlock]) removes extraneous whitespace from an
 * the given element. The function isBlock may optionally be passed in
 * to determine whether or not an element is a block element; if none
 * is provided, defaults to using the list of block elements provided
 * by the `block-elements` module.
 *
 * @param {Node} elem
 * @param {Function} blockTest
 */
function collapseWhitespace(elem, isBlock) {
  if (!elem.firstChild || elem.nodeName === 'PRE') return;

  if (typeof isBlock !== 'function') {
    isBlock = isBlockElem;
  }

  var prevText = null;
  var prevVoid = false;

  var prev = null;
  var node = next(prev, elem);

  while (node !== elem) {
    if (node.nodeType === 3) {
      // Node.TEXT_NODE
      var text = node.data.replace(/[ \r\n\t]+/g, ' ');

      if ((!prevText || / $/.test(prevText.data)) && !prevVoid && text[0] === ' ') {
        text = text.substr(1);
      }

      // `text` might be empty at this point.
      if (!text) {
        node = remove(node);
        continue;
      }

      node.data = text;
      prevText = node;
    } else if (node.nodeType === 1) {
      // Node.ELEMENT_NODE
      if (isBlock(node) || node.nodeName === 'BR') {
        if (prevText) {
          prevText.data = prevText.data.replace(/ $/, '');
        }

        prevText = null;
        prevVoid = false;
      } else if (isVoid(node)) {
        // Avoid trimming space around non-block, non-BR void elements.
        prevText = null;
        prevVoid = true;
      }
    } else {
      node = remove(node);
      continue;
    }

    var nextNode = next(prev, node);
    prev = node;
    node = nextNode;
  }

  if (prevText) {
    prevText.data = prevText.data.replace(/ $/, '');
    if (!prevText.data) {
      remove(prevText);
    }
  }
}

/**
 * remove(node) removes the given node from the DOM and returns the
 * next node in the sequence.
 *
 * @param {Node} node
 * @return {Node} node
 */
function remove(node) {
  var next = node.nextSibling || node.parentNode;

  node.parentNode.removeChild(node);

  return next;
}

/**
 * next(prev, current) returns the next node in the sequence, given the
 * current and previous nodes.
 *
 * @param {Node} prev
 * @param {Node} current
 * @return {Node}
 */
function next(prev, current) {
  if (prev && prev.parentNode === current || current.nodeName === 'PRE') {
    return current.nextSibling || current.parentNode;
  }

  return current.firstChild || current.nextSibling || current.parentNode;
}

module.exports = collapseWhitespace;

},{"block-elements":5,"void-elements":8}],8:[function(require,module,exports){
/**
 * This file automatically generated from `pre-publish.js`.
 * Do not manually edit.
 */

module.exports = {
  "area": true,
  "base": true,
  "br": true,
  "col": true,
  "embed": true,
  "hr": true,
  "img": true,
  "input": true,
  "keygen": true,
  "link": true,
  "menuitem": true,
  "meta": true,
  "param": true,
  "source": true,
  "track": true,
  "wbr": true
};

},{}]},{},[1])(1)
});
/* ===================================================
 * bootstrap-markdown.js v2.10.0
 * http://github.com/toopay/bootstrap-markdown
 * ===================================================
 * Copyright 2013-2016 Taufan Aditya
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ========================================================== */

(function(factory){
    if (typeof define === "function" && define.amd) {
        //RequireJS
        define(["jquery"], factory);
    } else if (typeof exports === 'object') {
        //Backbone.js
        factory(require('jquery'));
    } else {
        //Jquery plugin
        factory(jQuery);
    }
}(function($){
  "use strict"; // jshint ;_;

  /* MARKDOWN CLASS DEFINITION
   * ========================== */

  var Markdown = function (element, options) {
    // @TODO : remove this BC on next major release
    // @see : https://github.com/toopay/bootstrap-markdown/issues/109
    var opts = ['autofocus', 'savable', 'hideable', 'width', 
      'height', 'resize', 'iconlibrary', 'language', 
      'footer', 'fullscreen', 'hiddenButtons', 'disabledButtons'];
    $.each(opts,function(_, opt){
      if (typeof $(element).data(opt) !== 'undefined') {
        options = typeof options == 'object' ? options : {}
        options[opt] = $(element).data(opt)
      }
    });
    // End BC

    // Class Properties
    this.$ns           = 'bootstrap-markdown';
    this.$element      = $(element);
    this.$editable     = {el:null, type:null,attrKeys:[], attrValues:[], content:null};
    this.$options      = $.extend(true, {}, $.fn.markdown.defaults, options, this.$element.data('options'));
    this.$oldContent   = null;
    this.$isPreview    = false;
    this.$isFullscreen = false;
    this.$editor       = null;
    this.$textarea     = null;
    this.$handler      = [];
    this.$callback     = [];
    this.$nextTab      = [];

    this.showEditor();
  };

  Markdown.prototype = {

    constructor: Markdown

  , __alterButtons: function(name,alter) {
      var handler = this.$handler, isAll = (name == 'all'),that = this;

      $.each(handler,function(k,v) {
        var halt = true;
        if (isAll) {
          halt = false;
        } else {
          halt = v.indexOf(name) < 0;
        }

        if (halt === false) {
          alter(that.$editor.find('button[data-handler="'+v+'"]'));
        }
      });
    }

  , __buildButtons: function(buttonsArray, container) {
      var i,
          ns = this.$ns,
          handler = this.$handler,
          callback = this.$callback;

      for (i=0;i<buttonsArray.length;i++) {
        // Build each group container
        var y, btnGroups = buttonsArray[i];
        for (y=0;y<btnGroups.length;y++) {
          // Build each button group
          var z,
              buttons = btnGroups[y].data,
              btnGroupContainer = $('<div/>', {
                                    'class': 'btn-group'
                                  });

          for (z=0;z<buttons.length;z++) {
            var button = buttons[z],
                buttonContainer, buttonIconContainer,
                buttonHandler = ns+'-'+button.name,
                buttonIcon = this.__getIcon(button.icon),
                btnText = button.btnText ? button.btnText : '',
                btnClass = button.btnClass ? button.btnClass : 'btn',
                tabIndex = button.tabIndex ? button.tabIndex : '-1',
                hotkey = typeof button.hotkey !== 'undefined' ? button.hotkey : '',
                hotkeyCaption = typeof jQuery.hotkeys !== 'undefined' && hotkey !== '' ? ' ('+hotkey+')' : '';

            // Construct the button object
            buttonContainer = $('<button></button>');
            buttonContainer.text(' ' + this.__localize(btnText)).addClass('btn-default btn-sm').addClass(btnClass);
            if(btnClass.match(/btn\-(primary|success|info|warning|danger|link)/)){
                buttonContainer.removeClass('btn-default');
            }
            buttonContainer.attr({
                'type': 'button',
                'title': this.__localize(button.title) + hotkeyCaption,
                'tabindex': tabIndex,
                'data-provider': ns,
                'data-handler': buttonHandler,
                'data-hotkey': hotkey
            });
            if (button.toggle === true){
              buttonContainer.attr('data-toggle', 'button');
            }
            buttonIconContainer = $('<span/>');
            buttonIconContainer.addClass(buttonIcon);
            buttonIconContainer.prependTo(buttonContainer);

            // Attach the button object
            btnGroupContainer.append(buttonContainer);

            // Register handler and callback
            handler.push(buttonHandler);
            callback.push(button.callback);
          }

          // Attach the button group into container dom
          container.append(btnGroupContainer);
        }
      }

      return container;
    }
  , __setListener: function() {
      // Set size and resizable Properties
      var hasRows = typeof this.$textarea.attr('rows') !== 'undefined',
          maxRows = this.$textarea.val().split("\n").length > 5 ? this.$textarea.val().split("\n").length : '5',
          rowsVal = hasRows ? this.$textarea.attr('rows') : maxRows;

      this.$textarea.attr('rows',rowsVal);
      if (this.$options.resize) {
        this.$textarea.css('resize',this.$options.resize);
      }

      this.$textarea.on({
          'focus' : $.proxy(this.focus, this),
          'keyup' : $.proxy(this.keyup, this),
          'change' : $.proxy(this.change, this),
          'select' : $.proxy(this.select, this)
      });

      if (this.eventSupported('keydown')) {
        this.$textarea.on('keydown', $.proxy(this.keydown, this));
      }

      if (this.eventSupported('keypress')) {
        this.$textarea.on('keypress', $.proxy(this.keypress, this))
      }

      // Re-attach markdown data
      this.$textarea.data('markdown',this);
    }

  , __handle: function(e) {
      var target = $(e.currentTarget),
          handler = this.$handler,
          callback = this.$callback,
          handlerName = target.attr('data-handler'),
          callbackIndex = handler.indexOf(handlerName),
          callbackHandler = callback[callbackIndex];

      // Trigger the focusin
      $(e.currentTarget).focus();

      callbackHandler(this);

      // Trigger onChange for each button handle
      this.change(this);

      // Unless it was the save handler,
      // focusin the textarea
      if (handlerName.indexOf('cmdSave') < 0) {
        this.$textarea.focus();
      }

      e.preventDefault();
    }

  , __localize: function(string) {
      var messages = $.fn.markdown.messages,
          language = this.$options.language;
      if (
        typeof messages !== 'undefined' &&
        typeof messages[language] !== 'undefined' &&
        typeof messages[language][string] !== 'undefined'
      ) {
        return messages[language][string];
      }
      return string;
    }

  , __getIcon: function(src) {
    return typeof src == 'object' ? src[this.$options.iconlibrary] : src;
  }

  , setFullscreen: function(mode) {
    var $editor = this.$editor,
        $textarea = this.$textarea;

    if (mode === true) {
      $editor.addClass('md-fullscreen-mode');
      $('body').addClass('md-nooverflow');
      this.$options.onFullscreen(this);
    } else {
      $editor.removeClass('md-fullscreen-mode');
      $('body').removeClass('md-nooverflow');

      if (this.$isPreview == true) this.hidePreview().showPreview()
    }

    this.$isFullscreen = mode;
    $textarea.focus();
  }

  , showEditor: function() {
      var instance = this,
          textarea,
          ns = this.$ns,
          container = this.$element,
          originalHeigth = container.css('height'),
          originalWidth = container.css('width'),
          editable = this.$editable,
          handler = this.$handler,
          callback = this.$callback,
          options = this.$options,
          editor = $( '<div/>', {
                      'class': 'md-editor',
                      click: function() {
                        instance.focus();
                      }
                    });

      // Prepare the editor
      if (this.$editor === null) {
        // Create the panel
        var editorHeader = $('<div/>', {
                            'class': 'md-header btn-toolbar'
                            });

        // Merge the main & additional button groups together
        var allBtnGroups = [];
        if (options.buttons.length > 0) allBtnGroups = allBtnGroups.concat(options.buttons[0]);
        if (options.additionalButtons.length > 0) {
          // iterate the additional button groups
          $.each(options.additionalButtons[0], function(idx, buttonGroup){
            
            // see if the group name of the addional group matches an existing group
            var matchingGroups = $.grep(allBtnGroups, function(allButtonGroup, allIdx){
              return allButtonGroup.name === buttonGroup.name;
            });

            // if it matches add the addional buttons to that group, if not just add it to the all buttons group
            if(matchingGroups.length > 0) {
              matchingGroups[0].data = matchingGroups[0].data.concat(buttonGroup.data);
            } else {              
              allBtnGroups.push(options.additionalButtons[0][idx]);
            }

          });
        } 

        // Reduce and/or reorder the button groups
        if (options.reorderButtonGroups.length > 0) {
          allBtnGroups = allBtnGroups
              .filter(function(btnGroup) {
                return options.reorderButtonGroups.indexOf(btnGroup.name) > -1;
              })
              .sort(function(a, b) {
                if (options.reorderButtonGroups.indexOf(a.name) < options.reorderButtonGroups.indexOf(b.name)) return -1;
                if (options.reorderButtonGroups.indexOf(a.name) > options.reorderButtonGroups.indexOf(b.name)) return 1;
                return 0;
              });
        }

        // Build the buttons
        if (allBtnGroups.length > 0) {
          editorHeader = this.__buildButtons([allBtnGroups], editorHeader);
        }

        if (options.fullscreen.enable) {
          editorHeader.append('<div class="md-controls"><a class="md-control md-control-fullscreen" href="#"><span class="'+this.__getIcon(options.fullscreen.icons.fullscreenOn)+'"></span></a></div>').on('click', '.md-control-fullscreen', function(e) {
              e.preventDefault();
              instance.setFullscreen(true);
          });
        }

        editor.append(editorHeader);

        // Wrap the textarea
        if (container.is('textarea')) {
          container.before(editor);
          textarea = container;
          textarea.addClass('md-input');
          editor.append(textarea);
        } else {
          var rawContent = (typeof toMarkdown == 'function') ? toMarkdown(container.html()) : container.html(),
              currentContent = $.trim(rawContent);

          // This is some arbitrary content that could be edited
          textarea = $('<textarea/>', {
                       'class': 'md-input',
                       'val' : currentContent
                      });

          editor.append(textarea);

          // Save the editable
          editable.el = container;
          editable.type = container.prop('tagName').toLowerCase();
          editable.content = container.html();

          $(container[0].attributes).each(function(){
            editable.attrKeys.push(this.nodeName);
            editable.attrValues.push(this.nodeValue);
          });

          // Set editor to blocked the original container
          container.replaceWith(editor);
        }

        var editorFooter = $('<div/>', {
                           'class': 'md-footer'
                         }),
            createFooter = false,
            footer = '';
        // Create the footer if savable
        if (options.savable) {
          createFooter = true;
          var saveHandler = 'cmdSave';

          // Register handler and callback
          handler.push(saveHandler);
          callback.push(options.onSave);

          editorFooter.append('<button class="btn btn-success" data-provider="'
                              + ns
                              + '" data-handler="'
                              + saveHandler
                              + '"><i class="icon icon-white icon-ok"></i> '
                              + this.__localize('Save')
                              + '</button>');


        }

        footer = typeof options.footer === 'function' ? options.footer(this) : options.footer;

        if ($.trim(footer) !== '') {
          createFooter = true;
          editorFooter.append(footer);
        }

        if (createFooter) editor.append(editorFooter);

        // Set width
        if (options.width && options.width !== 'inherit') {
          if (jQuery.isNumeric(options.width)) {
            editor.css('display', 'table');
            textarea.css('width', options.width + 'px');
          } else {
            editor.addClass(options.width);
          }
        }

        // Set height
        if (options.height && options.height !== 'inherit') {
          if (jQuery.isNumeric(options.height)) {
            var height = options.height;
            if (editorHeader) height = Math.max(0, height - editorHeader.outerHeight());
            if (editorFooter) height = Math.max(0, height - editorFooter.outerHeight());
            textarea.css('height', height + 'px');
          } else {
            editor.addClass(options.height);
          }
        }

        // Reference
        this.$editor     = editor;
        this.$textarea   = textarea;
        this.$editable   = editable;
        this.$oldContent = this.getContent();

        this.__setListener();

        // Set editor attributes, data short-hand API and listener
        this.$editor.attr('id',(new Date()).getTime());
        this.$editor.on('click', '[data-provider="bootstrap-markdown"]', $.proxy(this.__handle, this));

        if (this.$element.is(':disabled') || this.$element.is('[readonly]')) {
          this.$editor.addClass('md-editor-disabled');
          this.disableButtons('all');
        }

        if (this.eventSupported('keydown') && typeof jQuery.hotkeys === 'object') {
          editorHeader.find('[data-provider="bootstrap-markdown"]').each(function() {
            var $button = $(this),
                hotkey = $button.attr('data-hotkey');
            if (hotkey.toLowerCase() !== '') {
              textarea.bind('keydown', hotkey, function() {
                $button.trigger('click');
                return false;
              });
            }
          });
        }

        if (options.initialstate === 'preview') {
          this.showPreview();
        } else if (options.initialstate === 'fullscreen' && options.fullscreen.enable) {
          this.setFullscreen(true);
        }

      } else {
        this.$editor.show();
      }

      if (options.autofocus) {
        this.$textarea.focus();
        this.$editor.addClass('active');
      }

      if (options.fullscreen.enable && options.fullscreen !== false) {
        this.$editor.append('<div class="md-fullscreen-controls">'
                        + '<a href="#" class="exit-fullscreen" title="Exit fullscreen"><span class="' + this.__getIcon(options.fullscreen.icons.fullscreenOff) + '">'
                        + '</span></a>'
                        + '</div>');
        this.$editor.on('click', '.exit-fullscreen', function(e) {
          e.preventDefault();
          instance.setFullscreen(false);
        });
      }

      // hide hidden buttons from options
      this.hideButtons(options.hiddenButtons);

      // disable disabled buttons from options
      this.disableButtons(options.disabledButtons);

      // Trigger the onShow hook
      options.onShow(this);

      return this;
    }

  , parseContent: function(val) {
      var content;

      // parse with supported markdown parser
      var val = val || this.$textarea.val();

      if (this.$options.parser) {
        content = this.$options.parser(val);
      } else if (typeof markdown == 'object') {
        content = markdown.toHTML(val);
      } else if (typeof marked == 'function') {
        content = marked(val);
      } else {
        content = val;
      }

      return content;
    }

  , showPreview: function() {
      var options = this.$options,
          container = this.$textarea,
          afterContainer = container.next(),
          replacementContainer = $('<div/>',{'class':'md-preview','data-provider':'markdown-preview'}),
          content,
          callbackContent;

      if (this.$isPreview == true) {
        // Avoid sequenced element creation on missused scenario
        // @see https://github.com/toopay/bootstrap-markdown/issues/170
        return this;
      }
      
      // Give flag that tell the editor enter preview mode
      this.$isPreview = true;
      // Disable all buttons
      this.disableButtons('all').enableButtons('cmdPreview');

      // Try to get the content from callback
      callbackContent = options.onPreview(this);
      // Set the content based from the callback content if string otherwise parse value from textarea
      content = typeof callbackContent == 'string' ? callbackContent : this.parseContent();

      // Build preview element
      replacementContainer.html(content);

      if (afterContainer && afterContainer.attr('class') == 'md-footer') {
        // If there is footer element, insert the preview container before it
        replacementContainer.insertBefore(afterContainer);
      } else {
        // Otherwise, just append it after textarea
        container.parent().append(replacementContainer);
      }

      // Set the preview element dimensions
      replacementContainer.css({
        width: container.outerWidth() + 'px',
        height: container.outerHeight() + 'px'
      });

      if (this.$options.resize) {
        replacementContainer.css('resize',this.$options.resize);
      }

      // Hide the last-active textarea
      container.hide();

      // Attach the editor instances
      replacementContainer.data('markdown',this);

      if (this.$element.is(':disabled') || this.$element.is('[readonly]')) {
        this.$editor.addClass('md-editor-disabled');
        this.disableButtons('all');
      }

      return this;
    }

  , hidePreview: function() {
      // Give flag that tell the editor quit preview mode
      this.$isPreview = false;

      // Obtain the preview container
      var container = this.$editor.find('div[data-provider="markdown-preview"]');

      // Remove the preview container
      container.remove();

      // Enable all buttons
      this.enableButtons('all');
      // Disable configured disabled buttons
      this.disableButtons(this.$options.disabledButtons);

      // Back to the editor
      this.$textarea.show();
      this.__setListener();

      return this;
    }

  , isDirty: function() {
      return this.$oldContent != this.getContent();
    }

  , getContent: function() {
      return this.$textarea.val();
    }

  , setContent: function(content) {
      this.$textarea.val(content);

      return this;
    }

  , findSelection: function(chunk) {
    var content = this.getContent(), startChunkPosition;

    if (startChunkPosition = content.indexOf(chunk), startChunkPosition >= 0 && chunk.length > 0) {
      var oldSelection = this.getSelection(), selection;

      this.setSelection(startChunkPosition,startChunkPosition+chunk.length);
      selection = this.getSelection();

      this.setSelection(oldSelection.start,oldSelection.end);

      return selection;
    } else {
      return null;
    }
  }

  , getSelection: function() {

      var e = this.$textarea[0];

      return (

          ('selectionStart' in e && function() {
              var l = e.selectionEnd - e.selectionStart;
              return { start: e.selectionStart, end: e.selectionEnd, length: l, text: e.value.substr(e.selectionStart, l) };
          }) ||

          /* browser not supported */
          function() {
            return null;
          }

      )();

    }

  , setSelection: function(start,end) {

      var e = this.$textarea[0];

      return (

          ('selectionStart' in e && function() {
              e.selectionStart = start;
              e.selectionEnd = end;
              return;
          }) ||

          /* browser not supported */
          function() {
            return null;
          }

      )();

    }

  , replaceSelection: function(text) {

      var e = this.$textarea[0];

      return (

          ('selectionStart' in e && function() {
              e.value = e.value.substr(0, e.selectionStart) + text + e.value.substr(e.selectionEnd, e.value.length);
              // Set cursor to the last replacement end
              e.selectionStart = e.value.length;
              return this;
          }) ||

          /* browser not supported */
          function() {
              e.value += text;
              return jQuery(e);
          }

      )();
    }

  , getNextTab: function() {
      // Shift the nextTab
      if (this.$nextTab.length === 0) {
        return null;
      } else {
        var nextTab, tab = this.$nextTab.shift();

        if (typeof tab == 'function') {
          nextTab = tab();
        } else if (typeof tab == 'object' && tab.length > 0) {
          nextTab = tab;
        }

        return nextTab;
      }
    }

  , setNextTab: function(start,end) {
      // Push new selection into nextTab collections
      if (typeof start == 'string') {
        var that = this;
        this.$nextTab.push(function(){
          return that.findSelection(start);
        });
      } else if (typeof start == 'number' && typeof end == 'number') {
        var oldSelection = this.getSelection();

        this.setSelection(start,end);
        this.$nextTab.push(this.getSelection());

        this.setSelection(oldSelection.start,oldSelection.end);
      }

      return;
    }

  , __parseButtonNameParam: function (names) {
      return typeof names == 'string' ?
                      names.split(' ') :
                      names;

    }

  , enableButtons: function(name) {
      var buttons = this.__parseButtonNameParam(name),
        that = this;

      $.each(buttons, function(i, v) {
        that.__alterButtons(buttons[i], function (el) {
          el.removeAttr('disabled');
        });
      });

      return this;
    }

  , disableButtons: function(name) {
      var buttons = this.__parseButtonNameParam(name),
        that = this;

      $.each(buttons, function(i, v) {
        that.__alterButtons(buttons[i], function (el) {
          el.attr('disabled','disabled');
        });
      });

      return this;
    }

  , hideButtons: function(name) {
      var buttons = this.__parseButtonNameParam(name),
        that = this;

      $.each(buttons, function(i, v) {
        that.__alterButtons(buttons[i], function (el) {
          el.addClass('hidden');
        });
      });

      return this;
    }

  , showButtons: function(name) {
      var buttons = this.__parseButtonNameParam(name),
        that = this;

      $.each(buttons, function(i, v) {
        that.__alterButtons(buttons[i], function (el) {
          el.removeClass('hidden');
        });
      });

      return this;
    }

  , eventSupported: function(eventName) {
      var isSupported = eventName in this.$element;
      if (!isSupported) {
        this.$element.setAttribute(eventName, 'return;');
        isSupported = typeof this.$element[eventName] === 'function';
      }
      return isSupported;
    }

  , keyup: function (e) {
      var blocked = false;
      switch(e.keyCode) {
        case 40: // down arrow
        case 38: // up arrow
        case 16: // shift
        case 17: // ctrl
        case 18: // alt
          break;

        case 9: // tab
          var nextTab;
          if (nextTab = this.getNextTab(),nextTab !== null) {
            // Get the nextTab if exists
            var that = this;
            setTimeout(function(){
              that.setSelection(nextTab.start,nextTab.end);
            },500);

            blocked = true;
          } else {
            // The next tab memory contains nothing...
            // check the cursor position to determine tab action
            var cursor = this.getSelection();

            if (cursor.start == cursor.end && cursor.end == this.getContent().length) {
              // The cursor already reach the end of the content
              blocked = false;
            } else {
              // Put the cursor to the end
              this.setSelection(this.getContent().length,this.getContent().length);

              blocked = true;
            }
          }

          break;

        case 13: // enter
          blocked = false;
          break;
        case 27: // escape
          if (this.$isFullscreen) this.setFullscreen(false);
          blocked = false;
          break;

        default:
          blocked = false;
      }

      if (blocked) {
        e.stopPropagation();
        e.preventDefault();
      }

      this.$options.onChange(this);
    }

  , change: function(e) {
      this.$options.onChange(this);
      return this;
    }
  , select: function (e) {
      this.$options.onSelect(this);
      return this;
    }
  , focus: function (e) {
      var options = this.$options,
          isHideable = options.hideable,
          editor = this.$editor;

      editor.addClass('active');

      // Blur other markdown(s)
      $(document).find('.md-editor').each(function(){
        if ($(this).attr('id') !== editor.attr('id')) {
          var attachedMarkdown;

          if (attachedMarkdown = $(this).find('textarea').data('markdown'),
              attachedMarkdown === null) {
              attachedMarkdown = $(this).find('div[data-provider="markdown-preview"]').data('markdown');
          }

          if (attachedMarkdown) {
            attachedMarkdown.blur();
          }
        }
      });

      // Trigger the onFocus hook
      options.onFocus(this);

      return this;
    }

  , blur: function (e) {
      var options = this.$options,
          isHideable = options.hideable,
          editor = this.$editor,
          editable = this.$editable;

      if (editor.hasClass('active') || this.$element.parent().length === 0) {
        editor.removeClass('active');

        if (isHideable) {
          // Check for editable elements
          if (editable.el !== null) {
            // Build the original element
            var oldElement = $('<'+editable.type+'/>'),
                content = this.getContent(),
                currentContent = this.parseContent(content);

            $(editable.attrKeys).each(function(k,v) {
              oldElement.attr(editable.attrKeys[k],editable.attrValues[k]);
            });

            // Get the editor content
            oldElement.html(currentContent);

            editor.replaceWith(oldElement);
          } else {
            editor.hide();
          }
        }

        // Trigger the onBlur hook
        options.onBlur(this);
      }

      return this;
    }

  };

 /* MARKDOWN PLUGIN DEFINITION
  * ========================== */

  var old = $.fn.markdown;

  $.fn.markdown = function (option) {
    return this.each(function () {
      var $this = $(this)
        , data = $this.data('markdown')
        , options = typeof option == 'object' && option;
      if (!data) $this.data('markdown', (data = new Markdown(this, options)))
    })
  };

  $.fn.markdown.messages = {};

  $.fn.markdown.defaults = {
    /* Editor Properties */
    autofocus: false,
    hideable: false,
    savable: false,
    width: 'inherit',
    height: 'inherit',
    resize: 'none',
    iconlibrary: 'glyph',
    language: 'en',
    initialstate: 'editor',
    parser: null,

    /* Buttons Properties */
    buttons: [
      [{
        name: 'groupFont',
        data: [{
          name: 'cmdBold',
          hotkey: 'Ctrl+B',
          title: 'Bold',
          icon: { glyph: 'glyphicon glyphicon-bold', fa: 'fa fa-bold', 'fa-3': 'icon-bold' },
          callback: function(e){
            // Give/remove ** surround the selection
            var chunk, cursor, selected = e.getSelection(), content = e.getContent();

            if (selected.length === 0) {
              // Give extra word
              chunk = e.__localize('strong text');
            } else {
              chunk = selected.text;
            }

            // transform selection and set the cursor into chunked text
            if (content.substr(selected.start-2,2) === '**'
                && content.substr(selected.end,2) === '**' ) {
              e.setSelection(selected.start-2,selected.end+2);
              e.replaceSelection(chunk);
              cursor = selected.start-2;
            } else {
              e.replaceSelection('**'+chunk+'**');
              cursor = selected.start+2;
            }

            // Set the cursor
            e.setSelection(cursor,cursor+chunk.length);
          }
        },{
          name: 'cmdItalic',
          title: 'Italic',
          hotkey: 'Ctrl+I',
          icon: { glyph: 'glyphicon glyphicon-italic', fa: 'fa fa-italic', 'fa-3': 'icon-italic' },
          callback: function(e){
            // Give/remove * surround the selection
            var chunk, cursor, selected = e.getSelection(), content = e.getContent();

            if (selected.length === 0) {
              // Give extra word
              chunk = e.__localize('emphasized text');
            } else {
              chunk = selected.text;
            }

            // transform selection and set the cursor into chunked text
            if (content.substr(selected.start-1,1) === '_'
                && content.substr(selected.end,1) === '_' ) {
              e.setSelection(selected.start-1,selected.end+1);
              e.replaceSelection(chunk);
              cursor = selected.start-1;
            } else {
              e.replaceSelection('_'+chunk+'_');
              cursor = selected.start+1;
            }

            // Set the cursor
            e.setSelection(cursor,cursor+chunk.length);
          }
        },{
          name: 'cmdHeading',
          title: 'Heading',
          hotkey: 'Ctrl+H',
          icon: { glyph: 'glyphicon glyphicon-header', fa: 'fa fa-header', 'fa-3': 'icon-font' },
          callback: function(e){
            // Append/remove ### surround the selection
            var chunk, cursor, selected = e.getSelection(), content = e.getContent(), pointer, prevChar;

            if (selected.length === 0) {
              // Give extra word
              chunk = e.__localize('heading text');
            } else {
              chunk = selected.text + '\n';
            }

            // transform selection and set the cursor into chunked text
            if ((pointer = 4, content.substr(selected.start-pointer,pointer) === '### ')
                || (pointer = 3, content.substr(selected.start-pointer,pointer) === '###')) {
              e.setSelection(selected.start-pointer,selected.end);
              e.replaceSelection(chunk);
              cursor = selected.start-pointer;
            } else if (selected.start > 0 && (prevChar = content.substr(selected.start-1,1), !!prevChar && prevChar != '\n')) {
              e.replaceSelection('\n\n### '+chunk);
              cursor = selected.start+6;
            } else {
              // Empty string before element
              e.replaceSelection('### '+chunk);
              cursor = selected.start+4;
            }

            // Set the cursor
            e.setSelection(cursor,cursor+chunk.length);
          }
        }]
      },{
        name: 'groupLink',
        data: [{
          name: 'cmdUrl',
          title: 'URL/Link',
          hotkey: 'Ctrl+L',
          icon: { glyph: 'glyphicon glyphicon-link', fa: 'fa fa-link', 'fa-3': 'icon-link' },
          callback: function(e){
            // Give [] surround the selection and prepend the link
            var chunk, cursor, selected = e.getSelection(), content = e.getContent(), link;

            if (selected.length === 0) {
              // Give extra word
              chunk = e.__localize('enter link description here');
            } else {
              chunk = selected.text;
            }

            link = prompt(e.__localize('Insert Hyperlink'),'http://');

            var urlRegex = new RegExp('^((http|https)://|(mailto:)|(//))[a-z0-9]', 'i');
            if (link !== null && link !== '' && link !== 'http://' && urlRegex.test(link)) {
              var sanitizedLink = $('<div>'+link+'</div>').text();

              // transform selection and set the cursor into chunked text
              e.replaceSelection('['+chunk+']('+sanitizedLink+')');
              cursor = selected.start+1;

              // Set the cursor
              e.setSelection(cursor,cursor+chunk.length);
            }
          }
        },{
          name: 'cmdImage',
          title: 'Image',
          hotkey: 'Ctrl+G',
          icon: { glyph: 'glyphicon glyphicon-picture', fa: 'fa fa-picture-o', 'fa-3': 'icon-picture' },
          callback: function(e){
            // Give ![] surround the selection and prepend the image link
            var chunk, cursor, selected = e.getSelection(), content = e.getContent(), link;

            if (selected.length === 0) {
              // Give extra word
              chunk = e.__localize('enter image description here');
            } else {
              chunk = selected.text;
            }

            link = prompt(e.__localize('Insert Image Hyperlink'),'http://');

            var urlRegex = new RegExp('^((http|https)://|(//))[a-z0-9]', 'i');
            if (link !== null && link !== '' && link !== 'http://' && urlRegex.test(link)) {
              var sanitizedLink = $('<div>'+link+'</div>').text();

              // transform selection and set the cursor into chunked text
              e.replaceSelection('!['+chunk+']('+sanitizedLink+' "'+e.__localize('enter image title here')+'")');
              cursor = selected.start+2;

              // Set the next tab
              e.setNextTab(e.__localize('enter image title here'));

              // Set the cursor
              e.setSelection(cursor,cursor+chunk.length);
            }
          }
        }]
      },{
        name: 'groupMisc',
        data: [{
          name: 'cmdList',
          hotkey: 'Ctrl+U',
          title: 'Unordered List',
          icon: { glyph: 'glyphicon glyphicon-list', fa: 'fa fa-list', 'fa-3': 'icon-list-ul' },
          callback: function(e){
            // Prepend/Give - surround the selection
            var chunk, cursor, selected = e.getSelection(), content = e.getContent();

            // transform selection and set the cursor into chunked text
            if (selected.length === 0) {
              // Give extra word
              chunk = e.__localize('list text here');

              e.replaceSelection('- '+chunk);
              // Set the cursor
              cursor = selected.start+2;
            } else {
              if (selected.text.indexOf('\n') < 0) {
                chunk = selected.text;

                e.replaceSelection('- '+chunk);

                // Set the cursor
                cursor = selected.start+2;
              } else {
                var list = [];

                list = selected.text.split('\n');
                chunk = list[0];

                $.each(list,function(k,v) {
                  list[k] = '- '+v;
                });

                e.replaceSelection('\n\n'+list.join('\n'));

                // Set the cursor
                cursor = selected.start+4;
              }
            }

            // Set the cursor
            e.setSelection(cursor,cursor+chunk.length);
          }
        },
        {
          name: 'cmdListO',
          hotkey: 'Ctrl+O',
          title: 'Ordered List',
          icon: { glyph: 'glyphicon glyphicon-th-list', fa: 'fa fa-list-ol', 'fa-3': 'icon-list-ol' },
          callback: function(e) {

            // Prepend/Give - surround the selection
            var chunk, cursor, selected = e.getSelection(), content = e.getContent();

            // transform selection and set the cursor into chunked text
            if (selected.length === 0) {
              // Give extra word
              chunk = e.__localize('list text here');
              e.replaceSelection('1. '+chunk);
              // Set the cursor
              cursor = selected.start+3;
            } else {
              if (selected.text.indexOf('\n') < 0) {
                chunk = selected.text;

                e.replaceSelection('1. '+chunk);

                // Set the cursor
                cursor = selected.start+3;
              } else {
                var list = [];

                list = selected.text.split('\n');
                chunk = list[0];

                $.each(list,function(k,v) {
                  list[k] = '1. '+v;
                });

                e.replaceSelection('\n\n'+list.join('\n'));

                // Set the cursor
                cursor = selected.start+5;
              }
            }

            // Set the cursor
            e.setSelection(cursor,cursor+chunk.length);
          }
        },
        {
          name: 'cmdCode',
          hotkey: 'Ctrl+K',
          title: 'Code',
          icon: { glyph: 'glyphicon glyphicon-asterisk', fa: 'fa fa-code', 'fa-3': 'icon-code' },
          callback: function(e) {
            // Give/remove ** surround the selection
            var chunk, cursor, selected = e.getSelection(), content = e.getContent();

            if (selected.length === 0) {
              // Give extra word
              chunk = e.__localize('code text here');
            } else {
              chunk = selected.text;
            }

            // transform selection and set the cursor into chunked text
            if (content.substr(selected.start-4,4) === '```\n'
                && content.substr(selected.end,4) === '\n```') {
              e.setSelection(selected.start-4, selected.end+4);
              e.replaceSelection(chunk);
              cursor = selected.start-4;
            } else if (content.substr(selected.start-1,1) === '`'
                && content.substr(selected.end,1) === '`') {
              e.setSelection(selected.start-1,selected.end+1);
              e.replaceSelection(chunk);
              cursor = selected.start-1;
            } else if (content.indexOf('\n') > -1) {
              e.replaceSelection('```\n'+chunk+'\n```');
              cursor = selected.start+4;
            } else {
              e.replaceSelection('`'+chunk+'`');
              cursor = selected.start+1;
            }

            // Set the cursor
            e.setSelection(cursor,cursor+chunk.length);
          }
        },
        {
          name: 'cmdQuote',
          hotkey: 'Ctrl+Q',
          title: 'Quote',
          icon: { glyph: 'glyphicon glyphicon-comment', fa: 'fa fa-quote-left', 'fa-3': 'icon-quote-left' },
          callback: function(e) {
            // Prepend/Give - surround the selection
            var chunk, cursor, selected = e.getSelection(), content = e.getContent();

            // transform selection and set the cursor into chunked text
            if (selected.length === 0) {
              // Give extra word
              chunk = e.__localize('quote here');

              e.replaceSelection('> '+chunk);

              // Set the cursor
              cursor = selected.start+2;
            } else {
              if (selected.text.indexOf('\n') < 0) {
                chunk = selected.text;

                e.replaceSelection('> '+chunk);

                // Set the cursor
                cursor = selected.start+2;
              } else {
                var list = [];

                list = selected.text.split('\n');
                chunk = list[0];

                $.each(list,function(k,v) {
                  list[k] = '> '+v;
                });

                e.replaceSelection('\n\n'+list.join('\n'));

                // Set the cursor
                cursor = selected.start+4;
              }
            }

            // Set the cursor
            e.setSelection(cursor,cursor+chunk.length);
          }
        }]
      },{
        name: 'groupUtil',
        data: [{
          name: 'cmdPreview',
          toggle: true,
          hotkey: 'Ctrl+P',
          title: 'Preview',
          btnText: 'Preview',
          btnClass: 'btn btn-primary btn-sm',
          icon: { glyph: 'glyphicon glyphicon-search', fa: 'fa fa-search', 'fa-3': 'icon-search' },
          callback: function(e){
            // Check the preview mode and toggle based on this flag
            var isPreview = e.$isPreview,content;

            if (isPreview === false) {
              // Give flag that tell the editor enter preview mode
              e.showPreview();
            } else {
              e.hidePreview();
            }
          }
        }]
      }]
    ],
    additionalButtons:[], // Place to hook more buttons by code
    reorderButtonGroups:[],
    hiddenButtons:[], // Default hidden buttons
    disabledButtons:[], // Default disabled buttons
    footer: '',
    fullscreen: {
      enable: true,
      icons: {
        fullscreenOn: {
          fa: 'fa fa-expand',
          glyph: 'glyphicon glyphicon-fullscreen',
          'fa-3': 'icon-resize-full'
        },
        fullscreenOff: {
          fa: 'fa fa-compress',
          glyph: 'glyphicon glyphicon-fullscreen',
          'fa-3': 'icon-resize-small'
        }
      }
    },

    /* Events hook */
    onShow: function (e) {},
    onPreview: function (e) {},
    onSave: function (e) {},
    onBlur: function (e) {},
    onFocus: function (e) {},
    onChange: function(e) {},
    onFullscreen: function(e) {},
    onSelect: function (e) {}
  };

  $.fn.markdown.Constructor = Markdown;


 /* MARKDOWN NO CONFLICT
  * ==================== */

  $.fn.markdown.noConflict = function () {
    $.fn.markdown = old;
    return this;
  };

  /* MARKDOWN GLOBAL FUNCTION & DATA-API
  * ==================================== */
  var initMarkdown = function(el) {
    var $this = el;

    if ($this.data('markdown')) {
      $this.data('markdown').showEditor();
      return;
    }

    $this.markdown()
  };

  var blurNonFocused = function(e) {
    var $activeElement = $(document.activeElement);

    // Blur event
    $(document).find('.md-editor').each(function(){
      var $this            = $(this),
          focused          = $activeElement.closest('.md-editor')[0] === this,
          attachedMarkdown = $this.find('textarea').data('markdown') ||
                             $this.find('div[data-provider="markdown-preview"]').data('markdown');

      if (attachedMarkdown && !focused) {
        attachedMarkdown.blur();
      }
    })
  };

  $(document)
    .on('click.markdown.data-api', '[data-provide="markdown-editable"]', function (e) {
      initMarkdown($(this));
      e.preventDefault();
    })
    .on('click focusin', function (e) {
      blurNonFocused(e);
    })
    .ready(function(){
      $('textarea[data-provide="markdown"]').each(function(){
        initMarkdown($(this));
      })
    });

}));

/**
 * @license AngularJS v1.5.3
 * (c) 2010-2016 Google, Inc. http://angularjs.org
 * License: MIT
 */
(function(window, angular, undefined) {'use strict';

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *     Any commits to this file should be reviewed with security in mind.  *
 *   Changes to this file can potentially create security vulnerabilities. *
 *          An approval from 2 Core members with history of modifying      *
 *                         this file is required.                          *
 *                                                                         *
 *  Does the change somehow allow for arbitrary javascript to be executed? *
 *    Or allows for someone to change the prototype of built-in objects?   *
 *     Or gives undesired access to variables likes document or window?    *
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

var $sanitizeMinErr = angular.$$minErr('$sanitize');

/**
 * @ngdoc module
 * @name ngSanitize
 * @description
 *
 * # ngSanitize
 *
 * The `ngSanitize` module provides functionality to sanitize HTML.
 *
 *
 * <div doc-module-components="ngSanitize"></div>
 *
 * See {@link ngSanitize.$sanitize `$sanitize`} for usage.
 */

/**
 * @ngdoc service
 * @name $sanitize
 * @kind function
 *
 * @description
 *   Sanitizes an html string by stripping all potentially dangerous tokens.
 *
 *   The input is sanitized by parsing the HTML into tokens. All safe tokens (from a whitelist) are
 *   then serialized back to properly escaped html string. This means that no unsafe input can make
 *   it into the returned string.
 *
 *   The whitelist for URL sanitization of attribute values is configured using the functions
 *   `aHrefSanitizationWhitelist` and `imgSrcSanitizationWhitelist` of {@link ng.$compileProvider
 *   `$compileProvider`}.
 *
 *   The input may also contain SVG markup if this is enabled via {@link $sanitizeProvider}.
 *
 * @param {string} html HTML input.
 * @returns {string} Sanitized HTML.
 *
 * @example
   <example module="sanitizeExample" deps="angular-sanitize.js">
   <file name="index.html">
     <script>
         angular.module('sanitizeExample', ['ngSanitize'])
           .controller('ExampleController', ['$scope', '$sce', function($scope, $sce) {
             $scope.snippet =
               '<p style="color:blue">an html\n' +
               '<em onmouseover="this.textContent=\'PWN3D!\'">click here</em>\n' +
               'snippet</p>';
             $scope.deliberatelyTrustDangerousSnippet = function() {
               return $sce.trustAsHtml($scope.snippet);
             };
           }]);
     </script>
     <div ng-controller="ExampleController">
        Snippet: <textarea ng-model="snippet" cols="60" rows="3"></textarea>
       <table>
         <tr>
           <td>Directive</td>
           <td>How</td>
           <td>Source</td>
           <td>Rendered</td>
         </tr>
         <tr id="bind-html-with-sanitize">
           <td>ng-bind-html</td>
           <td>Automatically uses $sanitize</td>
           <td><pre>&lt;div ng-bind-html="snippet"&gt;<br/>&lt;/div&gt;</pre></td>
           <td><div ng-bind-html="snippet"></div></td>
         </tr>
         <tr id="bind-html-with-trust">
           <td>ng-bind-html</td>
           <td>Bypass $sanitize by explicitly trusting the dangerous value</td>
           <td>
           <pre>&lt;div ng-bind-html="deliberatelyTrustDangerousSnippet()"&gt;
&lt;/div&gt;</pre>
           </td>
           <td><div ng-bind-html="deliberatelyTrustDangerousSnippet()"></div></td>
         </tr>
         <tr id="bind-default">
           <td>ng-bind</td>
           <td>Automatically escapes</td>
           <td><pre>&lt;div ng-bind="snippet"&gt;<br/>&lt;/div&gt;</pre></td>
           <td><div ng-bind="snippet"></div></td>
         </tr>
       </table>
       </div>
   </file>
   <file name="protractor.js" type="protractor">
     it('should sanitize the html snippet by default', function() {
       expect(element(by.css('#bind-html-with-sanitize div')).getInnerHtml()).
         toBe('<p>an html\n<em>click here</em>\nsnippet</p>');
     });

     it('should inline raw snippet if bound to a trusted value', function() {
       expect(element(by.css('#bind-html-with-trust div')).getInnerHtml()).
         toBe("<p style=\"color:blue\">an html\n" +
              "<em onmouseover=\"this.textContent='PWN3D!'\">click here</em>\n" +
              "snippet</p>");
     });

     it('should escape snippet without any filter', function() {
       expect(element(by.css('#bind-default div')).getInnerHtml()).
         toBe("&lt;p style=\"color:blue\"&gt;an html\n" +
              "&lt;em onmouseover=\"this.textContent='PWN3D!'\"&gt;click here&lt;/em&gt;\n" +
              "snippet&lt;/p&gt;");
     });

     it('should update', function() {
       element(by.model('snippet')).clear();
       element(by.model('snippet')).sendKeys('new <b onclick="alert(1)">text</b>');
       expect(element(by.css('#bind-html-with-sanitize div')).getInnerHtml()).
         toBe('new <b>text</b>');
       expect(element(by.css('#bind-html-with-trust div')).getInnerHtml()).toBe(
         'new <b onclick="alert(1)">text</b>');
       expect(element(by.css('#bind-default div')).getInnerHtml()).toBe(
         "new &lt;b onclick=\"alert(1)\"&gt;text&lt;/b&gt;");
     });
   </file>
   </example>
 */


/**
 * @ngdoc provider
 * @name $sanitizeProvider
 *
 * @description
 * Creates and configures {@link $sanitize} instance.
 */
function $SanitizeProvider() {
  var svgEnabled = false;

  this.$get = ['$$sanitizeUri', function($$sanitizeUri) {
    if (svgEnabled) {
      angular.extend(validElements, svgElements);
    }
    return function(html) {
      var buf = [];
      htmlParser(html, htmlSanitizeWriter(buf, function(uri, isImage) {
        return !/^unsafe:/.test($$sanitizeUri(uri, isImage));
      }));
      return buf.join('');
    };
  }];


  /**
   * @ngdoc method
   * @name $sanitizeProvider#enableSvg
   * @kind function
   *
   * @description
   * Enables a subset of svg to be supported by the sanitizer.
   *
   * <div class="alert alert-warning">
   *   <p>By enabling this setting without taking other precautions, you might expose your
   *   application to click-hijacking attacks. In these attacks, sanitized svg elements could be positioned
   *   outside of the containing element and be rendered over other elements on the page (e.g. a login
   *   link). Such behavior can then result in phishing incidents.</p>
   *
   *   <p>To protect against these, explicitly setup `overflow: hidden` css rule for all potential svg
   *   tags within the sanitized content:</p>
   *
   *   <br>
   *
   *   <pre><code>
   *   .rootOfTheIncludedContent svg {
   *     overflow: hidden !important;
   *   }
   *   </code></pre>
   * </div>
   *
   * @param {boolean=} regexp New regexp to whitelist urls with.
   * @returns {boolean|ng.$sanitizeProvider} Returns the currently configured value if called
   *    without an argument or self for chaining otherwise.
   */
  this.enableSvg = function(enableSvg) {
    if (angular.isDefined(enableSvg)) {
      svgEnabled = enableSvg;
      return this;
    } else {
      return svgEnabled;
    }
  };
}

function sanitizeText(chars) {
  var buf = [];
  var writer = htmlSanitizeWriter(buf, angular.noop);
  writer.chars(chars);
  return buf.join('');
}


// Regular Expressions for parsing tags and attributes
var SURROGATE_PAIR_REGEXP = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g,
  // Match everything outside of normal chars and " (quote character)
  NON_ALPHANUMERIC_REGEXP = /([^\#-~ |!])/g;


// Good source of info about elements and attributes
// http://dev.w3.org/html5/spec/Overview.html#semantics
// http://simon.html5.org/html-elements

// Safe Void Elements - HTML5
// http://dev.w3.org/html5/spec/Overview.html#void-elements
var voidElements = toMap("area,br,col,hr,img,wbr");

// Elements that you can, intentionally, leave open (and which close themselves)
// http://dev.w3.org/html5/spec/Overview.html#optional-tags
var optionalEndTagBlockElements = toMap("colgroup,dd,dt,li,p,tbody,td,tfoot,th,thead,tr"),
    optionalEndTagInlineElements = toMap("rp,rt"),
    optionalEndTagElements = angular.extend({},
                                            optionalEndTagInlineElements,
                                            optionalEndTagBlockElements);

// Safe Block Elements - HTML5
var blockElements = angular.extend({}, optionalEndTagBlockElements, toMap("address,article," +
        "aside,blockquote,caption,center,del,dir,div,dl,figure,figcaption,footer,h1,h2,h3,h4,h5," +
        "h6,header,hgroup,hr,ins,map,menu,nav,ol,pre,section,table,ul"));

// Inline Elements - HTML5
var inlineElements = angular.extend({}, optionalEndTagInlineElements, toMap("a,abbr,acronym,b," +
        "bdi,bdo,big,br,cite,code,del,dfn,em,font,i,img,ins,kbd,label,map,mark,q,ruby,rp,rt,s," +
        "samp,small,span,strike,strong,sub,sup,time,tt,u,var"));

// SVG Elements
// https://wiki.whatwg.org/wiki/Sanitization_rules#svg_Elements
// Note: the elements animate,animateColor,animateMotion,animateTransform,set are intentionally omitted.
// They can potentially allow for arbitrary javascript to be executed. See #11290
var svgElements = toMap("circle,defs,desc,ellipse,font-face,font-face-name,font-face-src,g,glyph," +
        "hkern,image,linearGradient,line,marker,metadata,missing-glyph,mpath,path,polygon,polyline," +
        "radialGradient,rect,stop,svg,switch,text,title,tspan");

// Blocked Elements (will be stripped)
var blockedElements = toMap("script,style");

var validElements = angular.extend({},
                                   voidElements,
                                   blockElements,
                                   inlineElements,
                                   optionalEndTagElements);

//Attributes that have href and hence need to be sanitized
var uriAttrs = toMap("background,cite,href,longdesc,src,xlink:href");

var htmlAttrs = toMap('abbr,align,alt,axis,bgcolor,border,cellpadding,cellspacing,class,clear,' +
    'color,cols,colspan,compact,coords,dir,face,headers,height,hreflang,hspace,' +
    'ismap,lang,language,nohref,nowrap,rel,rev,rows,rowspan,rules,' +
    'scope,scrolling,shape,size,span,start,summary,tabindex,target,title,type,' +
    'valign,value,vspace,width');

// SVG attributes (without "id" and "name" attributes)
// https://wiki.whatwg.org/wiki/Sanitization_rules#svg_Attributes
var svgAttrs = toMap('accent-height,accumulate,additive,alphabetic,arabic-form,ascent,' +
    'baseProfile,bbox,begin,by,calcMode,cap-height,class,color,color-rendering,content,' +
    'cx,cy,d,dx,dy,descent,display,dur,end,fill,fill-rule,font-family,font-size,font-stretch,' +
    'font-style,font-variant,font-weight,from,fx,fy,g1,g2,glyph-name,gradientUnits,hanging,' +
    'height,horiz-adv-x,horiz-origin-x,ideographic,k,keyPoints,keySplines,keyTimes,lang,' +
    'marker-end,marker-mid,marker-start,markerHeight,markerUnits,markerWidth,mathematical,' +
    'max,min,offset,opacity,orient,origin,overline-position,overline-thickness,panose-1,' +
    'path,pathLength,points,preserveAspectRatio,r,refX,refY,repeatCount,repeatDur,' +
    'requiredExtensions,requiredFeatures,restart,rotate,rx,ry,slope,stemh,stemv,stop-color,' +
    'stop-opacity,strikethrough-position,strikethrough-thickness,stroke,stroke-dasharray,' +
    'stroke-dashoffset,stroke-linecap,stroke-linejoin,stroke-miterlimit,stroke-opacity,' +
    'stroke-width,systemLanguage,target,text-anchor,to,transform,type,u1,u2,underline-position,' +
    'underline-thickness,unicode,unicode-range,units-per-em,values,version,viewBox,visibility,' +
    'width,widths,x,x-height,x1,x2,xlink:actuate,xlink:arcrole,xlink:role,xlink:show,xlink:title,' +
    'xlink:type,xml:base,xml:lang,xml:space,xmlns,xmlns:xlink,y,y1,y2,zoomAndPan', true);

var validAttrs = angular.extend({},
                                uriAttrs,
                                svgAttrs,
                                htmlAttrs);

function toMap(str, lowercaseKeys) {
  var obj = {}, items = str.split(','), i;
  for (i = 0; i < items.length; i++) {
    obj[lowercaseKeys ? angular.lowercase(items[i]) : items[i]] = true;
  }
  return obj;
}

var inertBodyElement;
(function(window) {
  var doc;
  if (window.document && window.document.implementation) {
    doc = window.document.implementation.createHTMLDocument("inert");
  } else {
    throw $sanitizeMinErr('noinert', "Can't create an inert html document");
  }
  var docElement = doc.documentElement || doc.getDocumentElement();
  var bodyElements = docElement.getElementsByTagName('body');

  // usually there should be only one body element in the document, but IE doesn't have any, so we need to create one
  if (bodyElements.length === 1) {
    inertBodyElement = bodyElements[0];
  } else {
    var html = doc.createElement('html');
    inertBodyElement = doc.createElement('body');
    html.appendChild(inertBodyElement);
    doc.appendChild(html);
  }
})(window);

/**
 * @example
 * htmlParser(htmlString, {
 *     start: function(tag, attrs) {},
 *     end: function(tag) {},
 *     chars: function(text) {},
 *     comment: function(text) {}
 * });
 *
 * @param {string} html string
 * @param {object} handler
 */
function htmlParser(html, handler) {
  if (html === null || html === undefined) {
    html = '';
  } else if (typeof html !== 'string') {
    html = '' + html;
  }
  inertBodyElement.innerHTML = html;

  //mXSS protection
  var mXSSAttempts = 5;
  do {
    if (mXSSAttempts === 0) {
      throw $sanitizeMinErr('uinput', "Failed to sanitize html because the input is unstable");
    }
    mXSSAttempts--;

    // strip custom-namespaced attributes on IE<=11
    if (document.documentMode <= 11) {
      stripCustomNsAttrs(inertBodyElement);
    }
    html = inertBodyElement.innerHTML; //trigger mXSS
    inertBodyElement.innerHTML = html;
  } while (html !== inertBodyElement.innerHTML);

  var node = inertBodyElement.firstChild;
  while (node) {
    switch (node.nodeType) {
      case 1: // ELEMENT_NODE
        handler.start(node.nodeName.toLowerCase(), attrToMap(node.attributes));
        break;
      case 3: // TEXT NODE
        handler.chars(node.textContent);
        break;
    }

    var nextNode;
    if (!(nextNode = node.firstChild)) {
      if (node.nodeType == 1) {
        handler.end(node.nodeName.toLowerCase());
      }
      nextNode = node.nextSibling;
      if (!nextNode) {
        while (nextNode == null) {
          node = node.parentNode;
          if (node === inertBodyElement) break;
          nextNode = node.nextSibling;
          if (node.nodeType == 1) {
            handler.end(node.nodeName.toLowerCase());
          }
        }
      }
    }
    node = nextNode;
  }

  while (node = inertBodyElement.firstChild) {
    inertBodyElement.removeChild(node);
  }
}

function attrToMap(attrs) {
  var map = {};
  for (var i = 0, ii = attrs.length; i < ii; i++) {
    var attr = attrs[i];
    map[attr.name] = attr.value;
  }
  return map;
}


/**
 * Escapes all potentially dangerous characters, so that the
 * resulting string can be safely inserted into attribute or
 * element text.
 * @param value
 * @returns {string} escaped text
 */
function encodeEntities(value) {
  return value.
    replace(/&/g, '&amp;').
    replace(SURROGATE_PAIR_REGEXP, function(value) {
      var hi = value.charCodeAt(0);
      var low = value.charCodeAt(1);
      return '&#' + (((hi - 0xD800) * 0x400) + (low - 0xDC00) + 0x10000) + ';';
    }).
    replace(NON_ALPHANUMERIC_REGEXP, function(value) {
      return '&#' + value.charCodeAt(0) + ';';
    }).
    replace(/</g, '&lt;').
    replace(/>/g, '&gt;');
}

/**
 * create an HTML/XML writer which writes to buffer
 * @param {Array} buf use buf.join('') to get out sanitized html string
 * @returns {object} in the form of {
 *     start: function(tag, attrs) {},
 *     end: function(tag) {},
 *     chars: function(text) {},
 *     comment: function(text) {}
 * }
 */
function htmlSanitizeWriter(buf, uriValidator) {
  var ignoreCurrentElement = false;
  var out = angular.bind(buf, buf.push);
  return {
    start: function(tag, attrs) {
      tag = angular.lowercase(tag);
      if (!ignoreCurrentElement && blockedElements[tag]) {
        ignoreCurrentElement = tag;
      }
      if (!ignoreCurrentElement && validElements[tag] === true) {
        out('<');
        out(tag);
        angular.forEach(attrs, function(value, key) {
          var lkey=angular.lowercase(key);
          var isImage = (tag === 'img' && lkey === 'src') || (lkey === 'background');
          if (validAttrs[lkey] === true &&
            (uriAttrs[lkey] !== true || uriValidator(value, isImage))) {
            out(' ');
            out(key);
            out('="');
            out(encodeEntities(value));
            out('"');
          }
        });
        out('>');
      }
    },
    end: function(tag) {
      tag = angular.lowercase(tag);
      if (!ignoreCurrentElement && validElements[tag] === true && voidElements[tag] !== true) {
        out('</');
        out(tag);
        out('>');
      }
      if (tag == ignoreCurrentElement) {
        ignoreCurrentElement = false;
      }
    },
    chars: function(chars) {
      if (!ignoreCurrentElement) {
        out(encodeEntities(chars));
      }
    }
  };
}


/**
 * When IE9-11 comes across an unknown namespaced attribute e.g. 'xlink:foo' it adds 'xmlns:ns1' attribute to declare
 * ns1 namespace and prefixes the attribute with 'ns1' (e.g. 'ns1:xlink:foo'). This is undesirable since we don't want
 * to allow any of these custom attributes. This method strips them all.
 *
 * @param node Root element to process
 */
function stripCustomNsAttrs(node) {
  if (node.nodeType === Node.ELEMENT_NODE) {
    var attrs = node.attributes;
    for (var i = 0, l = attrs.length; i < l; i++) {
      var attrNode = attrs[i];
      var attrName = attrNode.name.toLowerCase();
      if (attrName === 'xmlns:ns1' || attrName.indexOf('ns1:') === 0) {
        node.removeAttributeNode(attrNode);
        i--;
        l--;
      }
    }
  }

  var nextNode = node.firstChild;
  if (nextNode) {
    stripCustomNsAttrs(nextNode);
  }

  nextNode = node.nextSibling;
  if (nextNode) {
    stripCustomNsAttrs(nextNode);
  }
}



// define ngSanitize module and register $sanitize service
angular.module('ngSanitize', []).provider('$sanitize', $SanitizeProvider);

/* global sanitizeText: false */

/**
 * @ngdoc filter
 * @name linky
 * @kind function
 *
 * @description
 * Finds links in text input and turns them into html links. Supports `http/https/ftp/mailto` and
 * plain email address links.
 *
 * Requires the {@link ngSanitize `ngSanitize`} module to be installed.
 *
 * @param {string} text Input text.
 * @param {string} target Window (`_blank|_self|_parent|_top`) or named frame to open links in.
 * @param {object|function(url)} [attributes] Add custom attributes to the link element.
 *
 *    Can be one of:
 *
 *    - `object`: A map of attributes
 *    - `function`: Takes the url as a parameter and returns a map of attributes
 *
 *    If the map of attributes contains a value for `target`, it overrides the value of
 *    the target parameter.
 *
 *
 * @returns {string} Html-linkified and {@link $sanitize sanitized} text.
 *
 * @usage
   <span ng-bind-html="linky_expression | linky"></span>
 *
 * @example
   <example module="linkyExample" deps="angular-sanitize.js">
     <file name="index.html">
       <div ng-controller="ExampleController">
       Snippet: <textarea ng-model="snippet" cols="60" rows="3"></textarea>
       <table>
         <tr>
           <th>Filter</th>
           <th>Source</th>
           <th>Rendered</th>
         </tr>
         <tr id="linky-filter">
           <td>linky filter</td>
           <td>
             <pre>&lt;div ng-bind-html="snippet | linky"&gt;<br>&lt;/div&gt;</pre>
           </td>
           <td>
             <div ng-bind-html="snippet | linky"></div>
           </td>
         </tr>
         <tr id="linky-target">
          <td>linky target</td>
          <td>
            <pre>&lt;div ng-bind-html="snippetWithSingleURL | linky:'_blank'"&gt;<br>&lt;/div&gt;</pre>
          </td>
          <td>
            <div ng-bind-html="snippetWithSingleURL | linky:'_blank'"></div>
          </td>
         </tr>
         <tr id="linky-custom-attributes">
          <td>linky custom attributes</td>
          <td>
            <pre>&lt;div ng-bind-html="snippetWithSingleURL | linky:'_self':{rel: 'nofollow'}"&gt;<br>&lt;/div&gt;</pre>
          </td>
          <td>
            <div ng-bind-html="snippetWithSingleURL | linky:'_self':{rel: 'nofollow'}"></div>
          </td>
         </tr>
         <tr id="escaped-html">
           <td>no filter</td>
           <td><pre>&lt;div ng-bind="snippet"&gt;<br>&lt;/div&gt;</pre></td>
           <td><div ng-bind="snippet"></div></td>
         </tr>
       </table>
     </file>
     <file name="script.js">
       angular.module('linkyExample', ['ngSanitize'])
         .controller('ExampleController', ['$scope', function($scope) {
           $scope.snippet =
             'Pretty text with some links:\n'+
             'http://angularjs.org/,\n'+
             'mailto:us@somewhere.org,\n'+
             'another@somewhere.org,\n'+
             'and one more: ftp://127.0.0.1/.';
           $scope.snippetWithSingleURL = 'http://angularjs.org/';
         }]);
     </file>
     <file name="protractor.js" type="protractor">
       it('should linkify the snippet with urls', function() {
         expect(element(by.id('linky-filter')).element(by.binding('snippet | linky')).getText()).
             toBe('Pretty text with some links: http://angularjs.org/, us@somewhere.org, ' +
                  'another@somewhere.org, and one more: ftp://127.0.0.1/.');
         expect(element.all(by.css('#linky-filter a')).count()).toEqual(4);
       });

       it('should not linkify snippet without the linky filter', function() {
         expect(element(by.id('escaped-html')).element(by.binding('snippet')).getText()).
             toBe('Pretty text with some links: http://angularjs.org/, mailto:us@somewhere.org, ' +
                  'another@somewhere.org, and one more: ftp://127.0.0.1/.');
         expect(element.all(by.css('#escaped-html a')).count()).toEqual(0);
       });

       it('should update', function() {
         element(by.model('snippet')).clear();
         element(by.model('snippet')).sendKeys('new http://link.');
         expect(element(by.id('linky-filter')).element(by.binding('snippet | linky')).getText()).
             toBe('new http://link.');
         expect(element.all(by.css('#linky-filter a')).count()).toEqual(1);
         expect(element(by.id('escaped-html')).element(by.binding('snippet')).getText())
             .toBe('new http://link.');
       });

       it('should work with the target property', function() {
        expect(element(by.id('linky-target')).
            element(by.binding("snippetWithSingleURL | linky:'_blank'")).getText()).
            toBe('http://angularjs.org/');
        expect(element(by.css('#linky-target a')).getAttribute('target')).toEqual('_blank');
       });

       it('should optionally add custom attributes', function() {
        expect(element(by.id('linky-custom-attributes')).
            element(by.binding("snippetWithSingleURL | linky:'_self':{rel: 'nofollow'}")).getText()).
            toBe('http://angularjs.org/');
        expect(element(by.css('#linky-custom-attributes a')).getAttribute('rel')).toEqual('nofollow');
       });
     </file>
   </example>
 */
angular.module('ngSanitize').filter('linky', ['$sanitize', function($sanitize) {
  var LINKY_URL_REGEXP =
        /((ftp|https?):\/\/|(www\.)|(mailto:)?[A-Za-z0-9._%+-]+@)\S*[^\s.;,(){}<>"\u201d\u2019]/i,
      MAILTO_REGEXP = /^mailto:/i;

  var linkyMinErr = angular.$$minErr('linky');
  var isString = angular.isString;

  return function(text, target, attributes) {
    if (text == null || text === '') return text;
    if (!isString(text)) throw linkyMinErr('notstring', 'Expected string but received: {0}', text);

    var match;
    var raw = text;
    var html = [];
    var url;
    var i;
    while ((match = raw.match(LINKY_URL_REGEXP))) {
      // We can not end in these as they are sometimes found at the end of the sentence
      url = match[0];
      // if we did not match ftp/http/www/mailto then assume mailto
      if (!match[2] && !match[4]) {
        url = (match[3] ? 'http://' : 'mailto:') + url;
      }
      i = match.index;
      addText(raw.substr(0, i));
      addLink(url, match[0].replace(MAILTO_REGEXP, ''));
      raw = raw.substring(i + match[0].length);
    }
    addText(raw);
    return $sanitize(html.join(''));

    function addText(text) {
      if (!text) {
        return;
      }
      html.push(sanitizeText(text));
    }

    function addLink(url, text) {
      var key;
      html.push('<a ');
      if (angular.isFunction(attributes)) {
        attributes = attributes(url);
      }
      if (angular.isObject(attributes)) {
        for (key in attributes) {
          html.push(key + '="' + attributes[key] + '" ');
        }
      } else {
        attributes = {};
      }
      if (angular.isDefined(target) && !('target' in attributes)) {
        html.push('target="',
                  target,
                  '" ');
      }
      html.push('href="',
                url.replace(/"/g, '&quot;'),
                '">');
      addText(text);
      html.push('</a>');
    }
  };
}]);


})(window, window.angular);

/**
 * An Angular module that gives you access to the browsers local storage
 * @version v0.2.6 - 2016-03-16
 * @link https://github.com/grevory/angular-local-storage
 * @author grevory <greg@gregpike.ca>
 * @license MIT License, http://www.opensource.org/licenses/MIT
 */
!function(a,b){var c=b.isDefined,d=b.isUndefined,e=b.isNumber,f=b.isObject,g=b.isArray,h=b.extend,i=b.toJson;b.module("LocalStorageModule",[]).provider("localStorageService",function(){this.prefix="ls",this.storageType="localStorage",this.cookie={expiry:30,path:"/"},this.notify={setItem:!0,removeItem:!1},this.setPrefix=function(a){return this.prefix=a,this},this.setStorageType=function(a){return this.storageType=a,this},this.setStorageCookie=function(a,b){return this.cookie.expiry=a,this.cookie.path=b,this},this.setStorageCookieDomain=function(a){return this.cookie.domain=a,this},this.setNotify=function(a,b){return this.notify={setItem:a,removeItem:b},this},this.$get=["$rootScope","$window","$document","$parse",function(a,b,j,k){var l,m=this,n=m.prefix,o=m.cookie,p=m.notify,q=m.storageType;j?j[0]&&(j=j[0]):j=document,"."!==n.substr(-1)&&(n=n?n+".":"");var r=function(a){return n+a},s=function(){try{var c=q in b&&null!==b[q],d=r("__"+Math.round(1e7*Math.random()));return c&&(l=b[q],l.setItem(d,""),l.removeItem(d)),c}catch(e){return q="cookie",a.$broadcast("LocalStorageModule.notification.error",e.message),!1}}(),t=function(b,c){if(c=d(c)?null:i(c),!s||"cookie"===m.storageType)return s||a.$broadcast("LocalStorageModule.notification.warning","LOCAL_STORAGE_NOT_SUPPORTED"),p.setItem&&a.$broadcast("LocalStorageModule.notification.setitem",{key:b,newvalue:c,storageType:"cookie"}),z(b,c);try{l&&l.setItem(r(b),c),p.setItem&&a.$broadcast("LocalStorageModule.notification.setitem",{key:b,newvalue:c,storageType:m.storageType})}catch(e){return a.$broadcast("LocalStorageModule.notification.error",e.message),z(b,c)}return!0},u=function(b){if(!s||"cookie"===m.storageType)return s||a.$broadcast("LocalStorageModule.notification.warning","LOCAL_STORAGE_NOT_SUPPORTED"),A(b);var c=l?l.getItem(r(b)):null;if(!c||"null"===c)return null;try{return JSON.parse(c)}catch(d){return c}},v=function(){var b,c;for(b=0;b<arguments.length;b++)if(c=arguments[b],s&&"cookie"!==m.storageType)try{l.removeItem(r(c)),p.removeItem&&a.$broadcast("LocalStorageModule.notification.removeitem",{key:c,storageType:m.storageType})}catch(d){a.$broadcast("LocalStorageModule.notification.error",d.message),B(c)}else s||a.$broadcast("LocalStorageModule.notification.warning","LOCAL_STORAGE_NOT_SUPPORTED"),p.removeItem&&a.$broadcast("LocalStorageModule.notification.removeitem",{key:c,storageType:"cookie"}),B(c)},w=function(){if(!s)return a.$broadcast("LocalStorageModule.notification.warning","LOCAL_STORAGE_NOT_SUPPORTED"),[];var b=n.length,c=[];for(var d in l)if(d.substr(0,b)===n)try{c.push(d.substr(b))}catch(e){return a.$broadcast("LocalStorageModule.notification.error",e.Description),[]}return c},x=function(b){var c=n?new RegExp("^"+n):new RegExp,d=b?new RegExp(b):new RegExp;if(!s||"cookie"===m.storageType)return s||a.$broadcast("LocalStorageModule.notification.warning","LOCAL_STORAGE_NOT_SUPPORTED"),C();var e=n.length;for(var f in l)if(c.test(f)&&d.test(f.substr(e)))try{v(f.substr(e))}catch(g){return a.$broadcast("LocalStorageModule.notification.error",g.message),C()}return!0},y=function(){try{return b.navigator.cookieEnabled||"cookie"in j&&(j.cookie.length>0||(j.cookie="test").indexOf.call(j.cookie,"test")>-1)}catch(c){return a.$broadcast("LocalStorageModule.notification.error",c.message),!1}}(),z=function(b,c,h){if(d(c))return!1;if((g(c)||f(c))&&(c=i(c)),!y)return a.$broadcast("LocalStorageModule.notification.error","COOKIES_NOT_SUPPORTED"),!1;try{var k="",l=new Date,m="";if(null===c?(l.setTime(l.getTime()+-864e5),k="; expires="+l.toGMTString(),c=""):e(h)&&0!==h?(l.setTime(l.getTime()+24*h*60*60*1e3),k="; expires="+l.toGMTString()):0!==o.expiry&&(l.setTime(l.getTime()+24*o.expiry*60*60*1e3),k="; expires="+l.toGMTString()),b){var n="; path="+o.path;o.domain&&(m="; domain="+o.domain),j.cookie=r(b)+"="+encodeURIComponent(c)+k+n+m}}catch(p){return a.$broadcast("LocalStorageModule.notification.error",p.message),!1}return!0},A=function(b){if(!y)return a.$broadcast("LocalStorageModule.notification.error","COOKIES_NOT_SUPPORTED"),!1;for(var c=j.cookie&&j.cookie.split(";")||[],d=0;d<c.length;d++){for(var e=c[d];" "===e.charAt(0);)e=e.substring(1,e.length);if(0===e.indexOf(r(b)+"=")){var f=decodeURIComponent(e.substring(n.length+b.length+1,e.length));try{return JSON.parse(f)}catch(g){return f}}}return null},B=function(a){z(a,null)},C=function(){for(var a=null,b=n.length,c=j.cookie.split(";"),d=0;d<c.length;d++){for(a=c[d];" "===a.charAt(0);)a=a.substring(1,a.length);var e=a.substring(b,a.indexOf("="));B(e)}},D=function(){return q},E=function(a,b,d,e){e=e||b;var g=u(e);return null===g&&c(d)?g=d:f(g)&&f(d)&&(g=h(g,d)),k(b).assign(a,g),a.$watch(b,function(a){t(e,a)},f(a[b]))},F=function(){for(var a=0,c=b[q],d=0;d<c.length;d++)0===c.key(d).indexOf(n)&&a++;return a};return{isSupported:s,getStorageType:D,set:t,add:t,get:u,keys:w,remove:v,clearAll:x,bind:E,deriveKey:r,length:F,cookie:{isSupported:y,set:z,add:z,get:A,remove:B,clearAll:C}}}]})}(window,window.angular);
//
(function (angular) {
    'use strict';

    function ConfigLocalStorage(bbOmnibarConfig, localStorageServiceProvider) {
        var host,
            needle;

        localStorageServiceProvider.setPrefix('capabilities-catalog');

        host = window.location.hostname;
        needle = 'blackbaud.com';

        bbOmnibarConfig.serviceName = 'Capabilities Catalog';

        // If the host is not white-listed, load the DEV version of the omnibar library.
        if (host.indexOf(needle, host.length - needle.length) === -1) {
            bbOmnibarConfig.url = 'https://bbauth-signin-cdev.blackbaudhosting.com/omnibar.min.js';
        } else {
            bbOmnibarConfig.url = 'https://signin.blackbaud.com/omnibar.min.js';
        }
    }

    function Run($rootScope, SessionService) {
        $rootScope.$on('$stateChangeStart', function (event, toState, toParams, fromState, fromParams, options) {
            if (fromState.url !== '^') {
                SessionService.setIsAuthenticated(false);
            }
        });
    }

    function ConfigRoutes($stateProvider, $urlRouterProvider) {

        $urlRouterProvider.otherwise('/');

        $stateProvider
            .state('home', {
                url: '/',
                templateUrl: '../public/app/views/home/home.html'
            })
            .state('capability', {
                url: '/capability/:capabilitySlug',
                templateUrl: '../public/app/views/capability/detail/capability-detail.html',
                controller: 'CapabilityDetailController as detailCtrl'
            })
            .state('capability-form', {
                url: '/capability-form/:capabilityId',
                templateUrl: '../public/app/views/capability/form/capability-form.html',
                controller: 'CapabilityFormController as formCtrl'
            })
            .state('capability-group-form', {
                url: '/capability-group-form/:capabilityGroupId',
                templateUrl: '../public/app/views/capability-group/form/capability-group-form.html',
                controller: 'CapabilityGroupFormController as formCtrl'
            })
            .state('login', {
                url: '/login/',
                templateUrl: '../public/app/views/login/login-page.html',
                controller: 'LoginPageController as pageCtrl'
            })
            .state('page', {
                url: '/capability/:capabilitySlug/:pageSlug',
                templateUrl: '../public/app/views/page/detail/page-detail.html',
                controller: 'PageDetailController as pageCtrl'
            })
            .state('page-form', {
                url: '/page-form/capability/:capabilityId/page/:pageId',
                templateUrl: '../public/app/views/page/form/page-form.html',
                controller: 'PageFormController as formCtrl'
            })
            .state('product-form', {
                url: '/product-form/:productId',
                templateUrl: '../public/app/views/product/form/product-form.html',
                controller: 'ProductFormController as formCtrl',
                params: { productGroupId: null }
            })
            .state('product-group-form', {
                url: '/product-group-form/:productGroupId',
                templateUrl: '../public/app/views/product-group/form/product-group-form.html',
                controller: 'ProductGroupFormController as formCtrl'
            });
    }

    function AppController($state, $window, bbModal, SessionService) {
        var vm;
        vm = this;
        vm.isAuthorized = SessionService.isAuthorized;
        vm.isAuthenticated = SessionService.isAuthenticated;
        vm.logout = function () {
            SessionService.logout();
            $state.go('home');
            $window.location.reload();
        };
        vm.openLoginModal = function () {
            bbModal.open({
                controller: 'LoginModalController as contentCtrl',
                templateUrl: '../public/app/components/modals/login-modal.html'
            });
        };
    }

    AppController.$inject = [
        '$state',
        '$window',
        'bbModal',
        'SessionService'
    ];

    ConfigLocalStorage.$inject = [
        'bbOmnibarConfig',
        'localStorageServiceProvider'
    ];

    ConfigRoutes.$inject = [
        '$stateProvider',
        '$urlRouterProvider'
    ];

    Run.$inject = [
        '$rootScope',
        'SessionService'
    ];


    angular.module('capabilities-catalog', [
        'sky',
        'ui.router',
        'ngSanitize',
        //'dndLists',
        'ng-sortable',
        'LocalStorageModule',
        'capabilities-catalog.templates'
    ])
        .config(ConfigLocalStorage)
        .config(ConfigRoutes)
        .run(Run)
        .controller('AppController', AppController)
        .config(['$compileProvider', function ($compileProvider) {
            $compileProvider.debugInfoEnabled(false);
        }]);

}(window.angular));

(function (angular) {
    'use strict';

    function AdoptionStatusService($http, utils) {
        var service;
        service = this;

        service.getAll = function () {
            return $http.get('/api/adoption-status').then(function (res) {
                return res.data;
            });
        };
    }

    AdoptionStatusService.$inject = [
        '$http',
        'utils'
    ];


    angular.module('capabilities-catalog')
        .service('AdoptionStatusService', AdoptionStatusService);

}(window.angular));

(function (angular) {
    'use strict';

    function BreadcrumbsService($q, $rootScope) {
        var breadcrumbs,
            service;

        breadcrumbs = [];
        service = this;

        $rootScope.$on('$stateChangeStart', function () {
            breadcrumbs = [];
            $rootScope.$broadcast('breadcrumbs:updated');
        });

        service.setBreadcrumbs = function (arr) {
            breadcrumbs = arr;
            $rootScope.$broadcast('breadcrumbs:updated');
        };

        service.getBreadcrumbs = function () {
            return breadcrumbs;
        };
    }

    BreadcrumbsService.$inject = [
        '$q',
        '$rootScope'
    ];


    angular.module('capabilities-catalog')
        .service('BreadcrumbsService', BreadcrumbsService);

}(window.angular));

(function (angular) {
    'use strict';

    function CapabilityService($http, $q, SessionService, utils) {
        var service;
        service = this;

        function setNumPublicPages(response) {
            var isLoggedIn,
                numPublicPages;
            numPublicPages = 0;
            isLoggedIn = SessionService.isAuthenticated();
            response.data.capability.pages.forEach(function (page) {
                page.capabilityId = response.data.capability._id;
                if (isLoggedIn || !page.isPrivate) {
                    numPublicPages++;
                }
            });
            response.data.capability.numPublicPages = numPublicPages;
        }

        function getSortConfig(group) {
            return {
                animation: 150,
                handle: '.handle',
                draggable: 'tr.draggable',
                group: group._id,
                onEnd: sort
            };
        }

        function sort(e) {
            e.models.forEach(function (capability, i) {
                capability.order = i;
                service.update(capability);
            });
        }

        service.drop = function (id) {
            var deferred;
            deferred = $q.defer();
            if (SessionService.isAuthorized('DELETE_CAPABILITY')) {
                $http({
                    method: 'DELETE',
                    url: '/api/capability/' + id,
                    params: {
                        session: SessionService.getSession()
                    }
                }).then(function (res) {
                    deferred.resolve(res.data);
                });
            } else {
                deferred.resolve({
                    error: {
                        message: "You do not have permission to delete this capability."
                    }
                });
            }
            return deferred.promise;
        };

        service.getAll = function () {
            return $http.get('/api/capability').then(function (res) {
                var processProducts;
                processProducts = function (capability) {
                    utils.assignShieldClasses(capability.products);
                    capability.totals = {};
                    capability.products.forEach(function (product) {
                        product.defaultComment = capability.name + ' is currently ' + product.adoptionStatus.name.toLowerCase() + ' within ' + product.name + '.';
                        capability.totals[product.adoptionStatus.adoptionStatusId] = capability.totals[product.adoptionStatus.adoptionStatusId] || {
                            class: product.class,
                            count: 0,
                            model: product
                        };
                        capability.totals[product.adoptionStatus.adoptionStatusId].count++;
                    });
                    for (var k in capability.totals) {
                        capability.totals[k].percentage = (capability.totals[k].count / capability.products.length) * 100;
                    }
                };
                res.data.capabilityGroups.forEach(function (group) {
                    group.sortConfig = getSortConfig(group);
                    group.capabilities.forEach(processProducts);
                });
                return res.data;
            });
        };

        service.getById = function (id) {
            return $http.get('/api/capability/' + id).then(function (res) {
                utils.assignShieldClasses(res.data.capability.products);
                return res.data;
            });
        };

        service.getBySlug = function (slug) {
            return $http.get('/api/capability-slug/' + slug).then(function (res) {
                var capability;
                capability = res.data.capability;
                utils.assignShieldClasses(capability.products);
                capability.products.forEach(function (product) {
                    product.defaultComment = capability.name + ' is currently ' + product.adoptionStatus.name.toLowerCase() + ' within ' + product.name + '.';
                });
                setNumPublicPages(res);
                return res.data;
            });
        };

        service.create = function (data) {
            var deferred;
            deferred = $q.defer();
            data.session = SessionService.getSession();
            if (SessionService.isAuthorized('CREATE_CAPABILITY')) {
                $http.post('/api/capability', {
                    data : data,
                    headers : {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }).then(function (res) {
                    deferred.resolve(res.data);
                });
            } else {
                deferred.resolve({
                    error: {
                        message: "You do not have permission to create a new capability."
                    }
                });
            }
            return deferred.promise;
        };

        service.update = function (data) {
            var deferred;
            deferred = $q.defer();
            data.session = SessionService.getSession();

            if (SessionService.isAuthorized('EDIT_CAPABILITY:PARTIAL')) {
                if (!SessionService.isAuthorized('EDIT_CAPABILITY:FULL')) {
                    delete data.name;
                    delete data.shortname;
                }
                $http.put('/api/capability/' + data._id, {
                    data: data
                }).then(function (res) {
                    deferred.resolve(res.data);
                });
            } else {
                deferred.resolve({
                    error: {
                        message: "You do not have permission to edit this capability."
                    }
                });
            }

            return deferred.promise;
        };
    }

    CapabilityService.$inject = [
        '$http',
        '$q',
        'SessionService',
        'utils'
    ];


    angular.module('capabilities-catalog')
        .service('CapabilityService', CapabilityService);

}(window.angular));

(function (angular) {
    'use strict';

    function CapabilityGroupService($http, $q, SessionService) {
        var service;
        service = this;

        service.drop = function (id) {
            var deferred;
            deferred = $q.defer();
            if (SessionService.isAuthorized('DELETE_CAPABILITY_GROUP')) {
                $http({
                    method: 'DELETE',
                    url: '/api/capability-group/' + id,
                    params: {
                        session: SessionService.getSession()
                    }
                }).then(function (res) {
                    deferred.resolve(res.data);
                });
            } else {
                deferred.resolve({
                    error: {
                        message: "You do not have permission to delete this capability group."
                    }
                });
            }
            return deferred.promise;
        };

        service.getAll = function () {
            return $http.get('/api/capability-group').then(function (res) {
                return res.data;
            });
        };

        service.getById = function (id) {
            return $http.get('/api/capability-group/' + id).then(function (res) {
                return res.data;
            });
        };

        service.update = function (data) {
            var deferred;
            deferred = $q.defer();
            data.session = SessionService.getSession();

            if (data._id) {
                if (SessionService.isAuthorized('EDIT_CAPABILITY_GROUP')) {
                    $http.put('/api/capability-group/' + data._id, {
                        data: data
                    }).then(function (res) {
                        deferred.resolve(res.data);
                    });
                } else {
                    deferred.resolve({
                        error: {
                            message: "You do not have permission to edit this capability group."
                        }
                    });
                }
            } else {
                if (SessionService.isAuthorized('CREATE_CAPABILITY_GROUP')) {
                    $http.post('/api/capability-group', {
                        data : data,
                        headers : {
                            'Content-Type': 'application/x-www-form-urlencoded'
                        }
                    }).then(function (res) {
                        deferred.resolve(res.data);
                    });
                } else {
                    deferred.resolve({
                        error: {
                            message: "You do not have permission to create a new capability group."
                        }
                    });
                }
            }

            return deferred.promise;
        };
    }

    CapabilityGroupService.$inject = [
        '$http',
        '$q',
        'SessionService'
    ];


    angular.module('capabilities-catalog')
        .service('CapabilityGroupService', CapabilityGroupService);

}(window.angular));

(function (angular) {
    'use strict';

    function PageService($http, $q, SessionService) {
        var capabilityId,
            capabilitySlug,
            service;

        service = this;

        service.drop = function (id) {
            var deferred;
            deferred = $q.defer();
            if (!capabilityId) {
                return;
            }
            if (SessionService.isAuthorized('DELETE_PAGE')) {
                $http({
                    method: 'DELETE',
                    url: '/api/page/' + id,
                    params: {
                        capabilityId: capabilityId,
                        session: SessionService.getSession()
                    }
                }).then(function (res) {
                    deferred.resolve(res.data);
                });
            } else {
                deferred.resolve({
                    error: {
                        message: "You do not have permission to delete this page."
                    }
                });
            }
            return deferred.promise;
        };

        service.getAll = function () {
            if (!capabilityId) {
                return;
            }
            return $http({
                url: '/api/page/',
                method: 'get',
                params: {
                    capabilityId: capabilityId
                }
            }).then(function (res) {
                return res.data;
            });
        };

        service.getById = function (pageId) {
            if (!capabilityId) {
                return;
            }
            return $http({
                url: '/api/page/' + pageId,
                method: 'get',
                params: {
                    capabilityId: capabilityId
                }
            }).then(function (res) {
                return res.data;
            });
        };

        service.getBySlug = function (pageSlug) {
            if (!capabilitySlug) {
                return;
            }
            return $http({
                url: '/api/page-slug/' + pageSlug,
                method: 'get',
                params: {
                    capabilitySlug: capabilitySlug
                }
            }).then(function (res) {
                return res.data;
            });
        };

        service.setCapabilityId = function (id) {
            capabilityId = id;
            return service;
        };

        service.setCapabilitySlug = function (slug) {
            capabilitySlug = slug;
            return service;
        };

        service.update = function (data) {
            var deferred;
            deferred = $q.defer();
            data.session = SessionService.getSession();

            if (data._id) {
                if (SessionService.isAuthorized('EDIT_PAGE:PARTIAL')) {
                    if (!SessionService.isAuthorized('EDIT_PAGE:FULL')) {
                        delete data.name;
                    }
                    $http.put('/api/page/' + data._id, {
                        data: data
                    }).then(function (res) {
                        deferred.resolve(res.data);
                    });
                } else {
                    deferred.resolve({
                        error: {
                            message: "You do not have permission to edit this page."
                        }
                    });
                }
            } else {
                if (SessionService.isAuthorized('CREATE_PAGE')) {
                    $http.post('/api/page/', {
                        data: data
                    }).then(function (res) {
                        deferred.resolve(res.data);
                    });
                } else {
                    deferred.resolve({
                        error: {
                            message: "You do not have permission to create a new page."
                        }
                    });
                }
            }

            return deferred.promise;
        };
    }

    PageService.$inject = [
        '$http',
        '$q',
        'SessionService'
    ];


    angular.module('capabilities-catalog')
        .service('PageService', PageService);

}(window.angular));

(function (angular) {
    'use strict';

    function ProductService($http, $q, SessionService, utils) {
        var service;
        service = this;

        function sort(e) {
            e.models.forEach(function (item, i) {
                item.order = i;
                service.update(item);
            });
        }

        function getSortConfig(group) {
            return {
                animation: 150,
                handle: '.handle',
                draggable: 'tr.draggable',
                group: group._id,
                onEnd: sort
            };
        }

        service.drop = function (id) {
            var deferred;
            deferred = $q.defer();
            if (SessionService.isAuthorized('DELETE_PRODUCT')) {
                $http({
                    method: 'DELETE',
                    url: '/api/product/' + id,
                    params: {
                        session: SessionService.getSession()
                    }
                }).then(function (res) {
                    deferred.resolve(res.data);
                });
            } else {
                deferred.resolve({
                    error: {
                        message: "You do not have permission to delete this product."
                    }
                });
            }
            return deferred.promise;
        };

        service.getAll = function () {
            return $http.get('/api/product').then(function (res) {
                var k,
                    processProduct;
                processProduct = function (product) {
                    utils.assignShieldClasses(product.capabilities);
                    product.totals = {};
                    product.capabilities.forEach(function (capability) {
                        capability.defaultComment = capability.name + ' is currently ' + capability.adoptionStatus.name.toLowerCase() + ' within ' + product.name + '.';
                        product.totals[capability.adoptionStatus.adoptionStatusId] = product.totals[capability.adoptionStatus.adoptionStatusId] || {
                            class: capability.class,
                            count: 0,
                            model: capability
                        };
                        product.totals[capability.adoptionStatus.adoptionStatusId].count++;
                    });
                    for (var k in product.totals) {
                        product.totals[k].percentage = (product.totals[k].count / product.capabilities.length) * 100;
                    }
                };
                res.data.productGroups.forEach(function (group) {
                    group.sortConfig = getSortConfig(group);
                    group.products.forEach(processProduct);
                });
                return res.data;
            });
        };

        service.getById = function (id) {
            return $http.get('/api/product/' + id).then(function (res) {
                return res.data;
            });
        };

        service.update = function (data) {
            var deferred;
            deferred = $q.defer();
            data.session = SessionService.getSession();

            if (data._id) {
                if (SessionService.isAuthorized('EDIT_PRODUCT:PARTIAL')) {
                    $http.put('/api/product/' + data._id, { data: data }).then(function (res) {
                        deferred.resolve(res.data);
                    });
                } else {
                    deferred.resolve({
                        error: {
                            message: "You do not have permission to edit this product."
                        }
                    });
                }
            } else {
                if (SessionService.isAuthorized('CREATE_PRODUCT')) {
                    $http.post('/api/product', {
                        data : data,
                        headers : {
                            'Content-Type': 'application/x-www-form-urlencoded'
                        }
                    }).then(function (res) {
                        deferred.resolve(res.data);
                    });
                } else {
                    deferred.resolve({
                        error: {
                            message: "You do not have permission to create a new product."
                        }
                    });
                }
            }
            return deferred.promise;
        };
    }

    ProductService.$inject = [
        '$http',
        '$q',
        'SessionService',
        'utils'
    ];


    angular.module('capabilities-catalog')
        .service('ProductService', ProductService);

}(window.angular));

(function (angular) {
    'use strict';

    function ProductGroupService($http, $q, SessionService) {
        var service;
        service = this;

        service.drop = function (id) {
            var deferred;
            deferred = $q.defer();
            if (SessionService.isAuthorized('DELETE_PRODUCT_GROUP')) {
                $http({
                    method: 'DELETE',
                    url: '/api/product-group/' + id,
                    params: {
                        session: SessionService.getSession()
                    }
                }).then(function (res) {
                    deferred.resolve(res.data);
                });
            } else {
                deferred.resolve({
                    error: {
                        message: "You do not have permission to delete this product group."
                    }
                });
            }
            return deferred.promise;
        };

        service.getAll = function () {
            return $http.get('/api/product-group').then(function (res) {
                return res.data;
            });
        };

        service.getById = function (id) {
            return $http.get('/api/product-group/' + id).then(function (res) {
                return res.data;
            });
        };

        service.update = function (data) {
            var deferred;
            deferred = $q.defer();
            data.session = SessionService.getSession();
            if (data._id) {
                if (SessionService.isAuthorized('EDIT_PRODUCT_GROUP')) {
                    $http.put('/api/product-group/' + data._id, {
                        data: data
                    }).then(function (res) {
                        deferred.resolve(res.data);
                    });
                } else {
                    deferred.resolve({
                        error: {
                            message: "You do not have permission to edit this product group."
                        }
                    });
                }
            } else {
                if (SessionService.isAuthorized('CREATE_PRODUCT_GROUP')) {
                    $http.post('/api/product-group', {
                        data : data,
                        headers : {
                            'Content-Type': 'application/x-www-form-urlencoded'
                        }
                    }).then(function (res) {
                        deferred.resolve(res.data);
                    });
                } else {
                    deferred.resolve({
                        error: {
                            message: "You do not have permission to create a new product group."
                        }
                    });
                }
            }
            return deferred.promise;
        };
    }

    ProductGroupService.$inject = [
        '$http',
        '$q',
        'SessionService'
    ];


    angular.module('capabilities-catalog')
        .service('ProductGroupService', ProductGroupService);

}(window.angular));

(function (angular) {
    'use strict';

    function SessionService($http, StorageService) {
        var isAuthenticated,
            service,
            session,
            storageKey;

        service = this;
        storageKey = 'session';
        isAuthenticated = false;

        service.authenticate = function (request) {
            session = request;
            StorageService.set(storageKey, session);
            isAuthenticated = true;
        };

        service.getSession = function () {
            if (session) {
                return session;
            }
            session = StorageService.get(storageKey);
            if (session && session.permissions.length) {
                return session;
            } else {
                return false;
            }
        };

        service.isAuthenticated = function () {
            var dateCreated,
                now;

            if (isAuthenticated === true) {
                return isAuthenticated;
            }

            if (!service.getSession()) {
                isAuthenticated = false;
                return isAuthenticated;
            }

            // Check session's expiration date.
            now = new Date();
            dateCreated = new Date(session.dateCreated);
            if ((now - dateCreated) < session.lifespan) {
                isAuthenticated = true;
            } else {
                isAuthenticated = false;
            }
            return isAuthenticated;
        };

        service.login = function (req) {
            return $http.post('/api/login', {
                data: req
            }).then(function (res) {
                return res.data;
            });
        };

        service.logout = function () {
            StorageService.remove(storageKey);
            session = {};
        };

        service.isAuthorized = function (action) {
            if (!service.isAuthenticated()) {
                return false;
            }
            if (session.permissions.length) {
                return (session.permissions.indexOf(action) > -1);
            }
        };

        service.setIsAuthenticated = function (val) {
            isAuthenticated = false;
        };
    }

    SessionService.$inject = [
        '$http',
        'StorageService'
    ];


    angular.module('capabilities-catalog')
        .service('SessionService', SessionService);

}(window.angular));

(function (angular) {
    'use strict';

    function StorageService(localStorageService) {
        var service;
        service = this;

        service.get = localStorageService.get;
        service.set = localStorageService.set;
        service.remove = localStorageService.remove;
    }

    StorageService.$inject = [
        'localStorageService'
    ];


    angular.module('capabilities-catalog')
        .service('StorageService', StorageService);

}(window.angular));

(function (angular) {
    'use strict';

    function utils() {
        return {
            assignShieldClasses: function (products) {
                products.forEach(function (product) {
                    try {
                        product.class = 'status-' + product.adoptionStatus.order;
                    } catch (e) {}
                });
                return products;
            },
            cleanArray: function (arr) {
                var i;
                for (i = 0; i < arr.length; ++i) {
                    if (arr[i] === undefined) {
                        arr.splice(i, 1);
                        i--;
                    }
                }
                return arr;
            }
        };
    }

    angular.module('capabilities-catalog')
        .factory('utils', utils);
}(window.angular));

(function (angular) {
    'use strict';

    function ccBreadcrumbs() {
        return {
            restrict: 'E',
            replace: true,
            scope: true,
            bindToController: {
                breadcrumbs: '='
            },
            controller: 'BreadcrumbsController as breadcrumbsCtrl',
            templateUrl: '../public/app/components/breadcrumbs/breadcrumbs.html'
        };
    }

    function BreadcrumbsController($scope, BreadcrumbsService) {
        var vm;
        vm = this;
        vm.breadcrumbs = BreadcrumbsService.getBreadcrumbs();
        $scope.$on('breadcrumbs:updated', function () {
            vm.breadcrumbs = BreadcrumbsService.getBreadcrumbs();
        });
    }

    BreadcrumbsController.$inject = [
        '$scope',
        'BreadcrumbsService'
    ];

    angular.module('capabilities-catalog')
        .controller('BreadcrumbsController', BreadcrumbsController)
        .directive('ccBreadcrumbs', ccBreadcrumbs);

}(window.angular));

(function (angular) {
    'use strict';

    function ccCapabilityList() {
        return {
            restrict: 'E',
            scope: true,
            controller: 'CapabilityListController as listCtrl',
            templateUrl: '../public/app/components/capability-list/capability-list.html'
        };
    }

    function CapabilityListController($scope, bbModal, CapabilityService) {
        var vm;
        vm = this;

        vm.openModal = function (title, model) {
            bbModal.open({
                resolve: {
                    data: {
                        model: model.products,
                        title: title
                    }
                },
                controller: ['data', function (data) {
                    this.data = data;
                }],
                controllerAs: 'modalCtrl',
                templateUrl: '../public/app/components/modals/adoption-status-modal.html'
            });
        };

        CapabilityService.getAll().then(function (data) {
            vm.capabilities = data.capabilityGroups;
        });
    }

    CapabilityListController.$inject = [
        '$scope',
        'bbModal',
        'CapabilityService'
    ];


    angular.module('capabilities-catalog')
        .controller('CapabilityListController', CapabilityListController)
        .directive('ccCapabilityList', ccCapabilityList);

}(window.angular));

(function (window, angular) {
    'use strict';

    function ccConfirmClick() {
        return {
            link: function (scope, element, attr) {
                var clickAction,
                    message;

                message = attr.ccConfirmClick || "Are you sure?";
                clickAction = attr.confirmedClick;
                element.bind('click', function (event) {
                    if (window.confirm(message)) {
                        scope.$eval(clickAction);
                    }
                });
            }
        };
    }

    angular.module('capabilities-catalog')
        .directive('ccConfirmClick', ccConfirmClick);
}(window, window.angular));

(function (angular) {
    'use strict';

    function ccLoginForm() {
        return {
            restrict: 'E',
            scope: true,
            bindToController: {
                onSuccess: '='
            },
            controller: 'LoginFormController as formCtrl',
            templateUrl: '../public/app/components/forms/login/login-form.html'
        };
    }

    function LoginFormController($sce, SessionService) {
        var vm;
        vm = this;

        vm.submit = function () {
            vm.error = false;
            vm.success = false;
            SessionService.login(vm.formData).then(function (data) {
                if (data.error) {
                    vm.error = data.error.message;
                }
                if (data.authenticated) {
                    SessionService.authenticate(data.authenticated);
                    if (vm.onSuccess) {
                        vm.onSuccess.call({});
                    }
                }
            });
        };

        vm.trustHtml = function (markup) {
            return $sce.trustAsHtml(markup);
        };
    }

    LoginFormController.$inject = [
        '$sce',
        'SessionService'
    ];

    angular.module('capabilities-catalog')
        .controller('LoginFormController', LoginFormController)
        .directive('ccLoginForm', ccLoginForm);

}(window.angular));

(function (angular) {
    'use strict';

    function LoginModalController($scope, $timeout) {
        var vm;

        vm = this;

        vm.login = function () {
            $timeout(function() {
                angular.element(document.querySelector('#form-login')).triggerHandler('submit');
            }, 100);
        };

        vm.onSuccess = function () {
            $scope.$dismiss('cancel');
            alert("Log in successful. You may now submit your changes.");
        };
    }

    LoginModalController.$inject = [
        '$scope',
        '$timeout'
    ];


    angular.module('capabilities-catalog')
        .controller('LoginModalController', LoginModalController);

}(window.angular));

(function (angular) {
    'use strict';

    function ccProductList() {
        return {
            restrict: 'E',
            scope: true,
            controller: 'ProductListController as listCtrl',
            templateUrl: '../public/app/components/product-list/product-list.html'
        };
    }

    function ProductListController(bbModal, ProductService) {
        var vm;
        vm = this;

        vm.openModal = function (title, model) {
            bbModal.open({
                resolve: {
                    data: {
                        model: model.capabilities,
                        title: title
                    }
                },
                controller: ['data', function (data) {
                    this.data = data;
                }],
                controllerAs: 'modalCtrl',
                templateUrl: '../public/app/components/modals/adoption-status-modal.html'
            });
        };

        ProductService.getAll().then(function (data) {
            vm.products = data.productGroups;
        });
    }

    ProductListController.$inject = [
        'bbModal',
        'ProductService'
    ];

    angular.module('capabilities-catalog')
        .controller('ProductListController', ProductListController)
        .directive('ccProductList', ccProductList);

}(window.angular));

(function (angular) {
    'use strict';

    function CapabilityGroupFormController($scope, $state, $sce, CapabilityGroupService) {
        var vm;
        vm = this;
        vm.formData = {};

        function processError(data) {
            vm.error = data.error.message;
            if (data.error.code === 5) {
                vm.needsLogin = true;
            }
        }

        if ($state.params.capabilityGroupId) {
            CapabilityGroupService.getById($state.params.capabilityGroupId).then(function (data) {
                vm.formData = data.capabilityGroup;
                vm.isVisible = $scope.$parent.appCtrl.isAuthorized('EDIT_CAPABILITY_GROUP');
                vm.isReady = true;
            });
        } else {
            vm.isVisible = $scope.$parent.appCtrl.isAuthorized('CREATE_CAPABILITY_GROUP');
            vm.isReady = true;
        }

        vm.delete = function () {
            CapabilityGroupService.drop(vm.formData._id).then(function (data) {
                if (data.success) {
                    $state.go('home');
                } else {
                    processError(data);
                }
            });
        };

        vm.submit = function () {
            vm.error = false;
            vm.success = false;
            vm.needsLogin = false;
            CapabilityGroupService.update(vm.formData).then(function (data) {
                if (data.success) {
                    if ($state.params.capabilityGroupId) {
                        vm.success = 'Capability Group successfully updated.';
                    } else {
                        vm.success = 'Capability Group successfully created.';
                    }
                } else {
                    processError(data);
                }
                vm.scrollToTop = true;
            });
        };

        vm.trustHtml = function (markup) {
            return $sce.trustAsHtml(markup);
        };
    }

    CapabilityGroupFormController.$inject = [
        '$scope',
        '$state',
        '$sce',
        'CapabilityGroupService'
    ];

    angular.module('capabilities-catalog')
        .controller('CapabilityGroupFormController', CapabilityGroupFormController);

}(window.angular));

(function (angular) {
    'use strict';

    function CapabilityDetailController($state, BreadcrumbsService, CapabilityService, PageService) {
        var sort,
            vm;

        sort = function (e) {
            e.models.forEach(function (item, i) {
                item.order = i;
                PageService.update(item);
            });
        };

        vm = this;
        vm.sortConfig = {
            animation: 150,
            draggable: 'div.draggable',
            onEnd: sort
        };
        CapabilityService.getBySlug($state.params.capabilitySlug).then(function (data) {
            vm.capability = data.capability;
            BreadcrumbsService.setBreadcrumbs([
                {
                    name: vm.capability.name,
                    href: ''
                }
            ]);
        });
    }

    CapabilityDetailController.$inject = [
        '$state',
        'BreadcrumbsService',
        'CapabilityService',
        'PageService'
    ];

    angular.module('capabilities-catalog')
        .controller('CapabilityDetailController', CapabilityDetailController);
}(window.angular));

(function (angular) {
    'use strict';

    function CapabilityFormController($scope, $state, $sce, CapabilityService, CapabilityGroupService, ProductService, AdoptionStatusService) {
        var vm;
        vm = this;

        vm.formData = {};
        vm.formData.nicknames = [];
        vm.formData.owners = [];
        vm.formData.products = [];
        vm.formData.websites = [];
        vm.adoptionStatusOptions = [];
        vm.groupOptions = [];
        vm.orderOptions = [];
        vm.productOptions = [];
        vm.isFieldAuthorized = $scope.$parent.appCtrl.isAuthorized('EDIT_CAPABILITY:FULL');
        vm.roleOptions = [
            {
                name: "Engineering Manager",
                value: "Engineering Manager"
            },
            {
                name: "Product Manager",
                value: "Product Manager"
            }
        ];
        vm.typeOptions = [
            {
                name: "Component",
                value: "Component"
            },
            {
                name: "Service",
                value: "Service"
            }
        ];
        vm.developmentStateOptions = [
            {
                name: "Under Development",
                value: "Under Development"
            },
            {
                name: "Tech Preview",
                value: "Tech Preview"
            },
            {
                name: "Production",
                value: "Production"
            }
        ];

        function processError(data) {
            vm.error = data.error.message;
            if (data.error.code === 5) {
                vm.needsLogin = true;
            }
        }

        CapabilityGroupService.getAll().then(function (data) {
            data.capabilityGroups.forEach(function (group) {
                vm.groupOptions.push({
                    name: group.name,
                    value: group._id
                });
            });
        });

        AdoptionStatusService.getAll().then(function (data) {
            var temp;
            temp = [];
            data.adoptionStatuses.forEach(function (adoptionStatus) {
                temp.push({
                    name: adoptionStatus.name,
                    value: adoptionStatus._id
                });
            });
            vm.adoptionStatusOptions = temp;
        });

        ProductService.getAll().then(function (data) {
            var temp;
            temp = [];
            data.productGroups.forEach(function (group) {
                group.products.forEach(function (product) {
                    temp.push({
                        productId: product._id,
                        name: product.name,
                        value: product.name
                    });
                    product.nicknames.forEach(function (nickname) {
                        temp.push({
                            productId: product._id,
                            name: nickname + ' (abbr.)',
                            value: nickname
                        });
                    });
                });
            });
            vm.productOptions = temp;
        });

        if ($state.params.capabilityId) {
            CapabilityService.getById($state.params.capabilityId).then(function (data) {
                vm.formData = data.capability;
                vm.isVisible = $scope.$parent.appCtrl.isAuthorized('EDIT_CAPABILITY:PARTIAL');
                vm.isReady = true;
            });
        } else {
            vm.isVisible = $scope.$parent.appCtrl.isAuthorized('CREATE_CAPABILITY');
            vm.isReady = true;
        }

        vm.addNickname = function () {
            vm.formData.nicknames.push('');
        };

        vm.addOwner = function () {
            vm.formData.owners.push({});
        };

        vm.addProduct = function () {
            vm.formData.products.push({});
        };

        vm.addWebsite = function () {
            vm.formData.websites.push({});
        };

        vm.delete = function () {
            CapabilityService.drop(vm.formData._id).then(function (data) {
                if (data.success) {
                    $state.go('home');
                } else {
                    processError(data);
                }
            });
        };

        vm.removeNickname = function (index) {
            vm.formData.nicknames.splice(index, 1);
        };

        vm.removeOwner = function (index) {
            vm.formData.owners.splice(index, 1);
        };

        vm.removeProduct = function (index) {
            vm.formData.products.splice(index, 1);
        };

        vm.removeWebsite = function (index) {
            vm.formData.websites.splice(index, 1);
        };

        vm.submit = function () {
            vm.error = false;
            vm.success = false;
            vm.needsLogin = false;
            if ($state.params.capabilityId) {
                CapabilityService.update(vm.formData).then(function (data) {
                    if (data.success) {
                        vm.success = 'Capability successfully updated. <a href="#/capability/' + data.document.slug + '">View</a>';
                    } else {
                        processError(data);
                    }
                    vm.scrollToTop = true;
                });
            } else {
                CapabilityService.create(vm.formData).then(function (data) {
                    if (data.success) {
                        vm.success = 'Capability successfully created. <a href="#/capability/' + data.document.slug + '">View</a>';
                    } else {
                        processError(data);
                    }
                    vm.scrollToTop = true;
                });
            }
        };

        vm.trustHtml = function (markup) {
            return $sce.trustAsHtml(markup);
        };

        vm.updateProductName = function (index) {
            var product;
            product = vm.formData.products[index];
            vm.productOptions.forEach(function (option) {
                if (option.value === product.name) {
                    product.productId = option.productId;
                }
            });
        };
    }

    CapabilityFormController.$inject = [
        '$scope',
        '$state',
        '$sce',
        'CapabilityService',
        'CapabilityGroupService',
        'ProductService',
        'AdoptionStatusService'
    ];

    angular.module('capabilities-catalog')
        .controller('CapabilityFormController', CapabilityFormController);

}(window.angular));

(function (angular) {
    'use strict';

    function LoginPageController($state, $window) {
        var vm;
        vm = this;
        vm.redirect = function () {
            $state.go('home');
            $window.location.reload();
        };
    }

    LoginPageController.$inject = [
        '$state',
        '$window'
    ];

    angular.module('capabilities-catalog')
        .controller('LoginPageController', LoginPageController);
        
}(window.angular));

(function (angular) {
    'use strict';

    function PageDetailController($scope, $state, BreadcrumbsService, PageService) {
        var vm;
        vm = this;

        PageService
            .setCapabilitySlug($state.params.capabilitySlug)
            .getBySlug($state.params.pageSlug)
            .then(function (data) {
                vm.page = data.page;
                vm.isVisible = (vm.page.isPublished || (!vm.page.isPublished && $scope.$parent.appCtrl.isAuthenticated()));
                BreadcrumbsService.setBreadcrumbs([
                    {
                        name: vm.page.capability.name,
                        href: $state.href('capability', {
                            'capabilitySlug': vm.page.capability.slug
                        })
                    },
                    {
                        name: vm.page.title,
                        href: ''
                    }
                ]);
                vm.isReady = true;
            });
    }

    PageDetailController.$inject = [
        '$scope',
        '$state',
        'BreadcrumbsService',
        'PageService'
    ];

    angular.module('capabilities-catalog')
        .controller('PageDetailController', PageDetailController);

}(window.angular));

(function (angular) {
    'use strict';

    angular.module('capabilities-catalog').directive('markdownField', ['$parse', function (parse) {
        return {
            restrict: 'A',
            link: function(scope, element, attrs) {

                // We use $parse to avoid hardcoding a scope attribute here.
                var setter = parse(attrs.ngModel).assign;

                // Only initialize the $.markdown plugin once.
                if (! element.hasClass('processed')) {
                    element.addClass('processed');

                    // Setup the markdown WYSIWYG.
                    element.markdown({
                        autofocus: false,
                        saveable: false,
                        iconlibrary: 'fa',
                        onChange: function(event) {
                            // When a change occurs, we need to update scope incase
                            // the user clicked one of the plugin buttons (which
                            // isn't the same as a keydown event that angular would
                            // listen for).
                            setter(scope, event.getContent());
                        }
                    });
                }
            }
        };
    }]);

    function PageFormController($scope, $state, $sce, CapabilityService, PageService) {
        var vm;
        vm = this;
        vm.isFieldAuthorized = $scope.$parent.appCtrl.isAuthorized('EDIT_CAPABILITY:FULL');
        vm.formData = {
            content: {
                markdown: ""
            }
        };

        function processError(data) {
            vm.error = data.error.message;
            if (data.error.code === 5) {
                vm.needsLogin = true;
            }
        }

        // Get the page information if we're editing.
        if ($state.params.capabilityId) {
            vm.formData.capabilityId = $state.params.capabilityId;
            if ($state.params.pageId) {
                PageService.setCapabilityId($state.params.capabilityId).getById($state.params.pageId).then(function (data) {
                    vm.formData = data.page;
                    vm.formData.capabilityId = vm.formData.capability._id;
                    vm.formData.originalCapabilityId = vm.formData.capability._id;
                    vm.isVisible = $scope.$parent.appCtrl.isAuthorized('EDIT_PAGE:PARTIAL');
                    vm.isReady = true;
                });
            } else {
                vm.isVisible = $scope.$parent.appCtrl.isAuthorized('CREATE_PAGE');
                vm.isReady = true;
            }
        } else {
            vm.isVisible = $scope.$parent.appCtrl.isAuthorized('CREATE_PAGE');
            vm.isReady = true;
        }

        // Get any available capabilities.
        vm.capabilityOptions = [];
        CapabilityService.getAll().then(function (data) {
            var options;
            options = [];
            data.capabilityGroups.forEach(function (group) {
                group.capabilities.forEach(function (capability) {
                    options.push({
                        name: capability.name,
                        value: capability._id
                    });
                });
            });
            vm.capabilityOptions = options;
        });

        // Submitting the form.
        vm.submit = function () {
            vm.error = false;
            vm.success = false;
            PageService.update(vm.formData).then(function (data) {
                if (data.success) {
                    if ($state.params.pageId) {
                        vm.success = 'Page successfully updated. <a href="#/capability/' + data.capability.slug + '/' + data.page.slug + '">View</a>';
                    } else {
                        vm.success = 'Page successfully created. <a href="#/capability/' + data.capability.slug + '/' + data.page.slug + '">View</a>';
                    }
                } else {
                    processError(data);
                }
                vm.scrollToTop = true;
            });
        };

        vm.delete = function () {
            PageService.setCapabilityId(vm.formData.capability._id).drop(vm.formData._id).then(function (data) {
                if (data.success) {
                    $state.go('home');
                } else {
                    processError(data);
                }
            });
        };

        vm.trustHtml = function (markup) {
            return $sce.trustAsHtml(markup);
        };
    }

    PageFormController.$inject = [
        '$scope',
        '$state',
        '$sce',
        'CapabilityService',
        'PageService'
    ];

    angular.module('capabilities-catalog')
        .controller('PageFormController', PageFormController);

}(window.angular));

(function (angular) {
    'use strict';

    function ProductGroupFormController($scope, $state, $sce, ProductGroupService) {
        var vm;
        vm = this;
        vm.formData = {};

        if ($state.params.productGroupId) {
            ProductGroupService.getById($state.params.productGroupId).then(function (data) {
                vm.formData = data.productGroup;
                vm.isVisible = $scope.$parent.appCtrl.isAuthorized('EDIT_PRODUCT_GROUP');
                vm.isReady = true;
            });
        } else {
            vm.isVisible = $scope.$parent.appCtrl.isAuthorized('CREATE_PRODUCT_GROUP');
            vm.isReady = true;
        }

        vm.delete = function () {
            ProductGroupService.drop(vm.formData._id).then(function (data) {
                if (data.success) {
                    $state.go('home');
                } else {
                    window.alert("Delete failed.");
                }
            });
        };

        vm.submit = function () {
            vm.error = false;
            vm.success = false;
            vm.needsLogin = false;
            ProductGroupService.update(vm.formData).then(function (data) {
                if (data.success) {
                    if ($state.params.productGroupId) {
                        vm.success = 'Product Group successfully updated.';
                    } else {
                        vm.success = 'Product Group successfully created.';
                    }
                } else {
                    vm.error = data.error.message;
                    if (data.error.code === 5) {
                        vm.needsLogin = true;
                    }
                }
                vm.scrollToTop = true;
            });
        };

        vm.trustHtml = function (markup) {
            return $sce.trustAsHtml(markup);
        };
    }

    ProductGroupFormController.$inject = [
        '$scope',
        '$state',
        '$sce',
        'ProductGroupService'
    ];

    angular.module('capabilities-catalog')
        .controller('ProductGroupFormController', ProductGroupFormController);

}(window.angular));

(function (angular) {
    'use strict';

    function ProductFormController($sce, $scope, $state, ProductService, ProductGroupService) {
        var vm;
        vm = this;
        vm.formData = {};
        vm.formData.nicknames = [];
        vm.groupOptions = [];

        ProductGroupService.getAll().then(function (data) {
            var temp;
            temp = [];
            data.productGroups.forEach(function (group) {
                temp.push({
                    name: group.name,
                    value: group._id
                });
            });
            vm.groupOptions = temp;
        });

        if ($state.params.productId) {
            ProductService.getById($state.params.productId).then(function (data) {
                vm.formData = data.product;
                vm.isVisible = $scope.$parent.appCtrl.isAuthorized('EDIT_PRODUCT:PARTIAL');
                vm.isReady = true;
            });
        } else {
            vm.formData.productGroupId = $state.params.productGroupId;
            vm.isVisible = $scope.$parent.appCtrl.isAuthorized('CREATE_PRODUCT');
            vm.isReady = true;
        }

        vm.addNickname = function () {
            vm.formData.nicknames.push('');
        };

        vm.delete = function () {
            ProductService.drop(vm.formData._id).then(function (data) {
                if (data.success) {
                    $state.go('home');
                } else {
                    window.alert("Delete failed.");
                }
            });
        };

        vm.removeNickname = function (index) {
            vm.formData.nicknames.splice(index, 1);
        };

        vm.submit = function () {
            vm.error = false;
            vm.success = false;
            ProductService.update(vm.formData).then(function (data) {
                if (data.success) {
                    if ($state.params.productId) {
                        vm.success = "Product successfully updated.";
                    } else {
                        vm.success = "Product successfully created.";
                    }
                } else {
                    vm.error = data.error.message;
                    if (data.error.code === 5) {
                        vm.needsLogin = true;
                    }
                }
                vm.scrollToTop = true;
            });
        };

        vm.trustHtml = function (markup) {
            return $sce.trustAsHtml(markup);
        };
    }

    ProductFormController.$inject = [
        '$sce',
        '$scope',
        '$state',
        'ProductService',
        'ProductGroupService'
    ];

    angular.module('capabilities-catalog')
        .controller('ProductFormController', ProductFormController);

}(window.angular));

angular.module('capabilities-catalog.templates', []).run(['$templateCache', function($templateCache) {
    $templateCache.put('../public/app/views/capability-group/form/capability-group-form.html',
        '<div ng-if=::formCtrl.isReady><div ng-if=::formCtrl.isVisible class=capability-group-form-wrapper><div class=page-header bb-scroll-into-view=formCtrl.scrollToTop><div class=controls><button ng-if="::formCtrl.formData._id && appCtrl.isAuthorized(\'DELETE_CAPABILITY_GROUP\')" class="btn btn-danger" type=button cc-confirm-click data-confirmed-click=formCtrl.delete()><i class="fa fa-trash"></i>Delete</button></div><h1 ng-if=formCtrl.formData._id>Edit {{ formCtrl.formData.name }}</h1><h1 ng-if=!formCtrl.formData._id>Add Capability Group</h1></div><div ng-if=formCtrl.success class="alert alert-success" ng-bind-html=formCtrl.trustHtml(formCtrl.success)></div><div ng-if=formCtrl.error class="alert alert-danger"><p ng-bind-html=formCtrl.trustHtml(formCtrl.error)></p><p ng-if=formCtrl.needsLogin><a href ng-click=appCtrl.openLoginModal() class="btn btn-primary">Editor Log In</a></p></div><form name=capabilityGroupForm class=form-horizontal ng-submit=formCtrl.submit() novalidate><input type=hidden name=capabilityGroupId value="{{ formCtrl.formData._id }}"><div class=form-group ng-class="{\'has-error\': capabilityGroupForm.capabilityGroupName.$touched && capabilityGroupForm.capabilityGroupName.$invalid}"><label class="col-sm-2 control-label">Capability Group Name:</label><div class=col-sm-10><input class=form-control name=capabilityGroupName ng-model=formCtrl.formData.name placeholder=(required) required><div ng-show="capabilityGroupForm.capabilityGroupName.$touched && capabilityGroupForm.capabilityGroupName.$invalid" class=help-block>Capability Group Name is required.</div></div></div><div class=form-group><label class="col-sm-2 control-label">Order:</label><div class=col-sm-10><input class=form-control name=order ng-model=formCtrl.formData.order><div class=help-block>Zero (0) has highest priority.</div></div></div><div class=form-group><div class="col-sm-offset-2 col-sm-10"><button ng-if=formCtrl.formData._id class="btn btn-primary btn-lg" type=submit ng-disabled=capabilityGroupForm.$invalid><i class="fa fa-save"></i>Save</button> <button ng-if=!formCtrl.formData._id class="btn btn-primary btn-lg" type=submit ng-disabled=capabilityGroupForm.$invalid><i class="fa fa-plus"></i>Add Capability Group</button></div></div></form></div><div ng-if=::!formCtrl.isVisible class="alert alert-warning">You are not authorized to view this page.</div></div>');
    $templateCache.put('../public/app/views/capability/detail/capability-detail.html',
        '<div class="detail-page capability-detail-wrapper"><div class=page-header><div class=controls><a class="btn btn-default" ng-if="::appCtrl.isAuthorized(\'EDIT_CAPABILITY:PARTIAL\')" ui-sref="capability-form({ capabilityId: detailCtrl.capability._id })" href><i class="fa fa-pencil"></i>Edit</a> <a class="btn btn-default" ng-if="::appCtrl.isAuthorized(\'CREATE_PAGE\')" ui-sref="page-form({ capabilityId: detailCtrl.capability._id })" href><i class="fa fa-file-text-o"></i>Add Page</a></div><h1><span ng-bind=::detailCtrl.capability.name></span> <span ng-if=detailCtrl.capability.nicknames.length class=nicknames>(<span class=nickname ng-repeat="nickname in ::detailCtrl.capability.nicknames" ng-bind=::nickname></span>)</span></h1></div><div class="details well"><div class=table-responsive><table class="table table-condensed"><tr><th>Capability Type:</th><td ng-bind=::detailCtrl.capability.capabilityType></td></tr><tr><th>Development State:</th><td ng-bind=::detailCtrl.capability.developmentState></td></tr><tr><th>Owner(s):</th><td><div ng-repeat="owner in ::detailCtrl.capability.owners"><a ng-if=owner.profileUrl href="{{:: owner.profileUrl }}" target=_blank ng-bind=::owner.name></a> <span ng-if=!owner.profileUrl ng-bind=::owner.name></span> <span ng-if=owner.role class=text-muted>({{:: owner.role }})</span></div></td></tr><tr><th>Related Website(s):</th><td><ul class=nav-websites ng-if=::detailCtrl.capability.websites.length><li ng-repeat="website in ::detailCtrl.capability.websites"><a href="{{:: website.url }}" target=_blank ng-bind=::website.name></a> <i class="fa fa-eye-slash" ng-if=::website.isPrivate title="Website is private."></i></li></ul><span ng-if=::!detailCtrl.capability.websites.length>None</span></td></tr></table></div></div><p ng-bind-html=::detailCtrl.capability.description></p><h2>Product List</h2><p>List of products consuming <span ng-bind=::detailCtrl.capability.name></span>:</p><ul class=badge-list><li ng-repeat="product in ::detailCtrl.capability.products"><a href class="{{:: product.class }}" bb-popover-template=../public/app/components/popovers/product-comment.html data-popover-title="{{:: product.adoptionStatus.name }}"><span class=badge-list-name ng-bind=::product.name></span> <span class=badge-list-description ng-bind=::product.adoptionStatus.name></span></a></li></ul><h2>Technical Requirements</h2><p>This section will contain a listing of technical non-functional requirements and descriptions on how the <span ng-bind=::detailCtrl.capability.name></span> fulfills those requirements.</p><div ng-if="detailCtrl.capability.numPublicPages > 0"><h2>Learn More</h2><div class=showcase><div class=row ng-sortable=detailCtrl.sortConfig><div class="draggable col-xl-3 col-lg-4 col-md-4 col-sm-4 col-xs-6" ng-repeat="page in detailCtrl.capability.pages" ng-if="::page.isPublished || (!page.isPublished && appCtrl.isAuthenticated())"><a href ui-sref="page(::{ capabilitySlug: detailCtrl.capability.slug, pageSlug: page.slug })" class=showcase-item ng-class="::{ \'muted\': !page.isPublished }"><div class="panel panel-default"><div class=panel-heading><h3 class=panel-title><span ng-bind=::page.title></span> <span class="fa fa-eye-slash" ng-if=::!page.isPublished title="This page is not published.">&nbsp;</span></h3></div><div class=panel-body><div class=media><div class=media-left><i class="showcase-icon fa fa-2x {{:: page.icon}}"></i></div><div class="media-body showcase-description" ng-bind-html=::page.summary></div></div></div></div></a></div></div></div></div></div>');
    $templateCache.put('../public/app/views/capability/form/capability-form.html',
        '<div ng-if=::formCtrl.isReady><div ng-if=::formCtrl.isVisible class=capability-form-wrapper><div class=page-header bb-scroll-into-view=formCtrl.scrollToTop><div class=controls><button ng-if="::formCtrl.formData._id && appCtrl.isAuthorized(\'DELETE_CAPABILITY\')" class="btn btn-danger" type=button cc-confirm-click data-confirmed-click=formCtrl.delete()><i class="fa fa-trash"></i>Delete</button></div><h1 ng-if=formCtrl.formData._id>Edit {{ formCtrl.formData.name }}</h1><h1 ng-if=!formCtrl.formData._id>Add Capability</h1></div><div ng-if=formCtrl.success class="alert alert-success" ng-bind-html=formCtrl.trustHtml(formCtrl.success)></div><div ng-if=formCtrl.error class="alert alert-danger"><p ng-bind-html=formCtrl.trustHtml(formCtrl.error)></p><p ng-if=formCtrl.needsLogin><a href ng-click=appCtrl.openLoginModal() class="btn btn-primary">Editor Log In</a></p></div><form name=capabilityForm class=form-horizontal ng-submit=formCtrl.submit() novalidate><input type=hidden name=capabilityId value="{{ formCtrl.formData._id }}"><div ng-if=::formCtrl.isFieldAuthorized class=form-group ng-class="{\'has-error\': capabilityForm.capabilityName.$touched && capabilityForm.capabilityName.$invalid}"><label class="col-sm-2 control-label">Capability Name:</label><div class=col-sm-10><input class=form-control name=capabilityName ng-model=formCtrl.formData.name placeholder=(required) required><div ng-show="capabilityForm.capabilityName.$touched && capabilityForm.capabilityName.$invalid" class=help-block>Capability Name is required.</div></div></div><div ng-if=::formCtrl.isFieldAuthorized class=form-group ng-class="{\'has-error\': capabilityForm.shortname.$touched && capabilityForm.shortname.$invalid}"><label class="col-sm-2 control-label">Short Name:</label><div class=col-sm-10><input class=form-control name=shortname ng-model=formCtrl.formData.shortname placeholder=(required) required><div ng-show="capabilityForm.shortname.$touched && capabilityForm.shortname.$invalid" class=help-block>Capability Short Name is required.</div><div ng-hide="capabilityForm.shortname.$touched && capabilityForm.shortname.$invalid" class=help-block>Displayed on lists, badges, or when an informal reference is preferred.</div></div></div><div ng-if=::formCtrl.isFieldAuthorized class=form-group><label class="col-sm-2 control-label">Description:</label><div class=col-sm-10><textarea class=form-control ng-model=formCtrl.formData.description></textarea></div></div><div ng-if="::formCtrl.isFieldAuthorized && formCtrl.formData._id" class=form-group><label class="col-sm-2 control-label">Order:</label><div class=col-sm-10><input class=form-control name=order ng-model=formCtrl.formData.order><div class=help-block>Zero (0) has highest priority.</div></div></div><div ng-if=::formCtrl.isFieldAuthorized class=form-group><label class="col-sm-2 control-label">Development State:</label><div class=col-sm-10><select class=form-control ng-model=formCtrl.formData.developmentState><option value="">--- Select ---</option><option ng-repeat="option in formCtrl.developmentStateOptions" value="{{:: option.value }}" ng-selected="formCtrl.formData.developmentState === option.value">{{:: option.name }}</option></select></div></div><div ng-if=::formCtrl.isFieldAuthorized class=form-group><label class="col-sm-2 control-label">Group:</label><div class=col-sm-10><select class=form-control ng-model=formCtrl.formData.capabilityGroupId><option value="">--- Select ---</option><option ng-repeat="option in formCtrl.groupOptions" value="{{:: option.value }}" ng-selected="formCtrl.formData.capabilityGroupId === option.value">{{:: option.name }}</option></select></div></div><div ng-if=::formCtrl.isFieldAuthorized class=form-group><label class="col-sm-2 control-label">Capability Type:</label><div class=col-sm-10><select class=form-control ng-model=formCtrl.formData.capabilityType><option value="">--- Select ---</option><option ng-repeat="option in formCtrl.typeOptions" value="{{:: option.value }}" ng-selected="formCtrl.formData.capabilityType === option.value">{{:: option.name }}</option></select></div></div><div ng-if=::formCtrl.isFieldAuthorized class=form-group><label class="col-sm-2 control-label">Abbreviation(s):</label><div class=col-sm-10><div ng-repeat="nickname in formCtrl.formData.nicknames track by $index" class=form-group-list-item><div class=row><div class=col-sm-10><div class=form-group><input class=form-control ng-model=formCtrl.formData.nicknames[$index]></div></div><div class=col-sm-2><div class=form-group><button type=button class="btn btn-danger btn-sm btn-block" ng-click=formCtrl.removeNickname($index)>Remove</button></div></div></div></div><button type=button class="btn btn-link" ng-click=formCtrl.addNickname()><i class="fa fa-plus"></i> Add Abbreviation</button></div></div><div ng-if=::formCtrl.isFieldAuthorized class=form-group><label class="col-sm-2 control-label">Owner(s):</label><div class=col-sm-10><div ng-repeat="owner in formCtrl.formData.owners" class=form-group-list-item><div class=row><div class=col-sm-3><div class=form-group><label>Name:</label><input class=form-control ng-model=owner.name></div></div><div class=col-sm-3><div class=form-group><label>Role:</label><select class=form-control ng-model=owner.role><option value="">--- Select ---</option><option ng-repeat="option in formCtrl.roleOptions" value="{{:: option.value }}" ng-selected="owner.role === option.value">{{:: option.name }}</option></select></div></div><div class=col-sm-4><div class=form-group><label>MeeBee Profile:</label><input class=form-control ng-model=owner.profileUrl placeholder="http://"></div></div><div class=col-sm-2><div class=form-group><label>&nbsp;</label><button type=button class="btn btn-danger btn-sm btn-block" ng-click=formCtrl.removeOwner($index)>Remove</button></div></div></div></div><button type=button class="btn btn-link" ng-click=formCtrl.addOwner()><i class="fa fa-plus"></i> Add Owner</button></div></div><div class=form-group><label class="col-sm-2 control-label">Product(s):</label><div class=col-sm-10><div ng-repeat="product in formCtrl.formData.products" class=form-group-list-item><div class=row><div class=col-sm-6><div class=form-group><label>Product:</label><select class=form-control ng-model=product.name ng-change=formCtrl.updateProductName($index)><option value="">--- Select ---</option><option ng-repeat="option in formCtrl.productOptions" value="{{:: option.value }}" ng-selected="product.name === option.value">{{:: option.name }}</option></select></div></div><div class=col-sm-4><div class=form-group><label>Adoption Status:</label><select class=form-control ng-model=product.adoptionStatus.adoptionStatusId><option value="">--- Select ---</option><option ng-repeat="option in formCtrl.adoptionStatusOptions" value="{{:: option.value }}" ng-selected="product.adoptionStatus.adoptionStatusId === option.value">{{:: option.name }}</option></select></div></div><div class=col-sm-2><div class=form-group><label>&nbsp;</label><button type=button class="btn btn-danger btn-sm btn-block" ng-click=formCtrl.removeProduct($index)>Remove</button></div></div></div><div class=row><div class=col-sm-10><div class=form-group><label>Comment:</label><textarea class=form-control ng-model=product.comment></textarea></div></div></div></div><button type=button class="btn btn-link" ng-click=formCtrl.addProduct()><i class="fa fa-plus"></i> Add Product</button></div></div><div ng-if=::formCtrl.isFieldAuthorized class=form-group><label class="col-sm-2 control-label">Website(s):</label><div class=col-sm-10><div ng-repeat="website in formCtrl.formData.websites" class=form-group-list-item><div class=row><div class=col-sm-3><div class=form-group><label>Name:</label><input class=form-control ng-model=website.name></div></div><div class=col-sm-5><div class=form-group><label>Full URL:</label><input class=form-control ng-model=website.url placeholder="http://"></div></div><div class=col-sm-2><div class=form-group><label></label><div class=checkbox><label><input type=checkbox ng-model=website.isPrivate ng-checked=website.isPrivate> Private</label></div></div></div><div class=col-sm-2><div class=form-group><label>&nbsp;</label><button type=button class="btn btn-danger btn-sm btn-block" ng-click=formCtrl.removeWebsite($index)>Remove</button></div></div></div></div><button type=button class="btn btn-link" ng-click=formCtrl.addWebsite()><i class="fa fa-plus"></i> Add Website</button></div></div><div class=form-group><div class="col-sm-offset-2 col-sm-10"><button ng-if=formCtrl.formData._id class="btn btn-primary btn-lg" type=submit ng-disabled=capabilityForm.$invalid><i class="fa fa-save"></i>Save</button> <button ng-if=!formCtrl.formData._id class="btn btn-primary btn-lg" type=submit ng-disabled=capabilityForm.$invalid><i class="fa fa-plus"></i>Add Capability</button></div></div></form></div><div ng-if=::!formCtrl.isVisible class="alert alert-warning">You are not authorized to view this page.</div></div>');
    $templateCache.put('../public/app/views/home/home.html',
        '<div class=page-header><h1>Shared Capability Catalog</h1></div><h2>What is a Shared Capability?</h2><p>Services architecture is commonly defined as a set of related software capabilities that users can reuse for multiple purposes and can access through a prescribed interface. However, a Shared Capability is more than just software.</p><p>Shared Capabilities can come in the form of either services or components. The SKY UX capability is in the form of a set of components while the Blackbaud Authentication Services/Single Sign On capability is in the form of a service. Both comprise a discreet unit of business capability that cuts across a product portfolio and fulfills technical, nonfunctional requirements (NFRs). A product can incorporate a Shared Capability through composition, integration, or consumption.</p><p>A Shared Capability is composed of:</p><ul><li>intellectual property</li><li>operations</li><li>infrastructure</li><li>developer and QA effort during a systems development life cycle</li></ul><h2>Shared Components vs. Shared Services</h2><p>While a Shared Capability can be either a component or service, there are differences. <a href="/docs/component-v-service/">Read more</a>.</p><cc-capability-list></cc-capability-list><cc-product-list></cc-product-list>');
    $templateCache.put('../public/app/views/login/login-page.html',
        '<div class=page-header><h1>Content Editor Login</h1></div><cc-login-form on-success=pageCtrl.redirect></cc-login-form>');
    $templateCache.put('../public/app/views/page/detail/page-detail.html',
        '<div ng-if=::pageCtrl.isReady><div class=page-detail ng-if=::pageCtrl.isVisible><div class=row><main class="col-sm-10 col-sm-push-2"><div class=page-header><div class=controls><button class="btn btn-default" ng-if="::appCtrl.isAuthorized(\'EDIT_PAGE:PARTIAL\')" ui-sref="page-form({ capabilityId: pageCtrl.page.capability._id, pageId: pageCtrl.page._id })"><i class="fa fa-pencil"></i> Edit</button></div><h1 ng-bind=::pageCtrl.page.title></h1></div><p ng-if=::!pageCtrl.page.isPublished class="alert alert-warning">This page is not published.</p><div class=content ng-bind-html=::pageCtrl.page.content.markup></div></main><aside class="col-sm-2 col-sm-pull-10"><nav id=nav-sidebar><h4 class=nav-sidebar-title ng-bind=::pageCtrl.page.capability.name></h4><ul><li ng-repeat="page in ::pageCtrl.page.capability.pages" ui-sref-active=active ng-if="::page.isPublished || (!page.isPublished && appCtrl.isAuthenticated())"><a href ui-sref="page(::{ capabilitySlug: pageCtrl.page.capability.slug, pageSlug: page.slug })">{{:: page.title }}</a></li></ul></nav></aside></div></div><div ng-if=::!pageCtrl.isVisible class="alert alert-warning">The page you are attempting to view is not published.</div></div>');
    $templateCache.put('../public/app/views/page/form/page-form.html',
        '<div ng-if=::formCtrl.isReady><div ng-if=::formCtrl.isVisible class=page-form-wrapper><div class=page-header bb-scroll-into-view=formCtrl.scrollToTop><div class=controls><button ng-if="::formCtrl.formData._id && appCtrl.isAuthorized(\'DELETE_PAGE\')" class="btn btn-danger" type=button cc-confirm-click data-confirmed-click=formCtrl.delete()><i class="fa fa-trash"></i>Delete</button></div><h1 ng-if=formCtrl.formData._id>Edit {{ formCtrl.formData.title }}</h1><h1 ng-if=!formCtrl.formData._id>Add Page</h1></div><div ng-if=formCtrl.success class="alert alert-success" ng-bind-html=formCtrl.trustHtml(formCtrl.success)></div><div ng-if=formCtrl.error class="alert alert-danger"><p ng-bind-html=formCtrl.trustHtml(formCtrl.error)></p><p ng-if=formCtrl.needsLogin><a href ng-click=appCtrl.openLoginModal() class="btn btn-primary">Editor Log In</a></p></div><form name=pageForm class=form-horizontal ng-submit=formCtrl.submit() novalidate><input type=hidden name=capabilityId value="{{ formCtrl.formData.originalCapabilityId }}"> <input type=hidden name=pageId value="{{ formCtrl.formData._id }}"><div ng-if=::formCtrl.isFieldAuthorized class=form-group ng-class="{\'has-error\': pageForm.title.$touched && pageForm.title.$invalid}"><label class="col-sm-2 control-label">Page Title:</label><div class=col-sm-10><input class=form-control name=title ng-model=formCtrl.formData.title placeholder=(required) required><div ng-show="pageForm.title.$touched && pageForm.title.$invalid" class=help-block>Page Title is required.</div></div></div><div ng-if=::formCtrl.isFieldAuthorized class=form-group><label class="col-sm-2 control-label">For Capability:</label><div class=col-sm-10><select class=form-control ng-model=formCtrl.formData.capabilityId required><option value="">--- Select ---</option><option ng-repeat="option in formCtrl.capabilityOptions" value="{{:: option.value }}" ng-selected="formCtrl.formData.capabilityId === option.value">{{:: option.name }}</option></select></div></div><div ng-if=::formCtrl.isFieldAuthorized class=form-group><label class="col-sm-2 control-label">Summary:</label><div class=col-sm-10><textarea class=form-control ng-model=formCtrl.formData.summary max-length=100></textarea><div class=help-block>100 characters</div></div></div><div ng-if=::formCtrl.isFieldAuthorized class=form-group><label class="col-sm-2 control-label">Summary Icon:</label><div class=col-sm-10><input class=form-control ng-model=formCtrl.formData.icon max-length=100 placeholder="e.g., fa-circle"><div class=help-block>Enter a <a href="http://fortawesome.github.io/Font-Awesome/cheatsheet/" target=_blank>Font Awesome</a> icon name.</div></div></div><div ng-if="::formCtrl.isFieldAuthorized && formCtrl.formData._id" class=form-group><label class="col-sm-2 control-label">Order:</label><div class=col-sm-10><input class=form-control name=order ng-model=formCtrl.formData.order><div class=help-block>Zero (0) has highest priority.</div></div></div><div class=form-group><label class="col-sm-2 control-label">Page Content:</label><div class=col-sm-10><textarea id=markdown-editor markdown-field data-provide=markdown class="form-control form-control-markup" ng-model=formCtrl.formData.content.markdown max-length=10000></textarea><div class=help-block>Accepts HTML and Markdown.</div></div></div><div ng-if=::formCtrl.isFieldAuthorized class=form-group><label class="col-sm-2 control-label">Status:</label><div class=col-sm-10><div class=checkbox><label><input type=checkbox ng-model=formCtrl.formData.isPublished ng-checked=formCtrl.formData.isPublished> Published</label></div></div></div><div class=form-group><div class="col-sm-offset-2 col-sm-10"><button ng-if=formCtrl.formData._id class="btn btn-primary btn-lg" type=submit ng-disabled=pageForm.$invalid><i class="fa fa-save"></i>Save</button> <button ng-if=!formCtrl.formData._id class="btn btn-primary btn-lg" type=submit ng-disabled=pageForm.$invalid><i class="fa fa-plus"></i>Add Page</button></div></div></form></div><div ng-if=::!formCtrl.isVisible class="alert alert-warning">You are not authorized to view this page.</div></div>');
    $templateCache.put('../public/app/views/product-group/form/product-group-form.html',
        '<div ng-if=::formCtrl.isReady><div ng-if=::formCtrl.isVisible class=product-group-form-wrapper><div class=page-header bb-scroll-into-view=formCtrl.scrollToTop><div class=controls><button ng-if="::formCtrl.formData._id && appCtrl.isAuthorized(\'DELETE_PRODUCT_GROUP\')" class="btn btn-danger" type=button cc-confirm-click data-confirmed-click=formCtrl.delete()><i class="fa fa-trash"></i>Delete</button></div><h1 ng-if=formCtrl.formData._id>Edit {{ formCtrl.formData.name }}</h1><h1 ng-if=!formCtrl.formData._id>Add Product Group</h1></div><div ng-if=formCtrl.success class="alert alert-success" ng-bind-html=formCtrl.trustHtml(formCtrl.success)></div><div ng-if=formCtrl.error class="alert alert-danger"><p ng-bind-html=formCtrl.trustHtml(formCtrl.error)></p><p ng-if=formCtrl.needsLogin><a href ng-click=appCtrl.openLoginModal() class="btn btn-primary">Editor Log In</a></p></div><form name=productGroupForm class=form-horizontal ng-submit=formCtrl.submit() novalidate><input type=hidden name=productGroupId value="{{ formCtrl.formData._id }}"><div class=form-group ng-class="{\'has-error\': productGroupForm.productGroupName.$touched && productGroupForm.productGroupName.$invalid}"><label class="col-sm-2 control-label">Product Group Name:</label><div class=col-sm-10><input class=form-control name=productGroupName ng-model=formCtrl.formData.name placeholder=(required) required><div ng-show="productGroupForm.productGroupName.$touched && productGroupForm.productGroupName.$invalid" class=help-block>Product Group Name is required.</div></div></div><div class=form-group><label class="col-sm-2 control-label">Order:</label><div class=col-sm-10><input class=form-control name=order ng-model=formCtrl.formData.order><div class=help-block>Zero (0) has highest priority.</div></div></div><div class=form-group><div class="col-sm-offset-2 col-sm-10"><button ng-if=formCtrl.formData._id class="btn btn-primary btn-lg" type=submit ng-disabled=productGroupForm.$invalid><i class="fa fa-save"></i>Save</button> <button ng-if=!formCtrl.formData._id class="btn btn-primary btn-lg" type=submit ng-disabled=productGroupForm.$invalid><i class="fa fa-plus"></i>Add Product Group</button></div></div></form></div><div ng-if=::!formCtrl.isVisible class="alert alert-warning">You are not authorized to view this page.</div></div>');
    $templateCache.put('../public/app/views/product/form/product-form.html',
        '<div ng-if=::formCtrl.isReady><div ng-if=::formCtrl.isVisible class=product-form-wrapper><div class=page-header bb-scroll-into-view=formCtrl.scrollToTop><div class=controls><button ng-if="::formCtrl.formData._id && appCtrl.isAuthorized(\'DELETE_PRODUCT\')" class="btn btn-danger" type=button cc-confirm-click data-confirmed-click=formCtrl.delete()><i class="fa fa-trash"></i>Delete</button></div><h1 ng-if=formCtrl.formData._id>Edit {{ formCtrl.formData.name }}</h1><h1 ng-if=!formCtrl.formData._id>Add Product</h1></div><div ng-if=formCtrl.success class="alert alert-success" ng-bind-html=formCtrl.trustHtml(formCtrl.success)></div><div ng-if=formCtrl.error class="alert alert-danger"><p ng-bind-html=formCtrl.trustHtml(formCtrl.error)></p><p ng-if=formCtrl.needsLogin><a href ng-click=appCtrl.openLoginModal() class="btn btn-primary">Editor Log In</a></p></div><form name=productForm class=form-horizontal ng-submit=formCtrl.submit() novalidate><input type=hidden name=productId value="{{ formCtrl.formData._id }}"><div class=form-group ng-class="{\'has-error\': productForm.productName.$touched && productForm.productName.$invalid}"><label class="col-sm-2 control-label">Product Name:</label><div class=col-sm-10><input class=form-control name=productName ng-model=formCtrl.formData.name placeholder=(required) required><div ng-show="productForm.productName.$touched && productForm.productName.$invalid" class=help-block>Product Name is required.</div></div></div><div class=form-group><label class="col-sm-2 control-label">Abbreviation(s):</label><div class=col-sm-10><div ng-repeat="nickname in formCtrl.formData.nicknames track by $index" class=form-group-list-item><div class=row><div class=col-sm-10><div class=form-group><input class=form-control ng-model=formCtrl.formData.nicknames[$index]></div></div><div class=col-sm-2><div class=form-group><button type=button class="btn btn-danger btn-sm btn-block" ng-click=formCtrl.removeNickname($index)>Remove</button></div></div></div></div><button type=button class="btn btn-link" ng-click=formCtrl.addNickname()><i class="fa fa-plus"></i> Add Abbreviation</button></div></div><div ng-if=formCtrl.formData._id class=form-group><label class="col-sm-2 control-label">Order:</label><div class=col-sm-10><input class=form-control name=order ng-model=formCtrl.formData.order><div class=help-block>Zero (0) has highest priority.</div></div></div><div class=form-group><label class="col-sm-2 control-label">Group:</label><div class=col-sm-10><select class=form-control ng-model=formCtrl.formData.productGroupId><option value="">--- Select ---</option><option ng-repeat="option in formCtrl.groupOptions" value="{{:: option.value }}" ng-selected="formCtrl.formData.productGroupId === option.value">{{:: option.name }}</option></select></div></div><div class=form-group><div class="col-sm-offset-2 col-sm-10"><button ng-if=formCtrl.formData._id class="btn btn-primary btn-lg" type=submit ng-disabled=productForm.$invalid><i class="fa fa-save"></i>Save</button> <button ng-if=!formCtrl.formData._id class="btn btn-primary btn-lg" type=submit ng-disabled=productForm.$invalid><i class="fa fa-plus"></i>Add Product</button></div></div></form></div><div ng-if=::!formCtrl.isVisible class="alert alert-warning">You are not authorized to view this page.</div></div>');
    $templateCache.put('../public/app/components/breadcrumbs/breadcrumbs.html',
        '<div id=wrap-breadcrumbs ng-if="breadcrumbsCtrl.breadcrumbs.length > 0"><ul class=breadcrumb><li><a href ui-sref=home>Home</a></li><li ng-repeat="breadcrumb in ::breadcrumbsCtrl.breadcrumbs track by $index"><span ng-if=$last>{{:: breadcrumb.name }}</span><a ng-if=!$last ng-href="{{:: breadcrumb.href }}">{{:: breadcrumb.name }}</a></li></ul></div>');
    $templateCache.put('../public/app/components/capability-list/capability-list.html',
        '<h1>Shared Capabilities</h1><p ng-if="::appCtrl.isAuthorized(\'CREATE_CAPABILITY_GROUP\')"><a class="btn btn-default" href ui-sref=capability-group-form><i class="fa fa-plus"></i>Add Capability Group</a></p><ul class=table-list><li class=table-list-item ng-repeat="capabilityGroup in ::listCtrl.capabilities" ng-if="::capabilityGroup.capabilities.length || appCtrl.isAuthorized(\'CREATE_PRODUCT\')"><div class=table-list-heading><h2 class=table-list-title ng-bind=::capabilityGroup.name></h2><div class=controls ng-if="::appCtrl.isAuthorized(\'EDIT_CAPABILITY_GROUP\') && capabilityGroup._id"><a href ui-sref="capability-group-form(::{ capabilityGroupId: capabilityGroup._id })">Edit</a></div><p ng-if="::appCtrl.isAuthorized(\'CREATE_CAPABILITY\')"><a class="btn btn-default" href ui-sref="capability-form({ capabilityGroupId: capabilityGroup._id })"><i class="fa fa-plus"></i>Add Capability</a></p></div><div class=table-responsive><table class="table table-striped"><thead><tr><th class=name>Capability Name</th><th>Capability Type</th><th>State</th><th class=stats colspan=2>Products Adopting Capability</th></tr></thead><tbody ng-sortable=capabilityGroup.sortConfig><tr ng-class="::{ draggable: appCtrl.isAuthorized(\'EDIT_CAPABILITY:FULL\') && capabilityGroup._id }" ng-repeat="capability in capabilityGroup.capabilities"><td class=name><a href ui-sref="capability(::{ capabilitySlug: capability.slug })" ng-bind=::capability.name></a></td><td ng-bind=::capability.capabilityType></td><td ng-bind=::capability.developmentState></td><td class=stats><a class=chart href ng-click="listCtrl.openModal(\'Products Adopting \' + capability.name, capability)"><div ng-repeat="total in ::capability.totals" class="bar {{:: total.class }}" style="width:{{:: total.count * 40 }}px" title="{{:: total.model.adoptionStatus.name }}"></div></a></td><td class=controls ng-if="::appCtrl.isAuthorized(\'EDIT_CAPABILITY:PARTIAL\')"><bb-context-menu><li><a href ui-sref="capability-form(::{ capabilityId: capability._id })"><i class="fa fa-pencil"></i> Edit</a></li></bb-context-menu><span ng-if="::appCtrl.isAuthorized(\'EDIT_CAPABILITY:FULL\') && capabilityGroup._id" class=handle title="Order: {{capability.order}}"><i class="fa fa-sort"></i></span></td></tr></tbody></table></div></li></ul>');
    $templateCache.put('../public/app/components/forms/login/login-form.html',
        '<div bb-scroll-into-view=formCtrl.scrollToTop><div ng-if=formCtrl.success class="alert alert-success" ng-bind-html=formCtrl.trustHtml(formCtrl.success)></div><div ng-if=formCtrl.error class="alert alert-danger" ng-bind-html=formCtrl.trustHtml(formCtrl.error)></div><form name=loginForm id=form-login class=form-horizontal ng-submit=formCtrl.submit() method=post novalidate><div class=form-group ng-class="{\'has-error\': loginForm.emailAddress.$touched && loginForm.emailAddress.$invalid}"><label class="col-sm-2 control-label">Email Address:</label><div class=col-sm-10><input class=form-control name=emailAddress ng-model=formCtrl.formData.emailAddress placeholder=(required) required><div ng-show="loginForm.emailAddress.$touched && loginForm.emailAddress.$invalid" class=help-block>Email Address is required.</div></div></div><div class=form-group ng-class="{\'has-error\': loginForm.passphrase.$touched && loginForm.passphrase.$invalid}"><label class="col-sm-2 control-label">Passphrase:</label><div class=col-sm-10><input class=form-control type=password name=passphrase ng-model=formCtrl.formData.passphrase placeholder=(required) required><div ng-show="loginForm.passphrase.$touched && loginForm.passphrase.$invalid" class=help-block>Passphrase is required.</div></div></div><div class="form-group form-buttons"><div class="col-sm-offset-2 col-sm-10"><button class="btn btn-primary btn-lg" id=login-form-button type=submit ng-disabled=loginForm.$invalid><i class="fa fa-login"></i>Log In</button></div></div></form></div>');
    $templateCache.put('../public/app/components/modals/adoption-status-modal.html',
        '<bb-modal><div class=modal-wrapper><bb-modal-header>{{:: modalCtrl.data.title }}</bb-modal-header><div bb-modal-body><table class="table table-striped table-condensed" style=margin:0><thead><tr><th>Product</th><th>Status</th><th>Comment(s)</th></tr></thead><tr ng-repeat="product in ::modalCtrl.data.model"><td style="white-space: nowrap"><span ng-bind=::product.name></span></td><td style="white-space: nowrap"><span class="bullet {{:: product.class }}"></span><span ng-bind=::product.adoptionStatus.name></span></td><td><p ng-bind-html=::product.comment></p></td></tr></table></div><bb-modal-footer><button ng-click=$close() class="btn btn-default">Close</button></bb-modal-footer></div></bb-modal>');
    $templateCache.put('../public/app/components/modals/login-modal.html',
        '<bb-modal><div class=modal-form><bb-modal-header>Editor Log In</bb-modal-header><div bb-modal-body><cc-login-form on-success=contentCtrl.onSuccess></cc-login-form></div><bb-modal-footer><bb-modal-footer-button-primary ng-click=contentCtrl.login()>Log In</bb-modal-footer-button-primary><bb-modal-footer-button-cancel></bb-modal-footer-button-cancel></bb-modal-footer></div></bb-modal>');
    $templateCache.put('../public/app/components/popovers/adoption-status-chart.html',
        '<div class=popover-content><ul class=badge-list><li ng-repeat="product in ::capability.products"><a href class="{{:: product.class }}" bb-popover-template=../public/app/components/popovers/product-comment.html data-popover-title="{{:: product.adoptionStatus.name }}"><span class=badge-list-name ng-bind=::product.name></span> <span class=badge-list-description ng-bind=::product.adoptionStatus.name></span></a></li></ul></div>');
    $templateCache.put('../public/app/components/popovers/product-comment.html',
        '<div class=popover-content><p ng-bind-html=::product.defaultComment></p></div>');
    $templateCache.put('../public/app/components/product-list/product-list.html',
        '<h1>Adopted Capabilities By Product</h1><p ng-if="::appCtrl.isAuthorized(\'CREATE_PRODUCT_GROUP\')"><a class="btn btn-default" href ui-sref=product-group-form><i class="fa fa-plus"></i>Add Product Group</a></p><div class=table-list><div class=table-list-item ng-repeat="productGroup in ::listCtrl.products" ng-if="::productGroup.products.length || appCtrl.isAuthorized(\'CREATE_PRODUCT\')"><div class=table-list-heading><h2 class=table-list-title ng-bind=::productGroup.name></h2><div class=controls ng-if="::appCtrl.isAuthorized(\'EDIT_PRODUCT_GROUP\') && productGroup._id"><a href ui-sref="product-group-form(::{ productGroupId: productGroup._id })">Edit</a></div><p ng-if="::appCtrl.isAuthorized(\'CREATE_PRODUCT\')"><a class="btn btn-default" href ui-sref="product-form({ productGroupId: productGroup._id })"><i class="fa fa-plus"></i>Add Product</a></p></div><div class=table-responsive><table class="table table-striped table-hover"><thead><tr><th class=name>Product</th><th class=stats colspan=2>Capabilities Adopted and Status</th></tr></thead><tbody ng-sortable=productGroup.sortConfig><tr ng-class="::{ draggable: appCtrl.isAuthorized(\'EDIT_PRODUCT:FULL\') }" ng-repeat="product in productGroup.products"><td class=name ng-bind=::product.name></td><td class=stats><a class=chart href ng-click="listCtrl.openModal(\'Capabilities Adopted by \' + product.name, product)"><div ng-repeat="total in ::product.totals" class="bar {{:: total.class }}" style="width:{{:: total.count * 40 }}px" title="{{:: total.model.adoptionStatus.name }}"></div></a></td><td class=controls ng-if="::appCtrl.isAuthorized(\'EDIT_PRODUCT:PARTIAL\')"><bb-context-menu><li><a href ui-sref="product-form(::{ productId: product._id })"><i class="fa fa-pencil"></i> Edit</a></li></bb-context-menu><span class=handle><i class="fa fa-sort"></i></span></td></tr></tbody></table></div></div></div>');
}]);

//# sourceMappingURL=app.js.map