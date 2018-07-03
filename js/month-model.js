"use strict";

// Mixin: Month Model
export default function (base) {
	return class MonthModel extends base {
		constructor() {
			super();

			// Mutation Observer to keep track of the event-meta elements as they come and go
			this.mo = new MutationObserver(this.updateMetaTimestamp.bind(this));
		}
		connectedCallback() {
			if (super.connectedCallback) {
				super.connectedCallback();
			}

			// Activate our MutationObserver
			this.mo.observe(this, {
				childList: true,
				subtree: true
			});
			// And register an event handle so that connectors can notify the calendar that they have new (or no longer have) events.
			this.addEventListener('eventmeta-changed', this.updateMetaTimestamp.bind(this));
		}
		disconnectedCallback() {
			if (super.disconnectedCallback) {
				super.disconnectedCallback();
			}

			this.mo.disconnect();
		}
		static get properties() {
			return {
				basis: {
					type: Date,
					value: new Date()
				},
				visibleStart: {
					type: Date,
					computed: 'calcVisibleStart(basis)'
				},
				visibleEnd: {
					type: Date,
					computed: 'calcVisibleEnd(visibleStart)'
				},
				metaTimestamp: {
					type: Number
				},
				visibleEventsMeta: {
					type: Array,
					computed: 'calcVisibleEventsMeta(visibleStart, visibleEnd, metaTimestamp)'
				}
			};
		}
		calcVisibleStart(basis) {
			let visibleStart = new Date(basis);
			// Track to the first day of the month
			visibleStart.setDate(1);
			// Move to the first day of the week preceeding the first day of the month
			visibleStart.setDate(visibleStart.getDate() - visibleStart.getDay());
			// Set the time to the first milisecond of that day (This is complicated due to flipping daylight savings time.)
			visibleStart.setHours(0, 0, 0, 0);
			return visibleStart;
		}
		calcVisibleEnd(visibleStart) {
			// Copy the visible start
			let end = new Date(this.visibleStart);
			// Move to one past the last visible date
			end.setDate(end.getDate() + (7 * 6));
			// Get the last milisecond of the last visible date
			end.setHours(0, 0, 0, -1);
			return end;
		}
		async calcVisibleEventsMeta(visibleStart, visibleEnd, childrenTimestamp) {
			// We should only be getting children change events anyway
			// TODO: Use an actual invalidation scheme here

			// Get all the children of the calendar...
			let metalist = (await Promise.all(Array.from(this.children)
				// ... that have a visibleEvents function.
				.filter(el => (el.visibleEvents &&
					el.visibleEvents instanceof Function))
				// Call the asyncronouse visibleEvents function which gives us an array of arrays which we...
				.map(async el =>
					await el.visibleEvents(visibleStart, visibleEnd)
				)))
				// ... concatinate into a flattened array and...
				.reduce((metalist, sublist) => metalist.concat(sublist), [])
				// ... sort into what our sorting expects.
				.sort((a, b) => {
					// NOTE: I believe that there is some redundancy and error in this sorting.  I'll need to play around with it for a while to get something that works most, if not all, of the time.  I just don't have a good enough grasp of the pertinent variables.  This is too complex for me to fully reason out so I'm falling back onto trial and error.
					// TODO: Build a test event suite to verify that this is actually working in all the ways that I hope it does.
					const aMultiday = this.multiday(a);
					const bMultiday = this.multiday(b);
					if (aMultiday && !bMultiday) {
						return -1;
					} else if (!aMultiday && bMultiday) {
						return 1;
					} else if (aMultiday && bMultiday) {
						// Which multiday event should go first
						return a.start - b.start; // Whichever comes first?
					} else {
						if (a.end < b.start) {
							return -1;
						} else if (a.start > a.end) {
							return 1;
						} else { // They overlap at least some
							return a.start - b.start;
						}
					}
				});
			this.visibleEventsMeta = metalist;
		}
		updateMetaTimestamp() {
			this.metaTimestamp = Date.now();
		}
		isSameDay(A, B) {
			return (A.getDate() == B.getDate() &&
				A.getMonth() == B.getMonth() &&
				A.getFullYear() == B.getFullYear());
		}
		multiday(x) {
			return !this.isSameDay(x.start, x.end);
		}
		*visibleDays() {
			let i = new Date(this.visibleStart);
			while (i < this.visibleEnd) {
				yield i;
				i.setDate(i.getDate() + 1);
			}
		}
	}
};