"use strict";

const propCacheSym = Symbol("PropertyManager: Property Cache");

export default function (base) {
	return class PropertyManager extends base {
		constructor() {
			super();

			// Create an object to hold our property cache
			this[propCacheSym] = {};
		}
		getter(name) {
			return function () {
				return this[propCacheSym][name];
			};
		}
		setter(name, definition) {
			// Figure out how to check if our cached value is different from the new value
			var equals = this.compareFunction(definition);

			return function (newVal) {
				if (!equals(newVal, this[propCacheSym][name])) {
					this[propCacheSym][name] = newVal;
					this.dispatchEvent(new Event(name + '-changed'));
				}
			};
		}
		revalidate(name, definition) {
			let equals = this.compareFunction(definition);
			return function () {
				let oldVal = this[propCacheSym][name];
				let newVal = definition.func.call(this);
				if (!equals(oldVal, newVal)) {
					this[propCacheSym][name] = newVal;
					this.dispatchEvent(new Event(name + '-changed'));
				}
			};
		}
		compareFunction(definition) {
			if (definition.compare) {
				return definition.compare;
			} else if (definition.type == Date) {
				return (A, B) => (A.getTime() == B.getTime());
			}
			// Handle other datatypes
		}

		connectedCallback() {
			if (super.connectedCallback) {
				super.connectedCallback();
			}

			// Redefine the properties that we manage
			let definitions = this.getPropertyDefinitions();
			// List of computed properties that need to get their initial values
			let toCompute = [];
			for (let name of Object.keys(definitions)) {
				let def = definitions[name];

				let setter = undefined;
				if (def.default) {
					if (this[name]) {
						// If someone's already set properties on our element, then remove them so that we can use our setter
						def.default = this[name];
						delete this[name];
					}
					// Put our default value into the cache
					this[propCacheSym][name] = def.default instanceof Function ?
						def.default.call(this) :
						def.default;
					setter = this.setter(name, def)

				} else if (def.dependencies) {
					this.depends(this.revalidate(name, def), def.dependencies);
					toCompute.push(function () {
						this[propCacheSym][name] = def.func.call(this);
					});
				}
				Object.defineProperty(this, name, {
					get: this.getter(name),
					set: setter
				});
			}
			// Compute all our default properties now that our data properties are defined.
			toCompute.forEach(func => func.call(this), this);
		}
		depends(func, dependencies) {
			for (let dep of dependencies) {
				this.addEventListener(dep + '-changed', func);
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