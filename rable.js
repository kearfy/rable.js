class Rable {
    #root = null;
    #ready = false;
    #listeners = {};
    #components = {};
    data = {};
    functions = {};

    constructor(options = {}) {
        const eventTransporter = new EventTarget;
        this.eventTransporter = eventTransporter;

        const validator = {
            get: (target, key) => {
                if (typeof target[key] === 'object' && target[key] !== null) {
                    return new Proxy(target[key], validator)
                } else {
                    return target[key];
                }
            },
            set: (obj, prop, value) => {
                if (typeof value == 'function') value = value.bind(this.data);
                obj[prop] = value;
                eventTransporter.dispatchEvent(new CustomEvent('triggerListeners', { detail: { listeners: 'data:updated', additionalInformation: prop } } ));
                return true;
            }
        }

        this.data = new Proxy({}, validator);
        if (options.data) Object.keys(options.data).forEach(key => this.data[key] = options.data[key]);
        this.addEventListeners();
    }

    addEventListeners() {
        this.eventTransporter.addEventListener('triggerListeners', e => this.triggerListeners(e.detail.listeners, e.detail.additionalInformation));
        this.eventTransporter.addEventListener('retrieveData', e => e.detail.resolve(this.data));
        this.eventTransporter.addEventListener('retrieveScopeData', e => e.detail.resolve(this.data));
        this.eventTransporter.addEventListener('registerListener', e => {
            if (!this.#listeners[e.detail.type]) this.#listeners[e.detail.type] = [];
            this.#listeners[e.detail.type].push(e.detail.listener);
        });
    }

    triggerListeners(listener, additionalInformation) {
        if (!this.#ready) return false;
        if (this.#listeners[listener]) {
            this.#listeners[listener].forEach(listener => listener(additionalInformation));
            return true;
        } else {
            return false;
        }
    }

    async importComponent(name, path, raw = null) {
        name = name.toLowerCase();
        if (this.#components[name]) return false;
        if (!raw) raw = await (await fetch(path)).text();
        this.#components[name] = raw;
        return true;
    }

    mount(query) {
        let queried = document.querySelector(query);
        if (queried) {
            this.#root = queried;
            processElementAttributes(this.#root, this.eventTransporter, this.#components);
            processTextNodes(this.#root, this.eventTransporter);
            this.#ready = true;
            this.triggerListeners('data:updated', false);
            return true;
        } else {
            return false;
        }
    }
}

function processTextNodes(el, eventTransporter) {
    let nodes = el.childNodes;
    nodes.forEach(node => {
        if (!node.parentNode.doNotProcessTextNodes) {
            const activeEventTransporter = (node.eventTransporter ? node.eventTransporter : eventTransporter);
            if (node.nodeName == '#text') {
                node.originalData = node.data;
                let matches = [...node.data.matchAll(/{{(.*?)}}/g)];
                if (matches.length > 0) matches.forEach(match => {
                    activeEventTransporter.dispatchEvent(new CustomEvent('registerListener', {
                        detail: {
                            type: 'data:updated',
                            listener: async () => {
                                const data = await new Promise(resolve => activeEventTransporter.dispatchEvent(new CustomEvent('retrieveData', { detail: { resolve } })));
                                const scopeData = await new Promise(resolve => activeEventTransporter.dispatchEvent(new CustomEvent('retrieveScopeData', { detail: { resolve } })));                                
                                node.data = node.originalData.replaceAll(/{{(.*?)}}/g, (match, target) => {
                                    let keys = Object.keys(data);
                                    keys.push('return ' + target);
                                    let runner = Function.apply({}, keys);
                                    try {
                                        let res = runner.apply(scopeData, Object.values(data));
                                        return res;
                                    } catch(e) {
                                        console.error(e);
                                        return undefined;
                                    }
                                });
                            }
                        }
                    }));
                });
            } else if (node.childNodes.length > 0) {
                if (node.getAttribute('rable:norender') !== null || node.getAttribute('rbl:norender') !== null || node.getAttribute(':norender') !== null || node.getAttribute('rable:no-render') !== null || node.getAttribute('rbl:no-render') !== null || node.getAttribute(':no-render') !== null) return;
                processTextNodes(node, activeEventTransporter);
            }
        }
    });
}

function processElementAttributes(el, eventTransporter, components) {
    const logic_if = [];
    var latestif = 0;

    // IF - ELSEIF - ELSE
    eventTransporter.dispatchEvent(new CustomEvent('registerListener', {
        detail: {
            type: 'data:updated',
            listener: async () => {
                for(var i = 0; i < logic_if.length; i++) {
                    var prevRes = false;
                    const logic = logic_if[i];

                    for(var j = 0; j < logic.length; j++) {
                        const block = logic[j];
                        if (!prevRes) {
                            if (block.validator) {
                                const data = await new Promise(resolve => eventTransporter.dispatchEvent(new CustomEvent('retrieveData', { detail: { resolve } })));
                                const scopeData = await new Promise(resolve => eventTransporter.dispatchEvent(new CustomEvent('retrieveScopeData', { detail: { resolve } })));
                                let keys = Object.keys(data);
                                keys.push('return ' + block.validator);
                                let runner = Function.apply({}, keys);
                                try {
                                    prevRes = runner.apply(scopeData, Object.values(data));
                                    if (prevRes) {
                                        block.node.style.display = null;
                                    } else {
                                        block.node.style.display = 'none';
                                    }
                                } catch(e) {
                                    console.error(e);
                                    block.node.style.display = 'none';
                                }
                            } else {
                                block.node.style.display = null;
                            }
                        } else {
                            block.node.style.display = 'none';
                        }
                    }
                }
            }
        }
    }));

    let nodes = el.childNodes;
    nodes.forEach(node => {
        const originalNode = node.cloneNode(true);
        if (node.nodeName != '#text' && (node.getAttribute('rable:norender') !== null || node.getAttribute('rbl:norender') !== null || node.getAttribute(':norender') !== null || node.getAttribute('rable:no-render') !== null || node.getAttribute('rbl:no-render') !== null || node.getAttribute(':no-render') !== null)) return;
        if (node.nodeName != '#text') {
            var component = null;
            if (Object.keys(components).includes(node.nodeName.toLowerCase())) {
                component = {
                    identifier: 'component-' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
                    parsed: document.createElement('parsed'),
                    eventTransporter: new EventTarget,
                    listeners: {},
                    events: {},
                    data: {}
                };

                const originalEventTransporter = eventTransporter;
                const validator = {
                    get: (target, key) => {
                        if (typeof target[key] === 'object' && target[key] !== null) {
                            return new Proxy(target[key], validator)
                        } else {
                            return target[key];
                        }
                    },
                    set: (obj, prop, value) => {
                        if (typeof value == 'function') value = value.bind(this.data);
                        obj[prop] = value;
                        component.eventTransporter.dispatchEvent(new CustomEvent('triggerListeners', { detail: { listeners: 'data:updated', additionalInformation: prop } } ));
                        return true;
                    }
                }

                component.parsed.innerHTML = components[node.nodeName.toLowerCase()];

                component.data = new Proxy({}, validator);
                if (component.parsed.querySelector('data')) {
                    try {
                        let data = JSON.parse(component.parsed.querySelector('data').innerText);
                        Object.keys(data).forEach(key => component.data[key] = data[key]);
                    } catch(e) {
                        console.error("Failed to parse data from component: ", e);
                    }
                }
                
                component.eventTransporter.addEventListener('retrieveData', e => e.detail.resolve(component.data));                        
                component.eventTransporter.addEventListener('retrieveScopeData', e => e.detail.resolve(component.data));
                component.eventTransporter.addEventListener('triggerListeners', e => {
                    if (component.listeners[e.detail.listeners]) {
                        component.listeners[e.detail.listeners].forEach(listener => listener(e.detail.additionalInformation));
                        return true;
                    } else {
                        return false;
                    }
                });

                component.eventTransporter.addEventListener('registerListener', e => {
                    if (!component.listeners[e.detail.type]) component.listeners[e.detail.type] = [];
                    component.listeners[e.detail.type].push(e.detail.listener);
                });

                component.eventTransporter.addEventListener('triggerComponentEvent', async e => {
                    if (component.events[e.detail.event]) {
                        const data = await new Promise(resolve => originalEventTransporter.dispatchEvent(new CustomEvent('retrieveData', { detail: { resolve } })));
                        const scopeData = await new Promise(resolve => originalEventTransporter.dispatchEvent(new CustomEvent('retrieveScopeData', { detail: { resolve } })));
                        component.events[e.detail.event].forEach(runnerCode => {
                            const localData = {...data};
                            localData.event = e.detail.eventPayload;
                            localData.componentData = component.data;
                            let keys = Object.keys(localData);
                            keys.push(runnerCode);
                            let runner = Function.apply(localData, keys);
                            try {
                                runner.apply(scopeData, Object.values(localData));
                            } catch(e) {
                                console.error(e);
                            }
                        })
                    }
                })

                component.style = component.parsed.querySelector('style');
                component.style.setAttribute('component-identifier', component.identifier);
                component.style.innerText = component.style.innerText.replaceAll('\n', '').replaceAll(/(.*?)\{(.*?)}/gm, match => match.split('{')[0].split(',').map(target => 'body [component-identifier=' + component.identifier + '] ' + target.trim()).join(', ') + ' {' + match.split('{')[1]);
                document.head.appendChild(component.style);

                component.replacement = component.parsed.querySelector('component').children[0];
                component.replacement.eventTransporter = component.eventTransporter;
                node.parentNode.setAttribute('component-identifier', component.identifier);
                node.parentNode.replaceChild(component.replacement, node);
                node = component.replacement;

                // originalEventTransporter.dispatchEvent(new CustomEvent('registerListener', {
                //     detail: {
                //         type: 'data:updated',
                //         listener: additionalInformation => component.eventTransporter.dispatchEvent(new CustomEvent('triggerListeners', { detail: { listeners: 'data:updated', additionalInformation: additionalInformation } } ))
                //     }
                // }));

                [...originalNode.attributes].forEach(async attribute => {
                    var attrName = attribute.name;
                    if (attrName.slice(0, 1) == '@') attrName = ':on:' + attrName.slice(1);
                    if (attrName.slice(0, 1) == '$') attrName = ':data:' + attrName.slice(1);
                    if (attrName.slice(0, 1) == '&') attrName = ':bind:' + attrName.slice(1);
                    if (attrName.slice(0, 1) == ':' || attrName.slice(0, 4) == 'rbl:' || attrName.slice(0, 6) == 'rable:') {
                        let processedName = attrName.split(':').slice(1);
                        if (processedName[0]) switch(processedName[0]) {
                            case 'on':
                            case 'event':
                                if (processedName[1] && attribute.value !== '') {
                                    if (!component.events[processedName[1]]) component.events[processedName[1]] = [];
                                    component.events[processedName[1]].push(attribute.value);
                                }
        
                                break;
                            case 'bind':
                                if (processedName[1]) {
                                    const originalData = await new Promise(resolve => originalEventTransporter.dispatchEvent(new CustomEvent('retrieveData', { detail: { resolve } })));
                                    const origin = processedName[1];
                                    const target = (attribute.value !== '' ? attribute.value : origin);
                                    component.data[target] = originalData[origin];

                                    originalEventTransporter.dispatchEvent(new CustomEvent('registerListener', {
                                        detail: {
                                            type: 'data:updated',
                                            listener: async item => {
                                                if (item == origin) {
                                                    const denyList = ['object', 'function']
                                                    if (denyList.includes(typeof originalData[origin]) || denyList.includes(typeof component.data[target])) {
                                                        console.error('Cannot sync objects or functions.');
                                                    } else if (component.data[target] !== originalData[origin]) {
                                                        component.data[target] = originalData[origin];
                                                    }
                                                }
                                            }
                                        }
                                    }));

                                    component.eventTransporter.dispatchEvent(new CustomEvent('registerListener', {
                                        detail: {
                                            type: 'data:updated',
                                            listener: async item => {
                                                if (item == target) {
                                                    const denyList = ['object', 'function']
                                                    if (denyList.includes(typeof originalData[origin]) || denyList.includes(typeof component.data[target])) {
                                                        console.error('Cannot sync objects or functions.');
                                                    } else if (originalData[origin] !== component.data[target]) {
                                                        originalData[origin] = component.data[target];
                                                    }
                                                }
                                            }
                                        }
                                    }));
                                }

                                break;
                            case 'data':
                                if (processedName[1] && attribute.value !== '') component.data[processedName[1]] = attribute.value;
                                break;
                        }
                    }
                });
            }

            const activeEventTransporter = (node.eventTransporter ? node.eventTransporter : eventTransporter);
            if (node.childNodes.length > 0) processElementAttributes(node, activeEventTransporter, components);
            [...node.attributes].forEach(async attribute => {
                var attrName = attribute.name;
                if (attrName.slice(0, 1) == '@') attrName = ':on:' + attrName.slice(1);
                if (attrName.slice(0, 1) == ':' || attrName.slice(0, 4) == 'rbl:' || attrName.slice(0, 6) == 'rable:') {
                    let processedName = attrName.split(':').slice(1);
                    if (processedName[0]) switch(processedName[0]) {
                        case 'on':
                        case 'event':
                            if (processedName[1]) {
                                if (attribute.value !== '') {
                                    const data = await new Promise(resolve => activeEventTransporter.dispatchEvent(new CustomEvent('retrieveData', { detail: { resolve } })));
                                    const scopeData = await new Promise(resolve => activeEventTransporter.dispatchEvent(new CustomEvent('retrieveScopeData', { detail: { resolve } })));
                                    node.addEventListener(processedName[1], e => {
                                        const localData = {...data};
                                        localData.event = e;
                                        let keys = Object.keys(localData);
                                        keys.push(attribute.value);
                                        let runner = Function.apply(localData, keys);
                                        try {
                                            runner.apply(scopeData, Object.values(localData));
                                        } catch(e) {
                                            console.error(e);
                                        }
                                    });
                                } 
                                
                                if (processedName[2]) {
                                    node.addEventListener(processedName[1], e => activeEventTransporter.dispatchEvent(new CustomEvent('triggerComponentEvent', {
                                        detail: {
                                            event: processedName[2],
                                            eventPayload: e
                                        }
                                    })));
                                }

                                node.removeAttribute(attribute.name);
                            }
    
                            break;
                        case 'for':
                            const forIdentifier = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                            const parentNode = node.parentNode;
                            const clonedNode = node.cloneNode(true);
                            clonedNode.removeAttribute(attribute.name);

                            node.doNotProcessTextNodes = true;
                            node.forIdentifier = forIdentifier;
                            node.forMasterNode = true;
                            node.style.display = 'none';
                            
                            activeEventTransporter.dispatchEvent(new CustomEvent('registerListener', {
                                detail: {
                                    type: 'data:updated',
                                    listener: async () => {
                                        const data = await new Promise(resolve => activeEventTransporter.dispatchEvent(new CustomEvent('retrieveData', { detail: { resolve } })));
                                        const asloop = (res => (res.length > 0 ? res[0].slice(1, 4) : null))([...attribute.value.matchAll(/^(.*)\sas\s(.*)\s\=\>\s(.*)$/g)]),
                                              inloop = (res => (res.length > 0 ? res[0].slice(1, 3) : null))([...attribute.value.matchAll(/^(.*)\sin\s(.*)$/g)]);

                                        if (asloop) {
                                            var target = asloop[0];
                                            var key = asloop[1];
                                            var value = asloop[2];
                                        } else if (inloop) {
                                            var target = inloop[1];
                                            var key = null;
                                            var value = inloop[0];
                                        } else {
                                            console.error(attribute.value, "is not a valid loop statement.");
                                            return;
                                        }

                                        var lastNode = null;
                                        var masterNode = null;
                                        [...parentNode.children].forEach(el => {
                                            if (el.forIdentifier == forIdentifier) {
                                                if (el.forMasterNode) {
                                                    masterNode = el;
                                                } else {
                                                    el.parentNode.removeChild(el);
                                                }
                                            }
                                        });

                                        if (typeof data[target] == 'object') {
                                            const keys = Object.keys(data[target]);
                                            const values = Object.values(data[target]);
                                            for (var i = 0; i < keys.length; i++) {
                                                const item = keys[i];
                                                const replacementNode = clonedNode.cloneNode(true);
                                                const updatedData = {...data};
                                                updatedData[value] = data[target][item];
                                                if (key) updatedData[key] = item;

                                                const temporaryEventTransporter = new EventTarget;
                                                temporaryEventTransporter.addEventListener('retrieveData', e => e.detail.resolve(updatedData));   
                                                temporaryEventTransporter.addEventListener('registerListener', e => e.detail.listener());                                     
                                                temporaryEventTransporter.addEventListener('retrieveScopeData', e => e.detail.resolve(data));

                                                processElementAttributes(replacementNode, temporaryEventTransporter, components);
                                                processTextNodes(replacementNode, temporaryEventTransporter);
                                                replacementNode.forIdentifier = forIdentifier;

                                                if (lastNode) {
                                                    parentNode.insertBefore(replacementNode, (processedName.includes('reverse') || processedName.includes('reversed') ? lastNode : lastNode.nextSibling));
                                                    lastNode = replacementNode;
                                                } else {
                                                    replacementNode.forMasterNode = true;
                                                    lastNode = replacementNode;
                                                    if (masterNode) {
                                                        parentNode.replaceChild(replacementNode, masterNode);
                                                    } else {
                                                        parentNode.appendChild(replacementNode);
                                                    }
                                                }
                                            }
                                        } else {
                                            console.error("Targeted data-item is not a valid object.");
                                        }
                                    }
                                }
                            }));
                            break;
                        case 'value':
                            if (typeof node.value == 'string') {
                                const data = await new Promise(resolve => activeEventTransporter.dispatchEvent(new CustomEvent('retrieveData', { detail: { resolve } })));
                                node.value = data[attribute.value];
                                activeEventTransporter.dispatchEvent(new CustomEvent('registerListener', {
                                    detail: {
                                        type: 'data:updated',
                                        listener: async item => {
                                            if (item == attribute.value) {
                                                const denyList = ['object', 'function']
                                                if (denyList.includes(typeof node.value) || denyList.includes(typeof data[attribute.value])) {
                                                    console.error('Cannot sync objects or functions.');
                                                } else if (node.value !== data[attribute.value]) {
                                                    node.value = data[attribute.value];
                                                }
                                            }
                                        }
                                    }
                                }));

                                node.addEventListener('input', e => {
                                    const denyList = ['object', 'function']
                                    if (denyList.includes(typeof node.value) || denyList.includes(typeof data[attribute.value])) {
                                        console.error('Cannot sync objects or functions.');
                                    } else if (node.value !== data[attribute.value]) {
                                        data[attribute.value] = node.value;
                                    }
                                });
                            } else if (node.isContentEditable) {
                                const data = await new Promise(resolve => activeEventTransporter.dispatchEvent(new CustomEvent('retrieveData', { detail: { resolve } })));
                                node.innerText = data[attribute.value];
                                activeEventTransporter.dispatchEvent(new CustomEvent('registerListener', {
                                    detail: {
                                        type: 'data:updated',
                                        listener: async item => {
                                            if (item == attribute.value) {
                                                const denyList = ['object', 'function']
                                                if (denyList.includes(typeof node.innerText) || denyList.includes(typeof data[attribute.value])) {
                                                    console.error('Cannot sync objects or functions.');
                                                } else if (node.innerText !== data[attribute.value]) {
                                                    node.innerText = data[attribute.value];
                                                }
                                            }
                                        }
                                    }
                                }));

                                node.addEventListener('input', e => {
                                    const denyList = ['object', 'function']
                                    if (denyList.includes(typeof node.innerText) || denyList.includes(typeof data[attribute.value])) {
                                        console.error('Cannot sync objects or functions.');
                                    } else if (node.innerText !== data[attribute.value]) {
                                        data[attribute.value] = node.innerText;
                                    }
                                });
                            }
                            break;
                        case 'checked':
                            if (typeof node.checked == 'boolean') {
                                const data = await new Promise(resolve => activeEventTransporter.dispatchEvent(new CustomEvent('retrieveData', { detail: { resolve } })));
                                activeEventTransporter.dispatchEvent(new CustomEvent('registerListener', {
                                    detail: {
                                        type: 'data:updated',
                                        listener: async () => {
                                            if (item == attribute.value) {
                                                if (node.checked !== data[attribute.value]) node.checked = data[attribute.value];
                                            }
                                        }
                                    }
                                }));

                                node.addEventListener('input', e => {
                                    if (data[attribute.value] !== node.checked) data[attribute.value] = node.checked;
                                });
                            }
                            break;
                        case 'if':
                            if (logic_if[latestif]) latestif++;
                            logic_if[latestif] = [];
                            logic_if[latestif].push({
                                node: node,
                                validator: attribute.value
                            });
                            break;
                        case 'elseif':
                        case 'else-if':
                            if (!logic_if[latestif]) {
                                console.error("If statement should start with if block!");
                            } else {
                                logic_if[latestif].push({
                                    node: node,
                                    validator: attribute.value
                                });
                            }
                            break;
                        case 'else':
                            if (!logic_if[latestif]) {
                                console.error("If statement should start with if block!");
                            } else {
                                logic_if[latestif].push({
                                    node: node
                                });

                                latestif++;
                            }
                            break;
                        case 'class':
                            if (!processedName[1]) {
                                console.error("No class defined!");
                            } else {
                                const className = processedName[1];
                                activeEventTransporter.dispatchEvent(new CustomEvent('registerListener', {
                                    detail: {
                                        type: 'data:updated',
                                        listener: async () => {
                                            const data = await new Promise(resolve => activeEventTransporter.dispatchEvent(new CustomEvent('retrieveData', { detail: { resolve } })));
                                            const scopeData = await new Promise(resolve => activeEventTransporter.dispatchEvent(new CustomEvent('retrieveScopeData', { detail: { resolve } })));
                                            let keys = Object.keys(data);
                                            keys.push('return ' + attribute.value);
                                            let runner = Function.apply({}, keys);
                                            try {
                                                let res = runner.apply(scopeData, Object.values(data));
                                                if (res) {
                                                    node.classList.add(className);
                                                } else {
                                                    node.classList.remove(className);
                                                }
                                            } catch(e) {
                                                console.error(e);
                                                node.style.display = 'none';
                                            }
                                        }
                                    }
                                }));
                            }
                            break;
                        case 'bind':
                            const attrName = processedName[1];
                            activeEventTransporter.dispatchEvent(new CustomEvent('registerListener', {
                                detail: {
                                    type: 'data:updated',
                                    listener: async () => {
                                        const data = await new Promise(resolve => activeEventTransporter.dispatchEvent(new CustomEvent('retrieveData', { detail: { resolve } })));
                                        const scopeData = await new Promise(resolve => activeEventTransporter.dispatchEvent(new CustomEvent('retrieveScopeData', { detail: { resolve } })));
                                        let keys = Object.keys(data);
                                        keys.push('return ' + attribute.value);
                                        let runner = Function.apply({}, keys);
                                        try {
                                            let res = runner.apply(scopeData, Object.values(data));
                                            node.setAttribute(attrName, res);
                                        } catch(e) {
                                            console.error(e);
                                            node.style.display = 'none';
                                        }
                                    }
                                }
                            }));
                            break;
                    }
                }
            });
        }
    });
}

export { Rable };
export default Rable;
