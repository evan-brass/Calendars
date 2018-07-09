"use strict";

const propSym = Symbol("Cascade: Cached property Values and local metadata");
const propagationSym = Symbol("Cascade: Property update propagation list");

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

export default function (propertyDefinitions, base = Object) {
	// Fundamental properties have their properties calculated at constructor call time.  That means that it's not a good spot for things that need DOM access.
	// Entrypoints into the dependency graph
	var fundamentals = [];

	// Class that we will be extending
	class Model extends base {
		constructor() {
			super();

			// Allow extending a model into a new model.  Not sure if this is useful yet.
			if (!this[propagationSym]) {
				this[propagationSym] = [];
			}

			// Update the values for all of our fundamental properties
			for (let prop of fundamentals) {
				// Put our default value into the cache
				// TODO: Not sure that this is going to be prop.cache or this[propCacheSym]
				prop.cache = prop.value instanceof Function ?
					prop.value.call(this) :
					prop.value;
			}
		}
	};

	// Construct the dependency/propagation graph
	let propWorkingSet = Object.keys(propertyDefinitions);

	// TODO: Check for circular dependencies and give an error

	// TODO: Bind computed properties' funcs with their dependencies

	// Copy the dependencies into our workDeps and change from names to object references
	for (let name of propWorkingSet) {
		let prop = propertyDefinitions[name];
		// Copy our array
		if (!(prop.dependencies instanceof Array)) {
			prop.dependencies = [];
		}
		prop.workDeps = Array.from(prop.dependencies);
	}

	// Depth helps sort the updating of properties removing double updates
	let depth = 0;
	while (propWorkingSet.length > 0) {
		// The properties of this depth that we need to remove (I have to remove them at the end of a depth layer so that we don't accidentally add elements into a layer that it doesn't belong to)
		let toRemove = [];

		// Find all the properties where its dependencies are already defined
		for (let i = 0; i < propWorkingSet.length;) {
			let name = propWorkingSet[i];
			// Shortcut directly to the property definition
			let def = propertyDefinitions[name];

			// Is this property one whos dependencies (if any) have already been added
			if (def.workDeps.length == 0) {

				// TODO: Need to calculate default values when our model's constructor is called, not while we are constucting the model.
				let setter;
				if (def.value !== undefined) {
					// Add this property to the fundamentals (TODO: Fundamental properties are by denfinition depth 0, so might want to check that later).
					fundamentals.push(def);

					// This is a regular property.  Give it a setter.
					setter = revalidateFunc(def);
				} else {
					// Since all our dependencies are already in, we can safely compute this property
					def.cache = def.func();
					def.revalidate = revalidateFunc(def);
				}

				/* TODO: Need to use our setters and getters for Cascade Views, not for models though
				// If someone's already set properties on our element, remove them so that we can use our setter
				if (this[name]) {
					def.default = this[name];
					delete this[name];
				}
				*/

				// The dependents arrays are being populated in passes so the properties should be sorted by dependency depth automatically.

				// This property has been added to the graph and can be removed from the working set
				toRemove.push(name);

				// Actually define the property
				Object.defineProperty(Model.prototype, name, {
					get: function () {
						return def.cache;
					},
					set: setter
				});
				def.dependents = [];
				def.depth = depth;

				// Remove this property from our working set
				propWorkingSet.splice(i, 1);
				// Splicing will shift everything forward so we should continue with the same i value
			} else {
				++i;
			}
		}

		// Remove the properties that we added in this pass from the dependencies of other properties and add those properties as dependents
		for (let key of propWorkingSet) {
			if (propertyDefinitions[key].dependencies) {
				for (let old of toRemove) {
					// If the property had the added property as a dependency...
					let index = propertyDefinitions[key].workDeps.indexOf(old);
					if (index != -1) {
						// ...add the property as a dependent of the added property and...
						propertyDefinitions[old].dependents.push(propertyDefinitions[key] );
						// ...remove the added property
						propertyDefinitions[key].workDeps.splice(index, 1);
					}
				}
			}
		}

		++depth;
	}

	return Model;


	// TODO: Clearer control flow for revalidation
	function revalidateFunc(definition) {
		// Figure out how to check if our cached value is different from the new value
		let equals = compareFunction(definition);

		return function (newVal = definition.func.apply(this, definition.dependencies.map(name => this[name]))) {
			// Handy references:
			const propagation = this[propagationSym];

			let oldVal = definition.cache;

			if (!equals(newVal, oldVal)) {
				// Update the cache
				definition.cache = newVal;

				// TODO: BEGIN Optimize this!
				// Add our dependents to the propagation list which are not already there
				for (let dependent of definition.dependents) {
					// TODO: Don't use indexOf.  We only need to check up till one after our depth is reached, then we can insert our new dependent into the propagations.  This is because the propagations will always be sorted and this will also keep the list sorted meaning that we wouldn't need to sort the propagations after pushing the new one.
					let index = propagation.indexOf(dependent);
					if (index == -1) {
						propagation.push(dependent);
					}
				}

				// Sort the list of properties that need to be updated by depth so that we never double update a property
				propagation.sort((A, B) =>
					A.depth - B.depth);
				// END Optimize this!

				// Update the properties that need updating
				while (propagation.length != 0) {
					let needsUpdate = propagation.shift();
					needsUpdate.revalidate.call(this);
				}
			}
		};
	}
}