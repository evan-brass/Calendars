"use strict";

const propSym = Symbol("PropertyManager: Property meta");
const propagationSym = Symbol("PropertyManager: Property update propagation list");

function compareFunction(definition) {
	if (definition.compare) {
		return definition.compare;
	} else if (definition.type == Date) {
		return (A, B) => (A.getTime() == B.getTime());
	} else if (definition.type == Array || definition.type == HTMLCollection) {
		return function (A, B) {
			if (A.length == B.length) {
				for (let i = 0; i < A.length; ++i) {
					if (A[i] != B[i]) {
						return false;
					}
				}
				return true;
			}
			return false;
		};
	} else {
		return (A, B) => A == B;
	}
	// TODO: Handle other datatypes
}

export default function (base) {
	return class Cascade extends base {
		constructor() {
			super();

			this[propagationSym] = [];
		}
		getter(name) {
			return () => {
				return this[propSym][name].cache;
			};
		}
		revalidateFunc(name) {
			// Store references to objects that we need often
			const props = this[propSym];
			const propagations = this[propagationSym];

			const definition = props[name];
			// Figure out how to check if our cached value is different from the new value
			let equals = compareFunction(definition);

			return (newVal = props[name].func()) => {
				let oldVal = props[name].cache;

				if (!equals(newVal, oldVal)) {
					// Update the cache
					props[name].cache = newVal;

					// Add our dependents to the propagation list which are not already there
					for (let dependent of definition.dependents) {
						let index = propagations.indexOf(dependent);
						if (index == -1) {
							propagations.push(dependent);
						}
					}

					// Sort the list of properties that need to be updated by depth so that we never double update a property
					propagations.sort((A, B) =>
						props[A].depth - props[B].depth);

					// Update the properties that need updating
					while (propagations.length != 0) {
						let needsUpdate = propagations.shift();
						props[needsUpdate].revalidate();
					}
				}
			};
		}

		connectedCallback() {
			if (super.connectedCallback) {
				super.connectedCallback();
			}

			// Create an object to hold our property cache
			this[propSym] = this.getPropertyDefinitions();
			const props = this[propSym];

			let keys = Object.keys(props);

			// Encapsulate all the computed property functions to be bound with their dependencies passed as parameters
			for (let key of keys) {
				if (props[key].dependencies) {
					// Copy the dependencies (because we're going to remove it from the definitions later)
					let deps = Array.from(props[key].dependencies);
					let oldFunc = props[key].func;
					props[key].func = () => {
						return oldFunc.apply(this, deps.map(name => this[name])); // Hopefully this isn't too slow.
					}
				}
			}
			// Depth helps sort the updating of properties
			let depth = 0;
			while (keys.length > 0) {
				let toRemove = [];
				++depth;

				// Find all the properties where its dependencies are already defined
				for (let i = 0; i < keys.length; ) {
					let name = keys[i];
					let def = props[name];

					let setter = undefined;

					// Is this property one whos dependencies (if any) have already been added
					if (def.default || def.dependencies.length == 0) {

						if (def.default) {
							// Put our default value into the cache
							def.cache = def.default instanceof Function ?
								def.default.call(this) :
								def.default;
							// This is a regular property.  Give it a setter.
							setter = this.revalidateFunc(name)
						} else {
							// Since all our dependencies are already in, we can safely compute this property
							def.cache = def.func();
							def.revalidate = this.revalidateFunc(name);
						}

						// If someone's already set properties on our element, remove them so that we can use our setter
						if (this[name]) {
							def.default = this[name];
							delete this[name];
						}

						// The dependents arrays are being populated in passes so the properties should be sorted by dependency depth automatically.

						toRemove.push(name);
						Object.defineProperty(this, name, {
							get: this.getter(name),
							set: setter
						});
						props[name].dependents = [];
						props[name].depth = depth;

						// Remove this property from our working set
						keys.splice(i, 1);
						continue;
					}
					++i;
				}

				// Remove the properties that we added in this pass from the dependencies of other properties and add those properties as dependents
				for (let key of keys) {
					if (props[key].dependencies) {
						for (let old of toRemove) {
							// If the property had the added property as a dependency...
							let index = props[key].dependencies.indexOf(old);
							if (index != -1) {
								// ...add the property as a dependent of the added property and...
								props[old].dependents.push(key);
								// ...remove the added property
								props[key].dependencies.splice(index, 1);
							}
						}
					}
				}
			}
		}
		getPropertyDefinitions() {
			let object = this;
			let props = {};
			while (object != Object.prototype) {
				if (object.constructor.properties) {
					Object.assign(props, object.constructor.properties);
				}
				object = Object.getPrototypeOf(object);
			}
			return props;
		}
	};
}