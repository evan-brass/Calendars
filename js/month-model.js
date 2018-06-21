"use strict";

import PropertyMixin from "./property-mixin.js";

// Mixin: Month Model
export default function (base) {
	return class MonthModel extends PropertyMixin(base) {
		constructor() {
			super();
		}
		connectedCallback() {
			if (super.connectedCallback) {
				super.connectedCallback();
			}
		}
		static get properties() {
			return {
				'basis': {
					type: Date,
					default: new Date()
				},
				'visibleStart': {
					type: Date,
					dependencies: ['basis'],
					func: function() {
						let visibleStart = new Date(this.basis);
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
					func: function() {
						// Copy the visible start
						let end = new Date(this.visibleStart);
						// Move to one past the last visible date
						end.setDate(end.getDate() + (7 * 6));
						// Get the last milisecond of the last visible date
						end.setHours(0, 0, 0, -1);
						return end;
					}
				}
			};
		}
		*visibleDays() {
			let i = new Date(this.visibleStart);
			while (i < this.visibleEnd) {
				yield i;
				i.setDate(i.getDate() + 1);
			}
		}
		*visibleEvents() {
			// TODO: Need to observe children and yield some sort of metadata object
		}
	}
};