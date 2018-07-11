"use strict";
// Replaced by layers
//const graphSym = Symbol("Cascade: Access the graph of this model.  Used to extend a model.");
const propagationSym = Symbol("Cascade: Property update propagation list");

// Kinds of property definitions
const Kind = {
	Fundamental: 0,
	Computed: 1,
	User: 2
//	Needed: 3
};

// Has some basic comparison functions which we can use to check if a property's value has changed.
function compareFunction(def) {
	if (def.compare) {
		return def.compare;
	} else if (def.type == Date) {
		return (A, B) => (A.getTime() == B.getTime());
	} else if (def.type == Array || def.type == HTMLCollection) {
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

// 
function revalidateFunc(def) {
	// Insert a *sorted* dependents array into our propagation 
	function addDependents(propagation, dependents) {
		let i = 0;

		dependency:
		for (let dep of dependents) {
			while (i < propagation.length) {
				if (propagation[i] === dep) {
					break dependency;
				}
				if (propagation[i].depth > dep.depth) {
					--i;
					break;
				}
			}
			if (i == propagation.length) {
				propagation.push(dep);
			} else {
				propagation.splice(i, 0, dep);
			}
		}
	}

	// Consume the propagation list while items may be added to it.
	function* propagationIterator(propagation) {
		while (propagation.length != 0) {
			yield propagation.shift();
		}
	}

	// Figure out how to check if our cached value is different from the new value
	let equals = compareFunction(def);
	const isComputed = def.kind === Kind.Computed;

	return function (newVal) {

		// Handy references:
		const propagation = this[propagationSym];

		let oldVal = this._cache[def.name];

		// Get an update version of a computed value
		// TODO: Extract all of this logic into multiple functions so that it isn't performed for all properties.  After all, the whole point of using a function which returns a function is that only the work that needs to be done each time is actually done.
		if (isComputed) {
			let inputs = def.dependencies.map(name => this[name]);
			if (oldVal === undefined) {
				// Cal func if we've never computed this property before.
				newVal = def.func.apply(this, inputs);
			} else {
				// Otherwise patch the previous value given the new information.
				// While func should be a pure function, patch is not necessarily.  For that reason we can store (locally in a closure of the patch function) the previous values that func/patch was given or do whatever we want.  Just be careful/considerate.
				newVal = def.patch.apply(this, [oldVal].concat(inputs));
			}
		}

		// Has the property's value actually changed?
		if (!equals(newVal, oldVal)) {
			// Update the cache
			this._cache.set(def, newVal);

			// Add our dependents
			addDependents(propagation, def.dependents);

			// Update the properties that need updating
			for (let prop of propagationIterator(propagation)) {
				switch (prop.kind) {
					case Kind.Fundamental:
						throw new Error("Attempted to update a fundamental property: ");

					case Kind.Computed:
						prop.revalidate.call(this);
						break;

					/*
					case Kinds.Needed:
						throw new Error("Attempted to update a needed property: Cascade should have given you an error earlier.");
					*/

					case Kinds.User:
						// TODO: Re-call user with new values
						break;

					default:
						throw new Error("Unrecognized Property Kind: This is likely a bug in Cascade.");
				}
			}
		};
	}
}

function determineKind(def) {
	if (def.type === undefined || def.name === undefined) {
		throw new Error("Definition");
	} else if (def.value !== undefined) {
		if (def.func !== undefined || def.patch !== undefined) {
			throw new Error("A Fundamental Property must not have a func or a patch method");
		}
		return Kind.Fundamental;
	} else if (def.func !== undefined) {
		if (def.value !== undefined || def.readOnly !== undefined) {
			throw new Error("A Computed Property must not have a value or a readOnly property");
		}
		return Kind.Computed;
	} else {
		throw new Error("Unknown kind");
	}
}

export default function (propertyDefinitions, base = Object) {
	// Fundamental (depth 0) properties have their properties calculated at constructor call time.  That means that it's not a good spot for things that need DOM access.

	// Class that we will be extending
	class Model extends base {
		constructor() {
			super();

			// Allow extending a model into a new model.  Not sure if this is useful yet.
			if (!this[propagationSym]) {
				this[propagationSym] = [];
			}

			// TODO: Replace with module level symbols?
			this._cache = new Map();
			this._users = new Map();

			// Update the values for all of our fundamental properties
			for (let prop of this.layers[0]) {
				// Put our default value into the cache
				// TODO: Not sure that this is going to be prop.cache or this[propCacheSym]
				this._cache.set(prop, prop.value instanceof Function ?
					prop.value.call(this) :
					prop.value);
			}
		}
		use(deps, func) {
			// TODO: Implement
		}
	}

	// Construct the dependency/propagation graph
	let propWorkingSet = Object.keys(propertyDefinitions);

	// TODO: Check for circular dependencies and give an error

	// TODO: Check to make sure that overriding properties properly match the definition of what they're overriding.

	// Copy the dependencies into our workDeps and set the name property of all the definitions
	for (let name of propWorkingSet) {
		let prop = propertyDefinitions[name];

		// Set the name property (Used to override properties)
		prop.name = name;

		// determine the property's kind
		prop.kind = determineKind(prop);

		// Copy our array
		if (!(prop.dependencies instanceof Array)) {
			prop.dependencies = [];
		}
		prop.workDeps = Array.from(prop.dependencies);
	}

	// Define the layers:
	Model.prototype.layers = [];
	const layers = Model.prototype.layers;
	Model.prototype.depths = new Map();
	const depths = Model.prototype.depths;

	// Depth helps sort the updating of properties removing double updates
	let depth = 0;
	while (propWorkingSet.length > 0) {

		// Create a new layer
		const layer = new Set();
		layers[depth] = layer;

		// Find all the properties where its dependencies are already defined
		for (let i = 0; i < propWorkingSet.length;) {
			let name = propWorkingSet[i];
			// Shortcut directly to the property definition
			let def = propertyDefinitions[name];

			// Is this property one whos dependencies (if any) have already been added
			if (def.workDeps.length == 0) {

				// Add the definition to the layer
				layer.add(def);

				let setter;
				switch (def.kind) {
					case Kind.Fundamental:
						// Give it a setter.
						setter = revalidateFunc(def);
						break;
					case Kind.Computed:
						def.revalidate = revalidateFunc(def);
						// TODO: Allow setters for computed properties?
						break;
					default:
						throw new Error("Blah...");
				}

				// Actually define the property
				Object.defineProperty(Model.prototype, name, {
					get: function () {
						return this._cache.get(def);
					},
					set: setter
				});
				def.dependents = [];
				depths.set(def, depth);

				// Remove this property from our working set
				propWorkingSet.splice(i, 1);

				// Splicing will shift everything down (in index position) so we should continue with the same index
			} else {
				++i;
			}
		}

		// Remove the properties that we added in this pass from the dependencies of other properties and add those properties as dependents
		for (let key of propWorkingSet) {
			const 
			if (propertyDefinitions[key].dependencies) {
				for (let old of layer) {
					// If the property had the added property as a dependency...
					let index = propertyDefinitions[key].workDeps.indexOf(old.name);
					if (index != -1) {
						// ...add the property as a dependent of the added property and...
						old.dependents.push(propertyDefinitions[key] );
						// ...remove the added property
						propertyDefinitions[key].workDeps.splice(index, 1);
					}
				}
			}
		}

		++depth;
	}

	console.log(propertyDefinitions);

	// Return the model we've made
	return Model;
}