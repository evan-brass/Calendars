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

const Calendar = Cascade({
	'basis': {
		type: Date,
		value: new Date()
	},
	'visibleStart': {
		type: Date,
		dependencies: ['basis'],
		func: function (basis) {
			let visibleStart = new Date(basis);
			// Track to the first day of the month
			visibleStart.setDate(1);
			// Move to the first day of the week preceeding the first day of the month
			visibleStart.setDate(visibleStart.getDate() - visibleStart.getDay());
			// Set the time to the first milisecond of that day (This is complicated due to flipping daylight savings time.)
			visibleStart.setHours(0, 0, 0, 0);
			return visibleStart;
		}
	},
	'visibleEnd': {
		type: Date,
		dependencies: ['visibleStart'],
		func: function (visibleStart) {
			// Copy the visible start
			let end = new Date(visibleStart);
			// Move to one past the last visible date
			end.setDate(end.getDate() + (7 * 6));
			// Get the last milisecond of the last visible date
			end.setHours(0, 0, 0, -1);
			return end;
		}
	},
	'visibleDays': {
		type: Function,
		dependencies: ['visibleStart', 'visibleEnd'],
		func: function (visibleStart, visibleEnd) {
			return function* () {
				let i = new Date(visibleStart);
				while (i < visibleEnd) {
					yield new Date(i);
					i.setDate(i.getDate() + 1);
				}
			}
		}
	},
	'visibleEventsMeta': {
		type: Array,
		value: []
	}
});
window.CalendarModel = Calendar

window.cal = new Calendar();