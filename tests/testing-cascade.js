import Cascade from "../js/cascade.js";

const Pet = Cascade({
	"name": {
		type: String,
		value: "hasn't been named"
	},
	"owner": {
		type: Object,
		value: null
	},
	"noise": {
		type: String,
		value: null
	},
	"speak": {
		type: Function,
		dependencies: ["name", "noise"],
		func: function (name, noise) {
			return function () {
				console.log(noise ? `${name} says ${noise}.` : `Hi, I'm ${name}.`);
			}
		}
	}
});

const Dog = Cascade({
	"noise": {
		type: String,
		value: "Bark!",
		readOnly: true
	}
}, Pet);

let alfred = new Dog();
alfred.name = "alfred";


window.alfred = alfred;

console.log(alfred);