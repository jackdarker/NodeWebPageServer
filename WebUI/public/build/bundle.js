
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    let src_url_equal_anchor;
    function src_url_equal(element_src, url) {
        if (!src_url_equal_anchor) {
            src_url_equal_anchor = document.createElement('a');
        }
        src_url_equal_anchor.href = url;
        return element_src === src_url_equal_anchor.href;
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function get_store_value(store) {
        let value;
        subscribe(store, _ => value = _)();
        return value;
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function prevent_default(fn) {
        return function (event) {
            event.preventDefault();
            // @ts-ignore
            return fn.call(this, event);
        };
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    /**
     * The `onMount` function schedules a callback to run as soon as the component has been mounted to the DOM.
     * It must be called during the component's initialisation (but doesn't need to live *inside* the component;
     * it can be called from an external module).
     *
     * `onMount` does not run inside a [server-side component](/docs#run-time-server-side-component-api).
     *
     * https://svelte.dev/docs#run-time-svelte-onmount
     */
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    /**
     * Creates an event dispatcher that can be used to dispatch [component events](/docs#template-syntax-component-directives-on-eventname).
     * Event dispatchers are functions that can take two arguments: `name` and `detail`.
     *
     * Component events created with `createEventDispatcher` create a
     * [CustomEvent](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent).
     * These events do not [bubble](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Building_blocks/Events#Event_bubbling_and_capture).
     * The `detail` argument corresponds to the [CustomEvent.detail](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent/detail)
     * property and can contain any type of data.
     *
     * https://svelte.dev/docs#run-time-svelte-createeventdispatcher
     */
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail, { cancelable = false } = {}) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail, { cancelable });
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
                return !event.defaultPrevented;
            }
            return true;
        };
    }

    const dirty_components = [];
    const binding_callbacks = [];
    let render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = /* @__PURE__ */ Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function add_flush_callback(fn) {
        flush_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        // Do not reenter flush while dirty components are updated, as this can
        // result in an infinite loop. Instead, let the inner flush handle it.
        // Reentrancy is ok afterwards for bindings etc.
        if (flushidx !== 0) {
            return;
        }
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            try {
                while (flushidx < dirty_components.length) {
                    const component = dirty_components[flushidx];
                    flushidx++;
                    set_current_component(component);
                    update(component.$$);
                }
            }
            catch (e) {
                // reset dirty state to not end up in a deadlocked state and then rethrow
                dirty_components.length = 0;
                flushidx = 0;
                throw e;
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    /**
     * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
     */
    function flush_render_callbacks(fns) {
        const filtered = [];
        const targets = [];
        render_callbacks.forEach((c) => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
        targets.forEach((c) => c());
        render_callbacks = filtered;
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
        else if (callback) {
            callback();
        }
    }
    function each(items, fn) {
        let str = '';
        for (let i = 0; i < items.length; i += 1) {
            str += fn(items[i], i);
        }
        return str;
    }

    function bind(component, name, callback) {
        const index = component.$$.props[name];
        if (index !== undefined) {
            component.$$.bound[index] = callback;
            callback(component.$$.ctx[index]);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
                // if the component was destroyed immediately
                // it will update the `$$.on_destroy` reference to `null`.
                // the destructured on_destroy may still reference to the old array
                if (component.$$.on_destroy) {
                    component.$$.on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            flush_render_callbacks($$.after_update);
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: [],
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            if (!is_function(callback)) {
                return noop;
            }
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.59.2' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation, has_stop_immediate_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        if (has_stop_immediate_propagation)
            modifiers.push('stopImmediatePropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src\PostContainer.svelte generated by Svelte v3.59.2 */
    const file$7 = "src\\PostContainer.svelte";

    // (73:8) {#if post.fileName != ""}
    function create_if_block$6(ctx) {
    	let if_block_anchor;

    	function select_block_type(ctx, dirty) {
    		if (/*showThumb*/ ctx[3]) return create_if_block_1$4;
    		return create_else_block$3;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$6.name,
    		type: "if",
    		source: "(73:8) {#if post.fileName != \\\"\\\"}",
    		ctx
    	});

    	return block;
    }

    // (76:12) {:else}
    function create_else_block$3(ctx) {
    	let img;
    	let img_src_value;
    	let img_alt_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "postImage svelte-19bxwud");
    			if (!src_url_equal(img.src, img_src_value = /*imagePath*/ ctx[1])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", img_alt_value = /*post*/ ctx[0].fileName);
    			add_location(img, file$7, 76, 16, 2006);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);

    			if (!mounted) {
    				dispose = listen_dev(img, "click", /*thumbToggle*/ ctx[4], false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*imagePath*/ 2 && !src_url_equal(img.src, img_src_value = /*imagePath*/ ctx[1])) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (dirty & /*post*/ 1 && img_alt_value !== (img_alt_value = /*post*/ ctx[0].fileName)) {
    				attr_dev(img, "alt", img_alt_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$3.name,
    		type: "else",
    		source: "(76:12) {:else}",
    		ctx
    	});

    	return block;
    }

    // (74:12) {#if showThumb}
    function create_if_block_1$4(ctx) {
    	let img;
    	let img_src_value;
    	let img_alt_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "postThumb svelte-19bxwud");
    			if (!src_url_equal(img.src, img_src_value = /*thumbPath*/ ctx[2])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", img_alt_value = /*post*/ ctx[0].fileName);
    			add_location(img, file$7, 74, 16, 1883);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);

    			if (!mounted) {
    				dispose = listen_dev(img, "click", /*thumbToggle*/ ctx[4], false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*thumbPath*/ 4 && !src_url_equal(img.src, img_src_value = /*thumbPath*/ ctx[2])) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (dirty & /*post*/ 1 && img_alt_value !== (img_alt_value = /*post*/ ctx[0].fileName)) {
    				attr_dev(img, "alt", img_alt_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$4.name,
    		type: "if",
    		source: "(74:12) {#if showThumb}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$8(ctx) {
    	let div1;
    	let ul0;
    	let li0;
    	let t0_value = /*post*/ ctx[0].name + "";
    	let t0;
    	let t1;
    	let li1;
    	let t2_value = /*post*/ ctx[0].dateTime + "";
    	let t2;
    	let t3;
    	let li2;
    	let t4;
    	let t5_value = /*post*/ ctx[0].postID + "";
    	let t5;
    	let t6;
    	let ul1;
    	let li3;
    	let a;
    	let t7_value = /*post*/ ctx[0].fileName + "";
    	let t7;
    	let t8;
    	let div0;
    	let t9;
    	let p;
    	let t10_value = /*post*/ ctx[0].postText + "";
    	let t10;
    	let if_block = /*post*/ ctx[0].fileName != "" && create_if_block$6(ctx);

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			ul0 = element("ul");
    			li0 = element("li");
    			t0 = text(t0_value);
    			t1 = space();
    			li1 = element("li");
    			t2 = text(t2_value);
    			t3 = space();
    			li2 = element("li");
    			t4 = text("Post#");
    			t5 = text(t5_value);
    			t6 = space();
    			ul1 = element("ul");
    			li3 = element("li");
    			a = element("a");
    			t7 = text(t7_value);
    			t8 = space();
    			div0 = element("div");
    			if (if_block) if_block.c();
    			t9 = space();
    			p = element("p");
    			t10 = text(t10_value);
    			attr_dev(li0, "id", "name");
    			attr_dev(li0, "class", "svelte-19bxwud");
    			add_location(li0, file$7, 64, 8, 1557);
    			attr_dev(li1, "class", "svelte-19bxwud");
    			add_location(li1, file$7, 65, 8, 1596);
    			attr_dev(li2, "class", "svelte-19bxwud");
    			add_location(li2, file$7, 66, 8, 1629);
    			attr_dev(ul0, "class", "postHeader svelte-19bxwud");
    			add_location(ul0, file$7, 63, 4, 1525);
    			attr_dev(a, "target", "_blank");
    			attr_dev(a, "href", /*imagePath*/ ctx[1]);
    			attr_dev(a, "class", "svelte-19bxwud");
    			add_location(a, file$7, 69, 12, 1707);
    			attr_dev(li3, "class", "svelte-19bxwud");
    			add_location(li3, file$7, 69, 8, 1703);
    			attr_dev(ul1, "class", "postHeader svelte-19bxwud");
    			add_location(ul1, file$7, 68, 4, 1671);
    			attr_dev(p, "class", "postText svelte-19bxwud");
    			add_location(p, file$7, 80, 8, 2146);
    			attr_dev(div0, "class", "postBody svelte-19bxwud");
    			add_location(div0, file$7, 71, 4, 1782);
    			attr_dev(div1, "class", "postContainer svelte-19bxwud");
    			add_location(div1, file$7, 62, 0, 1493);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, ul0);
    			append_dev(ul0, li0);
    			append_dev(li0, t0);
    			append_dev(ul0, t1);
    			append_dev(ul0, li1);
    			append_dev(li1, t2);
    			append_dev(ul0, t3);
    			append_dev(ul0, li2);
    			append_dev(li2, t4);
    			append_dev(li2, t5);
    			append_dev(div1, t6);
    			append_dev(div1, ul1);
    			append_dev(ul1, li3);
    			append_dev(li3, a);
    			append_dev(a, t7);
    			append_dev(div1, t8);
    			append_dev(div1, div0);
    			if (if_block) if_block.m(div0, null);
    			append_dev(div0, t9);
    			append_dev(div0, p);
    			append_dev(p, t10);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*post*/ 1 && t0_value !== (t0_value = /*post*/ ctx[0].name + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*post*/ 1 && t2_value !== (t2_value = /*post*/ ctx[0].dateTime + "")) set_data_dev(t2, t2_value);
    			if (dirty & /*post*/ 1 && t5_value !== (t5_value = /*post*/ ctx[0].postID + "")) set_data_dev(t5, t5_value);
    			if (dirty & /*post*/ 1 && t7_value !== (t7_value = /*post*/ ctx[0].fileName + "")) set_data_dev(t7, t7_value);

    			if (dirty & /*imagePath*/ 2) {
    				attr_dev(a, "href", /*imagePath*/ ctx[1]);
    			}

    			if (/*post*/ ctx[0].fileName != "") {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$6(ctx);
    					if_block.c();
    					if_block.m(div0, t9);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (dirty & /*post*/ 1 && t10_value !== (t10_value = /*post*/ ctx[0].postText + "")) set_data_dev(t10, t10_value);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			if (if_block) if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$8.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$8($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('PostContainer', slots, []);
    	let { post } = $$props;
    	let imagePath, thumbPath;
    	let showThumb = true;
    	let url = document.URL.substr(0, document.URL.lastIndexOf("/") + 1);

    	//Set file paths if the post has a file
    	if (post.fileName) {
    		imagePath = "images/" + (post.replyToID ? post.replyToID : post.postID) + "/" + post.postID + "." + post.fileExt;
    		thumbPath = "images/" + (post.replyToID ? post.replyToID : post.postID) + "/thumb_" + post.postID + "." + post.fileExt;
    	}

    	function thumbToggle() {
    		$$invalidate(3, showThumb = !showThumb);
    	}

    	$$self.$$.on_mount.push(function () {
    		if (post === undefined && !('post' in $$props || $$self.$$.bound[$$self.$$.props['post']])) {
    			console.warn("<PostContainer> was created without expected prop 'post'");
    		}
    	});

    	const writable_props = ['post'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<PostContainer> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('post' in $$props) $$invalidate(0, post = $$props.post);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		post,
    		imagePath,
    		thumbPath,
    		showThumb,
    		url,
    		thumbToggle
    	});

    	$$self.$inject_state = $$props => {
    		if ('post' in $$props) $$invalidate(0, post = $$props.post);
    		if ('imagePath' in $$props) $$invalidate(1, imagePath = $$props.imagePath);
    		if ('thumbPath' in $$props) $$invalidate(2, thumbPath = $$props.thumbPath);
    		if ('showThumb' in $$props) $$invalidate(3, showThumb = $$props.showThumb);
    		if ('url' in $$props) url = $$props.url;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [post, imagePath, thumbPath, showThumb, thumbToggle];
    }

    class PostContainer extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$8, create_fragment$8, safe_not_equal, { post: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "PostContainer",
    			options,
    			id: create_fragment$8.name
    		});
    	}

    	get post() {
    		throw new Error("<PostContainer>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set post(value) {
    		throw new Error("<PostContainer>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\const.svelte generated by Svelte v3.59.2 */

    function create_fragment$7(ctx) {
    	const block = {
    		c: noop,
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: noop,
    		p: noop,
    		i: noop,
    		o: noop,
    		d: noop
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$7.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const apiURL = "http://127.0.0.1:30050/api/";
    const uiURL = "http://localhost:5000";

    async function getTags() {
    	const res = await fetch(apiURL + "tags");
    	let data = await res.json();
    	return data;
    }

    function instance$7($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Const', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Const> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ apiURL, uiURL, getTags });
    	return [];
    }

    class Const extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$7, create_fragment$7, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Const",
    			options,
    			id: create_fragment$7.name
    		});
    	}
    }

    var glob = /*#__PURE__*/Object.freeze({
        __proto__: null,
        'default': Const,
        apiURL: apiURL,
        uiURL: uiURL,
        getTags: getTags
    });

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=} start
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = new Set();
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (const subscriber of subscribers) {
                        subscriber[1]();
                        subscriber_queue.push(subscriber, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.add(subscriber);
            if (subscribers.size === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                subscribers.delete(subscriber);
                if (subscribers.size === 0 && stop) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    function createCount() {
    	const { subscribe, set, update } = writable(null);

    	return {
    		subscribe,
    		set: (x)=>set(x)
    	};
    }
    //stors get reinitialized if you browse a link because the whole app is reinitialized??
    const viewHandle = createCount();

    /* src\OpeningPostContainer.svelte generated by Svelte v3.59.2 */
    const file$6 = "src\\OpeningPostContainer.svelte";

    // (85:8) {#if post.fileName != ""}
    function create_if_block$5(ctx) {
    	let if_block_anchor;

    	function select_block_type(ctx, dirty) {
    		if (/*showThumb*/ ctx[3]) return create_if_block_1$3;
    		return create_else_block$2;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$5.name,
    		type: "if",
    		source: "(85:8) {#if post.fileName != \\\"\\\"}",
    		ctx
    	});

    	return block;
    }

    // (88:12) {:else}
    function create_else_block$2(ctx) {
    	let img;
    	let img_src_value;
    	let img_alt_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "postImage svelte-1hasst6");
    			if (!src_url_equal(img.src, img_src_value = /*imagePath*/ ctx[1])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", img_alt_value = /*post*/ ctx[0].fileName);
    			add_location(img, file$6, 88, 16, 2668);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);

    			if (!mounted) {
    				dispose = listen_dev(img, "click", /*thumbToggle*/ ctx[5], false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*imagePath*/ 2 && !src_url_equal(img.src, img_src_value = /*imagePath*/ ctx[1])) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (dirty & /*post*/ 1 && img_alt_value !== (img_alt_value = /*post*/ ctx[0].fileName)) {
    				attr_dev(img, "alt", img_alt_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$2.name,
    		type: "else",
    		source: "(88:12) {:else}",
    		ctx
    	});

    	return block;
    }

    // (86:12) {#if showThumb}
    function create_if_block_1$3(ctx) {
    	let img;
    	let img_src_value;
    	let img_alt_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "postThumb svelte-1hasst6");
    			if (!src_url_equal(img.src, img_src_value = /*thumbPath*/ ctx[2])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", img_alt_value = /*post*/ ctx[0].fileName);
    			add_location(img, file$6, 86, 16, 2545);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);

    			if (!mounted) {
    				dispose = listen_dev(img, "click", /*thumbToggle*/ ctx[5], false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*thumbPath*/ 4 && !src_url_equal(img.src, img_src_value = /*thumbPath*/ ctx[2])) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (dirty & /*post*/ 1 && img_alt_value !== (img_alt_value = /*post*/ ctx[0].fileName)) {
    				attr_dev(img, "alt", img_alt_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$3.name,
    		type: "if",
    		source: "(86:12) {#if showThumb}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$6(ctx) {
    	let div1;
    	let div0;
    	let ul0;
    	let li0;
    	let a0;
    	let t0_value = /*post*/ ctx[0].fileName + "";
    	let t0;
    	let t1;
    	let li1;
    	let button;
    	let t3;
    	let t4;
    	let ul1;
    	let li2;
    	let t5_value = /*post*/ ctx[0].subject + "";
    	let t5;
    	let t6;
    	let li3;
    	let t7_value = /*post*/ ctx[0].name + "";
    	let t7;
    	let t8;
    	let li4;
    	let t9_value = /*post*/ ctx[0].dateTime + "";
    	let t9;
    	let t10;
    	let li5;
    	let a1;
    	let t11;
    	let t12_value = /*post*/ ctx[0].postID + "";
    	let t12;
    	let a1_href_value;
    	let t13;
    	let p;
    	let t14_value = /*post*/ ctx[0].postText + "";
    	let t14;
    	let mounted;
    	let dispose;
    	let if_block = /*post*/ ctx[0].fileName != "" && create_if_block$5(ctx);

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			ul0 = element("ul");
    			li0 = element("li");
    			a0 = element("a");
    			t0 = text(t0_value);
    			t1 = space();
    			li1 = element("li");
    			button = element("button");
    			button.textContent = "Ext.Window";
    			t3 = space();
    			if (if_block) if_block.c();
    			t4 = space();
    			ul1 = element("ul");
    			li2 = element("li");
    			t5 = text(t5_value);
    			t6 = space();
    			li3 = element("li");
    			t7 = text(t7_value);
    			t8 = space();
    			li4 = element("li");
    			t9 = text(t9_value);
    			t10 = space();
    			li5 = element("li");
    			a1 = element("a");
    			t11 = text("Post#");
    			t12 = text(t12_value);
    			t13 = space();
    			p = element("p");
    			t14 = text(t14_value);
    			attr_dev(a0, "target", "_blank");
    			attr_dev(a0, "href", /*imagePath*/ ctx[1]);
    			add_location(a0, file$6, 81, 16, 2309);
    			attr_dev(li0, "class", "svelte-1hasst6");
    			add_location(li0, file$6, 81, 12, 2305);
    			add_location(button, file$6, 82, 16, 2386);
    			attr_dev(li1, "class", "svelte-1hasst6");
    			add_location(li1, file$6, 82, 12, 2382);
    			attr_dev(ul0, "class", "postHeader svelte-1hasst6");
    			add_location(ul0, file$6, 80, 8, 2269);
    			attr_dev(li2, "id", "subject");
    			attr_dev(li2, "class", "svelte-1hasst6");
    			add_location(li2, file$6, 93, 12, 2844);
    			attr_dev(li3, "id", "name");
    			attr_dev(li3, "class", "svelte-1hasst6");
    			add_location(li3, file$6, 94, 12, 2893);
    			attr_dev(li4, "class", "svelte-1hasst6");
    			add_location(li4, file$6, 95, 12, 2936);
    			attr_dev(a1, "href", a1_href_value = /*url*/ ctx[4] + "?thread=" + /*post*/ ctx[0].postID);
    			add_location(a1, file$6, 96, 16, 2977);
    			attr_dev(li5, "class", "svelte-1hasst6");
    			add_location(li5, file$6, 96, 12, 2973);
    			attr_dev(ul1, "class", "postHeader svelte-1hasst6");
    			add_location(ul1, file$6, 92, 8, 2808);
    			attr_dev(p, "class", "postText svelte-1hasst6");
    			add_location(p, file$6, 99, 8, 3075);
    			attr_dev(div0, "class", "postBody svelte-1hasst6");
    			add_location(div0, file$6, 79, 4, 2238);
    			attr_dev(div1, "class", "postContainer svelte-1hasst6");
    			add_location(div1, file$6, 78, 0, 2206);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			append_dev(div0, ul0);
    			append_dev(ul0, li0);
    			append_dev(li0, a0);
    			append_dev(a0, t0);
    			append_dev(ul0, t1);
    			append_dev(ul0, li1);
    			append_dev(li1, button);
    			append_dev(div0, t3);
    			if (if_block) if_block.m(div0, null);
    			append_dev(div0, t4);
    			append_dev(div0, ul1);
    			append_dev(ul1, li2);
    			append_dev(li2, t5);
    			append_dev(ul1, t6);
    			append_dev(ul1, li3);
    			append_dev(li3, t7);
    			append_dev(ul1, t8);
    			append_dev(ul1, li4);
    			append_dev(li4, t9);
    			append_dev(ul1, t10);
    			append_dev(ul1, li5);
    			append_dev(li5, a1);
    			append_dev(a1, t11);
    			append_dev(a1, t12);
    			append_dev(div0, t13);
    			append_dev(div0, p);
    			append_dev(p, t14);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*click_handler*/ ctx[7], false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*post*/ 1 && t0_value !== (t0_value = /*post*/ ctx[0].fileName + "")) set_data_dev(t0, t0_value);

    			if (dirty & /*imagePath*/ 2) {
    				attr_dev(a0, "href", /*imagePath*/ ctx[1]);
    			}

    			if (/*post*/ ctx[0].fileName != "") {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$5(ctx);
    					if_block.c();
    					if_block.m(div0, t4);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (dirty & /*post*/ 1 && t5_value !== (t5_value = /*post*/ ctx[0].subject + "")) set_data_dev(t5, t5_value);
    			if (dirty & /*post*/ 1 && t7_value !== (t7_value = /*post*/ ctx[0].name + "")) set_data_dev(t7, t7_value);
    			if (dirty & /*post*/ 1 && t9_value !== (t9_value = /*post*/ ctx[0].dateTime + "")) set_data_dev(t9, t9_value);
    			if (dirty & /*post*/ 1 && t12_value !== (t12_value = /*post*/ ctx[0].postID + "")) set_data_dev(t12, t12_value);

    			if (dirty & /*post*/ 1 && a1_href_value !== (a1_href_value = /*url*/ ctx[4] + "?thread=" + /*post*/ ctx[0].postID)) {
    				attr_dev(a1, "href", a1_href_value);
    			}

    			if (dirty & /*post*/ 1 && t14_value !== (t14_value = /*post*/ ctx[0].postText + "")) set_data_dev(t14, t14_value);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			if (if_block) if_block.d();
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('OpeningPostContainer', slots, []);
    	let { post } = $$props;
    	let imagePath, thumbPath;
    	let showThumb = true;
    	let url = document.URL.substring(0, document.URL.lastIndexOf("/") + 1);

    	//Set file paths if the post has a file
    	if (post.fileName.length > 0) {
    		imagePath = "images/" + (post.replyToID ? post.replyToID : post.postID) + "/" + post.postID + "." + post.fileExt;
    		thumbPath = "images/" + (post.replyToID ? post.replyToID : post.postID) + "/thumb_" + post.postID + "." + post.fileExt;
    	}

    	function thumbToggle() {
    		$$invalidate(3, showThumb = !showThumb);
    	}

    	function openWindow(post) {
    		let handle = get_store_value(viewHandle);

    		if (handle && !handle.closed) {
    			handle.postMessage(post, '*');
    		} else {
    			handle = open(uiURL + '/subpage.html');

    			//let newWindow = open(glob.uiURL+'/subpage.html', 'Viewer', 'width=300,height=300')
    			//newWindow.focus();
    			handle.onload = function () {
    				let html = `<div style="font-size:30px">Welcome!</div>`;
    				handle.document.body.insertAdjacentHTML('afterbegin', html);
    				handle.postMessage(post, '*');
    			};

    			viewHandle.set(handle);
    		}
    	}

    	$$self.$$.on_mount.push(function () {
    		if (post === undefined && !('post' in $$props || $$self.$$.bound[$$self.$$.props['post']])) {
    			console.warn("<OpeningPostContainer> was created without expected prop 'post'");
    		}
    	});

    	const writable_props = ['post'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<OpeningPostContainer> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => openWindow({ post });

    	$$self.$$set = $$props => {
    		if ('post' in $$props) $$invalidate(0, post = $$props.post);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		glob,
    		viewHandle,
    		get: get_store_value,
    		post,
    		imagePath,
    		thumbPath,
    		showThumb,
    		url,
    		thumbToggle,
    		openWindow
    	});

    	$$self.$inject_state = $$props => {
    		if ('post' in $$props) $$invalidate(0, post = $$props.post);
    		if ('imagePath' in $$props) $$invalidate(1, imagePath = $$props.imagePath);
    		if ('thumbPath' in $$props) $$invalidate(2, thumbPath = $$props.thumbPath);
    		if ('showThumb' in $$props) $$invalidate(3, showThumb = $$props.showThumb);
    		if ('url' in $$props) $$invalidate(4, url = $$props.url);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		post,
    		imagePath,
    		thumbPath,
    		showThumb,
    		url,
    		thumbToggle,
    		openWindow,
    		click_handler
    	];
    }

    class OpeningPostContainer extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, { post: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "OpeningPostContainer",
    			options,
    			id: create_fragment$6.name
    		});
    	}

    	get post() {
    		throw new Error("<OpeningPostContainer>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set post(value) {
    		throw new Error("<OpeningPostContainer>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\ReplyInputContainer.svelte generated by Svelte v3.59.2 */

    const { console: console_1$3 } = globals;
    const file$5 = "src\\ReplyInputContainer.svelte";

    // (100:8) {#if threadID == null}
    function create_if_block_1$2(ctx) {
    	let input;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			input = element("input");
    			attr_dev(input, "type", "text");
    			attr_dev(input, "id", "subjectInput");
    			attr_dev(input, "placeholder", "Subject");
    			attr_dev(input, "name", "subject");
    			attr_dev(input, "class", "svelte-1q1be4z");
    			add_location(input, file$5, 100, 12, 2945);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, input, anchor);
    			set_input_value(input, /*boardPost*/ ctx[0].subject);

    			if (!mounted) {
    				dispose = listen_dev(input, "input", /*input_input_handler*/ ctx[6]);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*boardPost*/ 1 && input.value !== /*boardPost*/ ctx[0].subject) {
    				set_input_value(input, /*boardPost*/ ctx[0].subject);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(input);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$2.name,
    		type: "if",
    		source: "(100:8) {#if threadID == null}",
    		ctx
    	});

    	return block;
    }

    // (104:8) {#if imageSource != null}
    function create_if_block$4(ctx) {
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			if (!src_url_equal(img.src, img_src_value = /*imageSource*/ ctx[1])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "id", "imagePreview");
    			attr_dev(img, "alt", "");
    			attr_dev(img, "class", "svelte-1q1be4z");
    			add_location(img, file$5, 104, 12, 3227);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*imageSource*/ 2 && !src_url_equal(img.src, img_src_value = /*imageSource*/ ctx[1])) {
    				attr_dev(img, "src", img_src_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$4.name,
    		type: "if",
    		source: "(104:8) {#if imageSource != null}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$5(ctx) {
    	let div;
    	let form;
    	let input0;
    	let t0;
    	let t1;
    	let textarea;
    	let t2;
    	let t3;
    	let input1;
    	let t4;
    	let button;
    	let mounted;
    	let dispose;
    	let if_block0 = /*threadID*/ ctx[2] == null && create_if_block_1$2(ctx);
    	let if_block1 = /*imageSource*/ ctx[1] != null && create_if_block$4(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			form = element("form");
    			input0 = element("input");
    			t0 = space();
    			if (if_block0) if_block0.c();
    			t1 = space();
    			textarea = element("textarea");
    			t2 = space();
    			if (if_block1) if_block1.c();
    			t3 = space();
    			input1 = element("input");
    			t4 = space();
    			button = element("button");
    			button.textContent = "Submit";
    			attr_dev(input0, "type", "text");
    			attr_dev(input0, "id", "nameInput");
    			attr_dev(input0, "placeholder", "Name");
    			attr_dev(input0, "name", "name");
    			attr_dev(input0, "class", "svelte-1q1be4z");
    			add_location(input0, file$5, 98, 8, 2807);
    			attr_dev(textarea, "placeholder", "Comment");
    			attr_dev(textarea, "id", "textInput");
    			attr_dev(textarea, "name", "postText");
    			attr_dev(textarea, "class", "svelte-1q1be4z");
    			add_location(textarea, file$5, 102, 8, 3074);
    			attr_dev(input1, "type", "file");
    			attr_dev(input1, "id", "imageInput");
    			attr_dev(input1, "name", "userImage");
    			attr_dev(input1, "accept", "image/*");
    			attr_dev(input1, "class", "svelte-1q1be4z");
    			add_location(input1, file$5, 106, 8, 3298);
    			attr_dev(button, "id", "replySubmit");
    			attr_dev(button, "class", "svelte-1q1be4z");
    			add_location(button, file$5, 107, 8, 3405);
    			attr_dev(form, "action", apiURL + "/submitPost");
    			attr_dev(form, "enctype", "multipart/form-data");
    			attr_dev(form, "method", "post");
    			attr_dev(form, "id", "postForm");
    			attr_dev(form, "class", "svelte-1q1be4z");
    			add_location(form, file$5, 97, 4, 2702);
    			attr_dev(div, "class", "replyBox svelte-1q1be4z");
    			add_location(div, file$5, 96, 0, 2675);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, form);
    			append_dev(form, input0);
    			set_input_value(input0, /*boardPost*/ ctx[0].name);
    			append_dev(form, t0);
    			if (if_block0) if_block0.m(form, null);
    			append_dev(form, t1);
    			append_dev(form, textarea);
    			set_input_value(textarea, /*boardPost*/ ctx[0].postText);
    			append_dev(form, t2);
    			if (if_block1) if_block1.m(form, null);
    			append_dev(form, t3);
    			append_dev(form, input1);
    			append_dev(form, t4);
    			append_dev(form, button);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[5]),
    					listen_dev(textarea, "input", /*textarea_input_handler*/ ctx[7]),
    					listen_dev(input1, "change", /*setImagePreview*/ ctx[3], false, false, false, false),
    					listen_dev(button, "click", prevent_default(/*validateInputs*/ ctx[4]), false, true, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*boardPost*/ 1 && input0.value !== /*boardPost*/ ctx[0].name) {
    				set_input_value(input0, /*boardPost*/ ctx[0].name);
    			}

    			if (/*threadID*/ ctx[2] == null) if_block0.p(ctx, dirty);

    			if (dirty & /*boardPost*/ 1) {
    				set_input_value(textarea, /*boardPost*/ ctx[0].postText);
    			}

    			if (/*imageSource*/ ctx[1] != null) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block$4(ctx);
    					if_block1.c();
    					if_block1.m(form, t3);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('ReplyInputContainer', slots, []);
    	let urlparams = new URLSearchParams(window.location.search);
    	let threadID = urlparams.get('thread');
    	let boardID = urlparams.get('board');

    	let boardPost = {
    		"name": "Anonymous ",
    		"subject": "",
    		"posterID": "",
    		"replyToID": "",
    		"postText": "",
    		"boardID": ""
    	};

    	//let apiURL="http://127.0.0.1:30050/api/";
    	boardPost.replyToID = threadID;

    	boardPost.boardID = boardID;
    	let imageSource;

    	// Loads a preview of an image the user is about to upload, this is called when the file input is updated
    	function setImagePreview() {
    		let reader = new FileReader();
    		reader.readAsDataURL(document.getElementById("imageInput").files[0]);

    		reader.onloadend = function (readerData) {
    			$$invalidate(1, imageSource = readerData.target.result);
    		};
    	}

    	//Function to send the reply to the api
    	async function submitReply() {
    		console.log(boardPost);
    		let formData = new FormData(document.getElementById("postForm"));
    		formData.append('posterID', boardPost.posterID);
    		formData.append('boardID', boardPost.boardID);
    		formData.append('replyToID', boardPost.replyToID);
    		let url;

    		if (threadID != null) {
    			url = apiURL + "submitPost";
    		} else {
    			url = apiURL + "submitOp";
    		}

    		let res = await fetch(url, { method: 'POST', body: formData });
    		let status = await res.status;
    		let response = await res.json();
    		console.log(status);

    		if (status != 200) {
    			alert(response.error);
    		} else {
    			location.reload();
    		}
    	}

    	function validateInputs() {
    		submitReply();
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$3.warn(`<ReplyInputContainer> was created with unknown prop '${key}'`);
    	});

    	function input0_input_handler() {
    		boardPost.name = this.value;
    		$$invalidate(0, boardPost);
    	}

    	function input_input_handler() {
    		boardPost.subject = this.value;
    		$$invalidate(0, boardPost);
    	}

    	function textarea_input_handler() {
    		boardPost.postText = this.value;
    		$$invalidate(0, boardPost);
    	}

    	$$self.$capture_state = () => ({
    		apiURL,
    		urlparams,
    		threadID,
    		boardID,
    		boardPost,
    		imageSource,
    		setImagePreview,
    		submitReply,
    		validateInputs
    	});

    	$$self.$inject_state = $$props => {
    		if ('urlparams' in $$props) urlparams = $$props.urlparams;
    		if ('threadID' in $$props) $$invalidate(2, threadID = $$props.threadID);
    		if ('boardID' in $$props) boardID = $$props.boardID;
    		if ('boardPost' in $$props) $$invalidate(0, boardPost = $$props.boardPost);
    		if ('imageSource' in $$props) $$invalidate(1, imageSource = $$props.imageSource);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		boardPost,
    		imageSource,
    		threadID,
    		setImagePreview,
    		validateInputs,
    		input0_input_handler,
    		input_input_handler,
    		textarea_input_handler
    	];
    }

    class ReplyInputContainer extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ReplyInputContainer",
    			options,
    			id: create_fragment$5.name
    		});
    	}
    }

    /* src\TagSearchBox.svelte generated by Svelte v3.59.2 */

    const file$4 = "src\\TagSearchBox.svelte";

    function get_each_context$3(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[18] = list[i];
    	child_ctx[20] = i;
    	return child_ctx;
    }

    // (146:0) {#if filteredItems.length > 0}
    function create_if_block$3(ctx) {
    	let ul;
    	let each_value = /*filteredItems*/ ctx[2];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$3(get_each_context$3(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			ul = element("ul");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(ul, "id", "autocomplete-items-list");
    			attr_dev(ul, "class", "svelte-16vetbs");
    			add_location(ul, file$4, 146, 0, 6809);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, ul, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(ul, null);
    				}
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*hiLiteIndex, setInputVal, filteredItems*/ 76) {
    				each_value = /*filteredItems*/ ctx[2];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$3(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$3(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(ul, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(ul);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$3.name,
    		type: "if",
    		source: "(146:0) {#if filteredItems.length > 0}",
    		ctx
    	});

    	return block;
    }

    // (148:0) {#each filteredItems as item, i}
    function create_each_block$3(ctx) {
    	let li;
    	let raw_value = /*item*/ ctx[18] + "";
    	let t;
    	let mounted;
    	let dispose;

    	function click_handler() {
    		return /*click_handler*/ ctx[11](/*item*/ ctx[18]);
    	}

    	const block = {
    		c: function create() {
    			li = element("li");
    			t = space();
    			attr_dev(li, "class", "autocomplete-items svelte-16vetbs");
    			toggle_class(li, "autocomplete-active", /*i*/ ctx[20] === /*hiLiteIndex*/ ctx[3]);
    			add_location(li, file$4, 148, 4, 6886);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, li, anchor);
    			li.innerHTML = raw_value;
    			insert_dev(target, t, anchor);

    			if (!mounted) {
    				dispose = listen_dev(li, "click", click_handler, false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*filteredItems*/ 4 && raw_value !== (raw_value = /*item*/ ctx[18] + "")) li.innerHTML = raw_value;
    			if (dirty & /*hiLiteIndex*/ 8) {
    				toggle_class(li, "autocomplete-active", /*i*/ ctx[20] === /*hiLiteIndex*/ ctx[3]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(li);
    			if (detaching) detach_dev(t);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$3.name,
    		type: "each",
    		source: "(148:0) {#each filteredItems as item, i}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$4(ctx) {
    	let div;
    	let input;
    	let t;
    	let if_block_anchor;
    	let mounted;
    	let dispose;
    	let if_block = /*filteredItems*/ ctx[2].length > 0 && create_if_block$3(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			input = element("input");
    			t = space();
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    			attr_dev(input, "id", "search-input");
    			attr_dev(input, "name", "name");
    			attr_dev(input, "type", "text");
    			attr_dev(input, "placeholder", /*placeholder*/ ctx[1]);
    			attr_dev(input, "class", "svelte-16vetbs");
    			add_location(input, file$4, 138, 4, 6497);
    			attr_dev(div, "class", "autocomplete svelte-16vetbs");
    			add_location(div, file$4, 137, 0, 6465);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, input);
    			/*input_binding*/ ctx[9](input);
    			set_input_value(input, /*inputValue*/ ctx[0]);
    			insert_dev(target, t, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(window, "keydown", /*navigateList*/ ctx[7], false, false, false, false),
    					listen_dev(input, "input", /*input_input_handler*/ ctx[10]),
    					listen_dev(input, "input", /*filterItems*/ ctx[5], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*placeholder*/ 2) {
    				attr_dev(input, "placeholder", /*placeholder*/ ctx[1]);
    			}

    			if (dirty & /*inputValue*/ 1 && input.value !== /*inputValue*/ ctx[0]) {
    				set_input_value(input, /*inputValue*/ ctx[0]);
    			}

    			if (/*filteredItems*/ ctx[2].length > 0) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$3(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			/*input_binding*/ ctx[9](null);
    			if (detaching) detach_dev(t);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let hiLitedCountry;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('TagSearchBox', slots, []);

    	let { itemList = [
    		"Afghanistan",
    		"Albania",
    		"Algeria",
    		"Andorra",
    		"Angola",
    		"Anguilla",
    		"Antigua and Barbuda",
    		"Argentina",
    		"Armenia",
    		"Aruba",
    		"Australia",
    		"Austria",
    		"Azerbaijan",
    		"Bahamas",
    		"Bahrain",
    		"Bangladesh",
    		"Barbados",
    		"Belarus",
    		"Belgium",
    		"Belize",
    		"Benin",
    		"Bermuda",
    		"Bhutan",
    		"Bolivia",
    		"Bosnia and Herzegovina",
    		"Botswana",
    		"Brazil",
    		"British Virgin Islands",
    		"Brunei",
    		"Bulgaria",
    		"Burkina Faso",
    		"Burundi",
    		"Cambodia",
    		"Cameroon",
    		"Canada",
    		"Cape Verde",
    		"Cayman Islands",
    		"Central African Republic",
    		"Chad",
    		"Chile",
    		"China",
    		"Colombia",
    		"Congo",
    		"Cook Islands",
    		"Costa Rica",
    		"Cote D Ivoire",
    		"Croatia",
    		"Cuba",
    		"Curacao",
    		"Cyprus",
    		"Czech Republic",
    		"Denmark",
    		"Djibouti",
    		"Dominica",
    		"Dominican Republic",
    		"Ecuador",
    		"Egypt",
    		"El Salvador",
    		"Equatorial Guinea",
    		"Eritrea",
    		"Estonia",
    		"Ethiopia",
    		"Falkland Islands",
    		"Faroe Islands",
    		"Fiji",
    		"Finland",
    		"France",
    		"French Polynesia",
    		"French West Indies",
    		"Gabon",
    		"Gambia",
    		"Georgia",
    		"Germany",
    		"Ghana",
    		"Gibraltar",
    		"Greece",
    		"Greenland",
    		"Grenada",
    		"Guam",
    		"Guatemala",
    		"Guernsey",
    		"Guinea",
    		"Guinea Bissau",
    		"Guyana",
    		"Haiti",
    		"Honduras",
    		"Hong Kong",
    		"Hungary",
    		"Iceland",
    		"India",
    		"Indonesia",
    		"Iran",
    		"Iraq",
    		"Ireland",
    		"Isle of Man",
    		"Israel",
    		"Italy",
    		"Jamaica",
    		"Japan",
    		"Jersey",
    		"Jordan",
    		"Kazakhstan",
    		"Kenya",
    		"Kiribati",
    		"Kosovo",
    		"Kuwait",
    		"Kyrgyzstan",
    		"Laos",
    		"Latvia",
    		"Lebanon",
    		"Lesotho",
    		"Liberia",
    		"Libya",
    		"Liechtenstein",
    		"Lithuania",
    		"Luxembourg",
    		"Macau",
    		"Macedonia",
    		"Madagascar",
    		"Malawi",
    		"Malaysia",
    		"Maldives",
    		"Mali",
    		"Malta",
    		"Marshall Islands",
    		"Mauritania",
    		"Mauritius",
    		"Mexico",
    		"Micronesia",
    		"Moldova",
    		"Monaco",
    		"Mongolia",
    		"Montenegro",
    		"Montserrat",
    		"Morocco",
    		"Mozambique",
    		"Myanmar",
    		"Namibia",
    		"Nauro",
    		"Nepal",
    		"Netherlands",
    		"Netherlands Antilles",
    		"New Caledonia",
    		"New Zealand",
    		"Nicaragua",
    		"Niger",
    		"Nigeria",
    		"North Korea",
    		"Norway",
    		"Oman",
    		"Pakistan",
    		"Palau",
    		"Palestine",
    		"Panama",
    		"Papua New Guinea",
    		"Paraguay",
    		"Peru",
    		"Philippines",
    		"Poland",
    		"Portugal",
    		"Puerto Rico",
    		"Qatar",
    		"Reunion",
    		"Romania",
    		"Russia",
    		"Rwanda",
    		"Saint Pierre and Miquelon",
    		"Samoa",
    		"San Marino",
    		"Sao Tome and Principe",
    		"Saudi Arabia",
    		"Senegal",
    		"Serbia",
    		"Seychelles",
    		"Sierra Leone",
    		"Singapore",
    		"Slovakia",
    		"Slovenia",
    		"Solomon Islands",
    		"Somalia",
    		"South Africa",
    		"South Korea",
    		"South Sudan",
    		"Spain",
    		"Sri Lanka",
    		"St Kitts and Nevis",
    		"St Lucia",
    		"St Vincent",
    		"Sudan",
    		"Suriname",
    		"Swaziland",
    		"Sweden",
    		"Switzerland",
    		"Syria",
    		"Taiwan",
    		"Tajikistan",
    		"Tanzania",
    		"Thailand",
    		"Timor L'Este",
    		"Togo",
    		"Tonga",
    		"Trinidad and Tobago",
    		"Tunisia",
    		"Turkey",
    		"Turkmenistan",
    		"Turks and Caicos",
    		"Tuvalu",
    		"Uganda",
    		"Ukraine",
    		"United Arab Emirates",
    		"United Kingdom",
    		"United States of America",
    		"Uruguay",
    		"Uzbekistan",
    		"Vanuatu",
    		"Vatican City",
    		"Venezuela",
    		"Vietnam",
    		"Virgin Islands (US)",
    		"Yemen",
    		"Zambia",
    		"Zimbabwe"
    	] } = $$props;

    	let { placeholder = "Search Name" } = $$props;
    	let { inputValue = "" } = $$props;

    	/* FILTERING countres DATA BASED ON INPUT */
    	let filteredItems = [];

    	let itemLabel;
    	let highlighted;

    	// $: console.log(filteredCountries)	
    	const filterItems = () => {
    		let storageArr = [];

    		if (inputValue) {
    			itemList.forEach(item => {
    				if (item.toLowerCase().startsWith(inputValue.toLowerCase())) {
    					storageArr = [...storageArr, makeMatchBold(item)];
    				}
    			});
    		}

    		$$invalidate(2, filteredItems = storageArr);
    	};

    	/* HANDLING THE INPUT */
    	let searchInput; // use with bind:this to focus element

    	const clearInput = () => {
    		$$invalidate(0, inputValue = "");
    		searchInput.focus();
    	};

    	const setInputVal = countryName => {
    		$$invalidate(0, inputValue = removeBold(countryName));
    		$$invalidate(2, filteredItems = []);
    		$$invalidate(3, hiLiteIndex = null);
    		document.querySelector('#search-input').focus();
    	};

    	const makeMatchBold = str => {
    		// replace part of ( name === inputValue) with strong tags
    		let matched = str.substring(0, inputValue.length);

    		let makeBold = `<strong>${matched}</strong>`;
    		let boldedMatch = str.replace(matched, makeBold);
    		return boldedMatch;
    	};

    	const removeBold = str => {
    		//replace < and > all characters between
    		return str.replace(/<(.)*?>/g, "");
    	}; // return str.replace(/<(strong)>/g, "").replace(/<\/(strong)>/g, "");

    	/* NAVIGATING OVER THE LIST OF COUNTRIES W HIGHLIGHTING */
    	let hiLiteIndex = null;

    	const navigateList = e => {
    		if (e.key === "ArrowDown" && hiLiteIndex <= filteredItems.length - 1) {
    			hiLiteIndex === null
    			? $$invalidate(3, hiLiteIndex = 0)
    			: $$invalidate(3, hiLiteIndex += 1);
    		} else if (e.key === "ArrowUp" && hiLiteIndex !== null) {
    			hiLiteIndex === 0
    			? $$invalidate(3, hiLiteIndex = filteredItems.length - 1)
    			: $$invalidate(3, hiLiteIndex -= 1);
    		} else if (e.key === "Enter") {
    			setInputVal(filteredItems[hiLiteIndex]);
    		} else {
    			return;
    		}
    	};

    	const writable_props = ['itemList', 'placeholder', 'inputValue'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<TagSearchBox> was created with unknown prop '${key}'`);
    	});

    	function input_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			searchInput = $$value;
    			$$invalidate(4, searchInput);
    		});
    	}

    	function input_input_handler() {
    		inputValue = this.value;
    		$$invalidate(0, inputValue);
    	}

    	const click_handler = item => setInputVal(item);

    	$$self.$$set = $$props => {
    		if ('itemList' in $$props) $$invalidate(8, itemList = $$props.itemList);
    		if ('placeholder' in $$props) $$invalidate(1, placeholder = $$props.placeholder);
    		if ('inputValue' in $$props) $$invalidate(0, inputValue = $$props.inputValue);
    	};

    	$$self.$capture_state = () => ({
    		itemList,
    		placeholder,
    		inputValue,
    		filteredItems,
    		itemLabel,
    		highlighted,
    		filterItems,
    		searchInput,
    		clearInput,
    		setInputVal,
    		makeMatchBold,
    		removeBold,
    		hiLiteIndex,
    		navigateList,
    		hiLitedCountry
    	});

    	$$self.$inject_state = $$props => {
    		if ('itemList' in $$props) $$invalidate(8, itemList = $$props.itemList);
    		if ('placeholder' in $$props) $$invalidate(1, placeholder = $$props.placeholder);
    		if ('inputValue' in $$props) $$invalidate(0, inputValue = $$props.inputValue);
    		if ('filteredItems' in $$props) $$invalidate(2, filteredItems = $$props.filteredItems);
    		if ('itemLabel' in $$props) itemLabel = $$props.itemLabel;
    		if ('highlighted' in $$props) highlighted = $$props.highlighted;
    		if ('searchInput' in $$props) $$invalidate(4, searchInput = $$props.searchInput);
    		if ('hiLiteIndex' in $$props) $$invalidate(3, hiLiteIndex = $$props.hiLiteIndex);
    		if ('hiLitedCountry' in $$props) hiLitedCountry = $$props.hiLitedCountry;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*inputValue*/ 1) {
    			if (!inputValue) {
    				$$invalidate(2, filteredItems = []);
    				$$invalidate(3, hiLiteIndex = null);
    			}
    		}

    		if ($$self.$$.dirty & /*filteredItems, hiLiteIndex*/ 12) {
    			//$: console.log(hiLiteIndex);	
    			hiLitedCountry = filteredItems[hiLiteIndex];
    		}
    	};

    	return [
    		inputValue,
    		placeholder,
    		filteredItems,
    		hiLiteIndex,
    		searchInput,
    		filterItems,
    		setInputVal,
    		navigateList,
    		itemList,
    		input_binding,
    		input_input_handler,
    		click_handler
    	];
    }

    class TagSearchBox extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {
    			itemList: 8,
    			placeholder: 1,
    			inputValue: 0
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "TagSearchBox",
    			options,
    			id: create_fragment$4.name
    		});
    	}

    	get itemList() {
    		throw new Error("<TagSearchBox>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set itemList(value) {
    		throw new Error("<TagSearchBox>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get placeholder() {
    		throw new Error("<TagSearchBox>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set placeholder(value) {
    		throw new Error("<TagSearchBox>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get inputValue() {
    		throw new Error("<TagSearchBox>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set inputValue(value) {
    		throw new Error("<TagSearchBox>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\TagInputContainer.svelte generated by Svelte v3.59.2 */

    const { console: console_1$2 } = globals;
    const file$3 = "src\\TagInputContainer.svelte";

    function get_each_context$2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[9] = list[i];
    	return child_ctx;
    }

    // (89:4) {#if tags!=undefined && tags.length > 0}
    function create_if_block$2(ctx) {
    	let each_1_anchor;
    	let each_value = /*tags*/ ctx[1];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(target, anchor);
    				}
    			}

    			insert_dev(target, each_1_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*tags*/ 2) {
    				each_value = /*tags*/ ctx[1];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$2(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$2(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		d: function destroy(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(89:4) {#if tags!=undefined && tags.length > 0}",
    		ctx
    	});

    	return block;
    }

    // (90:2) {#each tags as tag}
    function create_each_block$2(ctx) {
    	let span;
    	let t0_value = /*tag*/ ctx[9].tagName + "";
    	let t0;
    	let t1;

    	const block = {
    		c: function create() {
    			span = element("span");
    			t0 = text(t0_value);
    			t1 = space();
    			attr_dev(span, "class", "tags");
    			add_location(span, file$3, 90, 3, 2576);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    			append_dev(span, t0);
    			append_dev(span, t1);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*tags*/ 2 && t0_value !== (t0_value = /*tag*/ ctx[9].tagName + "")) set_data_dev(t0, t0_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$2.name,
    		type: "each",
    		source: "(90:2) {#each tags as tag}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let div;
    	let t0;
    	let form;
    	let tagsearchbox;
    	let updating_inputValue;
    	let t1;
    	let input;
    	let t2;
    	let button;
    	let current;
    	let mounted;
    	let dispose;
    	let if_block = /*tags*/ ctx[1] != undefined && /*tags*/ ctx[1].length > 0 && create_if_block$2(ctx);

    	function tagsearchbox_inputValue_binding(value) {
    		/*tagsearchbox_inputValue_binding*/ ctx[3](value);
    	}

    	let tagsearchbox_props = {
    		itemList: ["bing", "google"],
    		placeholder: "Name"
    	};

    	if (/*boardPost*/ ctx[0].name !== void 0) {
    		tagsearchbox_props.inputValue = /*boardPost*/ ctx[0].name;
    	}

    	tagsearchbox = new TagSearchBox({
    			props: tagsearchbox_props,
    			$$inline: true
    		});

    	binding_callbacks.push(() => bind(tagsearchbox, 'inputValue', tagsearchbox_inputValue_binding));

    	const block = {
    		c: function create() {
    			div = element("div");
    			if (if_block) if_block.c();
    			t0 = space();
    			form = element("form");
    			create_component(tagsearchbox.$$.fragment);
    			t1 = space();
    			input = element("input");
    			t2 = text("-->\r\n        ");
    			button = element("button");
    			button.textContent = "Submit";
    			attr_dev(input, "type", "text");
    			attr_dev(input, "id", "nameInput");
    			attr_dev(input, "placeholder", "xyt");
    			attr_dev(input, "name", "postText");
    			attr_dev(input, "class", "svelte-6v8zid");
    			add_location(input, file$3, 95, 8, 2872);
    			attr_dev(button, "id", "replySubmit");
    			attr_dev(button, "class", "svelte-6v8zid");
    			add_location(button, file$3, 96, 8, 2986);
    			attr_dev(form, "action", apiURL + "/submitTag");
    			attr_dev(form, "enctype", "multipart/form-data");
    			attr_dev(form, "method", "post");
    			attr_dev(form, "id", "postForm");
    			attr_dev(form, "autocomplete", "off");
    			attr_dev(form, "class", "svelte-6v8zid");
    			add_location(form, file$3, 93, 4, 2641);
    			attr_dev(div, "class", "replyBox svelte-6v8zid");
    			add_location(div, file$3, 87, 0, 2480);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			if (if_block) if_block.m(div, null);
    			append_dev(div, t0);
    			append_dev(div, form);
    			mount_component(tagsearchbox, form, null);
    			append_dev(form, t1);
    			append_dev(form, input);
    			set_input_value(input, /*boardPost*/ ctx[0].postText);
    			append_dev(form, t2);
    			append_dev(form, button);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "input", /*input_input_handler*/ ctx[4]),
    					listen_dev(button, "click", prevent_default(/*validateInputs*/ ctx[2]), false, true, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*tags*/ ctx[1] != undefined && /*tags*/ ctx[1].length > 0) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$2(ctx);
    					if_block.c();
    					if_block.m(div, t0);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			const tagsearchbox_changes = {};

    			if (!updating_inputValue && dirty & /*boardPost*/ 1) {
    				updating_inputValue = true;
    				tagsearchbox_changes.inputValue = /*boardPost*/ ctx[0].name;
    				add_flush_callback(() => updating_inputValue = false);
    			}

    			tagsearchbox.$set(tagsearchbox_changes);

    			if (dirty & /*boardPost*/ 1 && input.value !== /*boardPost*/ ctx[0].postText) {
    				set_input_value(input, /*boardPost*/ ctx[0].postText);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(tagsearchbox.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(tagsearchbox.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (if_block) if_block.d();
    			destroy_component(tagsearchbox);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('TagInputContainer', slots, []);
    	let urlparams = new URLSearchParams(window.location.search);
    	let threadID = urlparams.get('thread');
    	let boardID = urlparams.get('board');

    	let boardPost = {
    		"name": "Anonymous ",
    		"subject": "",
    		"posterID": "",
    		"replyToID": "",
    		"postText": "",
    		"boardID": ""
    	};

    	let tags;

    	//let apiURL="http://127.0.0.1:30050/api/";
    	onMount(async () => {
    		$$invalidate(1, tags = await getTags());
    		$$invalidate(0, boardPost.replyToID = threadID, boardPost);
    		$$invalidate(0, boardPost.boardID = boardID, boardPost);
    	});

    	//Function to send the reply to the api
    	async function submitReply() {
    		console.log(boardPost);
    		let formData = new FormData(document.getElementById("postForm"));
    		formData.append('posterID', boardPost.posterID);
    		formData.append('boardID', boardPost.boardID);
    		formData.append('replyToID', boardPost.replyToID);

    		//for (const key of formData.keys()) {
    		//    console.log(key);
    		//}
    		let url;

    		url = apiURL + "submitTag";
    		let res = await fetch(url, { method: 'POST', body: formData });
    		let status = await res.status;
    		let response = await res.json();
    		console.log(status);

    		if (status != 200) {
    			alert(response.error);
    		} else {
    			location.reload();
    		}
    	}

    	function validateInputs() {
    		submitReply();
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$2.warn(`<TagInputContainer> was created with unknown prop '${key}'`);
    	});

    	function tagsearchbox_inputValue_binding(value) {
    		if ($$self.$$.not_equal(boardPost.name, value)) {
    			boardPost.name = value;
    			$$invalidate(0, boardPost);
    		}
    	}

    	function input_input_handler() {
    		boardPost.postText = this.value;
    		$$invalidate(0, boardPost);
    	}

    	$$self.$capture_state = () => ({
    		onMount,
    		apiURL,
    		getTags,
    		TagSearchBox,
    		urlparams,
    		threadID,
    		boardID,
    		boardPost,
    		tags,
    		submitReply,
    		validateInputs
    	});

    	$$self.$inject_state = $$props => {
    		if ('urlparams' in $$props) urlparams = $$props.urlparams;
    		if ('threadID' in $$props) threadID = $$props.threadID;
    		if ('boardID' in $$props) boardID = $$props.boardID;
    		if ('boardPost' in $$props) $$invalidate(0, boardPost = $$props.boardPost);
    		if ('tags' in $$props) $$invalidate(1, tags = $$props.tags);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		boardPost,
    		tags,
    		validateInputs,
    		tagsearchbox_inputValue_binding,
    		input_input_handler
    	];
    }

    class TagInputContainer extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "TagInputContainer",
    			options,
    			id: create_fragment$3.name
    		});
    	}
    }

    /* src\NavBar.svelte generated by Svelte v3.59.2 */

    const { console: console_1$1 } = globals;
    const file$2 = "src\\NavBar.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[14] = list[i];
    	return child_ctx;
    }

    // (103:8) {#if boardPairs != undefined}
    function create_if_block_4$1(ctx) {
    	let if_block_anchor;
    	let if_block = /*boardPairs*/ ctx[0].length > 0 && create_if_block_5$1(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (/*boardPairs*/ ctx[0].length > 0) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_5$1(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4$1.name,
    		type: "if",
    		source: "(103:8) {#if boardPairs != undefined}",
    		ctx
    	});

    	return block;
    }

    // (104:12) {#if boardPairs.length > 0}
    function create_if_block_5$1(ctx) {
    	let each_1_anchor;
    	let each_value = /*boardPairs*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(target, anchor);
    				}
    			}

    			insert_dev(target, each_1_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*url, boardPairs*/ 17) {
    				each_value = /*boardPairs*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		d: function destroy(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_5$1.name,
    		type: "if",
    		source: "(104:12) {#if boardPairs.length > 0}",
    		ctx
    	});

    	return block;
    }

    // (105:16) {#each boardPairs as boardPair}
    function create_each_block$1(ctx) {
    	let li;
    	let a;
    	let t0;
    	let t1_value = /*boardPair*/ ctx[14].boardID + "";
    	let t1;
    	let t2;
    	let a_href_value;

    	const block = {
    		c: function create() {
    			li = element("li");
    			a = element("a");
    			t0 = text("/");
    			t1 = text(t1_value);
    			t2 = text("/");
    			attr_dev(a, "href", a_href_value = "" + (/*url*/ ctx[4] + "?board=" + /*boardPair*/ ctx[14].boardID));
    			add_location(a, file$2, 105, 42, 2873);
    			attr_dev(li, "class", "boardLink svelte-nxmcc7");
    			add_location(li, file$2, 105, 20, 2851);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, li, anchor);
    			append_dev(li, a);
    			append_dev(a, t0);
    			append_dev(a, t1);
    			append_dev(a, t2);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*boardPairs*/ 1 && t1_value !== (t1_value = /*boardPair*/ ctx[14].boardID + "")) set_data_dev(t1, t1_value);

    			if (dirty & /*boardPairs*/ 1 && a_href_value !== (a_href_value = "" + (/*url*/ ctx[4] + "?board=" + /*boardPair*/ ctx[14].boardID))) {
    				attr_dev(a, "href", a_href_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(li);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(105:16) {#each boardPairs as boardPair}",
    		ctx
    	});

    	return block;
    }

    // (115:8) {:else}
    function create_else_block$1(ctx) {
    	let li;
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			li = element("li");
    			button = element("button");
    			button.textContent = "Reply";
    			attr_dev(button, "id", "replyButton");
    			attr_dev(button, "class", "svelte-nxmcc7");
    			add_location(button, file$2, 115, 16, 3336);
    			attr_dev(li, "class", "svelte-nxmcc7");
    			add_location(li, file$2, 115, 12, 3332);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, li, anchor);
    			append_dev(li, button);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*toggleReplyBox*/ ctx[5], false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(li);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$1.name,
    		type: "else",
    		source: "(115:8) {:else}",
    		ctx
    	});

    	return block;
    }

    // (111:8) {#if threadID == null}
    function create_if_block_2$1(ctx) {
    	let if_block_anchor;
    	let if_block = /*boardID*/ ctx[9] != null && create_if_block_3$1(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (/*boardID*/ ctx[9] != null) if_block.p(ctx, dirty);
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2$1.name,
    		type: "if",
    		source: "(111:8) {#if threadID == null}",
    		ctx
    	});

    	return block;
    }

    // (112:12) {#if boardID != null}
    function create_if_block_3$1(ctx) {
    	let li;
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			li = element("li");
    			button = element("button");
    			button.textContent = "New Thread";
    			attr_dev(button, "id", "replyButton");
    			attr_dev(button, "class", "svelte-nxmcc7");
    			add_location(button, file$2, 112, 20, 3210);
    			attr_dev(li, "class", "svelte-nxmcc7");
    			add_location(li, file$2, 112, 16, 3206);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, li, anchor);
    			append_dev(li, button);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*toggleReplyBox*/ ctx[5], false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(li);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3$1.name,
    		type: "if",
    		source: "(112:12) {#if boardID != null}",
    		ctx
    	});

    	return block;
    }

    // (121:0) {#if showReplyBox}
    function create_if_block_1$1(ctx) {
    	let replyinputcontainer;
    	let current;
    	replyinputcontainer = new ReplyInputContainer({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(replyinputcontainer.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(replyinputcontainer, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(replyinputcontainer.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(replyinputcontainer.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(replyinputcontainer, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$1.name,
    		type: "if",
    		source: "(121:0) {#if showReplyBox}",
    		ctx
    	});

    	return block;
    }

    // (124:0) {#if showTagEditBox}
    function create_if_block$1(ctx) {
    	let taginputcontainer;
    	let current;
    	taginputcontainer = new TagInputContainer({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(taginputcontainer.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(taginputcontainer, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(taginputcontainer.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(taginputcontainer.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(taginputcontainer, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(124:0) {#if showTagEditBox}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let aside;
    	let ul;
    	let li0;
    	let a;
    	let p;
    	let t1;
    	let t2;
    	let li1;
    	let input;
    	let t3;
    	let t4;
    	let li2;
    	let button;
    	let t6;
    	let t7;
    	let if_block3_anchor;
    	let current;
    	let mounted;
    	let dispose;
    	let if_block0 = /*boardPairs*/ ctx[0] != undefined && create_if_block_4$1(ctx);

    	function select_block_type(ctx, dirty) {
    		if (/*threadID*/ ctx[8] == null) return create_if_block_2$1;
    		return create_else_block$1;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block1 = current_block_type(ctx);
    	let if_block2 = /*showReplyBox*/ ctx[1] && create_if_block_1$1(ctx);
    	let if_block3 = /*showTagEditBox*/ ctx[2] && create_if_block$1(ctx);

    	const block = {
    		c: function create() {
    			aside = element("aside");
    			ul = element("ul");
    			li0 = element("li");
    			a = element("a");
    			p = element("p");
    			p.textContent = "Image-Browser";
    			t1 = space();
    			if (if_block0) if_block0.c();
    			t2 = space();
    			li1 = element("li");
    			input = element("input");
    			t3 = space();
    			if_block1.c();
    			t4 = space();
    			li2 = element("li");
    			button = element("button");
    			button.textContent = "Reply";
    			t6 = space();
    			if (if_block2) if_block2.c();
    			t7 = space();
    			if (if_block3) if_block3.c();
    			if_block3_anchor = empty();
    			attr_dev(p, "class", "svelte-nxmcc7");
    			add_location(p, file$2, 101, 28, 2674);
    			attr_dev(a, "href", /*url*/ ctx[4]);
    			add_location(a, file$2, 101, 12, 2658);
    			attr_dev(li0, "class", "svelte-nxmcc7");
    			add_location(li0, file$2, 101, 8, 2654);
    			attr_dev(input, "id", "searchInput");
    			attr_dev(input, "label", "Search");
    			attr_dev(input, "type", "text");
    			attr_dev(input, "class", "svelte-nxmcc7");
    			add_location(input, file$2, 109, 12, 3014);
    			attr_dev(li1, "class", "svelte-nxmcc7");
    			add_location(li1, file$2, 109, 8, 3010);
    			attr_dev(button, "id", "tagEditButton");
    			attr_dev(button, "class", "svelte-nxmcc7");
    			add_location(button, file$2, 117, 12, 3433);
    			attr_dev(li2, "class", "svelte-nxmcc7");
    			add_location(li2, file$2, 117, 8, 3429);
    			attr_dev(ul, "class", "svelte-nxmcc7");
    			add_location(ul, file$2, 100, 4, 2641);
    			attr_dev(aside, "class", "topBar svelte-nxmcc7");
    			add_location(aside, file$2, 99, 0, 2614);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, aside, anchor);
    			append_dev(aside, ul);
    			append_dev(ul, li0);
    			append_dev(li0, a);
    			append_dev(a, p);
    			append_dev(ul, t1);
    			if (if_block0) if_block0.m(ul, null);
    			append_dev(ul, t2);
    			append_dev(ul, li1);
    			append_dev(li1, input);
    			set_input_value(input, /*searchString*/ ctx[3]);
    			append_dev(ul, t3);
    			if_block1.m(ul, null);
    			append_dev(ul, t4);
    			append_dev(ul, li2);
    			append_dev(li2, button);
    			insert_dev(target, t6, anchor);
    			if (if_block2) if_block2.m(target, anchor);
    			insert_dev(target, t7, anchor);
    			if (if_block3) if_block3.m(target, anchor);
    			insert_dev(target, if_block3_anchor, anchor);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "input", /*input_input_handler*/ ctx[10]),
    					listen_dev(input, "change", /*dispatchSearch*/ ctx[7], false, false, false, false),
    					listen_dev(button, "click", /*toggleTagBox*/ ctx[6], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*boardPairs*/ ctx[0] != undefined) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_4$1(ctx);
    					if_block0.c();
    					if_block0.m(ul, t2);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (dirty & /*searchString*/ 8 && input.value !== /*searchString*/ ctx[3]) {
    				set_input_value(input, /*searchString*/ ctx[3]);
    			}

    			if_block1.p(ctx, dirty);

    			if (/*showReplyBox*/ ctx[1]) {
    				if (if_block2) {
    					if (dirty & /*showReplyBox*/ 2) {
    						transition_in(if_block2, 1);
    					}
    				} else {
    					if_block2 = create_if_block_1$1(ctx);
    					if_block2.c();
    					transition_in(if_block2, 1);
    					if_block2.m(t7.parentNode, t7);
    				}
    			} else if (if_block2) {
    				group_outros();

    				transition_out(if_block2, 1, 1, () => {
    					if_block2 = null;
    				});

    				check_outros();
    			}

    			if (/*showTagEditBox*/ ctx[2]) {
    				if (if_block3) {
    					if (dirty & /*showTagEditBox*/ 4) {
    						transition_in(if_block3, 1);
    					}
    				} else {
    					if_block3 = create_if_block$1(ctx);
    					if_block3.c();
    					transition_in(if_block3, 1);
    					if_block3.m(if_block3_anchor.parentNode, if_block3_anchor);
    				}
    			} else if (if_block3) {
    				group_outros();

    				transition_out(if_block3, 1, 1, () => {
    					if_block3 = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block2);
    			transition_in(if_block3);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block2);
    			transition_out(if_block3);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(aside);
    			if (if_block0) if_block0.d();
    			if_block1.d();
    			if (detaching) detach_dev(t6);
    			if (if_block2) if_block2.d(detaching);
    			if (detaching) detach_dev(t7);
    			if (if_block3) if_block3.d(detaching);
    			if (detaching) detach_dev(if_block3_anchor);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('NavBar', slots, []);
    	let { boardPairs = [] } = $$props;
    	const dispatch = createEventDispatcher();

    	const fruits = [
    		"Açaí",
    		"Akee",
    		"Apple",
    		"Apricot",
    		"Avocado",
    		"Banana",
    		"Bilberry",
    		"Black sapote"
    	];

    	let showReplyBox = false;
    	let showTagEditBox = false;
    	let searchString = "";
    	let url = document.URL.substr(0, document.URL.lastIndexOf("/") + 1);

    	function toggleReplyBox() {
    		$$invalidate(1, showReplyBox = !showReplyBox);
    	}

    	function toggleTagBox() {
    		$$invalidate(2, showTagEditBox = !showTagEditBox);
    	}

    	function dispatchSearch() {
    		dispatch('message', { text: searchString });
    	}

    	console.log(boardPairs.size);
    	let urlparams = new URLSearchParams(window.location.search);
    	let threadID = urlparams.get('thread');
    	let boardID = urlparams.get('board');
    	const writable_props = ['boardPairs'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$1.warn(`<NavBar> was created with unknown prop '${key}'`);
    	});

    	function input_input_handler() {
    		searchString = this.value;
    		$$invalidate(3, searchString);
    	}

    	$$self.$$set = $$props => {
    		if ('boardPairs' in $$props) $$invalidate(0, boardPairs = $$props.boardPairs);
    	};

    	$$self.$capture_state = () => ({
    		boardPairs,
    		createEventDispatcher,
    		ReplyInputContainer,
    		TagInputContainer,
    		dispatch,
    		fruits,
    		showReplyBox,
    		showTagEditBox,
    		searchString,
    		url,
    		toggleReplyBox,
    		toggleTagBox,
    		dispatchSearch,
    		urlparams,
    		threadID,
    		boardID
    	});

    	$$self.$inject_state = $$props => {
    		if ('boardPairs' in $$props) $$invalidate(0, boardPairs = $$props.boardPairs);
    		if ('showReplyBox' in $$props) $$invalidate(1, showReplyBox = $$props.showReplyBox);
    		if ('showTagEditBox' in $$props) $$invalidate(2, showTagEditBox = $$props.showTagEditBox);
    		if ('searchString' in $$props) $$invalidate(3, searchString = $$props.searchString);
    		if ('url' in $$props) $$invalidate(4, url = $$props.url);
    		if ('urlparams' in $$props) urlparams = $$props.urlparams;
    		if ('threadID' in $$props) $$invalidate(8, threadID = $$props.threadID);
    		if ('boardID' in $$props) $$invalidate(9, boardID = $$props.boardID);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		boardPairs,
    		showReplyBox,
    		showTagEditBox,
    		searchString,
    		url,
    		toggleReplyBox,
    		toggleTagBox,
    		dispatchSearch,
    		threadID,
    		boardID,
    		input_input_handler
    	];
    }

    class NavBar extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { boardPairs: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "NavBar",
    			options,
    			id: create_fragment$2.name
    		});
    	}

    	get boardPairs() {
    		throw new Error("<NavBar>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set boardPairs(value) {
    		throw new Error("<NavBar>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\Viewer.svelte generated by Svelte v3.59.2 */
    const file$1 = "src\\Viewer.svelte";

    function create_fragment$1(ctx) {
    	let div;
    	let p;
    	let t1;
    	let img;
    	let img_src_value;
    	let img_alt_value;

    	const block = {
    		c: function create() {
    			div = element("div");
    			p = element("p");
    			p.textContent = "Viewer";
    			t1 = space();
    			img = element("img");
    			add_location(p, file$1, 46, 28, 1563);
    			attr_dev(img, "class", "postImage");
    			if (!src_url_equal(img.src, img_src_value = /*imagePath*/ ctx[1])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", img_alt_value = /*post*/ ctx[0].fileName);
    			add_location(img, file$1, 47, 4, 1582);
    			attr_dev(div, "class", "viewContainer svelte-16tekwk");
    			add_location(div, file$1, 46, 0, 1535);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, p);
    			append_dev(div, t1);
    			append_dev(div, img);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*imagePath*/ 2 && !src_url_equal(img.src, img_src_value = /*imagePath*/ ctx[1])) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (dirty & /*post*/ 1 && img_alt_value !== (img_alt_value = /*post*/ ctx[0].fileName)) {
    				attr_dev(img, "alt", img_alt_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Viewer', slots, []);

    	let { post = {
    		"postID": 11,
    		"name": "Anonymous ",
    		"subject": "gthaeg",
    		"posterID": null,
    		"dateTime": "2023-07-02 15:13:37",
    		"fileName": "2fa881f952bddb8cae6a28f096eb9542.jpeg",
    		"postText": "egte",
    		"fileExt": "jpeg",
    		"replyToID": null
    	} } = $$props;

    	let imagePath, thumbPath;
    	let showThumb = true;
    	let url = document.URL.substring(0, document.URL.lastIndexOf("/") + 1);

    	function buildImagePath(post) {
    		//Set file paths if the post has a file
    		if (post.fileName.length > 0) {
    			$$invalidate(1, imagePath = "images/" + (post.replyToID ? post.replyToID : post.postID) + "/" + post.postID + "." + post.fileExt);
    			thumbPath = "images/" + (post.replyToID ? post.replyToID : post.postID) + "/thumb_" + post.postID + "." + post.fileExt;
    		}
    	}

    	//receive the image to display from main-app
    	window.addEventListener('message', function (event) {
    		//alert(`Received ${event.data} from ${event.origin}`);
    		if (event.data.post != undefined) {
    			//
    			$$invalidate(0, post = event.data.post);

    			buildImagePath(post);
    		}
    	});

    	const writable_props = ['post'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Viewer> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('post' in $$props) $$invalidate(0, post = $$props.post);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		glob,
    		post,
    		imagePath,
    		thumbPath,
    		showThumb,
    		url,
    		buildImagePath
    	});

    	$$self.$inject_state = $$props => {
    		if ('post' in $$props) $$invalidate(0, post = $$props.post);
    		if ('imagePath' in $$props) $$invalidate(1, imagePath = $$props.imagePath);
    		if ('thumbPath' in $$props) thumbPath = $$props.thumbPath;
    		if ('showThumb' in $$props) showThumb = $$props.showThumb;
    		if ('url' in $$props) url = $$props.url;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [post, imagePath];
    }

    class Viewer extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { post: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Viewer",
    			options,
    			id: create_fragment$1.name
    		});
    	}

    	get post() {
    		throw new Error("<Viewer>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set post(value) {
    		throw new Error("<Viewer>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\App.svelte generated by Svelte v3.59.2 */

    const { console: console_1 } = globals;
    const file = "src\\App.svelte";

    function get_each_context_2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[24] = list[i];
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[19] = list[i];
    	return child_ctx;
    }

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[19] = list[i];
    	return child_ctx;
    }

    // (147:1) {:else}
    function create_else_block(ctx) {
    	let t0;
    	let t1;
    	let t2;
    	let current_block_type_index;
    	let if_block3;
    	let if_block3_anchor;
    	let current;
    	let if_block0 = /*boardIndex*/ ctx[3] != undefined && create_if_block_15(ctx);
    	let if_block1 = /*boardIndex*/ ctx[3] != undefined && create_if_block_13(ctx);
    	let if_block2 = /*boardPairs*/ ctx[2] != undefined && create_if_block_11(ctx);
    	const if_block_creators = [create_if_block_1, create_else_block_5];
    	const if_blocks = [];

    	function select_block_type_1(ctx, dirty) {
    		if (/*boardID*/ ctx[8] || /*threadID*/ ctx[7]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type_1(ctx);
    	if_block3 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			if (if_block0) if_block0.c();
    			t0 = space();
    			if (if_block1) if_block1.c();
    			t1 = space();
    			if (if_block2) if_block2.c();
    			t2 = space();
    			if_block3.c();
    			if_block3_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block0) if_block0.m(target, anchor);
    			insert_dev(target, t0, anchor);
    			if (if_block1) if_block1.m(target, anchor);
    			insert_dev(target, t1, anchor);
    			if (if_block2) if_block2.m(target, anchor);
    			insert_dev(target, t2, anchor);
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert_dev(target, if_block3_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (/*boardIndex*/ ctx[3] != undefined) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_15(ctx);
    					if_block0.c();
    					if_block0.m(t0.parentNode, t0);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*boardIndex*/ ctx[3] != undefined) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_13(ctx);
    					if_block1.c();
    					if_block1.m(t1.parentNode, t1);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (/*boardPairs*/ ctx[2] != undefined) {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);

    					if (dirty & /*boardPairs*/ 4) {
    						transition_in(if_block2, 1);
    					}
    				} else {
    					if_block2 = create_if_block_11(ctx);
    					if_block2.c();
    					transition_in(if_block2, 1);
    					if_block2.m(t2.parentNode, t2);
    				}
    			} else if (if_block2) {
    				group_outros();

    				transition_out(if_block2, 1, 1, () => {
    					if_block2 = null;
    				});

    				check_outros();
    			}

    			if_block3.p(ctx, dirty);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block2);
    			transition_in(if_block3);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block2);
    			transition_out(if_block3);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block0) if_block0.d(detaching);
    			if (detaching) detach_dev(t0);
    			if (if_block1) if_block1.d(detaching);
    			if (detaching) detach_dev(t1);
    			if (if_block2) if_block2.d(detaching);
    			if (detaching) detach_dev(t2);
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach_dev(if_block3_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(147:1) {:else}",
    		ctx
    	});

    	return block;
    }

    // (145:1) {#if isViewer}
    function create_if_block(ctx) {
    	let viewer;
    	let current;
    	viewer = new Viewer({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(viewer.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(viewer, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(viewer.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(viewer.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(viewer, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(145:1) {#if isViewer}",
    		ctx
    	});

    	return block;
    }

    // (148:2) {#if boardIndex != undefined}
    function create_if_block_15(ctx) {
    	let if_block_anchor;
    	let if_block = /*boardPairs*/ ctx[2].length > 0 && create_if_block_16(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (/*boardPairs*/ ctx[2].length > 0) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_16(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_15.name,
    		type: "if",
    		source: "(148:2) {#if boardIndex != undefined}",
    		ctx
    	});

    	return block;
    }

    // (149:3) {#if boardPairs.length > 0}
    function create_if_block_16(ctx) {
    	let div;
    	let h1;
    	let t0;
    	let t1_value = /*boardPairs*/ ctx[2][/*boardIndex*/ ctx[3]].boardID + "";
    	let t1;
    	let t2;
    	let t3_value = /*boardPairs*/ ctx[2][/*boardIndex*/ ctx[3]].boardName + "";
    	let t3;

    	const block = {
    		c: function create() {
    			div = element("div");
    			h1 = element("h1");
    			t0 = text("/");
    			t1 = text(t1_value);
    			t2 = text("/ - ");
    			t3 = text(t3_value);
    			add_location(h1, file, 150, 5, 3869);
    			attr_dev(div, "class", "boardBanner svelte-1yvb74k");
    			add_location(div, file, 149, 4, 3838);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h1);
    			append_dev(h1, t0);
    			append_dev(h1, t1);
    			append_dev(h1, t2);
    			append_dev(h1, t3);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*boardPairs, boardIndex*/ 12 && t1_value !== (t1_value = /*boardPairs*/ ctx[2][/*boardIndex*/ ctx[3]].boardID + "")) set_data_dev(t1, t1_value);
    			if (dirty & /*boardPairs, boardIndex*/ 12 && t3_value !== (t3_value = /*boardPairs*/ ctx[2][/*boardIndex*/ ctx[3]].boardName + "")) set_data_dev(t3, t3_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_16.name,
    		type: "if",
    		source: "(149:3) {#if boardPairs.length > 0}",
    		ctx
    	});

    	return block;
    }

    // (157:2) {#if boardIndex != undefined}
    function create_if_block_13(ctx) {
    	let if_block_anchor;
    	let if_block = /*boardPairs*/ ctx[2].length > 0 && create_if_block_14(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (/*boardPairs*/ ctx[2].length > 0) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_14(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_13.name,
    		type: "if",
    		source: "(157:2) {#if boardIndex != undefined}",
    		ctx
    	});

    	return block;
    }

    // (158:3) {#if boardPairs.length > 0}
    function create_if_block_14(ctx) {
    	let div;
    	let h1;
    	let t0;
    	let t1_value = /*boardPairs*/ ctx[2][/*boardIndex*/ ctx[3]].boardID + "";
    	let t1;
    	let t2;
    	let t3_value = /*boardPairs*/ ctx[2][/*boardIndex*/ ctx[3]].boardName + "";
    	let t3;

    	const block = {
    		c: function create() {
    			div = element("div");
    			h1 = element("h1");
    			t0 = text("/");
    			t1 = text(t1_value);
    			t2 = text("/ - ");
    			t3 = text(t3_value);
    			add_location(h1, file, 159, 5, 4129);
    			attr_dev(div, "class", "boardBanner svelte-1yvb74k");
    			add_location(div, file, 158, 4, 4098);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h1);
    			append_dev(h1, t0);
    			append_dev(h1, t1);
    			append_dev(h1, t2);
    			append_dev(h1, t3);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*boardPairs, boardIndex*/ 12 && t1_value !== (t1_value = /*boardPairs*/ ctx[2][/*boardIndex*/ ctx[3]].boardID + "")) set_data_dev(t1, t1_value);
    			if (dirty & /*boardPairs, boardIndex*/ 12 && t3_value !== (t3_value = /*boardPairs*/ ctx[2][/*boardIndex*/ ctx[3]].boardName + "")) set_data_dev(t3, t3_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_14.name,
    		type: "if",
    		source: "(158:3) {#if boardPairs.length > 0}",
    		ctx
    	});

    	return block;
    }

    // (165:2) {#if boardPairs != undefined}
    function create_if_block_11(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = /*boardPairs*/ ctx[2].length > 0 && create_if_block_12(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (/*boardPairs*/ ctx[2].length > 0) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*boardPairs*/ 4) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block_12(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_11.name,
    		type: "if",
    		source: "(165:2) {#if boardPairs != undefined}",
    		ctx
    	});

    	return block;
    }

    // (166:3) {#if boardPairs.length > 0}
    function create_if_block_12(ctx) {
    	let navbar;
    	let current;

    	navbar = new NavBar({
    			props: { boardPairs: /*boardPairs*/ ctx[2] },
    			$$inline: true
    		});

    	navbar.$on("message", /*handleSearch*/ ctx[10]);

    	const block = {
    		c: function create() {
    			create_component(navbar.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(navbar, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const navbar_changes = {};
    			if (dirty & /*boardPairs*/ 4) navbar_changes.boardPairs = /*boardPairs*/ ctx[2];
    			navbar.$set(navbar_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(navbar.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(navbar.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(navbar, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_12.name,
    		type: "if",
    		source: "(166:3) {#if boardPairs.length > 0}",
    		ctx
    	});

    	return block;
    }

    // (203:2) {:else}
    function create_else_block_5(ctx) {
    	let div;
    	let img;
    	let img_src_value;
    	let t;
    	let if_block = /*boardPairs*/ ctx[2] != undefined && create_if_block_9(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			img = element("img");
    			t = space();
    			if (if_block) if_block.c();
    			attr_dev(img, "class", "rinImage svelte-1yvb74k");
    			if (!src_url_equal(img.src, img_src_value = "./images/site/rinImage.jpg")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "");
    			add_location(img, file, 204, 4, 5270);
    			attr_dev(div, "class", "home svelte-1yvb74k");
    			add_location(div, file, 203, 3, 5247);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, img);
    			append_dev(div, t);
    			if (if_block) if_block.m(div, null);
    		},
    		p: function update(ctx, dirty) {
    			if (/*boardPairs*/ ctx[2] != undefined) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_9(ctx);
    					if_block.c();
    					if_block.m(div, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (if_block) if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_5.name,
    		type: "else",
    		source: "(203:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (171:2) {#if boardID || threadID}
    function create_if_block_1(ctx) {
    	let div;
    	let current_block_type_index;
    	let if_block;
    	let current;
    	const if_block_creators = [create_if_block_2, create_if_block_6, create_else_block_4];
    	const if_blocks = [];

    	function select_block_type_2(ctx, dirty) {
    		if (/*searching*/ ctx[4]) return 0;
    		if (/*posts*/ ctx[1] != undefined) return 1;
    		return 2;
    	}

    	current_block_type_index = select_block_type_2(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if_block.c();
    			attr_dev(div, "class", "posts svelte-1yvb74k");
    			add_location(div, file, 171, 2, 4534);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			if_blocks[current_block_type_index].m(div, null);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type_2(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(div, null);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if_blocks[current_block_type_index].d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(171:2) {#if boardID || threadID}",
    		ctx
    	});

    	return block;
    }

    // (206:4) {#if boardPairs != undefined}
    function create_if_block_9(ctx) {
    	let if_block_anchor;
    	let if_block = /*boardPairs*/ ctx[2].length > 0 && create_if_block_10(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (/*boardPairs*/ ctx[2].length > 0) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_10(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_9.name,
    		type: "if",
    		source: "(206:4) {#if boardPairs != undefined}",
    		ctx
    	});

    	return block;
    }

    // (207:5) {#if boardPairs.length > 0}
    function create_if_block_10(ctx) {
    	let each_1_anchor;
    	let each_value_2 = /*boardPairs*/ ctx[2];
    	validate_each_argument(each_value_2);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_2.length; i += 1) {
    		each_blocks[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
    	}

    	const block = {
    		c: function create() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(target, anchor);
    				}
    			}

    			insert_dev(target, each_1_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*url, boardPairs*/ 516) {
    				each_value_2 = /*boardPairs*/ ctx[2];
    				validate_each_argument(each_value_2);
    				let i;

    				for (i = 0; i < each_value_2.length; i += 1) {
    					const child_ctx = get_each_context_2(ctx, each_value_2, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_2(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_2.length;
    			}
    		},
    		d: function destroy(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_10.name,
    		type: "if",
    		source: "(207:5) {#if boardPairs.length > 0}",
    		ctx
    	});

    	return block;
    }

    // (208:6) {#each boardPairs as boardPair}
    function create_each_block_2(ctx) {
    	let h2;
    	let a;
    	let t0;
    	let t1_value = /*boardPair*/ ctx[24].boardID + "";
    	let t1;
    	let t2;
    	let t3_value = /*boardPair*/ ctx[24].boardName + "";
    	let t3;
    	let a_href_value;

    	const block = {
    		c: function create() {
    			h2 = element("h2");
    			a = element("a");
    			t0 = text("/");
    			t1 = text(t1_value);
    			t2 = text("/ - ");
    			t3 = text(t3_value);
    			attr_dev(a, "href", a_href_value = "" + (/*url*/ ctx[9] + "?board=" + /*boardPair*/ ctx[24].boardID));
    			attr_dev(a, "class", "svelte-1yvb74k");
    			add_location(a, file, 208, 11, 5450);
    			add_location(h2, file, 208, 7, 5446);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h2, anchor);
    			append_dev(h2, a);
    			append_dev(a, t0);
    			append_dev(a, t1);
    			append_dev(a, t2);
    			append_dev(a, t3);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*boardPairs*/ 4 && t1_value !== (t1_value = /*boardPair*/ ctx[24].boardID + "")) set_data_dev(t1, t1_value);
    			if (dirty & /*boardPairs*/ 4 && t3_value !== (t3_value = /*boardPair*/ ctx[24].boardName + "")) set_data_dev(t3, t3_value);

    			if (dirty & /*boardPairs*/ 4 && a_href_value !== (a_href_value = "" + (/*url*/ ctx[9] + "?board=" + /*boardPair*/ ctx[24].boardID))) {
    				attr_dev(a, "href", a_href_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_2.name,
    		type: "each",
    		source: "(208:6) {#each boardPairs as boardPair}",
    		ctx
    	});

    	return block;
    }

    // (198:4) {:else}
    function create_else_block_4(ctx) {
    	let h1;

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "No Posts Found";
    			add_location(h1, file, 198, 5, 5182);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_4.name,
    		type: "else",
    		source: "(198:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (188:4) {#if posts != undefined}
    function create_if_block_6(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = /*posts*/ ctx[1].length > 0 && create_if_block_7(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (/*posts*/ ctx[1].length > 0) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*posts*/ 2) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block_7(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_6.name,
    		type: "if",
    		source: "(188:4) {#if posts != undefined}",
    		ctx
    	});

    	return block;
    }

    // (173:3) {#if searching}
    function create_if_block_2(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block_3, create_else_block_2];
    	const if_blocks = [];

    	function select_block_type_3(ctx, dirty) {
    		if (/*searchPosts*/ ctx[5] != undefined) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type_3(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type_3(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(173:3) {#if searching}",
    		ctx
    	});

    	return block;
    }

    // (189:5) {#if posts.length > 0}
    function create_if_block_7(ctx) {
    	let each_1_anchor;
    	let current;
    	let each_value_1 = /*posts*/ ctx[1];
    	validate_each_argument(each_value_1);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(target, anchor);
    				}
    			}

    			insert_dev(target, each_1_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*posts*/ 2) {
    				each_value_1 = /*posts*/ ctx[1];
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block_1(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				group_outros();

    				for (i = each_value_1.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value_1.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_7.name,
    		type: "if",
    		source: "(189:5) {#if posts.length > 0}",
    		ctx
    	});

    	return block;
    }

    // (193:7) {:else}
    function create_else_block_3(ctx) {
    	let postcontainer;
    	let current;

    	postcontainer = new PostContainer({
    			props: { post: /*post*/ ctx[19] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(postcontainer.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(postcontainer, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const postcontainer_changes = {};
    			if (dirty & /*posts*/ 2) postcontainer_changes.post = /*post*/ ctx[19];
    			postcontainer.$set(postcontainer_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(postcontainer.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(postcontainer.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(postcontainer, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_3.name,
    		type: "else",
    		source: "(193:7) {:else}",
    		ctx
    	});

    	return block;
    }

    // (191:7) {#if post.replyToID == null}
    function create_if_block_8(ctx) {
    	let openingpostcontainer;
    	let current;

    	openingpostcontainer = new OpeningPostContainer({
    			props: { post: /*post*/ ctx[19] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(openingpostcontainer.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(openingpostcontainer, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const openingpostcontainer_changes = {};
    			if (dirty & /*posts*/ 2) openingpostcontainer_changes.post = /*post*/ ctx[19];
    			openingpostcontainer.$set(openingpostcontainer_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(openingpostcontainer.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(openingpostcontainer.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(openingpostcontainer, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_8.name,
    		type: "if",
    		source: "(191:7) {#if post.replyToID == null}",
    		ctx
    	});

    	return block;
    }

    // (190:6) {#each posts as post}
    function create_each_block_1(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block_8, create_else_block_3];
    	const if_blocks = [];

    	function select_block_type_5(ctx, dirty) {
    		if (/*post*/ ctx[19].replyToID == null) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type_5(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type_5(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(190:6) {#each posts as post}",
    		ctx
    	});

    	return block;
    }

    // (184:4) {:else}
    function create_else_block_2(ctx) {
    	let h1;

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "No Posts Found";
    			add_location(h1, file, 184, 5, 4864);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_2.name,
    		type: "else",
    		source: "(184:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (174:4) {#if searchPosts != undefined}
    function create_if_block_3(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = /*searchPosts*/ ctx[5].length > 0 && create_if_block_4(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (/*searchPosts*/ ctx[5].length > 0) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*searchPosts*/ 32) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block_4(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(174:4) {#if searchPosts != undefined}",
    		ctx
    	});

    	return block;
    }

    // (175:5) {#if searchPosts.length > 0}
    function create_if_block_4(ctx) {
    	let each_1_anchor;
    	let current;
    	let each_value = /*searchPosts*/ ctx[5];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(target, anchor);
    				}
    			}

    			insert_dev(target, each_1_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*searchPosts*/ 32) {
    				each_value = /*searchPosts*/ ctx[5];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4.name,
    		type: "if",
    		source: "(175:5) {#if searchPosts.length > 0}",
    		ctx
    	});

    	return block;
    }

    // (179:7) {:else}
    function create_else_block_1(ctx) {
    	let postcontainer;
    	let current;

    	postcontainer = new PostContainer({
    			props: { post: /*post*/ ctx[19] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(postcontainer.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(postcontainer, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const postcontainer_changes = {};
    			if (dirty & /*searchPosts*/ 32) postcontainer_changes.post = /*post*/ ctx[19];
    			postcontainer.$set(postcontainer_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(postcontainer.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(postcontainer.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(postcontainer, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_1.name,
    		type: "else",
    		source: "(179:7) {:else}",
    		ctx
    	});

    	return block;
    }

    // (177:7) {#if post.replyToID == null}
    function create_if_block_5(ctx) {
    	let openingpostcontainer;
    	let current;

    	openingpostcontainer = new OpeningPostContainer({
    			props: { post: /*post*/ ctx[19] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(openingpostcontainer.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(openingpostcontainer, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const openingpostcontainer_changes = {};
    			if (dirty & /*searchPosts*/ 32) openingpostcontainer_changes.post = /*post*/ ctx[19];
    			openingpostcontainer.$set(openingpostcontainer_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(openingpostcontainer.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(openingpostcontainer.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(openingpostcontainer, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_5.name,
    		type: "if",
    		source: "(177:7) {#if post.replyToID == null}",
    		ctx
    	});

    	return block;
    }

    // (176:6) {#each searchPosts as post}
    function create_each_block(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block_5, create_else_block_1];
    	const if_blocks = [];

    	function select_block_type_4(ctx, dirty) {
    		if (/*post*/ ctx[19].replyToID == null) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type_4(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type_4(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(176:6) {#each searchPosts as post}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let section;
    	let h1;
    	let t0;
    	let t1;
    	let t2;
    	let current_block_type_index;
    	let if_block;
    	let current;
    	const if_block_creators = [create_if_block, create_else_block];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*isViewer*/ ctx[0]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			section = element("section");
    			h1 = element("h1");
    			t0 = text("The count is ");
    			t1 = text(/*count_value*/ ctx[6]);
    			t2 = space();
    			if_block.c();
    			add_location(h1, file, 143, 1, 3698);
    			attr_dev(section, "class", "svelte-1yvb74k");
    			add_location(section, file, 142, 0, 3687);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, section, anchor);
    			append_dev(section, h1);
    			append_dev(h1, t0);
    			append_dev(h1, t1);
    			append_dev(section, t2);
    			if_blocks[current_block_type_index].m(section, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (!current || dirty & /*count_value*/ 64) set_data_dev(t1, /*count_value*/ ctx[6]);
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(section, null);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
    			if_blocks[current_block_type_index].d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let { isViewer = false } = $$props;
    	let posts;
    	let boardPairs, tags;
    	let urlparams = new URLSearchParams(window.location.search);
    	let threadID = urlparams.get('thread');
    	let boardID = urlparams.get('board');
    	let boardIndex;
    	let boardsRes;

    	//let apiURL="http://127.0.0.1:30050/api/";
    	let apiURL$1 = apiURL;

    	let searching = false;
    	let searchPosts = [];
    	let count_value;
    	let url = document.URL.substring(0, document.URL.lastIndexOf("/") + 1);

    	onMount(async () => {
    		//viewHandle.set(null);
    		get_store_value(viewHandle);

    		viewHandle.subscribe(value => {
    			if (value) {
    				$$invalidate(6, count_value = value.document.title);
    			}
    		});

    		$$invalidate(2, boardPairs = await getBoards());
    		tags = await getTags();
    		$$invalidate(3, boardIndex = getBoardIndex());

    		if (threadID != null) {
    			$$invalidate(1, posts = await getThread(urlparams.get('thread')));
    		} else if (boardID) {
    			$$invalidate(1, posts = await getOps(boardID));
    		} else ; //display home
    	});

    	function getBoardIndex() {
    		for (let i = 0; i < boardPairs.length; i++) {
    			if (boardPairs[i].boardID == boardID) {
    				return i;
    			}
    		}
    	}

    	// Fucntion to search the posts array and copy posts containing the search string to a new array
    	function handleSearch(event) {
    		$$invalidate(5, searchPosts = []);
    		$$invalidate(4, searching = true);
    		console.log("search: " + event.detail.text);

    		if (event.detail.text != "") {
    			for (let i = 0; i < posts.length; i++) {
    				if (posts[i].postText.includes(event.detail.text) || posts[i].subject.includes(event.detail.text)) {
    					console.log("found post containing searchString: " + posts[i]);
    					searchPosts.push(posts[i]);
    				}
    			}
    		} else {
    			$$invalidate(4, searching = false);
    		}
    	}

    	//Function to get a list of boardPairs from the api
    	async function getBoards() {
    		const res = await fetch(apiURL$1 + "boards");
    		boardsRes = await res.json();
    		return boardsRes;
    	}

    	//Function to get a list of Opening Posts from the api
    	async function getOps(board) {
    		const res = await fetch(apiURL$1 + "posts?board=" + board);
    		return await res.json();
    	}

    	//Function to get a list of posts from the api for a particular thread result[0] is an opening post and the rest are replies to that post
    	async function getThread(threadID) {
    		const res = await fetch(apiURL$1 + "posts?thread=" + threadID);
    		return await res.json();
    	}

    	const writable_props = ['isViewer'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('isViewer' in $$props) $$invalidate(0, isViewer = $$props.isViewer);
    	};

    	$$self.$capture_state = () => ({
    		isViewer,
    		PostContainer,
    		OpeningPostContainer,
    		onMount,
    		NavBar,
    		Viewer,
    		glob,
    		viewHandle,
    		get: get_store_value,
    		ReplyInputContainer,
    		each,
    		posts,
    		boardPairs,
    		tags,
    		urlparams,
    		threadID,
    		boardID,
    		boardIndex,
    		boardsRes,
    		apiURL: apiURL$1,
    		searching,
    		searchPosts,
    		count_value,
    		url,
    		getBoardIndex,
    		handleSearch,
    		getBoards,
    		getOps,
    		getThread
    	});

    	$$self.$inject_state = $$props => {
    		if ('isViewer' in $$props) $$invalidate(0, isViewer = $$props.isViewer);
    		if ('posts' in $$props) $$invalidate(1, posts = $$props.posts);
    		if ('boardPairs' in $$props) $$invalidate(2, boardPairs = $$props.boardPairs);
    		if ('tags' in $$props) tags = $$props.tags;
    		if ('urlparams' in $$props) urlparams = $$props.urlparams;
    		if ('threadID' in $$props) $$invalidate(7, threadID = $$props.threadID);
    		if ('boardID' in $$props) $$invalidate(8, boardID = $$props.boardID);
    		if ('boardIndex' in $$props) $$invalidate(3, boardIndex = $$props.boardIndex);
    		if ('boardsRes' in $$props) boardsRes = $$props.boardsRes;
    		if ('apiURL' in $$props) apiURL$1 = $$props.apiURL;
    		if ('searching' in $$props) $$invalidate(4, searching = $$props.searching);
    		if ('searchPosts' in $$props) $$invalidate(5, searchPosts = $$props.searchPosts);
    		if ('count_value' in $$props) $$invalidate(6, count_value = $$props.count_value);
    		if ('url' in $$props) $$invalidate(9, url = $$props.url);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		isViewer,
    		posts,
    		boardPairs,
    		boardIndex,
    		searching,
    		searchPosts,
    		count_value,
    		threadID,
    		boardID,
    		url,
    		handleSearch
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { isViewer: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}

    	get isViewer() {
    		throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set isViewer(value) {
    		throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		isViewer: (document.title==="Viewer")  //
    	}
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
